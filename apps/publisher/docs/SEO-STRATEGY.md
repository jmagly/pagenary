# SEO Strategy

Pagenary publishes a hash-routed single-page app, so it generates **crawler-facing
static artifacts** alongside the SPA. These are produced automatically at build
time by `scripts/lib/seo-generator.js` and configured via the tenant
[`seo` block](TENANT-CONFIG.md#seo-seo).

## What the build generates

| Artifact | Purpose |
|----------|---------|
| `sitemap.xml` | Absolute `<loc>` for the home page and every section's static snapshot |
| `robots.txt` | Allows `/` and `/pages/`, points at the sitemap |
| `llms.txt` | LLM-friendly site index ([llmstxt.org](https://llmstxt.org/)) |
| `/pages/<id>.html` | Per-section static snapshots with full metadata + JSON-LD, for crawlers |
| JSON-LD | `TechArticle` + `BreadcrumbList` per page; `WebSite` + optional `Organization` site-wide |
| Shell `<title>` | The build sets the static shell title from the **default page's metadata title** (`"<page title> · <brand>"`), so the crawler-visible root URL is specific, not generic. The brand alone is only a fallback |
| Runtime meta | `src/seo.js` keeps `<title>`, description, canonical, OG, and Twitter tags in sync as the SPA navigates |

## Make URLs absolute

Declare a `domain` (or `seo.siteUrl`) on the tenant. This is what turns the
sitemap `<loc>`, canonical, `og:url`, and `robots` `Sitemap:` into fully-qualified
URLs. The [sitemap protocol](https://www.sitemaps.org/protocol.html) requires
absolute URLs, so a tenant with neither set emits a non-compliant sitemap — the
build prints a warning when that happens.

Precedence: `seo.siteUrl` → `domain` (https-prefixed) → relative (warned).

## Canonical strategy

Static snapshots and the runtime SPA canonicalize to the **crawlable static URL**
(`/pages/<id>.html`), not the SPA `#hash` route. Search engines ignore URL
fragments, so hash canonicals (`/#section`) would collapse every page onto the
homepage. The `#hash` route is still used for the human-facing "interactive
version" link and the JavaScript redirect on the static page.

## Social cards

Set `seo.ogImage` (absolute or site-relative) to emit `og:image` /
`twitter:image` and upgrade `twitter:card` to `summary_large_image`. Individual
pages can override it with an `ogImage` field on the manifest entry.

## Authoring practices

- Keep manifest `summary` values concise — they power the meta description, search
  results, link previews, and the export document.
- Use human-readable, hyphenated, lowercase section `id`s — they become both the
  hash route and the static page filename (`/` becomes `--`).
- Gate broken links in CI with `strictLinks: true` (see
  [Tenant Configuration](TENANT-CONFIG.md)).
