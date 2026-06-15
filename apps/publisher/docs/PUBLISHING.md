# Publish your docs with GitHub or Gitea Actions

Turn any folder of docs into a deployed, searchable site in one workflow file.
You don't need a tidy layout, a manifest, or front matter — point Pagenary at a
directory of Markdown and it discovers the structure, turns filenames and folders
into navigation and titles, and builds a static, searchable, SEO-ready site. Add
a workflow, push, and your docs are live.

## The gentle on-ramp (fewest files)

Most repos already have a `docs/` folder (or just Markdown at the root). The only
file Pagenary needs is a small registry that points at it:

```json
// tenants.json  (at your repo root)
{
  "tenants": [
    {
      "id": "mydocs",
      "source": { "type": "local", "path": "./docs" },
      "config": { "title": "My Project Docs", "brandMark": "My", "brandSub": "Docs" }
    }
  ]
}
```

That's it. No `manifest.json` required — Pagenary **auto-discovers**:

- **Navigation** comes from your folder structure (subfolders become groups).
- **Titles** come from front-matter `title`, else the first `# H1`, else a
  humanized filename (`getting-started.md` → "Getting Started"; known acronyms
  like API/CLI/HTTP are preserved).
- **Ordering** is alphabetical unless you drop an optional `_manifest.json` in a
  folder to set order/titles.
- **Content types**: `.md`, `.html`, and `.js` modules all work side by side.

Build locally to preview:

```bash
npm install --no-save @pagenary/publisher \
  --registry=https://git.integrolabs.net/api/packages/pagenary/npm/
npx pagenary build:tenants mydocs --target ./_site
npx pagenary serve            # http://localhost:5173/mydocs/
```

> **Registry note.** `@pagenary/publisher` is published to the Gitea registry
> above. Either pass `--registry=…` on install (shown throughout) or add an
> `.npmrc` with `@pagenary:registry=https://git.integrolabs.net/api/packages/pagenary/npm/`.

Because asset URLs resolve through a per-tenant `<base>`, the same build works
whether you serve it at a domain root **or** under a subpath (e.g. GitHub Pages
project sites at `you.github.io/repo/`).

## GitHub → GitHub Pages

Add `.github/workflows/docs.yml` to your docs repo and enable Pages
(Settings → Pages → Source: GitHub Actions):

```yaml
name: Publish docs

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build the docs site
        run: |
          npm install --no-save @pagenary/publisher \
            --registry=https://git.integrolabs.net/api/packages/pagenary/npm/
          npx pagenary build:tenants mydocs --target ./_site
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./_site/mydocs

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

A project-site Pages URL (`you.github.io/repo/`) is a subpath — Pagenary's
`<base>` resolution handles it with no extra config. For a user/org site or a
custom domain (served at the root), it works unchanged.

## Gitea → Gitea Pages

Add `.gitea/workflows/docs.yml`. Gitea Pages serves a branch (commonly `pages`),
so this builds the site and publishes it there:

```yaml
name: Publish docs

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Build the docs site
        run: |
          npm install --no-save @pagenary/publisher \
            --registry=https://git.integrolabs.net/api/packages/pagenary/npm/
          npx pagenary build:tenants mydocs --target ./_site
      - name: Publish to the pages branch
        env:
          GIT_TOKEN: ${{ secrets.PAGES_TOKEN }}   # a token with repo write
        run: |
          cd ./_site/mydocs
          touch .nojekyll
          git init -q && git add -A
          git -c user.name=ci -c user.email=ci@local commit -qm "docs build"
          git push -f "https://oauth2:${GIT_TOKEN}@${GITHUB_SERVER_URL#https://}/${GITHUB_REPOSITORY}.git" HEAD:pages
```

Then point Gitea Pages (or any static host / reverse proxy) at the `pages`
branch. If you serve through Caddy, the bundled config in this repo
(`docker-compose.yml` + `Caddyfile`, see `README.md` → Docker Caddy Workflow) is
a working multi-tenant example.

## Build straight from a git repo (no checkout step)

Pagenary can clone the content itself, so a publishing repo can build docs that
live in **another** repo — handy for monorepos or aggregating several sources:

```json
// tenants.json
{
  "tenants": [
    {
      "id": "mydocs",
      "source": {
        "type": "git",
        "url": "https://github.com/me/my-project.git",
        "ref": "main",
        "path": "docs/"
      },
      "config": { "title": "My Project Docs" }
    }
  ]
}
```

`pagenary build:tenants --incremental` then rebuilds only what changed between
runs (it tracks the source commit), which keeps CI fast on large corpora.

## Works even when the layout isn't ideal

You do not have to reorganize an existing pile of docs to get value:

- **No front matter?** Titles fall back to the first `# H1`, then the filename.
- **Flat folder of Markdown?** You get a flat, searchable nav.
- **Deeply nested folders?** They become nested nav groups automatically.
- **Mixed `.md` / `.html` / `.js`?** All render; HTML ships as-is, JS modules can
  build their own markup.
- **Want to tune one corner?** Drop an `_manifest.json` in just that folder to set
  titles/order — everything else stays auto-discovered.

Start with zero configuration, then add only the structure you actually want.

## Next steps

- [Tenant Configuration](TENANT-CONFIG.md) — branding, theming, SEO, and export options.
- [SEO Strategy](SEO-STRATEGY.md) — sitemaps, snapshots, titles, and structured data.
- [Architecture](ARCHITECTURE.md) — how the build and the static SPA fit together.
