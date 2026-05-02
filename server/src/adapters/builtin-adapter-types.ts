/**
 * Adapter types shipped with MSProLtd. External plugins must not replace these.
 */
// MSPRO fork: claude_local, cursor, process, http + local_llm (Ollama, P-2026-017 F2)
export const BUILTIN_ADAPTER_TYPES = new Set([
  "claude_local",
  "cursor",
  "process",
  "http",
  "local_llm",
]);
