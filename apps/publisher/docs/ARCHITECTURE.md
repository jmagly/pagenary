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
    ├── search.js       # Full-text search
    ├── router.js       # Hash routing utilities
    └── export.js       # Document export
```

### Core Flow

```
Hash Change → Router → Manifest Lookup → Module Import → Render → Post-Process
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

Full-text search with lazy indexing:

```javascript
// First search: load all modules, extract text, build index
// Subsequent: search cached index

async function buildSearchIndex(manifest) {
  const sections = flattenManifest(manifest);
  return Promise.all(sections.map(async (section) => {
    const mod = await import(section.module);
    const { html } = await mod.load();
    return { ...section, searchContent: extractText(html) };
  }));
}
```

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
4. **Cached** - Search index after first search

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
