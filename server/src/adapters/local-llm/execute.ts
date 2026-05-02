import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

/**
 * local_llm adapter — Ollama OpenAI-compatible chat/completions client.
 *
 * Endpoint: http://localhost:11434/v1/chat/completions (configurable via baseUrl).
 * Model: `model` from agent config (e.g. "qwen3:14b", "qwen3:8b").
 * Prompt: read from ctx.context.prompt or ctx.config.promptTemplate; falls back
 * to a synthetic ping when neither is set so testEnvironment-style probes work.
 *
 * Streaming: SSE via OpenAI `stream:true`. Each delta token is forwarded to
 * onLog("stdout", ...) so the heartbeat surface sees live tokens. Full
 * concatenated text is returned in resultJson.message for callers.
 */
export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, context, onLog, onMeta } = ctx;

  const baseUrl = asString(config.baseUrl, "http://localhost:11434/v1").replace(/\/+$/, "");
  const model = asString(config.model, "qwen3:14b");
  const apiKey = asString(config.apiKey, "ollama"); // Ollama ignores; OpenAI SDK requires non-empty
  const stream = config.stream !== false; // default true
  const timeoutMs = asNumber(config.timeoutMs, 60_000);
  const temperature = asNumber(config.temperature, 0.2);
  const maxTokens = asNumber(config.maxTokens, 0);
  const systemPrompt = asString(config.systemPrompt, "");

  const ctxRecord = parseObject(context);
  const prompt =
    asString(ctxRecord.prompt, "") ||
    asString(config.promptTemplate, "") ||
    "ping";

  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    temperature,
  };
  if (maxTokens > 0) body.max_tokens = maxTokens;

  if (onMeta) {
    await onMeta({
      adapterType: "local_llm",
      command: `POST ${baseUrl}/chat/completions`,
      prompt,
      promptMetrics: { promptChars: prompt.length, messages: messages.length },
      context: { model, baseUrl, stream, temperature },
    });
  }

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const startedAt = Date.now();

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await onLog("stderr", errText.slice(0, 4096));
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: `local_llm HTTP ${res.status} ${res.statusText}`,
        resultJson: { status: res.status, body: errText.slice(0, 4096) },
      };
    }

    let fullText = "";
    let promptTokens = 0;
    let completionTokens = 0;
    let finishReason: string | null = null;

    if (stream && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames separated by \n\n; lines start with "data: "
        let idx;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).replace(/\r$/, "");
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };
            const delta = chunk.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              fullText += delta;
              await onLog("stdout", delta);
            }
            if (chunk.choices?.[0]?.finish_reason) {
              finishReason = chunk.choices[0].finish_reason ?? null;
            }
            if (chunk.usage) {
              promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
              completionTokens = chunk.usage.completion_tokens ?? completionTokens;
            }
          } catch {
            // tolerate malformed chunk; surface raw line for debugging
            await onLog("stderr", `bad SSE chunk: ${payload.slice(0, 200)}\n`);
          }
        }
      }
    } else {
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      fullText = json.choices?.[0]?.message?.content ?? "";
      finishReason = json.choices?.[0]?.finish_reason ?? null;
      promptTokens = json.usage?.prompt_tokens ?? 0;
      completionTokens = json.usage?.completion_tokens ?? 0;
      await onLog("stdout", fullText);
    }

    const elapsedMs = Date.now() - startedAt;

    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: `local_llm ${model}: ${completionTokens || fullText.length} ${
        completionTokens ? "tok" : "chars"
      } in ${elapsedMs}ms`,
      resultJson: {
        model,
        message: fullText,
        finishReason,
        elapsedMs,
        usage: { promptTokens, completionTokens },
      },
    };
  } catch (err) {
    const aborted = (err as { name?: string } | null)?.name === "AbortError";
    return {
      exitCode: aborted ? 124 : 1,
      signal: null,
      timedOut: aborted,
      errorMessage: aborted
        ? `local_llm timed out after ${timeoutMs}ms`
        : `local_llm error: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
