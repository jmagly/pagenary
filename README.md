# Pagenary

**"Where documentation takes shape."**

This repository houses multiple tooling and application layers for Pagenary, a multi-tenant documentation publishing platform. The initial focus is the **publisher** app, which packages tenant-specific static bundles and serves them via Caddy for local domain testing. Upcoming work will add upstream authoring, workflow, and billing components in separate workspaces under `apps/`.

## Layout
- `apps/publisher/` – static site publishing pipeline (build scripts, tenant configs, Docker Caddy integration)
- `package.json` – workspace orchestration for the monorepo
- Additional applications and services will be added alongside the publisher as the platform evolves.

## Common Commands
Run everything from the repository root unless noted.

```bash
# Install dependencies for all workspaces
npm run bootstrap

# Build the publisher app
npm run publisher:build

# Build every tenant bundle
npm run publisher:build:tenants

# Serve the publisher app locally
npm run publisher:serve
```

Refer to `apps/publisher/README.md` for tenant authoring workflows, Docker-based domain testing, and other publishing details.
