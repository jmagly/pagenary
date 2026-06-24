# Where documentation takes shape

Pagenary turns a folder of Markdown in a git repo into a fast, searchable,
SEO-ready documentation site you host yourself — for next to nothing. Write your
docs, run one tool, and deploy the static output to any free static host
(GitHub/Gitea Pages, Netlify, Cloudflare Pages, S3, a CDN, or your own box). No
server, no database, no monthly SaaS bill — just the things you'd expect from a
paid docs platform: command-palette search with ranking, theming and branding,
Mermaid diagrams, syntax highlighting, SEO, and one-click export.

**This portal is built by Pagenary, from Pagenary's own documentation.** Every
page you see here is the same publisher pipeline applied to the developer docs in
the repository, served as a static single-page app.

## Start here

- **[Quickstart](quickstart.md)** — install, build your first site, and serve it locally.
- **[Search & Data](search-and-data.md)** — ranked hybrid search, a knowledge graph, and faceted metadata, powered by [Fortémi](https://docs.fortemi.com).
- **[Architecture](architecture.md)** — the static SPA pattern, build pipeline, and content model.
- **[Tenant Configuration](tenant-config.md)** — every `config.json` option for branding, theming, SEO, and export.

## Scale to many sites when you need to

One site is just content, a `config.json`, and a `manifest.json`. Need more than
one? The same tool publishes many sites from a shared template catalog — branding,
theming, and navigation are **data, not code**, so standing up another branded
site is cheap, and a Git-aware build rebuilds only what changed. Pagenary scales
from a weekend project to a multi-product portal without changing tools.
