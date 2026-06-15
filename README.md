<div align="center">

# Pagenary

**Where documentation takes shape.**

Pagenary is a multi-tenant documentation publishing platform that turns one shared set of templates into many branded, tenant-specific static sites. Zero runtime dependencies, hash-based routing, and a Git-aware build pipeline make it suited to white-label documentation portals — one source of truth, any number of published sites.

Built with [AIWG](https://aiwg.io), the multi-agent AI framework used to plan,
audit, and ship this project.

```bash
npm install --save-dev @pagenary/publisher   # add Pagenary to your project
npx pagenary build:tenants my-docs           # build your docs tenant
npx pagenary serve                           # serve on http://localhost:5173
```

[![npm version](https://img.shields.io/npm/v/@pagenary/publisher?label=npm&color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/publisher)
[![npm downloads](https://img.shields.io/npm/dm/@pagenary/publisher?color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/publisher)
[![Docs](https://img.shields.io/badge/docs-docs.pagenary.com-22d3ee?style=flat-square&logo=readthedocs&logoColor=white)](https://docs.pagenary.com)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%E2%89%A516.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![Search: @fortemi/core](https://img.shields.io/npm/v/@fortemi/core?label=search%20%C2%B7%20%40fortemi%2Fcore&color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@fortemi/core)
[![Built with AIWG](https://img.shields.io/npm/v/aiwg?label=built%20with%20%C2%B7%20aiwg&color=7c3aed&logo=npm&style=flat-square)](https://www.npmjs.com/package/aiwg)

[**Docs Site**](https://docs.pagenary.com) · [**Quick Start**](#quick-start) · [**Features**](#features) · [**Architecture**](#architecture) · [**Documentation**](#documentation)

</div>

---

## What Pagenary Is

Pagenary is a static site generator built around a multi-tenant model. The core application is the **publisher** (`apps/publisher/`): it takes a catalog of shared section templates plus per-tenant content and configuration, and produces a self-contained documentation bundle for each tenant.

Each published bundle is a static single-page app — hash-based routing (`#/page-id`), no server-side rendering, no runtime dependencies. You build it once and host the output anywhere that serves files. Asset and module URLs resolve through a per-tenant `<base>`, so the same bundle works whether a tenant is served at its own domain root **or** mounted under a subpath of a shared host. Tenants share the template catalog but keep isolated content, branding, navigation, and domains, so a single repository can publish a dozen distinct documentation sites — each with real ranked search and SEO-ready output, not just static pages.

## Building Blocks

Pagenary is composed from a small set of plain inputs:

- **Templates** — the shared section catalog (`welcome`, `guide`, `reference`, `tutorial`, …) that defines how each page type renders
- **Tenants** — a named publication with its own content, branding, and navigation, defined under `tenants/<tenant-id>/`
- **Content** — Markdown (`.md`), HTML (`.html`), or JS modules (`.js`) that supply each tenant's pages
- **Manifests** — per-tenant navigation structure and section metadata
- **Overrides** — post-build file replacements for tenant-specific customization

Nothing is bundled at runtime. The build resolves templates + content + config into static `dist/<tenant-id>/` output the browser reads directly.

## Why It Compounds

The leverage comes from the template/tenant split:

- One template improvement (better search, a new page category, an accessibility fix) propagates to **every tenant** on the next build.
- One tenant is a thin layer — content, a config file, a manifest — over the shared catalog, so standing up a new branded site is cheap.
- Branding, theming, and navigation are **data, not code**: a tenant changes its look through `config.json`, not by forking the generator.
- Builds are **Git-aware and incremental**, so a large multi-tenant repository rebuilds only what changed.

The result is that the marginal cost of an additional documentation site trends toward the cost of its content alone.

## What Pagenary Is Not

- **Not a hosted service.** Pagenary produces static files. You own hosting — any static host, CDN, or the bundled Caddy setup works.
- **Not a runtime framework.** The published output has zero runtime dependencies. There is no server to run and nothing to import into a consuming app.
- **Not a headless CMS.** Content lives as files (Markdown/HTML/JS) in the repository, versioned with everything else — not in a database behind an API.

## Who It's For

Teams and platforms that publish **more than one** documentation site from shared conventions: white-label SaaS docs, multi-product portals, agency-managed client documentation, or any case where you want consistent structure across sites without maintaining each one by hand.

---

## What Problems Does Pagenary Solve?

Maintaining several documentation sites by hand has three recurring failure modes:

### 1. Drift Between Sites

Each site is edited independently, so structure, navigation, and styling diverge over time. A fix applied to one portal never reaches the others.

**Without Pagenary**: Every site is a snowflake. Consistency is a manual, never-finished chore.

**With Pagenary**: All tenants render from one template catalog. A structural or visual change is made once and rebuilt into every bundle.

### 2. Branding Coupled to Code

Customizing a site's look means forking the generator or hand-editing output, which makes upgrades painful.

**Without Pagenary**: Branding changes require touching build logic; tenant-specific tweaks accumulate as un-mergeable forks.

**With Pagenary**: Branding is per-tenant configuration (`config.json` — colors, brand marks, typography) plus optional `overrides/`. The generator stays shared and upgradable.

### 3. Slow, Full Rebuilds

Regenerating every site on every change wastes time as the number of tenants grows.

**Without Pagenary**: Build time scales with the whole repository, not the change.

**With Pagenary**: Git-aware incremental builds (`build:incremental`, `build:diff`) rebuild only the tenants and pages affected by a change.

---

## Core Concepts

### 1. Multi-Tenant Model

Each tenant is defined in `tenants/<tenant-id>/` with a `manifest.json` (navigation overrides), a `content/` directory, and optional `overrides/`. The build emits an isolated `dist/<tenant-id>/` bundle with its own `manifest.js` and `sections/`.

### 2. Template Catalog

`src/sections/section-templates.js` is the shared catalog. Categories (welcome, guide, reference, tutorial, …) define rendering for each page type, so all tenants inherit consistent page structure.

### 3. Hash-Based SPA Routing

Published bundles are single-page apps. All navigation runs client-side through `app.js` via `#/page-id` routes — no server-side rendering, deployable as plain files.

### 4. Content Types

Tenant content can be Markdown (converted to HTML by a lightweight parser), HTML (wrapped and shipped as-is), or JS modules (copied unchanged; must export `load()` returning `{ html, afterRender? }`).

### 5. Theming & Branding

Per-tenant `config.json` controls title, brand marks, tagline, accent and surface colors, and typography. Branding is data the build applies, never a fork of the generator.

### 6. Git-Aware Builds

The build pipeline tracks changes against Git to support incremental and diff-only rebuilds, keeping large multi-tenant repositories fast to publish.

---

## When to Use Pagenary (and When Not To)

### Good Fit

Publishing multiple documentation sites that share structure and conventions but differ in content and branding — white-label docs, multi-product portals, agency/client documentation, internal knowledge sites with per-team branding. Especially strong when those sites need **real in-page search** and **clean SEO** out of the box, and when you want to host them flexibly: each tenant on its own domain, or many mounted under subpaths of a single host (e.g. `docs.example.com/product-a/`, `/product-b/`).

### Not the Best Fit

A single one-off documentation site with no white-labeling needs, or content that must be edited by non-technical authors through a web UI rather than committed as files.

### The Trade-off

Pagenary adds a template/tenant abstraction that pays off across many sites. For a single site, a conventional static-site generator is simpler. Past two or three sites that should stay consistent, the shared-catalog model is what keeps them from drifting.

```
Templates + per-tenant content/config
                │
                ▼
        apps/publisher (build)
                │
                ▼
   dist/<tenant-id>/  ── static SPA bundle (hash routing, zero runtime deps)
                │
                ▼
   Any static host / CDN / bundled Caddy
```

---

## How It Works

1. **Define a tenant** under `tenants/<tenant-id>/` with content, a manifest, and a branding config.
2. **Build** with the publisher — templates from the shared catalog are merged with the tenant's content and config.
3. **Output** lands in `dist/<tenant-id>/` as a self-contained static SPA with a tenant-specific `manifest.js` and `sections/`.
4. **Serve** the bundle from any static host, or use the bundled Caddy setup for multi-tenant domain testing.

## Features

- **Multi-Tenant Architecture** — isolated content, branding, and configuration per tenant
- **Zero Runtime Dependencies** — published output is vanilla HTML, CSS, and ES modules
- **Fortemi-backed search** — command palette (`Ctrl/Cmd+K`) ranks results with snippets over a static chunked index ([`@fortemi/core`](https://www.npmjs.com/package/@fortemi/core)), with lazy precache, infinite scroll, and a community-graph view — all client-side (no server, no WASM)
- **SEO-first output** — metadata-driven page titles, crawlable `/pages/` static snapshots, and `sitemap.xml` / `robots.txt` / `llms.txt` / JSON-LD / Open Graph generated at build time
- **Flexible hosting** — per-tenant `<base>` resolution serves the same bundle at a domain root *or* under a subpath; any static host, CDN, or the bundled Caddy
- **Mermaid Diagrams** — native flowcharts, sequence diagrams, and more
- **Syntax Highlighting** — Prism.js integration for code blocks
- **Theming** — per-tenant colors, branding, and typography
- **Document Export** — one-click PDF-ready HTML export with table of contents
- **Incremental Builds** — Git-aware builds for fast iteration

## Quick Start

Pagenary is an npm package — **no clone required to use it**. New to Pagenary?
The **[Getting Started guide](apps/publisher/docs/GETTING-STARTED.md)** walks
you from zero to a published docs site step by step.

### Use the published package (recommended)

```bash
# See the available commands
npx @pagenary/publisher --help

# Add it to your project, then build and serve your docs
npm install --save-dev @pagenary/publisher
npx pagenary build:tenants my-docs    # build your tenant (see "Creating Your First Tenant")
npx pagenary serve                    # serve on http://localhost:5173
```

`pagenary` commands: `build`, `build:tenants [id]`, `tenants:list`, `serve`.
Extra flags pass through to the underlying script (e.g.
`pagenary build:tenants --incremental`). The published tarball also ships a
compiled reference site under `site/` — the Pagenary docs, built by Pagenary
itself.

### Build from source (contributors / modifying Pagenary)

Clone the repo only if you want to change the templates, hack on the generator,
or develop Pagenary itself — not to *use* it:

```bash
git clone https://github.com/jmagly/pagenary.git
cd pagenary && npm run bootstrap

npm run publisher:build && npm run publisher:serve   # default bundle → http://localhost:5173
npm run publisher:build:tenants                      # all tenant bundles
```

This project is developed with [AIWG](https://aiwg.io). On this host, the AIWG
project source is available at `~/dev/aiwg` for maintainers who want to inspect,
build, or run the framework that supports Pagenary development.

## Creating Your First Tenant

With `@pagenary/publisher` installed in your project (`npm install -D @pagenary/publisher`):

1. **Register the tenant** in a `tenants.json` at your project root (validated by the bundled `tenants.schema.json`):
```json
{
  "tenants": [
    {
      "id": "my-docs",
      "source": { "type": "local", "path": "./docs" },
      "strictLinks": true
    }
  ]
}
```

2. **Add your content** under the source path:
```
docs/
├── config.json          # branding and theme
├── manifest.json        # navigation structure (optional)
└── content/
    ├── welcome.md       # Markdown content
    ├── guide.html       # HTML content
    └── dashboard.js     # dynamic JS modules
```

3. **Configure branding** in `config.json`:
```json
{
  "title": "My Documentation",
  "brandMark": "ACME",
  "brandSub": "Docs",
  "tagline": "Your tagline here",
  "accentColor": "#6366F1",
  "surfaceColor": "#F7FAFC"
}
```

4. **Build and preview**:
```bash
npx pagenary build:tenants my-docs
npx pagenary serve
# Visit http://localhost:5173/my-docs/
```

> Building Pagenary from source instead? Use `npm run publisher:build:tenants my-docs`
> and register tenants in `apps/publisher/tenants.json`.

## Architecture

**Static SPA pattern**: hash-based routing (`#/page-id`), no server-side rendering. All navigation runs through `app.js`; all styling lives in a single `styles.css`.

**Key files**:

- `src/manifest.js` — navigation structure and section metadata
- `src/sections/section-templates.js` — template catalog with category-based rendering
- `src/app.js` — router, command palette, and export logic
- `scripts/build-tenants.js` — multi-tenant bundle generation

**Repository layout**:

```
pagenary/
├── apps/
│   └── publisher/           # Static site generator
│       ├── src/             # SPA shell and templates
│       ├── scripts/         # Build, serve, and utility scripts
│       ├── tenants/         # Built-in example tenants
│       ├── docs/            # Developer documentation
│       └── dist/            # Build output
├── package.json             # Workspace orchestration
└── README.md
```

## Common Commands

**Using the installed package** (the default — `npx pagenary <command>`):

```bash
npx pagenary build              # build the default bundle to dist/
npx pagenary build:tenants [id] # build a tenant (or all enabled tenants)
npx pagenary tenants:list       # list configured tenants
npx pagenary serve              # serve dist/ on localhost:5173
```

**From source** (after cloning — for contributors / Pagenary development):

```bash
npm run bootstrap               # install all workspace dependencies
npm run publisher:build         # build default bundle
npm run publisher:build:tenants # build all tenant bundles
npm run publisher:serve         # serve dist/ on localhost:5173

# from apps/publisher/:
npm run dev                     # build + serve with watch
npm run build:incremental [id]  # Git-aware incremental build
npm run caddy:up                # start multi-tenant Caddy server
npm test                        # run test suite
```

## Configuration & Customization

- **Tenant registration** — a `tenants.json` at your project root (or `apps/publisher/tenants.json` when building from source), validated by `tenants.schema.json`
- **Branding & theme** — per-tenant `config.json` (title, brand marks, tagline, colors, typography)
- **Navigation** — per-tenant `manifest.json` overrides the shared structure
- **Post-build overrides** — drop replacements in a tenant's `overrides/` directory
- **Multi-tenant domains** — the bundled `Caddyfile` + `docker-compose.yml` serve tenants by domain for local testing (`npm run caddy:up`)

## Documentation

The full documentation site is published at **[docs.pagenary.com](https://docs.pagenary.com)** — built by Pagenary from the source files below (Pagenary dogfooding its own publisher). Read it online, or browse the source:

- [Getting Started](apps/publisher/docs/GETTING-STARTED.md) — **start here**: zero to a published docs site using the npm package
- [Publisher README](apps/publisher/README.md) — full feature documentation
- [Quick Start Guide](apps/publisher/docs/QUICKSTART.md) — step-by-step tenant setup
- [Tenant Configuration](apps/publisher/docs/TENANT-CONFIG.md) — all config options
- [Architecture](apps/publisher/docs/ARCHITECTURE.md) — system design
- [API Reference](apps/publisher/docs/API.md) — module documentation
- [Deployment](apps/publisher/docs/DEPLOYMENT.md) — hosting patterns
- [Releasing](docs/contributing/releasing.md) — CalVer release + npm publish flow

---

## Contributing

Contributions are welcome.

- Found a bug or have a request? [Open an issue](https://github.com/jmagly/pagenary/issues/new)
- Improving a template benefits every tenant — changes to `src/sections/` are high-leverage
- Run `npm test` (from `apps/publisher/`) before opening a PR
- Releases follow CalVer (`YYYY.M.PATCH`); see [docs/contributing/releasing.md](docs/contributing/releasing.md)

---

## Community & Support

- **Issues:** [GitHub Issues](https://github.com/jmagly/pagenary/issues)
- **Discussions:** [GitHub Discussions](https://github.com/jmagly/pagenary/discussions)

---

## License

**GNU Affero General Public License v3.0** — strong copyleft. You may use, modify, and distribute Pagenary, but if you run a modified version to provide a network service, you must make the modified source available to its users. See [LICENSE](LICENSE).

---

## Acknowledgments

Built with vanilla web standards and a small set of best-in-class libraries — [Mermaid](https://mermaid.js.org/) for diagrams and [Prism.js](https://prismjs.com/) for syntax highlighting — kept out of the runtime bundle wherever possible.

---

<div align="center">

**[Back to Top](#pagenary)**

Made with care by [Joseph Magly](https://github.com/jmagly)

</div>
