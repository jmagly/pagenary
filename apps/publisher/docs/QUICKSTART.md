# Quick Start Guide

Create your first Pagenary documentation site in 10 minutes. For a more guided,
zero-assumptions walkthrough, see [Getting Started](GETTING-STARTED.md).

## Prerequisites

- Node.js ≥ 16 (20+ recommended)

## Step 1: Install Pagenary

Use the published package — no clone required:

```bash
npm install --save-dev @pagenary/publisher
npx pagenary --help            # confirm the CLI is available
```

> **Building Pagenary from source instead?** Clone the repo and work from the
> workspace (for contributors / modifying the generator):
> ```bash
> git clone https://github.com/jmagly/pagenary.git
> cd pagenary && npm run bootstrap
> npm run publisher:build && npm run publisher:serve
> ```

## Key Features

Pagenary includes several powerful features out of the box:

- **Command Palette** - Press `Ctrl+K` (or `Cmd+K` on Mac) to quickly navigate, search, and export
- **Mermaid Diagrams** - Embed flowcharts, sequence diagrams, and more using Mermaid syntax
- **Smart External Links** - External links automatically open in new tabs with security headers

## Step 2: Create Your Tenant Directory

Create a new directory for your documentation (can be anywhere on your system):

```bash
mkdir ~/my-docs
cd ~/my-docs
```

Create the basic structure:

```bash
mkdir content
```

## Step 3: Add Branding Configuration

Create `config.json`:

```json
{
  "title": "My Product Documentation",
  "description": "Complete guide to using My Product",
  "brandMark": "MY",
  "brandSub": "PRODUCT",
  "tagline": "Documentation that works",
  "copyright": "My Company",
  "accentColor": "#3B82F6",
  "surfaceColor": "#F8FAFC"
}
```

## Step 4: Create Your First Content

Create `content/welcome.md`:

```markdown
# Welcome to My Product

This is your documentation home page.

## Getting Started

Here's what you need to know to get started with My Product.

### Installation

\`\`\`bash
npm install my-product
\`\`\`

### Quick Example

\`\`\`javascript
import { MyProduct } from 'my-product';

const app = new MyProduct();
app.start();
\`\`\`

## Features

- **Fast** - Built for speed
- **Simple** - Easy to use
- **Powerful** - Full-featured

## Architecture

\`\`\`mermaid
graph TD
    A[User] --> B[Frontend]
    B --> C[API]
    C --> D[Database]
\`\`\`
```

Create `content/installation.md`:

```markdown
# Installation Guide

## Requirements

- Node.js 18 or higher
- npm or yarn

## Install via npm

\`\`\`bash
npm install my-product
\`\`\`

## Install via yarn

\`\`\`bash
yarn add my-product
\`\`\`

## Verify Installation

\`\`\`bash
npx my-product --version
\`\`\`
```

## Step 5: Create Navigation Manifest

Create `manifest.json`:

```json
[
  {
    "id": "welcome",
    "title": "Welcome",
    "summary": "Introduction to My Product",
    "file": "welcome.md"
  },
  {
    "id": "installation",
    "title": "Installation",
    "summary": "How to install My Product",
    "file": "installation.md"
  }
]
```

## Step 6: Register Your Tenant

Create (or edit) a `tenants.json` at your project root and add your tenant. The
registry is an array; `source` is an object (`local` or `git`):

```json
{
  "tenants": [
    {
      "id": "my-docs",
      "source": { "type": "local", "path": "./my-docs" },
      "strictLinks": true
    }
  ]
}
```

> Building from source? Edit `apps/publisher/tenants.json` in the cloned repo instead.

## Step 7: Build and Preview

```bash
# Build your tenant
npx pagenary build:tenants my-docs

# Start the server
npx pagenary serve

# Visit http://localhost:5173/my-docs/
```

> From source, the equivalents are `npm run build:tenants my-docs` and `npm run serve`.

You should see your documentation with your branding applied.

## Step 8: Set Up Local Domain (Optional)

For a more realistic preview with custom domains:

1. Edit `/etc/hosts` (Linux/Mac) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1 my-docs.local
```

2. Start the Caddy server:
```bash
npm run caddy:up
```

3. Visit http://my-docs.local

## Next Steps

### Add More Content

Create additional `.md`, `.html`, or `.js` files in `content/`:

```
content/
├── welcome.md
├── installation.md
├── guides/
│   ├── _manifest.json
│   ├── getting-started.md
│   └── advanced.md
└── api/
    ├── _manifest.json
    └── reference.md
```

### Organize with Section Manifests

Create `content/guides/_manifest.json`:

```json
{
  "title": "Guides",
  "sections": [
    { "id": "getting-started", "title": "Getting Started", "file": "getting-started.md" },
    { "id": "advanced", "title": "Advanced Usage", "file": "advanced.md" }
  ]
}
```

### Add Rich Content

**Tables:**
```html
<table class="spec-table">
  <thead>
    <tr><th>Feature</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr><td>Search</td><td>Ready</td></tr>
    <tr><td>Export</td><td>Ready</td></tr>
  </tbody>
</table>
```

**Diagrams:**
```mermaid
sequenceDiagram
    User->>API: Request
    API->>DB: Query
    DB-->>API: Results
    API-->>User: Response
```

### Customize Theme

Adjust colors in `config.json`:

| Color | Purpose | Example |
|-------|---------|---------|
| `accentColor` | Links, buttons, highlights | `#3B82F6` (blue) |
| `surfaceColor` | Page background | `#F8FAFC` (off-white) |

### Deploy

Your built site is in `dist/my-docs/`. Deploy it anywhere that serves static files:

- **Netlify/Vercel**: Point to `dist/my-docs/`
- **S3/GCS**: Upload the folder
- **Docker**: Use the included Caddy setup

## Troubleshooting

### Content not appearing?

1. Check that `manifest.json` references the correct file paths
2. Verify files exist in `content/`
3. Run `npx pagenary build:tenants my-docs` and check for errors

### Styles not applied?

1. Verify `config.json` is valid JSON
2. Check color values are valid hex codes (e.g., `#3B82F6`)

### Search not working?

The command palette loads a prebuilt static index (`dist/<tenant>/search-index/`)
on first open — wait a moment for "Indexing content…" to clear. If that directory
is missing (e.g., an older build), search falls back to indexing in the browser on
first use. Rebuild with `npm run build:tenants` to regenerate the static index.

## Resources

- [Tenant Configuration](TENANT-CONFIG.md) - All config options
- [Architecture](ARCHITECTURE.md) - How it works
- [API Reference](API.md) - Module documentation
- [Deployment](DEPLOYMENT.md) - Hosting guide
