---
title: Local Development
summary: Set up MSProLtd for local development
---

Run MSProLtd locally with zero external dependencies.

## Prerequisites

- Node.js 20+
- pnpm 9+

## Start Dev Server

```sh
pnpm install
pnpm dev
```

This starts:

- **API server** at `http://localhost:3100`
- **UI** served by the API server in dev middleware mode (same origin)

No Docker or external database required. MSProLtd uses embedded PostgreSQL automatically.

## One-Command Bootstrap

For a first-time install:

```sh
pnpm msproltdai run
```

This does:

1. Auto-onboards if config is missing
2. Runs `msproltdai doctor` with repair enabled
3. Starts the server when checks pass

## Bind Presets In Dev

Default `pnpm dev` stays in `local_trusted` with loopback-only binding.

To open MSProLtd to a private network with login enabled:

```sh
pnpm dev --bind lan
```

For Tailscale-only binding on a detected tailnet address:

```sh
pnpm dev --bind tailnet
```

Legacy aliases still work and map to the older broad private-network behavior:

```sh
pnpm dev --tailscale-auth
pnpm dev --authenticated-private
```

Allow additional private hostnames:

```sh
pnpm msproltdai allowed-hostname dotta-macbook-pro
```

For full setup and troubleshooting, see [Tailscale Private Access](/deploy/tailscale-private-access).

## Health Checks

```sh
curl http://localhost:3100/api/health
# -> {"status":"ok"}

curl http://localhost:3100/api/companies
# -> []
```

## Reset Dev Data

To wipe local data and start fresh:

```sh
rm -rf ~/.mspro-ltd/instances/default/db
pnpm dev
```

## Data Locations

| Data | Path |
|------|------|
| Config | `~/.mspro-ltd/instances/default/config.json` |
| Database | `~/.mspro-ltd/instances/default/db` |
| Storage | `~/.mspro-ltd/instances/default/data/storage` |
| Secrets key | `~/.mspro-ltd/instances/default/secrets/master.key` |
| Logs | `~/.mspro-ltd/instances/default/logs` |

Override with environment variables:

```sh
MSPROLTD_HOME=/custom/path MSPROLTD_INSTANCE_ID=dev pnpm msproltdai run
```
