# docs.pagenary.com Deployment Setup

> **Type**: documentation
> **Author(s)**: Ops session (jmagly + Claude Code)
> **Date**: 2026-05-26
> **URL / ISBN**: internal — roctinam/pagenary CI + integro-dev-004
> **Read / Watched on**: 2026-05-26

## Key Takeaways

- `docs.pagenary.com` is auto-published by CI from the `pagenary` tenant in `roctinam/pagenary` (`apps/publisher/tenants/pagenary/` + `apps/publisher/docs/*.md`), built **from source** (`node scripts/build-tenants.js pagenary`) — Pagenary dogfooding itself — then rsync'd over SSH to the docs origin host. This mirrors AIWG's `docs.aiwg.io` pipeline, which is the first normalization reference (AIWG consumes `@pagenary/publisher` from npm; Pagenary builds from source).
- The docs origin is [[integro-dev-004]]: one shared `caddy:2-alpine` container (`static-server`) behind Cloudflare tunnels, HTTP-only on `:80`, hostname-routed. It also serves magly.net, aiwg.io, docs.aiwg.io, roko-docs.
- The `:80 { … }` block is the **default catch-all serving magly.net** — any host with no dedicated block (including `docs.pagenary.com` before its block exists) falls through to magly.net and returns 200. A site only serves its own content once it has a named `http://<host> { root * /srv/<site> … }` block.
- Deploy/serve convention per site: rsync to `~/production-deploy/<site>/` on the host → bind-mounted read-only into the container at `/srv/<site>` → a named Caddy block with `try_files {path} {path}.html {path}/ /index.html` (required for Pagenary's extensionless SPA URLs).
- Volume mounts are **supposed** to be declared in `~/serve-static/.env` as `VOLUME_N_HOST`/`VOLUME_N_CONTAINER` pairs; `setup.sh` regenerates `docker-compose.override.yml` from them. **Drift found:** `docs-aiwg-io` was hand-added to the override but never codified in `.env`, so a future `setup.sh` run would drop docs.aiwg.io. Codifying it as `VOLUME_6` fixes that.
- Non-interactive/agentic SSH to the host uses `automation_ed25519` (`automation@grissom`), not the bio security key the ssh config pins. See [[integro-dev-004]].

## Quotes

> "aiwg docs is considered the first real step toward normalization but we may need to make some tweaks." — operator, 2026-05-26

> "most of these setups were still hand setup we just auto deployed, we will need to do some more clean up in the future." — operator, 2026-05-26

## Summary

To stand up `docs.pagenary.com`, the Pagenary repo gains a `docsite-deploy.yml` (and a `docsite-build.yml` validation gate) modeled on AIWG's, building the `pagenary` tenant from source and rsync'ing to `integro-dev-004:~/production-deploy/docs-pagenary-com/`. The host needs a matching read-only volume mount (`/srv/docs-pagenary-com`) and a dedicated Caddy block; without the block, the Cloudflare tunnel still routes the domain to `:80` but the catch-all (magly.net) answers. The broader context is normalization: the static-hosting setup was hand-built, with auto-deploy layered on, and is being incrementally standardized — AIWG docs first, Pagenary docs second.

## Connections

- Background for: [[static-docs-auto-deploy]] — the reusable pattern this instance follows
- Updates: [[integro-dev-004]] — records the host's serve-static topology and access
- CMDB: service `docs.aiwg.io` (public_id 284), host `integro-dev-004` (public_id 263, notes updated 2026-05-26)

## Critique

Strong: the per-site convention (rsync → ro volume → named Caddy block) is consistent and CI-friendly. Weak/incomplete: `.env`↔override drift (docs-aiwg-io uncodified); adding a volume requires a full `docker compose up -d` recreate, briefly restarting **all** sites on the shared container (no hot-add); Cloudflare tunnel ingress is dashboard-managed (no local config to verify in-repo). These are the "cleanup" items the operator flagged as future normalization work.

---
_Last updated: 2026-05-26_
