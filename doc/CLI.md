# CLI Reference

MSProLtd CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm msproltdai --help
```

First-time local bootstrap + run:

```sh
pnpm msproltdai run
```

Choose local instance:

```sh
pnpm msproltdai run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `msproltdai onboard` and `msproltdai configure --section server` set deployment mode in config
- server onboarding/configure ask for reachability intent and write `server.bind`
- `msproltdai run --bind <loopback|lan|tailnet>` passes a quickstart bind preset into first-run onboarding when config is missing
- runtime can override mode with `MSPROLTD_DEPLOYMENT_MODE`
- `msproltdai run` and `msproltdai doctor` still do not expose a direct low-level `--mode` flag

Canonical behavior is documented in `doc/DEPLOYMENT-MODES.md`.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm msproltdai allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.mspro-ltd`:

```sh
pnpm msproltdai run --data-dir ./tmp/mspro-ltd-dev
pnpm msproltdai issue list --data-dir ./tmp/mspro-ltd-dev
```

## Context Profiles

Store local defaults in `~/.mspro-ltd/context.json`:

```sh
pnpm msproltdai context set --api-base http://localhost:3100 --company-id <company-id>
pnpm msproltdai context show
pnpm msproltdai context list
pnpm msproltdai context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm msproltdai context set --api-key-env-var-name MSPROLTD_API_KEY
export MSPROLTD_API_KEY=...
```

## Company Commands

```sh
pnpm msproltdai company list
pnpm msproltdai company get <company-id>
pnpm msproltdai company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm msproltdai company delete PAP --yes --confirm PAP
pnpm msproltdai company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `MSPROLTD_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `MSPROLTD_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm msproltdai issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm msproltdai issue get <issue-id-or-identifier>
pnpm msproltdai issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm msproltdai issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm msproltdai issue comment <issue-id> --body "..." [--reopen]
pnpm msproltdai issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm msproltdai issue release <issue-id>
```

## Agent Commands

```sh
pnpm msproltdai agent list --company-id <company-id>
pnpm msproltdai agent get <agent-id>
pnpm msproltdai agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a MSProLtd agent:

- creates a new long-lived agent API key
- installs missing MSProLtd skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `MSPROLTD_API_URL`, `MSPROLTD_COMPANY_ID`, `MSPROLTD_AGENT_ID`, and `MSPROLTD_API_KEY`

Example for shortname-based local setup:

```sh
pnpm msproltdai agent local-cli codexcoder --company-id <company-id>
pnpm msproltdai agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm msproltdai approval list --company-id <company-id> [--status pending]
pnpm msproltdai approval get <approval-id>
pnpm msproltdai approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm msproltdai approval approve <approval-id> [--decision-note "..."]
pnpm msproltdai approval reject <approval-id> [--decision-note "..."]
pnpm msproltdai approval request-revision <approval-id> [--decision-note "..."]
pnpm msproltdai approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm msproltdai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm msproltdai activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm msproltdai dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm msproltdai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.mspro-ltd/instances/default`:

- config: `~/.mspro-ltd/instances/default/config.json`
- embedded db: `~/.mspro-ltd/instances/default/db`
- logs: `~/.mspro-ltd/instances/default/logs`
- storage: `~/.mspro-ltd/instances/default/data/storage`
- secrets key: `~/.mspro-ltd/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
MSPROLTD_HOME=/custom/home MSPROLTD_INSTANCE_ID=dev pnpm msproltdai run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm msproltdai configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
