# Operator Additions

## Tracker And Remote Access Protocol

For issue, PR, release, and CI work, agents must resolve the project tracker from
`.aiwg/aiwg.config` before using any tool. In this project:

- `remotes.primary`, `remotes.issue_tracker`, and `remotes.ci` are `origin`.
- `origin` is the canonical Gitea repo:
  `git@git.integrolabs.net:roctinam/pagenary.git`.
- `github` is a secondary publish/mirror remote, not the canonical issue
  tracker.
- `delivery.issue_storage` is `gitea-only`.

Do not infer tracker authority from whichever CLI is logged in. Tool availability
is not project policy.

When tracker access is needed, use this order:

1. Read `.aiwg/aiwg.config` and resolve the configured tracker remote.
2. Prefer MCP/app/API access for that tracker when available. For this project,
   use the Gitea MCP tools for issue creation, comments, labels, and tracker
   reads when present.
3. If MCP is unavailable, use the tracker HTTP API with configured credentials if
   available.
4. Use a tracker CLI only after checking MCP/API options. A missing or
   unauthenticated CLI is not proof that tracker access is unavailable.
5. Git SSH access to `origin` is sufficient for repository sync, commits, tags,
   and pushes, but it is not issue-tracker API access. Do not fall back to the
   GitHub mirror for issues merely because `git push` or `git fetch` works over
   SSH.

If the canonical tracker cannot be accessed after checking MCP, API, and CLI
paths, stop and report the blocker. Do not file canonical project issues on the
GitHub mirror unless the user explicitly asks for a mirror issue.
