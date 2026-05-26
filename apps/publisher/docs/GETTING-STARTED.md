# Getting Started with Pagenary

This guide takes you from nothing to a published documentation site using the
**`@pagenary/publisher` npm package**. No cloning, no build-from-source — you
install the package and point it at your content.

> **What Pagenary does:** it turns a folder of Markdown/HTML into a self-contained
> static documentation site (a single-page app with hash routing, search, and
> export). One install can publish many separately-branded sites ("tenants").

You only need to clone this repository if you want to **modify Pagenary itself**
(templates, the generator). To *use* it, follow the steps below.

---

## Prerequisites

- **Node.js ≥ 16** (`node --version`). Node 20+ recommended.
- A project directory to work in. A fresh folder is fine:
  ```bash
  mkdir my-site && cd my-site
  npm init -y
  ```

---

## Step 1 — Install the package

```bash
npm install --save-dev @pagenary/publisher
```

Verify it's available:

```bash
npx pagenary --help
```

You should see the commands: `build`, `build:tenants`, `tenants:list`, `serve`.

---

## Step 2 — Add your content

Create a `docs/` folder with a `content/` subfolder and one or more Markdown files:

```bash
mkdir -p docs/content
cat > docs/content/welcome.md <<'EOF'
# Welcome

This is my first Pagenary page. Add more `.md` files under `content/`.
EOF
```

Add a `config.json` in `docs/` for branding:

```bash
cat > docs/config.json <<'EOF'
{
  "title": "My Docs",
  "brandMark": "My",
  "brandSub": "Docs",
  "tagline": "Documentation, the easy way."
}
EOF
```

That's the minimum. (Navigation, themes, SEO, and more are optional — see
[Tenant Configuration](TENANT-CONFIG.md).)

---

## Step 3 — Register the tenant

Create a `tenants.json` at your project root. A **tenant** is one published site;
`source` points at the content folder you just made:

```json
{
  "tenants": [
    {
      "id": "my-docs",
      "source": { "type": "local", "path": "./docs" },
      "strictLinks": true
    }
  ]
}
```

- `id` — the tenant's name (lowercase, used in the output path and URL).
- `source.path` — a path **relative to where you run the command** (your project).
- `strictLinks: true` — **fail the build** if any internal link is broken (a good
  CI gate). Set it to `false` to downgrade broken links to warnings.

---

## Step 4 — Build

```bash
npx pagenary build:tenants my-docs
```

This writes a complete static site to `dist/my-docs/`. On success you'll see
`Tenant my-docs ready` and `Build complete. Built: 1`.

If you set `strictLinks: true` and a link is broken, the build **fails with a
non-zero exit code** — that's intentional, so CI can catch it. Fix the link, or
set `strictLinks: false`.

---

## Step 5 — Preview it locally

```bash
npx pagenary serve
```

Open **http://localhost:5173/my-docs/** in a browser. You'll see your site with
working navigation, search, and export.

---

## Step 6 — Deploy

The output in `dist/my-docs/` is **static files with zero runtime dependencies**.
Host it anywhere that serves files — GitHub/Gitea Pages, Netlify, S3, nginx, a CDN.
Just upload the contents of `dist/my-docs/`.

For multi-tenant domain routing and hosting patterns, see [Deployment](DEPLOYMENT.md).

---

## Common first-time issues

| Symptom | Cause / fix |
|---------|-------------|
| `Cannot find module … build.js` on an old version | Upgrade: `npm install -D @pagenary/publisher@latest` (fixed in 2026.5.1). |
| Build "fails" on broken links | `strictLinks: true` is doing its job — fix the link or set `strictLinks: false`. |
| `No tenants to build` | Check `tenants.json` exists at your CWD and the tenant `id` matches the one you passed. |
| Tenant builds but pages are empty | Ensure your content lives under `content/` (or matches your `manifest.json`). |
| Want to script it | Every command is plain CLI; extra flags pass through (e.g. `npx pagenary build:tenants --incremental`). |

---

## Where to go next

- [Tenant Configuration](TENANT-CONFIG.md) — every `config.json` / `tenants.json` option (branding, navigation, themes, SEO, overrides).
- [Quick Start Guide](QUICKSTART.md) — a more detailed tenant walkthrough.
- [Architecture](ARCHITECTURE.md) — how the static SPA + build pipeline work.
- [Deployment](DEPLOYMENT.md) — hosting and multi-tenant domains.
- [Extending](EXTENDING.md) — add section templates and content types (build-from-source territory).
