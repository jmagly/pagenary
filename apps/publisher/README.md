# Pagenary Publisher

Static publishing component for Pagenary — "Where documentation takes shape." It repackages shared documentation templates into tenant-specific bundles with optional branding, while keeping the underlying shell dependency-free. Run the commands below either from this workspace directory or via the monorepo helpers (`npm run publisher:*` from the repository root).

## Quick Start
Install dependencies inside this workspace, then use the convenience scripts for local development.

```bash
npm install
npm run dev         # build + serve with watch mode
# or
npm run build       # copy src → dist/
npm run serve       # preview dist/ on localhost

# optional utilities
npm run lint:content # trailing whitespace / tab scan
npm run check:seo    # verify dist/ metadata after build
npm run check        # run lint + SEO checks together
npm run build:tenants # compile every config in tenants/ into dist/<tenant-id>/
# domain testing
# add `127.0.0.1 tenant-alpha.local tenant-beta.local` to /etc/hosts and run `npm run caddy:up`
# export `DOCS_TOOLKIT_PORT=5173` if you prefer a non-privileged host port (visit http://tenant-alpha.local:5173)
# use `npm run caddy:down` to stop the container when you're done

# regenerate template modules
npm run sync:docs
```
The static bundle lives in `dist/`. Any CDN, object store, or minimal web server can host it—the hash router only requires `index.html`.

## Highlights
- **Template-Driven Sections** – each file in `src/sections/` calls a shared renderer so every page type (guides, tutorials, use cases, operations, etc.) shares consistent scaffolding.
- **Deterministic Manifest** – `src/manifest.js` builds navigation from declarative section metadata and keeps summaries ready for export/share cards.
- **Command Palette** – `Ctrl/Cmd + K` (or `/`) opens the global finder; queries persist via `localStorage` and highlight matches after navigation.
- **Document Export** – the Export button assembles all sections into a print-ready HTML document with an automatic table of contents and timestamps.

## Docker Caddy Workflow
- Build tenants with `npm run build:tenants` before launching the container so `dist/` holds per-tenant bundles.
- Start the local Caddy reverse proxy with `npm run caddy:up`; it forwards port 80 by default (HTTP/1.1 + HTTP/2 only to avoid UDP buffer warnings). Override the host port via `DOCS_TOOLKIT_PORT=5173 npm run caddy:up` when you don’t want privileged bindings, then browse using that port (e.g. `http://tenant-alpha.local:5173`).
- Update your hosts file with `127.0.0.1 tenant-alpha.local tenant-beta.local` (and any additional tenants you add).
- Tail logs via `npm run caddy:logs`, reload the config with `npm run caddy:reload`, restart the container via `npm run caddy:restart`, and stop the stack using `npm run caddy:down`.
- If the configuration file changes, rebuild assets and apply the new config with `npm run caddy:reload` (the container stays running).

## Tenant Content Workflow
- Each tenant folder can declare a manifest (`tenants/<tenant-id>/manifest.json`) describing nav groups and the file backing each section.
- Place Markdown, HTML, or JavaScript modules inside `tenants/<tenant-id>/content/`; the build converts Markdown to HTML, wraps static HTML, or copies JavaScript modules unchanged.
- Run `npm run build:tenants` to generate per-tenant bundles. The script rebuilds `dist/<tenant-id>/manifest.js` and `dist/<tenant-id>/sections/` based on the manifest.
- Use Markdown for long-form docs, HTML for direct markup control, and JavaScript when you need dynamic rendering (e.g. dashboards) that return `{ html, afterRender? }`.

## Repository Layout
- `src/` – SPA shell (`index.html`, `app.js`, `styles.css`, manifest, section templates)
- `scripts/` – zero-dependency build, dev server, SEO, lint, and section sync utilities
- `docs/` – design notes, deployment guidance, extension patterns, developer onboarding
- `assets/` – reserved for imagery or downloadable collateral (optional)

## Next Steps
- Replace placeholder copy inside templates with tenant-specific content.
- Extend `section-templates.js` with new patterns as additional page types emerge.
- Integrate automated checks (content linting, accessibility sweeps) into CI before publishing.
