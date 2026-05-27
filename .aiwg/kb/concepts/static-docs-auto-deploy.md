# Static Docs Auto-Deploy (Pagenary → serve-static → Cloudflare)

> **Category**: pattern
> **Domain**: infrastructure / CI-CD / documentation publishing
> **Confidence**: emerging (first normalized instance: AIWG docs; being standardized)

## Definition

A repeatable pattern for auto-publishing a Pagenary-built documentation site to a custom domain: CI builds a tenant bundle, rsyncs the static output over SSH to a shared Caddy origin host, where a per-site read-only volume + named Caddy block serve it behind a Cloudflare tunnel.

## Context

Originated as hand-built static hosting on [[integro-dev-004]] (magly.net, aiwg.io, roko-docs), with auto-deploy added incrementally. `docs.aiwg.io` was the **first real normalization step** — a clean CI→rsync→Caddy pipeline. `docs.pagenary.com` (2026-05-26) is the second instance and the first where the publisher (`@pagenary/publisher`) is built **from its own source** rather than consumed from npm.

## How It Works

1. **Build** (CI, `.gitea/workflows/docsite-deploy.yml`): build the docs tenant. AIWG: `npx pagenary build:tenants aiwg-docs` (npm devDependency). Pagenary: `node scripts/build-tenants.js pagenary` (from source). Output: `dist/<tenant>/` with `index.html` + `sections/`.
2. **Verify**: fail the job if `index.html` or `sections/` is missing (refuse to rsync an incomplete site under `--delete`).
3. **Deploy**: `rsync -avz --delete` over SSH (repo secret `DEPLOY_SSH_KEY`) to `~/production-deploy/<site>/` on the origin host.
4. **Serve**: that dir is bind-mounted `:ro` to `/srv/<site>`; a named `http://<host>` Caddy block sets `root * /srv/<site>` with `try_files {path} {path}.html {path}/ /index.html` (extensionless SPA URLs) and a 404→/index.html fallback.
5. **Route**: a Cloudflare tunnel terminates TLS and forwards the hostname to the container on `:80`.

Triggers: `v*` tags, pushes to `main` touching docs/tenant/publisher paths, and manual `workflow_dispatch`.

## Examples

1. **docs.aiwg.io** — AIWG repo, tenant `aiwg-docs`, publisher from npm. Reference implementation.
2. **docs.pagenary.com** — Pagenary repo, tenant `pagenary`, publisher from source (dogfooding).
3. **Counterexample** — a site with **no named Caddy block**: the Cloudflare tunnel still routes the host to `:80`, but the `:80` catch-all (magly.net) answers, so the domain returns 200 of the *wrong* content. A named block is mandatory for correct serving.

## Related Concepts

- **Runs on**: [[integro-dev-004]] — the shared origin host
- **Depends on**: a per-site `:ro` volume + named Caddy block; a stable CI deploy key in `authorized_keys`
- **Often confused with**: a hosted docs service — this produces plain static files; there is no runtime

## Open Questions

- Volume adds require a full container recreate (brief multi-site restart) — is a per-site container or a hot-reloadable mount worth it as the fleet grows?
- `.env`↔`docker-compose.override.yml` drift has already bitten once (docs-aiwg-io uncodified) — should `setup.sh` be the only writer, enforced by CI?
- Cloudflare tunnel ingress is dashboard-managed — should it be moved to a versioned `cloudflared` config for auditability?

## Sources

| Source | Key claim from this source | Link |
|--------|---------------------------|------|
| docs.pagenary.com Deployment Setup | full pipeline + host topology + drift | [[docs-pagenary-com-deployment-setup]] |

---
_Last updated: 2026-05-26_
