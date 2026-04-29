---
title: CLI Overview
summary: CLI installation and setup
---

The MSProLtd CLI handles instance setup, diagnostics, and control-plane operations.

## Usage

```sh
pnpm msproltdai --help
```

## Global Options

All commands support:

| Flag | Description |
|------|-------------|
| `--data-dir <path>` | Local MSProLtd data root (isolates from `~/.mspro-ltd`) |
| `--api-base <url>` | API base URL |
| `--api-key <token>` | API authentication token |
| `--context <path>` | Context file path |
| `--profile <name>` | Context profile name |
| `--json` | Output as JSON |

Company-scoped commands also accept `--company-id <id>`.

For clean local instances, pass `--data-dir` on the command you run:

```sh
pnpm msproltdai run --data-dir ./tmp/mspro-ltd-dev
```

## Context Profiles

Store defaults to avoid repeating flags:

```sh
# Set defaults
pnpm msproltdai context set --api-base http://localhost:3100 --company-id <id>

# View current context
pnpm msproltdai context show

# List profiles
pnpm msproltdai context list

# Switch profile
pnpm msproltdai context use default
```

To avoid storing secrets in context, use an env var:

```sh
pnpm msproltdai context set --api-key-env-var-name MSPROLTD_API_KEY
export MSPROLTD_API_KEY=...
```

Context is stored at `~/.mspro-ltd/context.json`.

## Command Categories

The CLI has two categories:

1. **[Setup commands](/cli/setup-commands)** — instance bootstrap, diagnostics, configuration
2. **[Control-plane commands](/cli/control-plane-commands)** — issues, agents, approvals, activity
