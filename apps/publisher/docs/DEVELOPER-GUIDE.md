# Developer Guide

Welcome to Pagenary Publisher. This workspace lives at `apps/publisher/` inside the Pagenary platform monorepo. Use the repo-level commands (e.g. `npm run publisher:*`) when you prefer not to `cd` into the workspace. This guide keeps onboarding fast so you can focus on tailoring tenant-specific copy rather than plumbing.

## Prerequisites
- Node.js 16+
- npm (ships with Node)
- Optional: a modern browser for local testing, and a static host account for deployment

## Install & Run
```bash
npm install
npm run dev
```
The dev command builds to `dist/` and serves the bundle with live reload. Open the printed URL and start exploring.

## Project Tour
- `src/index.html` – HTML entry point with top-level shell structure
- `src/app.js` – navigation, routing, command palette, export logic
- `src/sections/section-templates.js` – template catalogue for every page type
- `src/manifest.js` – default navigation structure (overridden per tenant via `tenants/<id>/manifest.json`)
- `scripts/` – small Node utilities for building, serving, syncing sections, linting content, and checking SEO metadata

## Key Features

1. **Mermaid Diagrams** - Use fenced code blocks with `mermaid` language. Renders with zoom/pan controls and pan-on-drag functionality.

2. **External Links** - Links to external URLs (http/https) automatically open in new tab with security attributes. Use `url` property in manifest for external nav links.

3. **Internal Linking** - Link between sections with `#section-id` syntax. Build validates that all internal links reference existing sections.

4. **Bottom Navigation** - Configurable via `bottomNav` in root manifest. Options: "mobile" (default), "always", or "never".

5. **Command Palette** - Press Ctrl+K (or Cmd+K) to search and navigate sections. Supports fuzzy search across section titles and summaries.

See TENANT-CONFIG.md for full configuration details and examples.

## Common Tasks
- **Add a Section** – create `src/sections/my-section.js`, set the `SECTION_ID`, update `manifest.js`.
- **Regenerate Templates** – run `npm run sync:docs` to reset section boilerplate if you need a clean slate.
- **Branding** – tweak the logo text and footer copy in `src/index.html`; adjust colors in `src/styles.css`.
- **Export Testing** – open the app locally and use the Export button to confirm the combined PDF-ready document looks correct.

## Tenant Content Bundles
- Each tenant folder supports a `manifest.json` describing nav groupings, titles, and the content file backing each section. Use nested `sections` arrays to create expandable groups.
- Supported content types live in `tenants/<id>/content/`:
  - `.md` → converted to structured HTML (headings, lists, blockquotes supported by the lightweight parser).
  - `.html` → shipped as-is, wrapped in a loader module.
  - `.js` → copied unchanged; export a `load()` function that returns `{ html, afterRender? }` to drive rich experiences.
- Run `npm run build:tenants` after editing content. The script regenerates `dist/<id>/manifest.js` plus section modules so the navigation immediately reflects the manifest.
- Provide per-tenant overrides (styles, assets, app shell tweaks) inside `tenants/<id>/overrides/`; they copy into the tenant bundle after content generation, so you can replace generated files if needed.

## Tooling Philosophy
- Zero framework lock-in; replace `app.js` with your own router if you outgrow it.
- Scripts avoid third-party dependencies so they run in restricted environments.
- Everything is ASCII-only by default to ease diffs and downstream localization.

## Support Checklist
Before shipping to a tenant:
1. Replace placeholder copy with real content.
2. Verify navigation order and summaries in `manifest.js`.
3. Run `npm run check` to ensure lint and SEO checks pass.
4. Test export output and section highlighting.
