---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `msproltdai run`

One-command bootstrap and start:

```sh
pnpm msproltdai run
```

Does:

1. Auto-onboards if config is missing
2. Runs `msproltdai doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm msproltdai run --instance dev
```

## `msproltdai onboard`

Interactive first-time setup:

```sh
pnpm msproltdai onboard
```

If MSProLtd is already configured, rerunning `onboard` keeps the existing config in place. Use `msproltdai configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm msproltdai onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm msproltdai onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts MSProLtd with that setup.

## `msproltdai doctor`

Health checks with optional auto-repair:

```sh
pnpm msproltdai doctor
pnpm msproltdai doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `msproltdai configure`

Update configuration sections:

```sh
pnpm msproltdai configure --section server
pnpm msproltdai configure --section secrets
pnpm msproltdai configure --section storage
```

## `msproltdai env`

Show resolved environment configuration:

```sh
pnpm msproltdai env
```

This now includes bind-oriented deployment settings such as `MSPROLTD_BIND` and `MSPROLTD_BIND_HOST` when configured.

## `msproltdai allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm msproltdai allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.mspro-ltd/instances/default/config.json` |
| Database | `~/.mspro-ltd/instances/default/db` |
| Logs | `~/.mspro-ltd/instances/default/logs` |
| Storage | `~/.mspro-ltd/instances/default/data/storage` |
| Secrets key | `~/.mspro-ltd/instances/default/secrets/master.key` |

Override with:

```sh
MSPROLTD_HOME=/custom/home MSPROLTD_INSTANCE_ID=dev pnpm msproltdai run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm msproltdai run --data-dir ./tmp/mspro-ltd-dev
pnpm msproltdai doctor --data-dir ./tmp/mspro-ltd-dev
```
