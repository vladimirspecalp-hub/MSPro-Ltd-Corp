export const type = "claude_local";
export const label = "Claude Code (Max subscription, MSPRO fork)";

// MSPRO fork: только модели входящие в Max plan.
// Haiku убран — на Max он работает через API, не через подписку.
// Opus/Sonnet последних версий доступны с лимитами Max.
export const models = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7 (Max)" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6 (Max)" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Max)" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (Max)" },
];

export const agentConfigurationDoc = `# claude_local agent configuration (MSPRO fork)

Adapter: claude_local
**Билд только для Max-подписки.** Вход через \`claude login\` один раз на хосте.
API-ключи (ANTHROPIC_API_KEY) и Bedrock блокируются pre-flight guard-ом.

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): Claude model id (см. список выше — только Max-совместимые)
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- chrome (boolean, optional): pass --chrome when running Claude
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- dangerouslySkipPermissions (boolean, optional, default true): pass --dangerously-skip-permissions to claude; defaults to true because Paperclip runs Claude in headless --print mode where interactive permission prompts cannot be answered
- command (string, optional): defaults to "claude"
- env (object, optional): KEY=VALUE environment variables — нельзя задавать ANTHROPIC_API_KEY, ANTHROPIC_BEDROCK_BASE_URL, CLAUDE_CODE_USE_BEDROCK, ANTHROPIC_AUTH_TOKEN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY — guard упадёт
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): reserved for workspace runtime metadata; workspace runtime services are manually controlled from the workspace UI and are not auto-started by heartbeats

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- When Paperclip realizes a workspace/runtime for a run, it injects PAPERCLIP_WORKSPACE_* and PAPERCLIP_RUNTIME_* env vars for agent-side tooling.
`;
