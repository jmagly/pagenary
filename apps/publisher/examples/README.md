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
