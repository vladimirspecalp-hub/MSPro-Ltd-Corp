// Smoke test for local_llm adapter — P-2026-017 F2 acceptance.
// Imports the compiled adapter execute() with a minimal AdapterExecutionContext
// and prints elapsed ms + first 200 chars of the response.
//
// Run: cd server && node scripts/smoke-local-llm.mjs
//
// Note: imports are resolved against TypeScript sources via tsx so we don't
// need a build step. Falls back to a fresh tsx invocation if not installed.

import { execute } from "../src/adapters/local-llm/execute.ts";

const onLog = async (stream, chunk) => process[stream === "stdout" ? "stdout" : "stderr"].write(chunk);
const onMeta = async (meta) => console.error(`[meta] ${JSON.stringify(meta)}`);

const ctx = {
  runId: "smoke-local-llm",
  agent: { id: "smoke", name: "smoke", adapterType: "local_llm", config: {} },
  runtime: {},
  config: { model: "qwen3:14b", stream: true, temperature: 0.1, timeoutMs: 30_000 },
  context: { prompt: "Скажи коротко: сколько будет 2+2? Ответь одним числом." },
  onLog,
  onMeta,
};

const startedAt = Date.now();
const result = await execute(ctx);
const elapsed = Date.now() - startedAt;

console.error(`\n[result] elapsed=${elapsed}ms exitCode=${result.exitCode} summary=${result.summary ?? ""}`);
console.error(`[result.message] ${(result.resultJson?.message ?? "").slice(0, 300)}`);
console.error(`[acceptance] under_10s=${elapsed < 10_000} non_empty=${(result.resultJson?.message ?? "").length > 0}`);
process.exit(result.exitCode ?? 0);
