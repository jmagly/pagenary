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
