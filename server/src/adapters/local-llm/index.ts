import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment, listModels } from "./test.js";

export const localLlmAdapter: ServerAdapterModule = {
  type: "local_llm",
  execute,
  testEnvironment,
  // Default seed; runtime listModels() probes Ollama for actual catalog.
  models: [
    { id: "qwen3:14b", label: "Qwen3 14B (Ollama)" },
    { id: "qwen3:8b", label: "Qwen3 8B (Ollama, fallback)" },
  ],
  listModels: () => listModels(),
  agentConfigurationDoc: `# local_llm agent configuration (Ollama OpenAI-compat)

Adapter: local_llm

Calls a locally hosted LLM through the OpenAI-compatible /v1/chat/completions
endpoint. Designed for Ollama (default) but works with any compat server
(LM Studio, llama.cpp server, vLLM).

Core fields:
- model (string, required): model id, e.g. "qwen3:14b" or "qwen3:8b"
- baseUrl (string, optional): default "http://localhost:11434/v1"
- apiKey (string, optional): default "ollama" (Ollama ignores; placeholder so OpenAI clients accept it)
- systemPrompt (string, optional): system message prepended to every chat call
- promptTemplate (string, optional): used as user message when ctx.context.prompt is empty
- stream (boolean, optional, default true): enable SSE streaming; tokens are emitted via onLog("stdout", ...)
- temperature (number, optional, default 0.2)
- maxTokens (number, optional, default 0 = unlimited)
- timeoutMs (number, optional, default 60000)

Acceptance:
- Adapter test: \`POST {baseUrl}/chat/completions\` with model qwen3:14b returns a non-empty
  message in <10s for a short prompt.
- testEnvironment: GET {baseUrl}/models lists at least the configured model.
`,
};
