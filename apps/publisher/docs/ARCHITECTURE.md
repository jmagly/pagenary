# Pagenary Architecture

A minimalist multi-tenant documentation platform built around static assets and client-side rendering.

## Design Principles

- **Zero Runtime Dependencies** - Vanilla HTML, CSS, and ES modules keep the footprint tiny
- **Static-First** - Hash-based routing (`#/page-id`) works on any static host
- **Multi-Tenant Isolation** - Each tenant gets isolated content, branding, and configuration
- **Progressive Enhancement** - Core content works without JavaScript; features enhance with it

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Build System                           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Tenant   │  │ Content      │  │ Asset Pipeline        │ │
│  │ Registry │──│ Processor    │──│ (Minify, Copy, Brand) │ │
│  └──────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Static Bundle (dist/)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │index.html│  │ app.js   │  │styles.css│  │ sections/  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Runtime (Browser)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Router   │  │ Search   │  │ Renderer │  │ Export     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Build System

### Tenant Registry

`tenants.json` maps tenant IDs to content sources:

```json
{
  "tenant-id": {
    "source": "/path/or/git:url#branch",
    "domain": "docs.example.com"
  }
}
```

Supports local paths and git repositories. Git sources are cloned to a cache directory.

### Content Processor

Transforms source content into section modules:

| Input | Processing | Output |
|-------|------------|--------|
| `.md` | Parse Markdown → HTML | ES module with `load()` |
| `.html` | Wrap in loader | ES module with `load()` |
| `.js` | Copy unchanged | ES module with `load()` |

### Asset Pipeline

1. **Copy** - Static assets from `src/` to `dist/`
2. **Minify** - JavaScript via Terser (production)
3. **Brand** - Apply tenant config (colors, text)
4. **Override** - Replace files from `overrides/`

### SEO Artifact Generation

After content processing, branding, tenant overrides, and `.public/` assets are
in place, `scripts/build-tenants.js` calls `scripts/lib/seo-generator.js` to emit
crawler-facing files into the tenant output directory:

- `sitemap.xml` from the generated manifest
- `robots.txt` with a sitemap pointer
- `llms.txt` for LLM-friendly site discovery
- static snapshots under `pages/` for each navigable section
- JSON-LD metadata embedded in the generated snapshots

The generator resolves absolute URLs from `seo.siteUrl` or `domain`. Tenants can
disable the whole stage with `seo.enabled: false` or individual artifact switches.

### Collection Manifests

If `config.collections` is configured, `buildTenant()` resolves the tenant content
root and calls `scripts/lib/collections-generator.js` after SEO artifacts are
written. Each collection reads Markdown posts from its configured `path`, parses
front matter with `scripts/lib/frontmatter.js`, sorts entries by the configured
field/order, and writes machine-readable output under the collection route:

- `index.json` with `slug`, `title`, `date`, `summary`, `hero`, `tags`,
  `reading_time`, `canonical`, and `path`
- optional `feed.xml` when `feed: true`

### Search Index Generation

After `manifest.js` and `sections/` are materialized (both the nested-content and
legacy-manifest paths), `scripts/lib/search-index-generator.js` emits a static
**Fortemi** search index per tenant. It imports each section module, extracts
plain text, and writes a deterministic chunked index under
`dist/<tenant>/search-index/`:

- `manifest.json` — `aiwg.fortemi.index.chunk-manifest.v1` (totals, facet counts,
  contiguous part refs, and a content-derived `source.build_hash`)
- `part-NNNN.json` — `aiwg.fortemi.index.chunk.v1` record pages

The corpus contract and chunking live in the pure, DOM-free
`src/lib/fortemi-corpus.js` (shared with the runtime fallback); the validated
record/index shape comes from the vendored `@fortemi/core` engine
(`src/vendor/fortemi-aiwg-index.js`). Generation is deterministic — repeat builds
are byte-identical — and failure is non-fatal (search degrades to the in-browser
fallback). See `.aiwg/architecture/adr/ADR-015-fortemi-core-search-adapter.md`.

### Build Flow

```text
resolve source
  -> run base build
  -> process tenant content and manifest
  -> apply overrides
  -> apply branding/theme/navigation/welcome
  -> copy .public assets
  -> generate Fortemi search index (search-index/)
  -> generate SEO artifacts
  -> generate collection manifests/feeds
  -> copy or sync to target
```

## Runtime Architecture

### Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Menu Toggle │ Brand │ Command Palette │ Export │
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│   Sidebar     │              Canvas                     │
│   (Nav)       │           (Content)                     │
│               │                                         │
├───────────────┴─────────────────────────────────────────┤
│                     Footer                              │
└─────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── index.html          # Shell template
├── app.js              # Core controller
├── styles.css          # All styling
├── manifest.js         # Navigation registry
├── seo.js              # Meta tag management
├── mermaid-init.js     # Diagram rendering
├── syntax-highlight.js # Code highlighting
└── lib/
    ├── search.js       # Fortemi-backed search adapter (ranking, paging, fallback)
    ├── fortemi-corpus.js # Deterministic corpus builder (shared with build)
    ├── router.js       # Hash routing utilities
    └── export.js       # Document export

scripts/lib/
├── seo-generator.js         # Build-time SEO artifacts
├── collections-generator.js # Collection manifests and feeds
└── frontmatter.js           # Markdown front-matter parsing
```

### Core Flow

```
Build: Content → Manifest → Branding → Public Assets → SEO Artifacts → Collections

Runtime: Hash Change → Router → Manifest Lookup → Module Import → Render → Post-Process
                                                        │
                                                        ├── Mermaid Diagrams
                                                        ├── Syntax Highlighting
                                                        └── SEO Meta Tags
```

## Key Components

### Router (app.js)

Hash-based navigation with history support:

```javascript
// URL: https://docs.example.com/#/guides/setup
// Resolves to section ID: "guides/setup"

window.addEventListener('hashchange', handleRoute);

function handleRoute() {
  const id = resolveTarget(location.hash);
  const section = findSection(id);
  await loadSection(section);
}
```

### Search (lib/search.js)

Ranked full-text search on the vendored `@fortemi/core` static-index engine. The
primary path loads the build-time chunked index from `search-index/` through an
index controller + fetch chunk-loader (lazy part fetch, in-memory part cache),
ranks with snippets, and returns results by offset for infinite scroll. If the
static index is missing/invalid it falls back to an in-browser index built from
section modules — same engine, same result shape.

```javascript
// Primary: fetch the chunk manifest once (precache), then page through results.
const page = await searchContentPage(MANIFEST, query, { offset, limit: 25 });
// page = { items, total, offset, limit, complete, source: 'static' | 'legacy' }
// items: section objects carrying searchRank, searchSnippet, searchMatches
```

The chunked index is emitted at build time (see "Search Index Generation"); the
runtime engine and the build-time corpus builder (`lib/fortemi-corpus.js`) share
the `@fortemi/core` `aiwg.fortemi.index.*.v1` contract.

> `@fortemi/core` is the browser-only half of [Fortémi](https://docs.fortemi.com)
> (the self-hosted Rust + PostgreSQL server shares the same JSON contracts). The
> graph and React layers — `@fortemi/graph` and `@fortemi/react` — are documented
> at [docs.fortemi.com/react](https://docs.fortemi.com/react/). See
> [Search & Data](#search-and-data) for what this enables and how far it scales.

### Mermaid Integration (mermaid-init.js)

Lazy-loaded diagram rendering:

```javascript
export async function renderMermaidBlocks(container) {
  const blocks = container.querySelectorAll('pre > code.language-mermaid');
  if (!blocks.length) return;

  const mermaid = await import('https://esm.sh/mermaid@11');
  mermaid.default.initialize({ startOnLoad: false });

  for (const block of blocks) {
    const { svg } = await mermaid.default.render(id, block.textContent);
    // Replace code block with rendered SVG
  }
}
```

### Syntax Highlighting (syntax-highlight.js)

Prism.js integration with language auto-detection:

```javascript
export async function highlightCodeBlocks(container) {
  const blocks = container.querySelectorAll('pre > code[class*="language-"]');
  if (!blocks.length) return;

  const Prism = await import('https://esm.sh/prismjs@1.29.0');
  // Load language modules dynamically
  Prism.highlightAllUnder(container);
}
```

### Export (lib/export.js)

Document composition for print/PDF:

```javascript
export function composeExportDocument(chapters) {
  // Generate TOC
  const toc = chapters.map((ch, i) => `<li>${i+1}. ${ch.title}</li>`);

  // Compose sections
  const body = chapters.map((ch, i) => `
    <section>
      <h2>${i+1}. ${ch.title}</h2>
      ${ch.html}
    </section>
  `);

  return `<!doctype html>...${toc}...${body}...`;
}
```

## Multi-Tenant Architecture

### Build-Time Isolation

Each tenant build produces an isolated bundle:

```
dist/
├── tenant-a/
│   ├── index.html      # Branded shell
│   ├── manifest.js     # Tenant navigation
│   ├── styles.css      # Themed styles
│   └── sections/       # Tenant content
└── tenant-b/
    └── ...             # Completely separate
```

### Runtime Isolation

- No shared state between tenants
- Each tenant loads its own manifest
- Theming via CSS variables replaced at build time

### Caddy Routing

Multi-tenant domain routing via Caddy:

```
tenant-a.example.com → dist/tenant-a/
tenant-b.example.com → dist/tenant-b/
```

## Performance Characteristics

### Bundle Size

| Component | Size (minified) |
|-----------|-----------------|
| Shell (HTML/CSS/JS) | ~50 KB |
| Per section | ~1-5 KB |
| Mermaid (lazy) | ~800 KB |
| Prism (lazy) | ~30 KB |

### Loading Strategy

1. **Critical Path** - Shell + manifest + first section
2. **Lazy Load** - Other sections on navigation
3. **On-Demand** - Mermaid/Prism when needed
4. **Precached** - Search index chunks fetched on first palette open and cached in memory

## Extensibility Points

### Custom Page Types

Add to `section-templates.js`:

```javascript
export const templates = {
  'custom-type': {
    render: (data) => `<section class="custom">...</section>`
  }
};
```

### Custom Components

Use HTML classes in content:

```html
<div class="my-component">...</div>
```

Add styles to tenant's `overrides/styles.css`.

### Dynamic Data

JavaScript modules can fetch external data:

```javascript
export async function load() {
  const data = await fetch('/api/data.json').then(r => r.json());
  return { html: renderWithData(data) };
}
```

## Security Considerations

- **No Server-Side Code** - Pure static assets
- **CSP Compatible** - No inline scripts in content
- **Sandboxed Content** - Each tenant in separate directory
- **No User Data** - Only localStorage for UI state
