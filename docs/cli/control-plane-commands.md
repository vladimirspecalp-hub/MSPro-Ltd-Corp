---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm msproltdai issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm msproltdai issue get <issue-id-or-identifier>

# Create issue
pnpm msproltdai issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm msproltdai issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm msproltdai issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm msproltdai issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm msproltdai issue release <issue-id>
```

## Company Commands

```sh
pnpm msproltdai company list
pnpm msproltdai company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm msproltdai company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm msproltdai company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm msproltdai company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm msproltdai agent list
pnpm msproltdai agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm msproltdai approval list [--status pending]

# Get approval
pnpm msproltdai approval get <approval-id>

# Create approval
pnpm msproltdai approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm msproltdai approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm msproltdai approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm msproltdai approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm msproltdai approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm msproltdai approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm msproltdai activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm msproltdai dashboard get
```

## Heartbeat

```sh
pnpm msproltdai heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
