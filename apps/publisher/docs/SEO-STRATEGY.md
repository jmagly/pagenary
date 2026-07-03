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
| `content-index.json` / `documents.jsonl` | Open-profile machine-readable corpus index and bulk ingestion records |
| `/pages/<id>.json` / `/pages/<id>.txt` | Open-profile per-page metadata and body-text extracts |
| `/pages/<id>.html` | Per-section static snapshots with full metadata + JSON-LD, for crawlers |
| Root HTML fallback | The root `index.html` embeds the default page's rendered HTML by default (`seo.rootHtmlFallback: true`) so no-JS readers do not see an empty SPA shell |
| JSON-LD | `TechArticle` + `BreadcrumbList` per page; `WebSite` + optional `Organization` site-wide |
| Shell `<title>` | The build sets the static shell title from the **default page's metadata title** (`"<page title> · <brand>"`), so the crawler-visible root URL is specific, not generic. The brand alone is only a fallback |
| Runtime meta | `src/seo.js` keeps `<title>`, description, canonical, OG, and Twitter tags in sync as the SPA navigates |

For tenants that need a simpler high-level choice, set
`seo.discoverabilityProfile`:

| Profile | Sitemap | Robots | `llms.txt` | Static pages | Corpus artifacts | Root fallback | Indexing signal |
|---|---|---|---|---|---|---|---|
| `standard` | yes | allow `/` and `/pages/` | yes | yes | no | yes | indexable |
| `open` | yes | allow plus permissive `Content-Signal` | yes, with extract links | yes | yes | yes | indexable |
| `limited` | no | `Disallow: /` | no | yes | no | yes | `noindex, nofollow` |
| `locked` | no | `Disallow: /` | no | no | no | no | `noindex, nofollow` |

Low-level fields such as `generateSitemap`, `generateStaticPages`,
`generateLlmsTxt`, `generateCorpusArtifacts`, `rootHtmlFallback`, and
`robots.sitemap` override profile artifact defaults. `limited` and `locked`
remain advisory static-site modes, not access control.

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

The root SPA shell is also readable without JavaScript by default: the build
embeds the default page's rendered HTML into `index.html` before the runtime
loads. JavaScript-enabled browsers still hydrate/replace that content. Set
`seo.rootHtmlFallback: false` only for tenants that deliberately want a JS-only
root shell.

## Social cards

Set `seo.ogImage` (absolute or site-relative) to emit `og:image` /
`twitter:image` and upgrade `twitter:card` to `summary_large_image`. Individual
pages can override it with an `ogImage` field on the manifest entry.

## Machine-readable corpus artifacts

The `open` profile emits a stable extraction surface for automation that should
not need to scrape visual HTML or execute JavaScript:

- `content-index.json`: site title, build timestamp, and one entry per page with
  id, title, summary, canonical URL, static HTML URL, and extract URLs.
- `documents.jsonl`: one JSON record per page with the same metadata plus full
  `bodyText` for bulk ingestion.
- `/pages/<id>.json`: one page record with metadata and body text.
- `/pages/<id>.txt`: plain body text.
- `llms-full.txt`: full-site text bundle when the generated text stays under the
  configured size guard.

When `domain` or `seo.siteUrl` is configured, URLs in these artifacts are
absolute. Restrictive profiles and `seo.noIndex` suppress these corpus artifacts
by default.

## Section Heading Pages And Future Topic Pages

Prefer real section heading pages when a section has a meaningful theme and
multiple child pages. A heading page should be useful to a human arriving from
search or a machine-readable index: it needs visible intro content, natural
title/H1/metadata, and links to the most important child pages.

To author one, put `file` on the grouped manifest entry that also has
`subsections`:

```json
{
  "id": "guides",
  "title": "Guides",
  "summary": "Practical guides for operating the product.",
  "file": "guides/index.md",
  "subsections": [
    { "id": "guides/install", "title": "Install", "file": "guides/install.md" }
  ]
}
```

The build publishes that group as its own route and static snapshot, appends a
visible child-page link list, and includes it in `sitemap.xml`, `llms.txt`, and
open-profile corpus artifacts only when the active SEO profile allows those
artifacts. If `file` is omitted, the group stays a navigation container and
continues to route to its first child.

Do not use generated topic pages as hidden SEO copies, doorway pages, or
keyword-loaded alternate versions of existing pages. Any future generated topic
page feature must publish human-visible content, avoid one-page duplication,
honor `limited`, `locked`, `seo.noIndex`, and `robots.blockAll`, and include only
structured data that matches visible page content.

## AI crawler signals

Set `seo.aiCrawlers.search`, `seo.aiCrawlers.aiInput`, and
`seo.aiCrawlers.aiTrain` to emit a `Content-Signal:` line in `robots.txt`.
These signals are advisory preferences for cooperating crawlers. They are not
enforced by Pagenary and do not guarantee exclusion from AI training, search, or
generated-answer systems.

## Authoring practices

- Keep manifest `summary` values concise — they power the meta description, search
  results, link previews, and the export document.
- Use human-readable, hyphenated, lowercase section `id`s — they become both the
  hash route and the static page filename (`/` becomes `--`).
- Gate broken links in CI with `strictLinks: true` (see
  [Tenant Configuration](TENANT-CONFIG.md)).
