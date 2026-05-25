# Where documentation takes shape

Pagenary is a multi-tenant documentation publishing platform that turns one
shared set of templates into many branded, tenant-specific static sites. Zero
runtime dependencies, hash-based routing, and a Git-aware build pipeline make
it suited to white-label documentation portals — one source of truth, any
number of published sites.

**This portal is built by Pagenary, from Pagenary's own documentation.** Every
page you see here is the same publisher pipeline applied to the developer docs
in the repository, served as a static single-page app.

## Start here

- **[Quickstart](quickstart.md)** — install, build the default bundle, and serve it locally.
- **[Architecture](architecture.md)** — the static SPA pattern, build pipeline, and tenant content model.
- **[Tenant Configuration](tenant-config.md)** — every `config.json` option for branding, theming, and export.

## How a tenant works

A tenant is a thin layer — content, a `config.json`, and a `manifest.json` —
over the shared template catalog. Branding, theming, and navigation are **data,
not code**: a tenant changes its look through configuration, never by forking
the generator. The build produces a self-contained bundle under
`dist/<tenant-id>/` that you can host anywhere that serves files.
