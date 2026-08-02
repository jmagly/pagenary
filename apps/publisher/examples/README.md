# Pagenary publishing examples

Copy-paste starting points for making any docs repo "Pagenary ready". See
[`../docs/PUBLISHING.md`](../docs/PUBLISHING.md) for the full walkthrough.

- `tenants.json` — the minimal registry: point Pagenary at your `docs/` folder.
  No `manifest.json` needed; navigation and titles are auto-discovered.
- `github-pages.yml` — drop into `.github/workflows/` to build + deploy to
  GitHub Pages.
- `gitea-pages.yml` — drop into `.gitea/workflows/` to build + publish to a
  `pages` branch.

`@pagenary/publisher` is published to the Gitea registry; the workflows install
with `--registry=https://git.integrolabs.net/api/packages/pagenary/npm/`.

## Recipe gallery & the consolidated showcase

The recipe tenants in [`recipes.tenants.json`](recipes.tenants.json) are one
content set rebuilt under many `config.json`s — see
[`../docs/THEMING-RECIPES.md`](../docs/THEMING-RECIPES.md). Build the whole
gallery with `npm run build:examples`, then serve `dist/<recipe-id>/`.

Start with [`showcase/`](showcase/) — **one deploy** that mixes a **docs shell**
and a **blog shell** (section-scoped layouts, #90), with page-effects, an
on-this-page TOC, code-copy, living scroll, and an opt-in Tally form (#91). The
remaining recipes are reserved for **theming** (palette, fonts, nav position,
blog looks): one capability site plus a focused theme gallery, instead of a
sprawl of near-duplicate deploys.

## Portfolio brochureware

[`portfolio-brochure/`](portfolio-brochure/) is an independent React-SPA
tenant proving the brochureware pipeline is repeatable beyond tenant zero. Run:

```bash
cd apps/publisher
node scripts/build-tenants.js --registry examples/recipes.tenants.json portfolio-brochure
```

To create another tenant in a normal content session:

1. Copy the directory and replace `content.json` with site, entity, and route
   data. Keep all seven template roles, or deliberately map merged pages in the
   route manifest.
2. Export that object as `pagenaryContent` from `content.mjs` (or point config
   directly at JSON). Existing TypeScript data can be normalized by a small
   adapter compiled through the tenant's React/Vite toolchain.
3. Keep `manifest.json` and `content/home.md` as the no-JS shell fallback; the
   tenant-owned React entry remains responsible for visual UX.
4. Add the tenant to a registry and build it. Treat validation failures as
   content fixes, not generator customization.
5. Verify `route-coverage.json`, seven semantic route snapshots/extracts,
   `content-index.json`, `documents.jsonl`, LLM files, sitemap/robots, the
   portfolio JSON surfaces, and the seven-record Fortémi index.

The fixture removes the main setup friction discovered during construction:
routes and entities have one shared contract, content modules stay tenant-local,
and generated artifacts need no site-specific export scripts. Content volume
and review—not publisher plumbing—should dominate the under-one-day setup goal.
