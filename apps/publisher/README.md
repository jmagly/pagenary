# Pagenary Publisher

Static publishing component for Pagenary — "Where documentation takes shape."

Transform shared documentation templates into tenant-specific bundles with custom branding, themes, and content. Zero runtime dependencies, hash-based routing, and full-text search make it ideal for white-label documentation portals.

## Quick Start

```bash
npm install
npm run dev         # Build + serve with watch mode

# Or separately:
npm run build       # Build default bundle to dist/
npm run serve       # Preview on http://localhost:5173
```

## Features

### Content Authoring
- **Markdown** - Write in `.md` files with full CommonMark support
- **HTML** - Direct markup control with `.html` files
- **JavaScript Modules** - Dynamic content with `.js` files returning `{ html, afterRender? }`
- **Nested Directories** - Organize content in subdirectories (`content/guides/setup.md`)

### Rich Content
- **Mermaid Diagrams** - Flowcharts, sequence diagrams, state machines, and more
- **Syntax Highlighting** - Prism.js with 10+ language support
- **Markdown Tables** - Full table syntax with alignment support
- **HTML Components** - Spec tables, layer stacks, box diagrams, cards
- **Internal Links** - Auto-resolved `#section-id` links in Markdown

### External Links
- **Navigation Links** - Add external URLs directly in manifest with `url` property
- **Smart Link Handling** - All external links open in new tab with security headers
- **Visual Indicators** - Subtle ↗ icon shows external destinations
- **CTA Styling** - Button-like `external-cta` class for prominent external links

**External navigation example** (manifest.json):
```json
[
  { "id": "welcome", "title": "Welcome", "file": "welcome.md" },
  { "title": "External Resource", "url": "https://example.com" }
]
```

**External links in Markdown** (auto-handled):
```markdown
Visit our [support portal](https://support.example.com) for help.
```

**Prominent CTA in HTML**:
```html
<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="external-cta">
  Get Started →
</a>
```

**Security & UX:**
- All external links use `target="_blank"` and `rel="noopener noreferrer"` by default
- Navigation external links show ↗ indicator
- Content external links styled with subtle ↗ after link text
- No configuration needed - works automatically for `http://` and `https://` URLs

### Navigation & Search
- **Command Palette** - `Ctrl/Cmd+K` or `/` opens global finder
- **Full-Text Search** - Searches all content, not just titles
- **Manifest-Driven Nav** - Declarative navigation structure
- **Keyboard Navigation** - Arrow keys, Enter to select

### Theming & Branding
- **Custom Colors** - `accentColor` and `surfaceColor` per tenant
- **Brand Identity** - Logo text, tagline, copyright
- **Typography** - IBM Plex Sans/Mono defaults, customizable

### Export & Sharing
- **Export Options** - Choose between Current Page or Entire Site export
- **Branded Exports** - Tenant logo, brand name, and tagline in export header
- **Document Export** - One-click HTML export with TOC
- **Print Styles** - Optimized for PDF generation
- **Syntax Highlighting** - Preserved in exports
- **Table Rendering** - Markdown tables render correctly in exports

## Tenant Content Workflow

### Directory Structure

```
my-tenant/
├── config.json           # Branding and theme settings
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

**Root manifest.json** (optional - auto-generated from content/ if omitted):
```json
[
  {
    "id": "welcome",
    "title": "Welcome",
    "file": "welcome.md"
  },
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

**External links in manifest** (use `url` instead of `id`):
```json
[
  { "id": "welcome", "title": "Welcome", "file": "welcome.md" },
  { "title": "Support Portal", "url": "https://support.example.com" },
  {
    "id": "resources",
    "title": "Resources",
    "subsections": [
      { "id": "guides/overview", "title": "Overview", "file": "guides/overview.md" },
      { "title": "API Docs", "url": "https://api.example.com/docs" }
    ]
  }
]
```

### Branding Configuration

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
  "export": {
    "logo": "embed",
    "logoPath": "favicon.png",
    "showTagline": true,
    "showDate": true
  }
}
```

| Property | Description | Default |
|----------|-------------|---------|
| `title` | Browser tab title | "Docs Toolkit" |
| `description` | Meta description for SEO | - |
| `brandMark` | Primary brand text (bold) | "DOCS" |
| `brandSub` | Secondary brand text (light) | "TOOLKIT" |
| `tagline` | Subtitle under brand | - |
| `copyright` | Footer copyright text | "Modular Documentation Toolkit" |
| `accentColor` | Links, buttons, highlights | `#111111` |
| `surfaceColor` | Background color (hex) | `#ffffff` |
| `export.logo` | Logo mode: `"embed"`, `"reference"`, or `null` | `"embed"` |
| `export.logoPath` | Path to logo in `.public/` directory | Auto-detect |
| `export.showTagline` | Show tagline in export header | `true` |
| `export.showDate` | Show generation date in export | `true` |

## Build Commands

```bash
# Full builds
npm run build                    # Build default bundle
npm run build:tenants            # Build all registered tenants
npm run build:tenants my-tenant  # Build specific tenant

# Incremental builds (git-aware)
npm run build:incremental my-tenant  # Only rebuild changed files

# Development
npm run dev                      # Build + serve with watch
npm run serve                    # Serve dist/ on localhost:5173

# Utilities
npm run lint:content             # Check for trailing whitespace/tabs
npm run check:seo                # Verify SEO metadata
npm run check                    # Run all checks
npm run sync:docs                # Regenerate section templates
npm test                         # Run test suite
```

## Tenant Registry

Register tenants in `tenants.json`:

```json
{
  "my-docs": {
    "source": "/absolute/path/to/my-docs",
    "domain": "my-docs.local"
  },
  "client-portal": {
    "source": "git:https://github.com/org/client-docs.git#main",
    "domain": "docs.client.com"
  }
}
```

**Source types:**
- **Local path**: `/absolute/path/to/content`
- **Git repository**: `git:https://github.com/org/repo.git#branch`

## Docker Caddy Workflow

For multi-tenant domain testing:

```bash
# Add to /etc/hosts:
# 127.0.0.1 my-docs.local client-portal.local

# Build tenants and start Caddy
npm run build:tenants
npm run caddy:up

# Visit http://my-docs.local or http://client-portal.local

# Management commands
npm run caddy:logs      # Tail logs
npm run caddy:reload    # Reload config without restart
npm run caddy:restart   # Full restart
npm run caddy:down      # Stop container
```

Use non-privileged port: `DOCS_TOOLKIT_PORT=5173 npm run caddy:up`

## Repository Layout

```
apps/publisher/
├── src/
│   ├── index.html          # SPA shell
│   ├── app.js              # Router and core logic
│   ├── styles.css          # All styling
│   ├── manifest.js         # Default navigation
│   ├── seo.js              # Meta tag management
│   ├── mermaid-init.js     # Diagram rendering
│   ├── syntax-highlight.js # Code highlighting
│   ├── lib/
│   │   ├── search.js       # Full-text search
│   │   ├── router.js       # Hash routing
│   │   └── export.js       # Document export
│   └── sections/           # Default section modules
├── scripts/
│   ├── build.js            # Core build script
│   ├── build-tenants.js    # Multi-tenant builder
│   ├── serve.js            # Dev server
│   └── sync-docs.js        # Template sync
├── tenants/                # Built-in example tenants
├── docs/                   # Documentation
├── dist/                   # Build output
├── Caddyfile              # Multi-tenant routing
└── docker-compose.yml     # Caddy container
```

## Documentation

- [Quick Start Guide](docs/QUICKSTART.md) - Step-by-step tenant creation
- [Tenant Configuration](docs/TENANT-CONFIG.md) - All config options
- [Architecture](docs/ARCHITECTURE.md) - System design
- [API Reference](docs/API.md) - Module documentation
- [Deployment](docs/DEPLOYMENT.md) - Hosting patterns
- [Extending](docs/EXTENDING.md) - Customization guide
