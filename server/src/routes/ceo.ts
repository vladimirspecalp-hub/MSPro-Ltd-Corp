import { Router } from "express";
import { z } from "zod";
import type { Db } from "@msproltd/db";
import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import { badRequest, HttpError } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";

/**
 * P-2026-017 F6.1: «Спросить Гендира» backend.
 *
 * POST /api/companies/:companyId/ceo/ask  { question }
 *   → { answer, citations[], durationMs, model }
 *
 * Pipeline:
 *   user prompt → Ollama /api/chat (qwen3:14b) с tools (obsidian_search,
 *   obsidian_get_file_contents). При tool_calls вызываем Obsidian Local REST
 *   API (плагин на 27124/HTTPS), результат возвращаем модели как `tool` сообщение,
 *   повторяем до финального ответа без tool_calls (max 4 шага).
 *
 * Tools напрямую бьют в Obsidian Local REST API (плагин). MCP-сервер
 * (mcp-obsidian) — это враппер той же REST API, тут он не нужен в server-side
 * рантайме.
 */

const ceoAskSchema = z.object({
  question: z.string().trim().min(1, "question is required").max(4000),
});

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:14b";
const OBSIDIAN_API_URL =
  process.env.OBSIDIAN_API_URL ?? "https://127.0.0.1:27124";
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY ?? "";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? "60000");
const OBSIDIAN_TIMEOUT_MS = Number(process.env.OBSIDIAN_TIMEOUT_MS ?? "10000");
const MAX_TOOL_ITERATIONS = 4;
const MAX_TOOL_RESULT_CHARS = 8000;

const SYSTEM_PROMPT = [
  "Ты — Гендиректор компании MSPRO. Отвечай на русском языке.",
  "У тебя есть инструменты для поиска и чтения заметок Obsidian-vault компании:",
  "  • obsidian_search(query) — полнотекстовый поиск по vault",
  "  • obsidian_get_file_contents(filename) — прочитать конкретную заметку",
  "Когда вопрос касается истории, решений, планов компании — ОБЯЗАТЕЛЬНО используй",
  "поиск и чтение заметок, а не выдумывай факты.",
  "В финальном ответе:",
  "  — приводи цитаты в формате [[относительный/путь/без/расширения]],",
  "  — не выдумывай ссылки, если не нашёл подтверждения в vault — так и скажи,",
  "  — будь краток (1-3 абзаца), без воды.",
].join("\n");

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "obsidian_search",
      description:
        "Полнотекстовый поиск по Obsidian vault компании. Возвращает релевантные файлы и фрагменты.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Поисковая строка на русском или английском",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obsidian_get_file_contents",
      description:
        "Прочитать содержимое конкретного файла из Obsidian vault. filename — путь относительно корня vault, например 'ceo/vault/decisions-log.md'.",
      parameters: {
        type: "object",
        properties: {
          filename: {
            type: "string",
            description: "Путь файла относительно корня vault, с расширением .md",
          },
        },
        required: ["filename"],
      },
    },
  },
];

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown> | string;
  };
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaChatResponse {
  model: string;
  message: OllamaChatMessage;
  done: boolean;
  total_duration?: number;
}

// Obsidian Local REST API plugin использует self-signed сертификат на 27124.
// Доверяем только localhost, поэтому отключаем проверку TLS для этого агента.
const obsidianHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

async function callOllama(messages: OllamaChatMessage[]): Promise<OllamaChatResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
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
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(
        502,
        `Ollama ${res.status}: ${text.slice(0, 500) || res.statusText}`,
      );
    }
    return (await res.json()) as OllamaChatResponse;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if ((err as Error)?.name === "AbortError") {
      throw new HttpError(504, `Ollama timeout after ${OLLAMA_TIMEOUT_MS}ms`);
    }
    throw new HttpError(
      502,
      `Ollama unreachable at ${OLLAMA_URL}: ${(err as Error)?.message ?? err}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function obsidianFetch(path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    if (!OBSIDIAN_API_KEY) {
      resolve({
        status: 0,
        body: "OBSIDIAN_API_KEY не задан в env сервера — vault недоступен.",
      });
      return;
    }
    const fullUrl = `${OBSIDIAN_API_URL.replace(/\/+$/, "")}${path}`;
    let parsed: URL;
    try {
      parsed = new URL(fullUrl);
    } catch (err) {
      resolve({ status: 0, body: `Invalid OBSIDIAN_API_URL: ${(err as Error).message}` });
      return;
    }
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
          Accept: "application/json, text/markdown, text/plain;q=0.9",
        },
        ...(isHttps ? { agent: obsidianHttpsAgent } : {}),
      },
      (resp) => {
        const chunks: Buffer[] = [];
        resp.on("data", (c: Buffer) => chunks.push(c));
        resp.on("end", () => {
          resolve({
            status: resp.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", (err) => {
      resolve({
        status: 0,
        body: `Obsidian unreachable at ${OBSIDIAN_API_URL}: ${err.message}`,
      });
    });
    req.setTimeout(OBSIDIAN_TIMEOUT_MS, () => {
      req.destroy();
      resolve({ status: 0, body: `Obsidian timeout after ${OBSIDIAN_TIMEOUT_MS}ms` });
    });
    req.end();
  });
}

interface ToolHits {
  files: Set<string>;
  excerpts: Map<string, string>;
}

function parseArgs(raw: OllamaToolCall["function"]["arguments"]): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw ?? {};
}

function truncate(text: string, max = MAX_TOOL_RESULT_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

async function execToolCall(
  call: OllamaToolCall,
  hits: ToolHits,
): Promise<string> {
  const name = call.function.name;
  const args = parseArgs(call.function.arguments);

  if (name === "obsidian_search") {
    const query = String(args.query ?? "").trim();
    if (!query) return JSON.stringify({ error: "empty query" });
    const r = await obsidianFetch(
      `/search/simple/?query=${encodeURIComponent(query)}&contextLength=200`,
    );
    if (r.status !== 200) {
      return JSON.stringify({ error: `obsidian_search ${r.status}`, detail: r.body.slice(0, 400) });
    }
    try {
      const parsed = JSON.parse(r.body) as Array<{
        filename?: string;
        score?: number;
        matches?: Array<{ context?: string }>;
      }>;
      const top = parsed.slice(0, 8).map((hit) => {
        if (hit.filename) {
          hits.files.add(hit.filename);
          const ctx = hit.matches?.[0]?.context;
          if (ctx && !hits.excerpts.has(hit.filename)) {
            hits.excerpts.set(hit.filename, ctx.slice(0, 300));
          }
        }
        return {
          filename: hit.filename,
          score: hit.score,
          context: hit.matches?.[0]?.context?.slice(0, 300),
        };
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
    if (r.status !== 200) {
      return JSON.stringify({
        error: `obsidian_get_file_contents ${r.status}`,
        filename,
        detail: r.body.slice(0, 400),
      });
    }
    hits.files.add(filename);
    return truncate(r.body);
  }

  return JSON.stringify({ error: `unknown tool: ${name}` });
}

function wikilinkFromPath(filepath: string): string {
  return filepath.replace(/\.md$/i, "");
}

export function ceoRoutes(_db: Db) {
  const router = Router();

  router.post(
    "/:companyId/ceo/ask",
    validate(ceoAskSchema),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);

        const { question } = req.body as z.infer<typeof ceoAskSchema>;
        const startedAt = Date.now();

        const messages: OllamaChatMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question },
        ];
        const hits: ToolHits = { files: new Set(), excerpts: new Map() };

        let final: OllamaChatResponse | null = null;
        for (let step = 0; step < MAX_TOOL_ITERATIONS; step++) {
          const resp = await callOllama(messages);
          messages.push(resp.message);

          const calls = resp.message.tool_calls ?? [];
          if (calls.length === 0) {
            final = resp;
            break;
          }
          for (const call of calls) {
            const toolResult = await execToolCall(call, hits);
            messages.push({ role: "tool", content: toolResult });
          }
        }

        if (!final) {
          throw new HttpError(
            504,
            `Не получилось получить финальный ответ за ${MAX_TOOL_ITERATIONS} итераций tool-calling`,
          );
        }

        const durationMs = Date.now() - startedAt;
        const citations = Array.from(hits.files).map((filename) => ({
          wikilink: wikilinkFromPath(filename),
          excerpt: hits.excerpts.get(filename),
        }));

        res.json({
          answer: final.message.content ?? "",
          citations,
          durationMs,
          model: final.model ?? OLLAMA_MODEL,
        });
      } catch (err) {
        if (err instanceof HttpError) {
          res.status(err.status).json({ error: err.message, details: err.details });
          return;
        }
        if ((err as { name?: string })?.name === "ZodError") {
          next(badRequest("invalid ceo/ask request", err));
          return;
        }
        next(err);
      }
    },
  );

  return router;
}
