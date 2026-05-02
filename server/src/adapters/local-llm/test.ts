import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

/**
 * Probe the Ollama server via OpenAI-compat endpoint.
 *
 * Two-stage check:
 *  1. GET {baseUrl}/models — verifies Ollama daemon is alive.
 *  2. confirm requested model id appears in returned list (warns when absent so
 *     the operator can `ollama pull <model>`).
 */
export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const baseUrl = asString(config.baseUrl, "http://localhost:11434/v1").replace(/\/+$/, "");
  const model = asString(config.model, "qwen3:14b");

  let modelsList: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${asString(config.apiKey, "ollama")}` },
    });
    if (!res.ok) {
      checks.push({
        code: "local_llm_daemon_unreachable",
        level: "error",
        message: `Ollama responded ${res.status} at ${baseUrl}/models`,
        hint: "Ensure `ollama serve` is running and listening on the configured baseUrl.",
      });
    } else {
      const json = (await res.json()) as { data?: Array<{ id?: string }> };
      modelsList = (json.data ?? []).map((m) => m.id ?? "").filter(Boolean);
      checks.push({
        code: "local_llm_daemon_reachable",
        level: "info",
        message: `Ollama reachable; ${modelsList.length} model(s) available`,
        detail: modelsList.slice(0, 10).join(", "),
      });
    }
  } catch (err) {
    checks.push({
      code: "local_llm_daemon_unreachable",
      level: "error",
      message: `Ollama unreachable at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      hint: "Start the Ollama service (`ollama serve`) or override baseUrl in adapter config.",
    });
  }

  if (modelsList.length > 0) {
    if (modelsList.includes(model)) {
      checks.push({
        code: "local_llm_model_present",
        level: "info",
        message: `Model ${model} is loaded`,
      });
    } else {
      checks.push({
        code: "local_llm_model_missing",
        level: "warn",
        message: `Configured model ${model} not found locally`,
        hint: `Run: ollama pull ${model}`,
        detail: `Available: ${modelsList.join(", ")}`,
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

/**
 * Discover models registered with the local Ollama daemon.
 */
export async function listModels(
  baseUrl = "http://localhost:11434/v1",
  apiKey = "ollama",
): Promise<{ id: string; label: string }[]> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Array<{ id?: string }> };
    return (json.data ?? [])
      .map((m) => m.id ?? "")
      .filter(Boolean)
      .map((id) => ({ id, label: id }));
  } catch {
    return [];
  }
}
