# Tenant Configuration Reference

Complete reference for all tenant configuration options.

## Tenant Registry (tenants.json)

Located at `apps/publisher/tenants.json`, this file registers all tenants:

```json
{
  "tenant-id": {
    "source": "/path/to/content",
    "domain": "docs.example.com"
  }
}
```

### Registry Properties

| Property | Required | Description |
|----------|----------|-------------|
| `source` | Yes | Path to tenant content directory |
| `domain` | No | Custom domain for Caddy routing |
| `enabled` | No | Whether to build this tenant (default `true`) |
| `strictLinks` | No | Broken-link gate (default `true`). When `true`, **broken internal links fail the build** — the tenant is reported `Failed` and the process exits non-zero, so CI can gate on it. Set `false` to log broken links as warnings and continue. |
| `language` / `lang` / `locale` / `htmlLang` | No | Default language metadata for generated pages, such as `en` or `en-US`. Missing language metadata emits an accessibility warning. |
| `accessibility.strict` | No | Content accessibility gate. Default `false` reports findings during builds without failing. When `true`, high-confidence authored-content errors fail the tenant build. |
| `accessibility.report.enabled` | No | Emit `accessibility-report.json` and `accessibility-report.md` into the tenant output. Hosting dashboards can read the JSON artifact directly. |
| `accessibility.report.manualReview` | No | Include manual-review checklist items in accessibility reports (default `true`). |
| `media.enabled` | No | Enable fenced `media` block rendering (default `true`). Set `false` to render non-breaking fallback notes. |
| `media.providers` / `media.allowedProviders` | No | Allowed hosted embed providers. Defaults to `youtube`, `vimeo`, and `peertube`. |
| `media.load` | No | Hosted embed loading mode: `click` by default, or `immediate` for tenants that intentionally load provider iframes right away. |
| `narration.enabled` | No | Generate reviewable narration text artifacts and, when audio is attached, render a listen-to-this-page player. Default `false`. |
| `narration.provider` | No | `preview` writes text/JSON review artifacts without external calls. `attached` renders configured audio. Hosted TTS providers are intentionally not invoked by this public builder. |
| `narration.voice` / `narration.language` | No | Metadata included in narration artifact hashes so voice/language changes invalidate cached text/audio relationships. |
| `narration.disclosure` | No | Human-readable disclosure shown near the narration control, for example `Machine-generated narration`. |

Example strict accessibility config:

```json
{
  "language": "en-US",
  "accessibility": {
    "strict": true,
    "report": {
      "enabled": true
    }
  }
}
```

### Media Blocks

Authors can render native audio/video and allowlisted hosted embeds with fenced
`media` blocks:

````markdown
```media
type: video
src: assets/demo.mp4
title: Product walkthrough
poster: assets/demo-poster.jpg
captions: assets/demo.vtt
transcript: transcripts/demo.md
description: Spoken narration covers every important visual step.
caption: Watch the product walkthrough.
```
````

````markdown
```media
type: audio
src: audio/episode.mp3
title: Episode audio
transcript: transcripts/episode.md
```
````

````markdown
```media
type: embed
provider: youtube
id: abc123
title: Hosted walkthrough
```
````

Native media renders semantic `<audio>` or `<video>` with controls, accessible
labels, optional posters/captions/transcript links, and no autoplay. Hosted
providers render as click-to-load buttons by default and swap to sandboxed,
lazy iframes only after activation.

Tenant `media` config applies to every document. A document can override those
settings with frontmatter `media` fields, for example `media: { load:
"immediate" }` for a single trusted page.

Use `description` or `audioDescription` metadata when important visual
information is already described in the audio or nearby prose. Otherwise the
accessibility report keeps a manual-review item for audio-description needs.
Generated narration can use `type: narration` with the same `src`, `title`, and
`transcript` fields as audio media.

### Narration

Narration is opt-in and disabled by default. Tenant config can enable preview
artifacts for every Markdown page:

```json
{
  "narration": {
    "enabled": true,
    "provider": "preview",
    "voice": "review",
    "language": "en-US",
    "disclosure": "Narration preview"
  }
}
```

Authors can override per page with frontmatter. `false` disables narration for
that document, `true` uses tenant defaults, and an object can attach audio:

```yaml
---
title: Launch Notes
narration:
  src: audio/launch-notes.mp3
  duration: 4:02
  download: true
  disclosure: Machine-generated narration
---
```

The builder extracts deterministic readable text from Markdown, excluding
frontmatter and ordinary code fences while preserving headings, prose, lists,
tables, image alt text, and narration-relevant media metadata. It writes:

- `narration/<route>.<hash>.txt` — exact text used for narration review.
- `narration/<route>.<hash>.json` — route, provider, voice/language, source text
  path, audio path, and invalidation metadata.

The hash changes only when extracted text, provider, voice, or language changes.
`provider: "preview"` never sends content to an external service. `provider:
"attached"` renders the configured audio through the same accessible media
player used for native audio, with no autoplay, a transcript/source-text link,
optional duration, optional download link, and the configured disclosure.
Unconfigured hosted providers produce a non-breaking note and preview artifact;
hosted TTS credentials, rate limits, queueing, provider timeouts, and stale audio
reuse belong in the private hosting/control-plane layer.

### Source Types

**Local Path:**
```json
{
  "my-docs": {
    "source": "/home/user/my-docs"
  }
}
```

**Git Repository:**
```json
{
  "my-docs": {
    "source": "git:https://github.com/org/my-docs.git#main"
  }
}
```

Format: `git:<repo-url>#<branch>`

Git sources are cloned to a cache directory and updated on each build.

## Tenant Directory Structure

```
my-tenant/
├── config.json           # Branding and theme (required)
├── manifest.json         # Navigation structure (optional)
├── content/              # Content files
│   ├── *.md              # Markdown files
│   ├── *.html            # HTML files
│   ├── *.js              # JavaScript modules
│   └── section/          # Nested directories
│       └── _manifest.json
├── .public/              # Static assets (optional)
│   ├── favicon.ico       # Favicons copied to dist root
│   ├── logo.svg          # Assets copied to dist/assets/
│   └── icons/            # Subdirectories preserved
└── overrides/            # Post-build replacements (optional)
    └── styles.css        # Replace built files
```

## Branding Configuration (config.json)

### Complete Example

```json
{
  "title": "ACME Documentation",
  "description": "Complete guide to the ACME platform",
  "brandMark": "ACME",
  "brandSub": "Docs",
  "tagline": "Build better, faster",
  "copyright": "ACME Corporation",
  "accentColor": "#6366F1",
  "surfaceColor": "#F7FAFC"
}
```

### Properties Reference

#### Site Metadata

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | "Docs Toolkit" | Browser tab title and header |
| `description` | string | - | Meta description for SEO |

#### Branding

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `brandMark` | string | "DOCS" | Primary brand text (bold, uppercase) |
| `brandSub` | string | "TOOLKIT" | Secondary brand text (light weight) |
| `tagline` | string | - | Subtitle displayed under brand |
| `copyright` | string | "Modular Documentation Toolkit" | Footer copyright text |

#### Theme Colors

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `theme` | string \| object | `light` | Preset (`light` \| `dark` \| `matrix`) or a full custom theme object (see below) |
| `accentColor` | hex string | "#111111" | Links, buttons, active states |
| `surfaceColor` | hex string | "#ffffff" | Page background color |
| `inkColor` | hex string | "#0b0b0b" | Primary text color |
| `mutedColor` | hex string | "#5a5a5a" | Secondary / muted text |
| `gridLineColor` | CSS color | rgba(0,0,0,0.08) | Borders and dividers |

Color values may be 3- or 6-digit hex codes (for example `#6366F1` or `#111`);
`gridLineColor` may be any CSS color (`rgba(...)` is common).

A custom `theme` **object** merges over the `light` base and accepts the keys
above plus `colorScheme` (`light` \| `dark`) and dark-mode surface keys
(`sidebarBg`, `codeBackground`, `tableBorder`, …). See the
[interocitor config](../examples/interocitor/config.json) for a complete example.

#### Typography

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fontBody` | CSS font stack | IBM Plex Sans stack | Font for prose |
| `fontMono` | CSS font stack | IBM Plex Mono stack | Font for code |

#### Layout

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `navPosition` | string | `left` | Navigation placement: `left` \| `right` \| `top` \| `bottom` \| `hybrid` |
| `navAlign` | string | `top` | Sidebar list alignment. Vertical: `top` (default), `spread` (distribute across the column), `bottom`. Horizontal: `left` (default edge), `right`. |
| `layout` | string | `docs` | Layout family: `docs` (sidebar shell) or `blog` (chronological index + hero post pages). See [Blog Layout](#blog-layout). |
| `blog.sidebar` | string | `hidden` | Blog only: `hidden` (single reading column) or `rail` (content + posts/tags rail). |
| `blog.indexTitle` | string | collection title | Blog only: heading above the post index. |
| `livingScroll` | bool | `false` | **Any layout** (docs included): reveal page content on scroll + a reading-progress bar (opt-in, reduced-motion + JS-off safe). The layout-agnostic form of `blog.livingScroll`. |
| `blog.livingScroll` | bool | `false` | Blog shortcut for the same living-scroll treatment on post pages. Equivalent to top-level `livingScroll` scoped to the blog layout. See [Blog Layout](#blog-layout). |
| `reader.progress` / `readingProgress` | bool/object | `false` | Enable the presentational reading-progress bar for the tenant without hand-editing `<body>`. Frontmatter `progress: { enabled: true }` can opt in one document. |
| `codeCopy` | bool/object | `false` | Add a quick-copy button to every code block (`<pre>`). `true` (or `{ enabled: true }`) enables it. The button is added by JS and copies the exact source text with brief "Copied" feedback; it appears on hover/focus (always visible on touch). Code stays fully selectable with JS off. |
| `pageToc` | bool/object | `false` | "On this page" heading nav + scroll-spy, generated client-side from each page's `h2`/`h3`. `true` ⇒ right rail; `{ placement: "rail" \| "right" \| "left" \| "top" \| "off", minHeadings: N }` configures placement and the heading-count threshold (default 3). **`rail`** — a pinnable right-gutter panel (unpin to collapse it to a prev/next bar that reveals on hover/tap). **`right`** — a persistent nav-style list in the right gutter, styled like the main nav (hover rows, active accent bar, indented sub-headings); no pin/collapse. **`left`** — the same nav-style list, but mirrored into the sidebar under the site navigation (content runs full-width). **`top`** — a bordered block above the content. Accessible (`<nav aria-label>`, real links, `aria-current`); content is complete with JS off (the nav is an enhancement). |
| `navCollapse` | string | `"overlay"` | How the sidebar nav collapses (the header menu button toggles it). `"overlay"` (default) — drawer hidden by default; the button slides it in over the full-width content (the mobile UX, on desktop too), with a scrim and click-outside to close. `"push"` — nav stays visible; collapsing slides it out and reflows the content. `"instant"` — nav visible; collapsing drops the column with no animation. Mobile always uses the drawer regardless. Positioned-nav layouts (`navPosition` top/bottom/right) keep their own layout and hide the desktop toggle. |
| `collections` | array | — | Folders the build scans as dated post collections (emits `index.json` + `feed.xml`). See [Blog Layout](#blog-layout). |

`top` and `bottom` render navigation as a horizontal bar; `hybrid` adds a
horizontal primary strip (built from your top-level sections) above the left
rail. See the [Theming Recipes gallery](THEMING-RECIPES.md) for screenshots of
each.

#### Reading length and progress

Pagenary emits `reading_time` for backward compatibility and a richer
`reading_length` object for generated manifests and collection indexes. The
model counts rendered prose, headings, lists, table text, image alt text, code
blocks, and Markdown checklist state while excluding frontmatter and ordinary
Markdown syntax. Code lines, table rows, and images add conservative time
adjustments so technical documents do not look artificially short.

Reader-facing surfaces should prefer `reading_label` (`<1 min read`, `3 min
read`) over raw minute math. Blog cards and post metadata use this label when it
is available. `checklist_progress` is author/publisher metadata and is kept
separate from reader scroll progress.

Enable the progress bar for the whole tenant:

```json
{
  "reader": {
    "progress": {
      "enabled": true,
      "mode": "bar"
    }
  }
}
```

Enable it on a single Markdown document:

```yaml
---
title: Long Guide
progress:
  enabled: true
---
```

The progress bar remains presentational (`aria-hidden`) and passive on scroll.
For future table-of-contents or active-section variants, use the metadata-only
fields first rather than announcing percent changes to screen readers.

#### Theme picker (runtime)

Opt-in `themePicker` adds a header control that lets readers switch theme at
runtime; the choice persists in `localStorage` and the first visit honors the
reader's `prefers-color-scheme`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `themePicker.enabled` | boolean | `false` | Add the picker control |
| `themePicker.themes` | string[] | `["light","dark","matrix"]` | Selectable themes — presets and/or `"custom"` (your `theme` object) |
| `themePicker.default` | string | `theme` or `light` | Theme shown on first visit |

```json
{
  "themePicker": {
    "enabled": true,
    "themes": ["light", "dark", "matrix"],
    "default": "light"
  }
}
```

The build emits one full stylesheet per selectable theme (`theme-<name>.css`)
and swaps the active `<link>` at runtime, so switching is instant and
pixel-correct (including code blocks and tables). When disabled, no control,
script behavior, or extra stylesheets are emitted.

When choosing custom brand colors, keep text, focus rings, and status labels
readable against the selected surfaces. See [Accessible Authoring](ACCESSIBLE-AUTHORING.md)
for practical guidance. `npm run check` includes a lightweight accessibility
check that warns on risky tenant color combinations.

#### Runtime cache strategy

Pagenary emits content-addressed runtime URLs by default. Mutable browser-loaded
artifacts such as `app.js`, `styles.css`, `manifest.js`, section modules, docs
map data, theme stylesheets, search-index parts, and copied tenant assets also
get deterministic hashed copies. The shell and generated manifests reference the
hashed URLs so CDNs can cache unchanged files aggressively without serving stale
virtual pages after a deploy.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cacheStrategy` | `"contentHash"` or `"stable"` | `"contentHash"` | Runtime filename strategy. Use `stable` only for legacy hosting/tooling that requires unversioned filenames. |

```json
{ "cacheStrategy": "contentHash" }
```

The build keeps stable compatibility files on disk, but the generated shell uses
the content-hashed URLs. See [Deployment](DEPLOYMENT.md#cache-strategy) for the
matching CDN headers.

#### Deploy mount path

By default Pagenary supports domain-root deploys (`/`) and tenant-id subpath
deploys (`/<tenant-id>/`). Set `basePath` when the public mount path differs
from the tenant id, for example when tenant `fortemi-react-docs` is served from
`/react/`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `basePath` | string | auto | Optional mount path used for the generated `<base href>`. Values normalize to leading and trailing slashes, so `"react"` becomes `"/react/"`. |

```json
{ "basePath": "/react/" }
```

Registry-level `basePath` overrides a value from the tenant source
`config.json`, which lets one source bundle be published at different mounts.

#### Docs map (relationship view)

Opt-in `docsMap` adds a standalone **Docs Map** page — a framework-free SVG view
that clusters your pages by concept (from the same index that powers search) so
readers can see how the docs relate. It appears in the nav and at `#docs-map`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `docsMap.enabled` | boolean | `false` | Add the Docs Map page + nav entry |
| `docsMap.title` | string | `"Docs Map"` | Nav/heading label |
| `docsMap.renderer` | `"svg"` or `"cytoscape"` | `"svg"` | Graph renderer. `svg` is the current renderer and fallback; `cytoscape` reserves the opt-in richer JS renderer path. |

```json
{ "docsMap": { "enabled": true, "renderer": "svg" } }
```

The graph is computed **at build time** from your actual page content using the
vendored Fortemi graph adapter. Each page's body is run through the Fortemi
concept procedure: pages cluster into communities by nav group, and pages that
share salient concepts are linked with weighted `related` edges. The build
embeds the Fortemi graph plus compact node/relationship metadata as
`docs-map-data.js`; the SVG renderer uses that metadata for subtle hover titles,
edge weight, confidence, shared-concept details, zoom/pan controls, neighbor
highlighting, and pinned node popups. The default renderer is the framework-free
SVG view; optional renderers must fall back to SVG if they cannot initialize.
Tenants with too little content fall back to a lightweight manifest-derived
graph, and small or empty corpora render a friendly placeholder. When disabled,
nothing is emitted.

> See `examples/docs-map-corpus/` (the **docs-map** recipe) for a fully
> cross-linked sample corpus — 14 interconnected pages that produce a graph of
> 5 clusters and dozens of concept edges.

#### SEO (`seo`)

The optional `seo` block controls the build-time SEO artifacts (sitemap, robots,
`llms.txt`, static HTML snapshots, JSON-LD) and the runtime meta tags.

```json
{
  "title": "ACME Documentation",
  "domain": "docs.acme.com",
  "seo": {
    "enabled": true,
    "siteUrl": "https://docs.acme.com",
    "ogImage": "/assets/og-card.png",
    "generateSitemap": true,
    "generateStaticPages": true,
    "generateRobotsTxt": true,
    "defaultChangeFreq": "weekly",
    "structuredData": {
      "organizationName": "ACME Corporation",
      "logoUrl": "https://docs.acme.com/assets/logo.svg"
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `true` | Set `false` to skip all SEO artifact generation |
| `siteUrl` | string | falls back to `domain` | Absolute base URL for sitemap `<loc>`, canonical, `og:url`, and `robots` `Sitemap:`. **If omitted, the tenant's top-level `domain` is used** (https-prefixed). If neither is set, URLs are emitted relative and the build prints a warning. |
| `ogImage` | string | - | Social share image for `og:image` / `twitter:image`. Absolute URL or site-relative path (joined to the base URL). When set, `twitter:card` is upgraded to `summary_large_image`. Per-section override: set `ogImage` on a manifest entry. |
| `generateSitemap` | boolean | `true` | Emit `sitemap.xml` |
| `generateStaticPages` | boolean | `true` | Emit per-section static HTML snapshots under `/pages/` (crawler-friendly; the SPA uses hash routing) |
| `generateRobotsTxt` | boolean | `true` | Emit `robots.txt` |
| `defaultChangeFreq` | string | `"weekly"` | `<changefreq>` for the sitemap root entry |
| `structuredData.organizationName` | string | - | Organization name in the JSON-LD `publisher` |
| `structuredData.logoUrl` | string | - | Organization logo URL in the JSON-LD `publisher` |

**Absolute URLs:** declaring a `domain` (or `seo.siteUrl`) is what makes the
sitemap, canonical, and Open Graph URLs absolute. The sitemap protocol requires
fully-qualified URLs, so a tenant with neither set will emit a non-compliant
sitemap — the build warns when this happens.

**Canonical strategy:** static snapshots and the runtime SPA canonicalize to the
crawlable static URL (`/pages/<id>.html`), not the SPA `#hash` route — search
engines drop URL fragments, so hash canonicals would collapse every page onto the
homepage. The `#hash` route is still used for the in-page "interactive version"
link and the JS redirect.

#### Export (`export`)

The header's **Export** button compiles the current page or the whole site into a
single document and opens the browser's **print / Save-as-PDF** dialog. Export
renders in an off-screen frame and triggers the dialog directly — there is **no
pop-up window** to allow or dismiss, and nothing is left open afterward.

```json
{
  "export": {
    "enabled": true,
    "scopes": ["page", "site"],
    "logo": "embed",
    "showTagline": true,
    "showDate": true
  }
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | `true` | Master switch. `false` removes the Export button entirely. |
| `scopes` | string[] | `["page", "site"]` | Which options appear: `page` (current section) and/or `site` (everything). An empty list also disables export. |
| `logo` | string | `embed` | `embed` (inline the `.public/` logo), `reference` (link it by `logoPath`), or omit for a text-only header. |
| `logoPath` | string | — | Path within `.public/` to the export header logo. |
| `showTagline` | bool | `true` | Show the tenant `tagline` under the export header. |
| `showDate` | bool | `true` | Show the generated-on date in the export header. |

Disable export for a tenant, or restrict it to single-page exports:

```json
{ "export": { "enabled": false } }
{ "export": { "scopes": ["page"] } }
```

## Collections

A **collection** marks a content folder (e.g. a blog) so the build emits a
machine-readable manifest — letting downstream sites consume the posts without
scraping rendered HTML. Configure collections in the tenant `config.json`:

```json
{
  "collections": [
    {
      "path": "blog",
      "route": "/blog",
      "title": "Blog",
      "manifest": true,
      "feed": true,
      "sortBy": "date",
      "order": "desc"
    }
  ]
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `path` | string | required | Collection folder, relative to the content root (e.g. `blog` → `content/blog/`) |
| `route` | string | `/<path>` | Public route; also the output subdirectory under `dist/` |
| `title` | string | tenant `title` | Collection title (manifest + feed) |
| `manifest` | boolean | `true` | Emit `index.json` |
| `feed` | boolean | `false` | Emit RSS `feed.xml` |
| `sortBy` | string | `"date"` | Front-matter field to sort by |
| `order` | string | `"desc"` | `"desc"` or `"asc"` (entries missing the sort key sort last) |

Each post (`<path>/<slug>.md`) supplies metadata via YAML **front matter**;
files starting with `_` and `index.md` are skipped:

```markdown
---
title: Shipping Pagenary Collections
date: 2026-05-27
summary: How the new collection manifest works.
hero: /assets/blog/collections.png
tags: [release, seo]
---

# Shipping Pagenary Collections

Post body…
```

The build writes to `dist/<route>/`:

- **`index.json`** — `{ title, route, count, generated, posts: [...] }`, where each
  post is `{ slug, title, date, summary, hero, tags, reading_time, reading_label,
  reading_length, word_count, checklist_progress, progress, canonical, path }`,
  sorted per `sortBy`/`order`. `canonical` is the absolute static-page URL (uses
  the same base URL as [SEO](#seo-seo)); `reading_time` is the rounded minute
  value and `reading_length` contains the deterministic weighted model details.
- **`feed.xml`** *(when `feed: true`)* — RSS 2.0 of the same set.

> A collection's posts are still rendered as normal pages (each `.md` becomes a
> section). The manifest/feed are additive, machine-readable indexes.

## Navigation Manifest (manifest.json)

### Root Manifest

Located at tenant root, defines top-level navigation:

```json
[
  {
    "id": "welcome",
    "title": "Welcome",
    "summary": "Introduction to the platform",
    "file": "welcome.md"
  },
  {
    "id": "guides",
    "title": "Guides",
    "summary": "Step-by-step tutorials",
    "subsections": [
      {
        "id": "guides/getting-started",
        "title": "Getting Started",
        "summary": "First steps",
        "file": "guides/getting-started.md"
      },
      {
        "id": "guides/advanced",
        "title": "Advanced",
        "file": "guides/advanced.md"
      }
    ]
  }
]
```

### Section Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes* | Unique section identifier (used in URLs) |
| `title` | Yes | Display title in navigation |
| `summary` | No | Description shown in search results |
| `file` | No** | Path to content file (relative to `content/`) |
| `url` | No** | External link URL (opens in new tab) |
| `subsections` | No | Array of child sections |
| `exclude` | No | Exclude from build (`true` to skip) |

*Not required for external links
**Use either `file` OR `url`, not both

### External Links in Navigation

Manifest entries can link to external resources using `url` instead of `id`/`file`:

```json
[
  {
    "id": "docs",
    "title": "Documentation",
    "file": "docs.md"
  },
  {
    "title": "GitHub",
    "url": "https://github.com/example/repo"
  },
  {
    "title": "Support Portal",
    "url": "https://support.example.com"
  }
]
```

External links automatically:
- Open in new tab (`target="_blank"`)
- Display subtle arrow icon indicator (↗)
- Skip URL hash routing

### Section Manifest (_manifest.json)

Located in content subdirectories for nested navigation:

```json
{
  "title": "API Reference",
  "summary": "Complete API documentation",
  "sections": [
    {
      "id": "overview",
      "title": "Overview",
      "file": "overview.md"
    },
    {
      "id": "endpoints",
      "title": "Endpoints",
      "file": "endpoints.md"
    }
  ]
}
```

### Auto-Generated Manifest

If no `manifest.json` exists, the build system auto-generates navigation from the `content/` directory structure:

- Files become sections (filename → title)
- Directories become groups
- `_manifest.json` in directories customizes the group

## Bottom Navigation

Configure the bottom prev/next article navigation in `config.json`, root
`_manifest.json`, or `manifest.json` (it is on for all screens by default):

```json
{
  "bottomNav": "always",
  "bottomNavSections": ["getting-started", "api-reference", "faq"],
  "sections": [
    // ... section definitions
  ]
}
```

### Bottom Navigation Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bottomNav` | string | `"always"` | When to show the **docs** prev/next article nav at the bottom of each page: `"always"`, `"mobile"`, or `"never"` |
| `bottomNavSections` | string[] | `[]` | Section IDs to include (empty array = all sections) |
| `postNav` | object \| bool | all on | **Blog** post navigation affordances. `false` disables it; an object toggles `{ prev, next, index, label }`. Posts always get a persistent prev/next + back-to-index control regardless of `bottomNav`. |

**Behavior:**
- `"always"` - Show on all screen sizes (default): titled prev/next links to the adjacent article in nav order, so readers move between pages without opening the menu
- `"mobile"` - Show only on small screens
- `"never"` - Hide bottom navigation completely

Blog posts use a separate, always-visible **post navigation** (collection-scoped
prev/next plus a back-to-index link) so a post with the sidebar hidden can still
move between posts. Disable or trim it with `postNav`:

```json
{ "postNav": { "prev": true, "next": true, "index": true, "label": "All posts" } }
```

## Page Effects (hero & banner)

Pages can carry a rich **hero** and a **CTA banner** declared in Markdown
frontmatter — full-bleed, overlaid, optionally parallax/sticky, with CTA
buttons. These are opt-in, theme-token aware, and accessible. See the
[Page Effects](#page-effects) guide for the full reference; the short version:

```markdown
---
title: My landing page
hero:
  title: Heroes that earn the scroll
  image: assets/images/hero.svg
  fullBleed: true
  overlay: true
  parallax: true
  cta:
    - { label: "Get started", href: "#start", style: primary }
banner:
  title: Ready to ship?
  fullBleed: true
  cta:
    - { label: "Get started", href: "#start", style: primary }
---
```

| Field | Applies to | Meaning |
|-------|-----------|---------|
| `hero.eyebrow` / `hero.title` / `hero.subtitle` | hero | Overlay text (all optional). |
| `hero.image` / `hero.video` / `hero.poster` | hero | Background media (`video` wins over `image`). |
| `hero.fullBleed` / `banner.fullBleed` | both | Span the content area edge-to-edge. |
| `hero.overlay` | hero | Scrim for legible text (defaults on with media). |
| `hero.parallax` | hero | Drift the background on scroll (reduced-motion safe). |
| `hero.sticky` | hero | Pin the hero to the top of the reading area. |
| `hero.align` | hero | `start` \| `center` \| `end`. |
| `hero.height` | hero | Override the hero min-height. |
| `banner.title` / `banner.text` | banner | Band heading and supporting line. |
| `hero.cta[]` / `banner.cta[]` | both | `{ label, href, style }` — `style` is `primary` \| `ghost` \| `plain`. |

A **string** `hero` (e.g. `hero: assets/x.svg`) is the simple blog post image,
not a rich hero — use the object form above for page effects.

**Examples:**

Show all sections on mobile only (default):
```json
{
  "bottomNav": "mobile"
}
```

Show specific sections always:
```json
{
  "bottomNav": "always",
  "bottomNavSections": ["home", "docs", "api"]
}
```

Hide bottom navigation:
```json
{
  "bottomNav": "never"
}
```

## Content Files

### Markdown (.md)

Full CommonMark support plus:

- Fenced code blocks with syntax highlighting
- Mermaid diagrams with interactive controls
- Internal links via `#section-id`
- External links auto-open in new tab

```markdown
# Page Title

Regular markdown content.

## Code Example

\`\`\`javascript
const x = 1;
\`\`\`

## Diagram

\`\`\`mermaid
graph LR
    A --> B
\`\`\`

See also: [Getting Started](#guides/getting-started)

Learn more: [GitHub](https://github.com/example)
```

#### External Links in Content

All HTTP/HTTPS links in markdown automatically:
- Open in new tab (`target="_blank"`)
- Display subtle ↗ indicator via CSS
- Include security attributes (`rel="noopener noreferrer"`)

**Standard external link:**
```markdown
Visit our [GitHub repository](https://github.com/example/repo).
```

**Prominent call-to-action link:**
```html
<a href="https://example.com/signup" class="external-cta">
  Sign Up Now →
</a>
```

The `.external-cta` class provides enhanced styling for important external links.

#### Mermaid Diagrams

Mermaid diagrams render with interactive controls:

**Features:**
- **Zoom controls**: +/− buttons for zoom in/out
- **Reset button**: ⊙ restores original view
- **Pan**: Click and drag to move diagram
- **Pinch zoom**: Touch devices support pinch gestures
- **Auto-scroll**: Diagrams larger than viewport are scrollable

**Supported diagram types:**
- Flowcharts (`graph`, `flowchart`)
- Sequence diagrams (`sequenceDiagram`)
- Class diagrams (`classDiagram`)
- State diagrams (`stateDiagram`)
- ER diagrams (`erDiagram`)
- User journey (`journey`)
- Gantt charts (`gantt`)
- And more (see Mermaid documentation)

**Example:**
```markdown
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`
```

### HTML (.html)

Direct HTML with access to built-in CSS classes:

```html
<section class="section doc markdown">
  <div class="doc-content">
    <h1>Custom Section</h1>

    <table class="spec-table">
      <thead>
        <tr><th>Feature</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr><td>Search</td><td>Ready</td></tr>
      </tbody>
    </table>

    <div class="layer-stack">
      <div class="layer">
        <div class="layer-title">Layer 1</div>
        <div class="layer-desc">Description</div>
      </div>
    </div>
  </div>
</section>
```

### JavaScript (.js)

Dynamic content modules:

```javascript
export async function load() {
  // Fetch data, compute values, etc.
  const data = await fetch('/api/data.json').then(r => r.json());

  return {
    html: `
      <section class="section doc">
        <h1>Dynamic Content</h1>
        <p>Value: ${data.value}</p>
      </section>
    `,
    afterRender(container) {
      // Optional: DOM manipulation after render
      container.querySelector('button')?.addEventListener('click', () => {
        // Handle click
      });
    }
  };
}
```

## CSS Classes Reference

### Layout

| Class | Description |
|-------|-------------|
| `.section` | Section container |
| `.doc` | Document-style section |
| `.markdown` | Apply markdown typography |
| `.doc-content` | Content wrapper |

### Components

| Class | Description |
|-------|-------------|
| `.spec-table` | Styled data table |
| `.layer-stack` | Vertical layer diagram |
| `.layer` | Individual layer in stack |
| `.layer-title` | Layer heading |
| `.layer-desc` | Layer description |
| `.card` | Card component |
| `.card-grid` | Grid of cards |
| `.content-box` | Bordered content box |
| `.box-title` | Box heading |
| `.html-block` | HTML content wrapper |
| `.external-cta` | Prominent external link button |

### Typography

| Class | Description |
|-------|-------------|
| `.doc-h1` through `.doc-h4` | Heading styles |
| `.doc-list` | Styled list |
| `.doc-grid` | Two-column grid |

## Overrides Directory

Files in `overrides/` replace built files after the build completes:

```
my-tenant/
└── overrides/
    ├── styles.css      # Replace default styles
    └── favicon.ico     # Custom favicon
```

Use for:
- Custom stylesheets
- Custom favicons
- Additional assets

## Static Assets (.public/)

The `.public/` directory stores static assets (images, icons, logos) that should be included in the built tenant bundle.

### Directory Structure

```
my-tenant/
├── .public/              # Static assets directory
│   ├── favicon.ico       # Copied to dist root
│   ├── favicon.png       # Copied to dist root
│   ├── logo.svg          # Copied to dist/assets/
│   └── icons/            # Subdirectories preserved
│       ├── discord.svg
│       └── github.svg
├── config.json
├── content/
└── ...
```

### Build Behavior

During the build process:

1. **Assets directory creation**: Contents are copied to `dist/<tenant-id>/assets/`
2. **Favicon handling**: Files matching `favicon.*` (e.g., `favicon.ico`, `favicon.png`, `favicon.svg`) are copied to the dist root (`dist/<tenant-id>/`) for browser auto-detection
3. **Subdirectory preservation**: Subdirectory structure within `.public/` is maintained in the output

### Referencing Assets in Content

**In Markdown:**
```markdown
![Company Logo](./assets/logo.svg)
![Product Screenshot](./assets/screenshots/dashboard.png)
```

**In HTML content:**
```html
<img src="./assets/logo.svg" alt="Company Logo">
<img src="./assets/icons/github.svg" alt="GitHub">
```

**In CSS (via overrides):**
```css
.custom-header {
  background-image: url(./assets/logo.svg);
}

.icon-discord {
  content: url(./assets/icons/discord.svg);
}
```

### Why .public Instead of public?

The dot-prefix (`.public/`) was chosen to:

- **Avoid conflicts**: Prevents naming collisions with user's conventional `public/` directories that might contain user-facing content
- **Clear separation**: Distinguishes between tenant assets and potential user content directories
- **Build system clarity**: Signals this is a build-time directive, not user-facing content

### Supported File Formats

The `.public/` directory supports all static file types:

**Images:**
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- SVG (`.svg`)
- WebP (`.webp`)
- GIF (`.gif`)

**Icons:**
- ICO (`.ico`)
- SVG (`.svg`)

**Other static files:**
- Any additional static assets needed by your documentation

### Example Usage

**Typical tenant structure with assets:**

```
acme-docs/
├── config.json
├── manifest.json
├── .public/
│   ├── favicon.ico              # Browser tab icon
│   ├── favicon.svg              # Modern browsers
│   ├── logo.svg                 # Company logo
│   ├── logo-dark.svg            # Dark mode variant
│   ├── screenshots/             # Product screenshots
│   │   ├── dashboard.png
│   │   └── settings.png
│   └── icons/                   # Social/external icons
│       ├── github.svg
│       ├── discord.svg
│       └── twitter.svg
└── content/
    └── welcome.md
```

**Referenced in welcome.md:**

```markdown
# Welcome to ACME Docs

![ACME Logo](./assets/logo.svg)

## Quick Start

Check out our dashboard:

![Dashboard Screenshot](./assets/screenshots/dashboard.png)

## Community

Join us on:
- ![GitHub](./assets/icons/github.svg) [GitHub](https://github.com/acme)
- ![Discord](./assets/icons/discord.svg) [Discord](https://discord.gg/acme)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUILD_OUTPUT` | `dist/` | Output directory |
| `DOCS_TOOLKIT_PORT` | `80` | Caddy server port |
| `PORT` | `5173` | Dev server port |

## Build Modes

### Full Build

```bash
npm run build:tenants my-tenant
```

Rebuilds everything from scratch.

### Incremental Build

```bash
npm run build:incremental my-tenant
```

Only rebuilds files changed since last build (git-aware).

### All Tenants

```bash
npm run build:tenants
```

Builds all registered tenants.
