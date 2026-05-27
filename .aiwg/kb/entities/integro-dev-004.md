# integro-dev-004

> **Type**: server (host)
> **Domain**: infrastructure / static web hosting
> **Status**: active

## Overview

`integro-dev-004` is a Contabo KVM VPS that acts as the shared static-site origin for several public docs/marketing domains, fronted by Cloudflare tunnels. A single `caddy:2-alpine` container (`static-server`) serves all sites HTTP-only on `:80`, routed by Host header. It is the deploy target for [[static-docs-auto-deploy]] (docs.aiwg.io and, as of 2026-05-26, docs.pagenary.com).

## Key Facts

| Attribute | Value |
|-----------|-------|
| Provider | Contabo KVM VPS (vmi687914.contaboserver.net) |
| IP / SSH | 66.94.104.191, port 2424, key-only |
| OS | Ubuntu 24.04.4 LTS |
| Edge | Two Cloudflare tunnels → container on localhost:80 (TLS terminates at CF) |
| Web server | Caddy `caddy:2-alpine`, container `static-server`, config `~/serve-static/` |
| Sites served | magly.net (default `:80` catch-all), aiwg.io, docs.aiwg.io, roko-docs, markdown-editor, stg, docs.pagenary.com |
| CMDB | host public_id 263; service docs.aiwg.io public_id 284 |

## Relationships

- **Hosts**: [[static-docs-auto-deploy]] targets (docs.aiwg.io, docs.pagenary.com)
- **Default site**: magly.net answers any unmatched Host via the `:80 { … }` block
- **Documented in**: [[docs-pagenary-com-deployment-setup]]

## Key Contributions / Outputs

- **serve-static layout** (`~/serve-static/`): `Caddyfile` (git-tracked), `.env` (`VOLUME_N_HOST`/`VOLUME_N_CONTAINER` pairs), `docker-compose.override.yml` (generated from `.env` by `setup.sh`), `setup.sh`.
- **Per-site serving convention**: rsync to `~/production-deploy/<site>/` → bind-mount `:ro` to `/srv/<site>` → named `http://<host>` Caddy block with `root * /srv/<site>` and `try_files {path} {path}.html {path}/ /index.html` (for extensionless SPA URLs) + JSON access log + 404→/index.html SPA fallback.
- **Known drift (2026-05-26)**: `docs-aiwg-io` volume was hand-added to the override but absent from `.env`; codifying it as `VOLUME_6` prevents a `setup.sh` regen from dropping docs.aiwg.io.

## Access

| Key | Use |
|-----|-----|
| `automation_ed25519` (`automation@grissom`) | **Non-interactive / agentic + CI** — plain ed25519, no touch. Connect: `env -u SSH_AUTH_SOCK ssh -F /dev/null -o IdentitiesOnly=yes -i ~/.ssh/automation_ed25519 -p 2424 roctinam@66.94.104.191` |
| `bio_ed25519_sk` (`rocti@sf255`) | Interactive only — hardware-touch security key (the ssh config default; unusable in non-TTY agent shells) |
| `deploy-aiwg@titan` | AIWG CI docsite-deploy key |
| `agentic_ed25519`, `cert_ed25519` | Do **not** use non-interactively (not authorized / Vault cert expired 2026-04-23) |

## Sources

| Source | Type | Date | Notes |
|--------|------|------|-------|
| [[docs-pagenary-com-deployment-setup]] | documentation | 2026-05-26 | serve-static topology + access discovery |

## Notes

Operator flagged (2026-05-26) that this and sibling static-host setups were hand-built with auto-deploy layered on; incremental normalization is in progress, AIWG docs being the first reference implementation. Adding any volume requires `docker compose up -d` (container recreate) → brief multi-site restart; there is no hot-add path.

---
_Last updated: 2026-05-26_
