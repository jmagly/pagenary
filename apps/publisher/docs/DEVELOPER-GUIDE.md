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
- `docs/ACCESSIBLE-AUTHORING.md` – author-facing guidance for alt text, headings, links, tables, diagrams, media, embeds, and custom HTML.

## Key Features

1. **Mermaid Diagrams** - Use fenced code blocks with `mermaid` language. Renders with zoom/pan controls and pan-on-drag functionality.

2. **External Links** - Links to external URLs (http/https) automatically open in new tab with security attributes. Use `url` property in manifest for external nav links.

3. **Internal Linking** - Link between sections with `#section-id` syntax. Build validates that all internal links reference existing sections.

4. **Bottom Navigation** - Configurable via `bottomNav` in root manifest. Options: "mobile" (default), "always", or "never".

5. **Command Palette** - Press Ctrl+K (or Cmd+K) to search and navigate sections. Ranked full-text search (titles, summaries, and rendered content) via the vendored `@fortemi/core` static index, with snippets and infinite scroll.

See TENANT-CONFIG.md for full configuration details and examples.

## Common Tasks
- **Add a Section** – create `src/sections/my-section.js`, set the `SECTION_ID`, update `manifest.js`.
- **Regenerate Templates** – run `npm run sync:docs` to reset section boilerplate if you need a clean slate.
- **Branding** – tweak the logo text and footer copy in `src/index.html`; adjust colors in `src/styles.css`.
- **Export Testing** – open the app locally and use the Export button to confirm the combined PDF-ready document looks correct.

## Tenant Content Bundles
- Each tenant folder supports a `manifest.json` describing nav groupings, titles, and the content file backing each section. Use nested `sections` arrays to create expandable groups. Put `file` on a grouped entry when that group should publish its own authored section heading page; omit `file` when it should stay a navigation-only container that routes to its first child.
- Supported content types live in `tenants/<id>/content/`:
  - `.md` → converted to structured HTML (headings, lists, blockquotes supported by the lightweight parser).
  - `.html` → shipped as-is, wrapped in a loader module.
  - `.js` → copied unchanged; export a `load()` function that returns `{ html, afterRender? }` to drive rich experiences.
- Run `npm run build:tenants` after editing content. The script regenerates `dist/<id>/manifest.js` plus section modules so the navigation immediately reflects the manifest.
- Provide per-tenant overrides (styles, assets, app shell tweaks) inside `tenants/<id>/overrides/`; they copy into the tenant bundle after content generation, so you can replace generated files if needed.

## Authoring Collection Posts

Use collections when a tenant needs a feed-like content group such as a blog,
release notes, news, or changelog. Configure the collection in
`TENANT-CONFIG.md` under `collections`, then add Markdown posts under the
configured content path.

Each post can start with front matter parsed by `scripts/lib/frontmatter.js`:

```markdown
---
title: Launch Notes
date: 2026-05-28
summary: What changed in this release
tags: [release, platform]
hero: /assets/blog/launch.png
---

# Launch Notes

Post content starts here.
```

During `npm run build:tenants`, `scripts/lib/collections-generator.js` reads those
posts and writes `index.json` plus optional `feed.xml` under the collection
route. See `TENANT-CONFIG.md` for the collection config schema and `API.md` for
the generated entry shape.

## Extending SEO Output

Tenant SEO settings live in `TENANT-CONFIG.md` under `seo`. The runtime
`src/seo.js` module updates browser metadata after navigation, while the build-time
`scripts/lib/seo-generator.js` module emits crawler-facing artifacts:

- `sitemap.xml`
- `robots.txt`
- `llms.txt`
- static snapshots under `pages/`
- JSON-LD metadata for generated pages

Extend `scripts/lib/seo-generator.js` when the output artifact set changes, and update
`API.md` when adding or changing exported helpers.

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
