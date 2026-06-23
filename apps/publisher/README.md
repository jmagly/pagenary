<div align="center">

# Pagenary Publisher

**Where documentation takes shape.**

`@pagenary/publisher` is the static site generator behind Pagenary — it turns one shared template catalog into many branded, tenant-specific documentation sites. Zero runtime dependencies, hash-based routing, full-text search, and a Git-aware build pipeline. Install it as a dev dependency and drive it with the `pagenary` CLI.

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
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square)](../../LICENSE)
[![Node Version](https://img.shields.io/badge/node-%E2%89%A516.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![Search: @fortemi/core](https://img.shields.io/npm/v/@fortemi/core?label=search%20%C2%B7%20%40fortemi%2Fcore&color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@fortemi/core)
[![Built with AIWG](https://img.shields.io/npm/v/aiwg?label=built%20with%20%C2%B7%20aiwg&color=7c3aed&logo=npm&style=flat-square)](https://www.npmjs.com/package/aiwg)

[**Docs Site**](https://docs.pagenary.com) · [**Quick Start**](#quick-start) · [**Features**](#features) · [**Tenant Workflow**](#tenant-content-workflow) · [**Documentation**](#documentation)

</div>

---

## What It Is

The publisher takes a catalog of shared section templates plus per-tenant content and configuration and produces a self-contained documentation bundle for each tenant. Each bundle is a static single-page app — hash-based routing (`#/page-id`), no server-side rendering, no runtime dependencies — that you build once and host anywhere that serves files. A per-tenant `<base>` resolves asset and module URLs to the tenant root, so the same bundle serves correctly at a domain root *or* under a subpath mount. Tenants share the template catalog but keep isolated content, branding, navigation, and domains — each with ranked client-side search and SEO-ready output — so one repository can publish a dozen distinct sites.

---

## Quick Start

Install the package and drive it with the `pagenary` CLI — **no clone required**.
New here? Follow the **[Getting Started guide](docs/GETTING-STARTED.md)**.

```bash
npm install --save-dev @pagenary/publisher

npx pagenary build:tenants my-docs   # build your tenant (see Tenant Registry below)
npx pagenary serve                   # preview on http://localhost:5173
```

Commands: `build`, `build:tenants [id]`, `tenants:list`,
`managed-hosting`, `serve` (run `npx pagenary --help`). The package also
ships a compiled reference site under `site/` — the Pagenary docs, built by
Pagenary itself.

**Building from source** (contributors / modifying Pagenary):

```bash
npm install
npm run dev         # build + serve with watch mode
npm run build       # build default bundle to dist/
```

Pagenary development uses [AIWG](https://aiwg.io). On this host, maintainers can
inspect, build, or run the AIWG project from `~/dev/aiwg`.

---

## Features

### Content Authoring
- **Markdown** — write in `.md` files with full CommonMark support
- **HTML** — direct markup control with `.html` files
- **JavaScript Modules** — dynamic content with `.js` files returning `{ html, afterRender? }`
- **Nested Directories** — organize content in subdirectories (`content/guides/setup.md`)

### Rich Content
- **Mermaid Diagrams** — flowcharts, sequence diagrams, state machines, and more
- **Syntax Highlighting** — Prism.js with 10+ language support
- **Markdown Tables** — full table syntax with alignment support
- **HTML Components** — spec tables, layer stacks, box diagrams, cards
- **Internal Links** — auto-resolved `#section-id` links in Markdown

### External Links
- **Navigation Links** — add external URLs directly in the manifest with a `url` property
- **Smart Link Handling** — external links open in a new tab with security headers (`rel="noopener noreferrer"`)
- **Visual Indicators** — a subtle ↗ icon marks external destinations
- **CTA Styling** — button-like `external-cta` class for prominent external links

### Navigation & Search
- **Command Palette** — `Ctrl/Cmd+K` or `/` opens a global finder
- **Fortemi-backed full-text search** — ranked results with snippets over a static
  chunked index emitted at build time; lazy chunk fetch (precache) and offset
  paging for infinite scroll, with a clean in-browser fallback. No server, no WASM.
  The engine is *vendored* (`@fortemi/core`) — see `docs/VENDORING.md` for the
  process, `docs/ARCHITECTURE.md`, and
  `.aiwg/architecture/adr/ADR-015-fortemi-core-search-adapter.md`.
- **Docs Map** — opt-in static graph view over the same Fortemi corpus, with
  weighted relationships, zoom/pan controls, neighbor highlighting, and node
  metadata popups.
- **Manifest-Driven Nav** — declarative navigation structure
- **Keyboard Navigation** — arrow keys, Enter to select

### Theming & Branding
- **Custom Colors** — `accentColor` and `surfaceColor` per tenant
- **Brand Identity** — logo text, tagline, copyright
- **Typography** — IBM Plex Sans/Mono defaults, customizable

### SEO (built in)
- **Metadata-driven titles** — the shell `<title>` derives from the default page's metadata title (`"<page title> · <brand>"`), and each section sets its own title/description at runtime; the generic brand is only a fallback
- **Absolute URLs** — declare a `domain` (or `seo.siteUrl`) and the sitemap, canonical, `og:url`, and `robots` URLs become fully-qualified
- **Static snapshots** — crawler-friendly `/pages/<id>.html` for every section, self-canonical (the SPA hash route isn't crawlable)
- **`sitemap.xml`, `robots.txt`, `llms.txt`** — generated automatically
- **JSON-LD + Open Graph** — `TechArticle`/`BreadcrumbList` per page, optional Organization data, and `og:image`/`twitter:image` via `seo.ogImage`
- **Subpath-safe assets** — a per-tenant `<base>` keeps stylesheet/script/snapshot URLs valid whether served at a domain root or a subpath

### Export & Sharing
- **Export Options** — Current Page or Entire Site
- **Branded Exports** — tenant logo, brand name, and tagline in the export header
- **Document Export** — one-click HTML export with a table of contents, print-optimized for PDF

---

## Tenant Content Workflow

### Directory Structure

```
my-tenant/
├── config.json           # Branding, theme, and SEO settings
├── manifest.json         # Navigation structure (optional)
├── content/              # Content files
│   ├── welcome.md        # Root-level content
│   ├── guides/           # Nested directory
│   │   ├── _manifest.json  # Section manifest
│   │   ├── getting-started.md
│   │   └── advanced.md
│   └── api/
│       ├── _manifest.json
│       └── reference.md
└── overrides/            # Post-build file replacements (optional)
```

### Content Types

**Markdown (.md)**
```markdown
# Getting Started

Welcome to the docs. Here's a code example:

\`\`\`javascript
console.log('Hello, Pagenary!');
\`\`\`

And a Mermaid diagram:

\`\`\`mermaid
graph LR
    A[Start] --> B[Build]
    B --> C[Deploy]
\`\`\`
```

**HTML (.html)**
```html
<section class="section doc">
  <h1>Custom HTML Section</h1>
  <table class="spec-table">
    <tr><th>Feature</th><th>Status</th></tr>
    <tr><td>Search</td><td>Ready</td></tr>
  </table>
</section>
```

**JavaScript (.js)**
```javascript
export async function load() {
  const data = await fetch('/api/metrics.json').then(r => r.json());
  return {
    html: `<section><h1>Metrics: ${data.count}</h1></section>`,
    afterRender(container) {
      // DOM manipulation after render
    }
  };
}
```

### Manifest Configuration

**Root manifest.json** (optional — auto-generated from `content/` if omitted):
```json
[
  { "id": "welcome", "title": "Welcome", "file": "welcome.md" },
  {
    "id": "guides",
    "title": "Guides",
    "subsections": [
      { "id": "guides/getting-started", "title": "Getting Started", "file": "guides/getting-started.md" },
      { "id": "guides/advanced", "title": "Advanced Usage", "file": "guides/advanced.md" }
    ]
  }
]
```

**Section _manifest.json** (in content subdirectories):
```json
{
  "title": "API Reference",
  "sections": [
    { "id": "overview", "title": "Overview", "file": "overview.md" },
    { "id": "endpoints", "title": "Endpoints", "file": "endpoints.md" }
  ]
}
```

**External links in the manifest** (use `url` instead of `file`):
```json
[
  { "id": "welcome", "title": "Welcome", "file": "welcome.md" },
  { "title": "Support Portal", "url": "https://support.example.com" }
]
```

### Branding & SEO Configuration

**config.json**:
```json
{
  "title": "My Documentation",
  "description": "Comprehensive guide to our platform",
  "brandMark": "ACME",
  "brandSub": "Docs",
  "tagline": "Build better, faster",
  "copyright": "ACME Corp",
  "accentColor": "#6366F1",
  "surfaceColor": "#F7FAFC",
  "domain": "docs.acme.com",
  "seo": {
    "siteUrl": "https://docs.acme.com",
    "ogImage": "/assets/og-card.png",
    "structuredData": { "organizationName": "ACME Corporation" }
  }
}
```

| Property | Description | Default |
|----------|-------------|---------|
| `title` | Browser tab title | "Documentation" |
| `description` | Meta description for SEO | - |
| `brandMark` | Primary brand text (bold) | "DOCS" |
| `brandSub` | Secondary brand text (light) | "TOOLKIT" |
| `tagline` | Subtitle under brand | - |
| `copyright` | Footer copyright text | - |
| `accentColor` | Links, buttons, highlights | `#111111` |
| `surfaceColor` | Background color (hex) | `#ffffff` |
| `domain` | Canonical domain; also the SEO base URL when `seo.siteUrl` is unset | - |
| `seo` | SEO block — see [Tenant Configuration](docs/TENANT-CONFIG.md#seo-seo) | - |

---

## Build Commands

With the package installed (the default):

```bash
npx pagenary build                    # build the default bundle to dist/
npx pagenary build:tenants            # build all enabled tenants
npx pagenary build:tenants my-tenant  # build a specific tenant
npx pagenary tenants:list             # list configured tenants
npx pagenary managed-hosting plans    # inspect public hosting entitlements
npx pagenary serve                    # serve dist/ on localhost:5173
```

From source (clone — adds dev/utility scripts):

```bash
npm run build:incremental my-tenant  # git-aware incremental rebuild
npm run dev                          # build + serve with watch
npm run lint:content                 # check trailing whitespace/tabs
npm run check:seo                    # verify SEO metadata
npm run check                        # run all checks
npm test                             # run test suite
npm run test:browser                 # optional real-browser smoke (see below)
```

### Browser smoke test (optional)

`npm run test:browser` runs `scripts/smoke-browser.mjs`, a real-browser check for
things the jest/node suite can't cover: `<base href>` resolution under a subpath
mount, asset + section loading, the runtime `<title>` brand, and Fortemi
command-palette search. It builds + serves the `pagenary` tenant and drives a
headless Chromium, capturing a screenshot for review.

Playwright is **not** a dependency (keeps the install lean); the script skips with
instructions when it's absent. Enable it once:

```bash
npm i -D playwright && npx playwright install chromium
SMOKE_REQUIRE=1 npm run test:browser   # fail (not skip) if Playwright is missing — use in CI
```

---

## Tenant Registry

Register tenants in a `tenants.json` at your project root (validated by the
bundled `tenants.schema.json`):

```json
{
  "tenants": [
    {
      "id": "my-docs",
      "source": { "type": "local", "path": "./docs" },
      "strictLinks": true
    },
    {
      "id": "client-portal",
      "source": { "type": "git", "url": "https://github.com/org/client-docs.git", "ref": "main" },
      "domains": ["docs.client.com"]
    }
  ]
}
```

**Source types:**
- **Local**: `{ "type": "local", "path": "./relative/or/abs/path" }`
- **Git**: `{ "type": "git", "url": "https://…", "ref": "main", "path": "subdir" }`

Per-tenant options include `enabled` (default `true`), `strictLinks` (default
`true` — fail the build on broken internal links), and `domains` (for the
multi-tenant Caddy router). See [Tenant Configuration](docs/TENANT-CONFIG.md).

---

## Docker Caddy Workflow

For multi-tenant domain testing:

```bash
# Add to /etc/hosts:
# 127.0.0.1 my-docs.local client-portal.local

npm run build:tenants   # build tenants
npm run caddy:up        # start Caddy
# Visit http://my-docs.local or http://client-portal.local

npm run caddy:logs      # tail logs
npm run caddy:reload    # reload config without restart
npm run caddy:restart   # full restart
npm run caddy:down      # stop container
```

Use a non-privileged port: `DOCS_TOOLKIT_PORT=5173 npm run caddy:up`

---

## Managed Hosting MVP

Pagenary can be operated as a concierge managed-hosting service before the
self-serve control panel exists. The public package includes the static
publisher, plan/entitlement contract, routing generator, and build-worker
examples; Stripe secrets, OAuth apps, customer records, and the control panel
belong in the private hosting/control-plane repository.

```bash
npm run managed-hosting -- plans
npm run managed-hosting -- onboarding-intake examples/managed-hosting.tenants.json examples/managed-hosting-onboarding-pro.json
npm run managed-hosting -- account-usage examples/managed-hosting.tenants.json
npm run managed-hosting -- dashboard-state examples/managed-hosting.tenants.json --account-id acme
npm run managed-hosting -- validate examples/managed-hosting.tenants.json
npm run managed-hosting -- caddy examples/managed-hosting.tenants.json
npm run managed-hosting -- billing-action examples/managed-hosting.tenants.json acme
npm run managed-hosting -- site-event examples/managed-hosting.tenants.json examples/managed-hosting-site-created.json
npm run managed-hosting -- domain-event examples/managed-hosting.tenants.json acme examples/managed-hosting-domain-verified.json
npm run managed-hosting -- repo-event examples/managed-hosting.tenants.json acme examples/managed-hosting-repo-connected.json
npm run managed-hosting -- rollback-plan examples/managed-hosting.tenants.json acme
npm run managed-hosting -- deploy-manifest examples/managed-hosting.tenants.json acme
npm run managed-hosting -- artifact-index examples/managed-hosting.tenants.json acme
```

See [Managed Hosting MVP](docs/MANAGED-HOSTING.md) for the concierge flow,
plan gates, Caddy routing, worker example, post-sync support packet, worker
status events, and private control-panel boundary.

---

## Repository Layout

```
apps/publisher/
├── src/
│   ├── index.html          # SPA shell
│   ├── app.js              # Router and core logic
│   ├── styles.css          # All styling
│   ├── manifest.js         # Default navigation
│   ├── seo.js              # Runtime meta tag management
│   ├── mermaid-init.js     # Diagram rendering
│   ├── syntax-highlight.js # Code highlighting
│   └── lib/                # search, router, export
├── scripts/
│   ├── build.js            # Core build script
│   ├── build-tenants.js    # Multi-tenant builder
│   ├── serve.js            # Dev server
│   └── lib/seo-generator.js # Sitemap, robots, snapshots, JSON-LD
├── tenants/                # Built-in example tenants
├── docs/                   # Documentation
└── Caddyfile, docker-compose.yml  # Multi-tenant routing
```

---

## Documentation

The full documentation site is published at **[docs.pagenary.com](https://docs.pagenary.com)** — built by this publisher from the source below. Read it online, or browse the source:

- [Getting Started](docs/GETTING-STARTED.md) — **start here**: zero to a published site with the npm package
- [Quick Start Guide](docs/QUICKSTART.md) — step-by-step tenant creation
- [Publish with GitHub/Gitea Actions](docs/PUBLISHING.md) — make any docs repo Pagenary-ready: copy-paste CI workflows + auto-discovery
- [Managed Hosting MVP](docs/MANAGED-HOSTING.md) — concierge hosting, plan gates, Caddy routing, and worker examples
- [Tenant Configuration](docs/TENANT-CONFIG.md) — all config options (branding, theme, SEO)
- [Theming Recipes](docs/THEMING-RECIPES.md) — copy-paste recipes for colors, fonts, and nav positions, with screenshots
- [Architecture](docs/ARCHITECTURE.md) — system design
- [API Reference](docs/API.md) — module documentation
- [Deployment](docs/DEPLOYMENT.md) — hosting patterns
- [Extending](docs/EXTENDING.md) — customization guide

---

## License

**GNU Affero General Public License v3.0** — strong copyleft. You may use, modify, and distribute Pagenary, but if you run a modified version to provide a network service, you must make the modified source available to its users. See [LICENSE](../../LICENSE).

---

<div align="center">

**[Back to Top](#pagenary-publisher)**

Made with care by [Joseph Magly](https://github.com/jmagly)

</div>
