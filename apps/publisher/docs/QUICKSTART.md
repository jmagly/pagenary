# Quickstart

Start here when you want the shortest path from Markdown to a working Pagenary
site. This uses the default theme and generated navigation, so you can see a
local site before deciding what to customize.

## Prerequisites

- Node.js >= 16 (20+ recommended)
- A project folder with npm initialized

```bash
mkdir my-docs-site
cd my-docs-site
npm init -y
npm install --save-dev @pagenary/publisher
```

## Create a Site

Use the scaffold command to create a buildable tenant with the default theme:

```bash
npx pagenary new my-docs
```

This creates the tenant content and registers it in `tenants.json`. The generated
site is intentionally plain: title, default colors, default navigation behavior,
and no custom theme work required.

## Build It

```bash
npx pagenary build my-docs
```

The static site is written to:

```text
dist/my-docs/
```

## Preview It

```bash
npx pagenary serve
```

Open:

```text
http://localhost:5173/my-docs/
```

You now have a local Pagenary site with navigation, search, export, SEO metadata,
and crawlable static snapshots.

## Edit Content

Open the generated Markdown files under the tenant's `content/` folder, then
rebuild:

```bash
npx pagenary build my-docs
```

Add more Markdown files when you need more pages. Pagenary can infer navigation
from content folders, and you can add explicit manifests later when you want
tighter control.

## Keep Going

- [Detailed Walkthrough](getting-started.md) shows the manual setup path:
  content files, `config.json`, `manifest.json`, and tenant registration.
- [Tenant Configuration](tenant-config.md) covers branding, themes, SEO,
  navigation, export, and controls.
- [Publishing](publishing.md) shows how to deploy the generated static files.
