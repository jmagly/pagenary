# Pagenary

**"Where documentation takes shape."**

Pagenary is a multi-tenant documentation publishing platform that transforms shared templates into branded, tenant-specific static sites. Zero dependencies, hash-based routing, and a powerful build system make it ideal for white-label documentation portals.

## Key Features

- **Multi-Tenant Architecture** - Each tenant gets isolated content, branding, and configuration
- **Zero Runtime Dependencies** - Pure vanilla HTML, CSS, and ES modules
- **Full-Text Search** - Command palette (`Ctrl/Cmd+K`) searches across all content
- **Mermaid Diagrams** - Native support for flowcharts, sequence diagrams, and more
- **Syntax Highlighting** - Prism.js integration for code blocks
- **Theming** - Per-tenant colors, branding, and typography
- **Document Export** - One-click PDF-ready HTML export with TOC
- **Incremental Builds** - Git-aware builds for fast iteration

## Quick Start

```bash
# Clone and install
git clone https://github.com/jmagly/dbbuilder.git pagenary
cd pagenary
npm run bootstrap

# Build and serve the default bundle
npm run publisher:build
npm run publisher:serve
# Visit http://localhost:5173

# Build all tenant bundles
npm run publisher:build:tenants
```

## Creating Your First Tenant

1. **Register the tenant** in `apps/publisher/tenants.json`:
```json
{
  "my-docs": {
    "source": "/path/to/my-docs",
    "domain": "my-docs.local"
  }
}
```

2. **Create tenant structure**:
```
my-docs/
├── config.json          # Branding and theme
├── manifest.json        # Navigation structure (optional)
└── content/
    ├── welcome.md       # Markdown content
    ├── guide.html       # HTML content
    └── dashboard.js     # Dynamic JS modules
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
npm run publisher:build:tenants my-docs
npm run publisher:serve
# Visit http://localhost:5173/my-docs/
```

## Repository Layout

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

Run from repository root:

```bash
# Workspace management
npm run bootstrap              # Install all dependencies

# Publisher commands
npm run publisher:build        # Build default bundle
npm run publisher:build:tenants # Build all tenant bundles
npm run publisher:serve        # Serve dist/ on localhost:5173

# From apps/publisher/:
npm run dev                    # Build + serve with watch
npm run build:tenants [id]     # Build specific or all tenants
npm run build:incremental [id] # Git-aware incremental build
npm run caddy:up               # Start multi-tenant Caddy server
npm run caddy:down             # Stop Caddy server
npm test                       # Run test suite
```

## Documentation

- [Publisher README](apps/publisher/README.md) - Full feature documentation
- [Quick Start Guide](apps/publisher/docs/QUICKSTART.md) - Step-by-step tenant setup
- [Tenant Configuration](apps/publisher/docs/TENANT-CONFIG.md) - All config options
- [Architecture](apps/publisher/docs/ARCHITECTURE.md) - System design
- [API Reference](apps/publisher/docs/API.md) - Module documentation
- [Deployment](apps/publisher/docs/DEPLOYMENT.md) - Hosting patterns

## License

MIT
