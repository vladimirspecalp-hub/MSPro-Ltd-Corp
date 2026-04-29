/**
 * Adapter types shipped with MSProLtd. External plugins must not replace these.
 */
// MSPRO fork: оставлены только claude_local, cursor, process, http
export const BUILTIN_ADAPTER_TYPES = new Set([
  "claude_local",
  "cursor",
  "process",
  "http",
]);
