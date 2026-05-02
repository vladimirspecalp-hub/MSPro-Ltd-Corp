// Smoke test for POST /api/companies/:companyId/ceo/ask (MSP-214 F6.1).
// Standalone — поднимает мини-сервер с маршрутом ceoRoutes и шлёт тестовый
// запрос. Тестирует, что pipeline (Express → Ollama → tool-calls → ответ)
// работает end-to-end без полного билда @msproltd/server.

import express from "express";

// declare global-ish actor on Request for assertCompanyAccess
const COMPANY_ID = "9bdd1254-4b9d-490d-aafa-04e26c81c329";
const PORT = 4747;

// Inline copy of ceo.ts (transpiled by hand, no TS), чтобы не цеплять билд
// сломанных src/services/*.ts. Логика идентична src/routes/ceo.ts.
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:14b";
const OBSIDIAN_API_URL =
  process.env.OBSIDIAN_API_URL ?? "https://127.0.0.1:27124";
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY ?? "";
const MAX_TOOL_ITERATIONS = 4;
const MAX_TOOL_RESULT_CHARS = 8000;
const OLLAMA_TIMEOUT_MS = 300_000;
const OBSIDIAN_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = [
  "Ты — Гендиректор компании MSPRO. Отвечай на русском языке.",
  "У тебя есть инструменты obsidian_search(query) и obsidian_get_file_contents(filename).",
  "Когда вопрос касается истории/решений компании — используй поиск и чтение, не выдумывай.",
  "Цитируй [[относительный/путь/без/расширения]]. Будь краток (1-3 абзаца).",
].join("\n");

const TOOLS = [
  {
    type: "function",
    function: {
      name: "obsidian_search",
      description: "Полнотекстовый поиск по Obsidian vault.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obsidian_get_file_contents",
      description: "Прочитать файл из vault. filename — путь от корня, с .md.",
      parameters: {
        type: "object",
        properties: { filename: { type: "string" } },
        required: ["filename"],
      },
    },
  },
];

const obsidianAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function obsidianFetch(path) {
  return new Promise((resolve) => {
    if (!OBSIDIAN_API_KEY) {
      resolve({ status: 0, body: "OBSIDIAN_API_KEY not set" });
      return;
    }
    const fullUrl = `${OBSIDIAN_API_URL.replace(/\/+$/, "")}${path}`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
          Accept: "application/json, text/markdown",
        },
        ...(isHttps ? { agent: obsidianAgent } : {}),
      },
      (resp) => {
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () =>
          resolve({
            status: resp.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", (err) => resolve({ status: 0, body: `error: ${err.message}` }));
    req.setTimeout(OBSIDIAN_TIMEOUT_MS, () => {
      req.destroy();
      resolve({ status: 0, body: "timeout" });
    });
    req.end();
  });
}

async function callOllama(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        tools: TOOLS,
        stream: false,
        options: { temperature: 0.3 },
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`ollama ${r.status}: ${await r.text()}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseArgs(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

function truncate(s, max = MAX_TOOL_RESULT_CHARS) {
  return s.length > max ? s.slice(0, max) + "\n…[truncated]" : s;
}

async function execTool(call, hits) {
  const name = call.function.name;
  const args = parseArgs(call.function.arguments);
  if (name === "obsidian_search") {
    const query = String(args.query ?? "").trim();
    if (!query) return JSON.stringify({ error: "empty query" });
    const r = await obsidianFetch(
      `/search/simple/?query=${encodeURIComponent(query)}&contextLength=200`,
    );
    if (r.status !== 200) return JSON.stringify({ error: `search ${r.status}`, detail: r.body.slice(0, 400) });
    try {
      const parsed = JSON.parse(r.body);
      const top = parsed.slice(0, 8).map((h) => {
        if (h.filename) hits.add(h.filename);
        return { filename: h.filename, score: h.score, context: h.matches?.[0]?.context?.slice(0, 300) };
      });
      return truncate(JSON.stringify({ results: top }));
    } catch {
      return truncate(r.body);
    }
  }
  if (name === "obsidian_get_file_contents") {
    const filename = String(args.filename ?? "").trim().replace(/^\/+/, "");
    if (!filename) return JSON.stringify({ error: "empty filename" });
    const r = await obsidianFetch(`/vault/${encodeURI(filename)}`);
    if (r.status !== 200) return JSON.stringify({ error: `get ${r.status}`, filename });
    hits.add(filename);
    return truncate(r.body);
  }
  return JSON.stringify({ error: `unknown tool ${name}` });
}

const app = express();
app.use(express.json());
app.post("/api/companies/:companyId/ceo/ask", async (req, res) => {
  try {
    const question = (req.body?.question ?? "").trim();
    if (!question) return res.status(400).json({ error: "question required" });
    const startedAt = Date.now();
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: question },
    ];
    const hits = new Set();
    let final = null;
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const resp = await callOllama(messages);
      messages.push(resp.message);
      const calls = resp.message.tool_calls ?? [];
      console.log(
        `[step ${i}] tool_calls=${calls.length} content_len=${(resp.message.content ?? "").length}`,
      );
      if (calls.length === 0) {
        final = resp;
        break;
      }
      for (const c of calls) {
        console.log(`  → tool ${c.function.name} args=${JSON.stringify(c.function.arguments)}`);
        const out = await execTool(c, hits);
        console.log(`    ← ${out.length} chars`);
        messages.push({ role: "tool", content: out });
      }
    }
    if (!final) return res.status(504).json({ error: "no final answer" });
    res.json({
      answer: final.message.content ?? "",
      citations: [...hits].map((f) => ({ wikilink: f.replace(/\.md$/i, "") })),
      durationMs: Date.now() - startedAt,
      model: final.model ?? OLLAMA_MODEL,
    });
  } catch (e) {
    console.error("ERR:", e);
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

const server = app.listen(PORT, "127.0.0.1", async () => {
  console.log(`smoke server on :${PORT}`);
  const url = `http://127.0.0.1:${PORT}/api/companies/${COMPANY_ID}/ceo/ask`;
  console.log(`POST ${url}`);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question:
          "Найди в vault информацию: когда designer сдал v2 калькулятор? Поищи через obsidian_search.",
      }),
    });
    const j = await r.json();
    console.log("=== RESPONSE ===");
    console.log(JSON.stringify(j, null, 2));
  } catch (e) {
    console.error("REQ ERR:", e);
  } finally {
    server.close();
  }
});
