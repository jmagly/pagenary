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
type: image
src: assets/screens/default.jpg
portrait: assets/screens/portrait.jpg
landscape: assets/screens/landscape.jpg
alt: Product dashboard
caption: The dashboard uses a tighter crop on portrait screens.
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

Image media renders semantic `<picture>` markup when `portrait`/`portraitSrc` or
`landscape`/`landscapeSrc` variants are provided, with `src` as the fallback
image. `mobile`/`mobileSrc` and `desktop`/`desktopSrc` are accepted aliases.
When no variants are provided, image media renders a plain `<img>` so existing
single-image usage stays simple.

Add `zoom: true` to an informative SVG, PNG, JPEG, or JPG media block to create
an accessible bounded image viewport:

````markdown
```media
type: image
src: assets/architecture.svg
alt: Three application tiers connected from browser to database
label: Application architecture
caption: Application architecture at a glance.
description: Requests enter through the browser tier, pass through two API nodes, and finish in the primary database.
zoom: true
width: 1600
height: 900
```
````

The optional `label` names the viewer controls, `caption` is concise visible
context, and `description` is a longer visible explanation associated with the
image. They do not replace `alt`. Use an explicit `alt: ""` only for decorative
static images; decorative images cannot enable the interactive viewport.
`width` and `height` preserve intrinsic aspect ratio and reduce layout shift.

For a simple Markdown image, append `{zoom}`:

```markdown
![Application architecture](assets/architecture.png){zoom}
```

The viewport is opt-in. It keeps the static image as its no-JavaScript fallback
and supports buttons, pointer/pen drag, touch pan and pinch, and arrow-key pan.
SVG, PNG, JPEG, and JPG filenames may include query strings or fragments.

Native audio/video media renders semantic `<audio>` or `<video>` with controls,
accessible labels, optional posters/captions/transcript links, and no autoplay.
Hosted providers render as click-to-load buttons by default and swap to
sandboxed, lazy iframes only after activation.

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
reuse belong in a hosted/server-side layer, not the static publisher.

### Runtime And React Routes

Pagenary's default runtime is static. Missing `runtime` is equivalent to:

```json
{
  "runtime": {
    "mode": "static"
  }
}
```

Supported draft modes:

| Mode | Status | Behavior |
|------|--------|----------|
| `static` | Default | Existing vanilla Pagenary runtime. `runtime.react` is ignored. |
| `hybrid` | Prototype | Builds normal Pagenary docs plus selected React app routes through the optional `@pagenary/react` adapter. |
| `react-spa` | Planned | Reserved for a future full React shell that still consumes Pagenary artifacts. |

Hybrid React routes require an authored Markdown or HTML fallback. The fallback
is published as a normal Pagenary page, so sitemap, static snapshots,
`llms.txt`, search, Docs Map data, and collection artifacts still see the route
without needing the React app to run.

```json
{
  "runtime": {
    "mode": "hybrid",
    "react": {
      "enabled": true,
      "entry": "app/main.jsx",
      "mount": "#react-diagnostics-root",
      "routes": [
        {
          "id": "diagnostics",
          "title": "Diagnostics",
          "path": "/diagnostics",
          "fallback": "content/diagnostics.md"
        }
      ],
      "ssg": {
        "staticFallbacks": true,
        "snapshotRoutes": true
      }
    }
  }
}
```

Compatibility notes:

- `@pagenary/publisher` remains installable without React, React DOM, Vite, or
  `@vitejs/plugin-react`.
- React publishing fails clearly if `runtime.mode` is `hybrid` or `react-spa`
  and the configured adapter package is not installed.
- `runtime.react.entry` and route fallbacks must stay inside the tenant source
  directory.
- `runtime.react.ssg.staticFallbacks` must remain `true` for the hybrid
  prototype.
- The optional `@pagenary/react` adapter follows Vite's Node requirement:
  Node `20.19+` or `22.12+`. The static publisher keeps its Node `>=16`
  compatibility floor.

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
| `layout` | string | `docs` | Default shell: `docs` (sidebar shell) or `blog` (chronological index + hero post pages). The shell is also resolvable **per nav group / collection / section** — precedence `section ?? collection ?? group ?? tenant ?? docs` — so one site/deploy can mix a docs group and a blog group, with the shell switching per route. Declare a group/section `layout` in `_manifest.json`, or a collection `layout` (below). See [Blog Layout](#blog-layout). |
| `blog.sidebar` | string | `hidden` | Blog only: `hidden` (single reading column) or `rail` (content + posts/tags rail). |
| `blog.indexTitle` | string | collection title | Blog only: heading above the post index. |
| `livingScroll` | bool | `false` | **Any layout** (docs included): reveal page content on scroll + a reading-progress bar (opt-in, reduced-motion + JS-off safe). The layout-agnostic form of `blog.livingScroll`. |
| `blog.livingScroll` | bool | `false` | Blog shortcut for the same living-scroll treatment on post pages. Equivalent to top-level `livingScroll` scoped to the blog layout. See [Blog Layout](#blog-layout). |
| `reader.progress` / `readingProgress` | bool/object | `false` | Enable the presentational reading-progress bar for the tenant without hand-editing `<body>`. Frontmatter `progress: { enabled: true }` can opt in one document. |
| `codeCopy` | bool/object | `false` | Add a quick-copy button to every code block (`<pre>`). `true` (or `{ enabled: true }`) enables it. The button is added by JS and copies the exact source text with brief "Copied" feedback; it appears on hover/focus (always visible on touch). Code stays fully selectable with JS off. |
| `siteForm` | object | — | Site-wide form affordance — a persistent floating control on every page. `{ provider, id, mode, button, title }`. `provider` selects a form host (`tally` today); `id` is the public form id; `mode` is `popup` (default) or `inline`; `button` labels the trigger. The provider script loads only because a `siteForm` is configured. JS-off shows a working link to the hosted form. See the **Form Embeds** section. |
| `pageToc` | bool/object | `false` | "On this page" heading nav + scroll-spy, generated client-side from each page's `h2`/`h3`. `true` ⇒ right rail; `{ placement: "rail" \| "right" \| "left" \| "top" \| "off", minHeadings: N }` configures placement and the heading-count threshold (default 3). **`rail`** — a pinnable right-gutter panel (unpin to collapse it to a prev/next bar that reveals on hover/tap); on wide screens the panel is capped to the viewport and only the heading list scrolls, keeping the title and prev/next controls visible. **`right`** — a persistent nav-style list in the right gutter, styled like the main nav (hover rows, active accent bar, indented sub-headings); no pin/collapse. **`left`** — the same nav-style list, but mirrored into the sidebar under the site navigation (content runs full-width). **`top`** — a bordered block above the content. Accessible (`<nav aria-label>`, real links, `aria-current`); content is complete with JS off (the nav is an enhancement). |
| `navCollapse` | string | `"overlay"` | How the sidebar nav collapses (the header menu button toggles it). `"overlay"` (default) — drawer hidden by default; the button slides it in over the full-width content (the mobile UX, on desktop too), with a scrim and click-outside to close. `"push"` — nav stays visible; collapsing slides it out and reflows the content. `"instant"` — nav visible; collapsing drops the column with no animation. Mobile always uses the drawer regardless. Positioned-nav layouts (`navPosition` top/bottom/right) keep their own layout and hide the desktop toggle. |
| `collections` | array | — | Folders the build scans as dated post collections (emits `index.json` + `feed.xml`). A collection may set `layout: "blog"` to render its posts in the blog shell even when the tenant defaults to `docs` (mixed docs + blog in one deploy). See [Blog Layout](#blog-layout). |

`top` and `bottom` render navigation as a horizontal bar; `hybrid` adds a
horizontal primary strip (built from your top-level sections) above the left
rail. See the [Theming Recipes gallery](THEMING-RECIPES.md) for screenshots of
each.

When customizing a tenant stylesheet, preserve the generated `pageToc` DOM
contract. The rail placement is rendered as:

```html
<nav class="page-toc page-toc--rail">
  <details class="page-toc__disc">
    <summary class="page-toc__title">…</summary>
    <div class="page-toc__body">
      <div class="page-toc__controls">…</div>
      <ol class="page-toc__list">…</ol>
    </div>
  </details>
</nav>
```

For `placement: "rail"`, the scroll container should be the heading list, not
the whole panel. Keep the outer rail/disc viewport-capped and keep
`.page-toc__controls` plus `.page-toc__title` outside the scrolling region. If a
tenant replaces `styles.css` through `overrides/`, start from the current
generated stylesheet or copy the complete `.page-toc--rail` rule set; replacing
only the base `.page-toc__body` or `.page-toc__list` rules can make long rails
overflow below the fold or let the header scroll away.

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

By default Pagenary resolves runtime assets from the directory that served
`index.html`, so a base-less build can be mounted at `/`, `/docs/`,
`/<tenant-id>/`, or another reverse-proxy path. Set `basePath` only when the
bundle must be hard-pinned to one public mount, for example when tenant
`fortemi-react-docs` is always served from `/react/`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `basePath` | string | auto | Optional mount path used for the generated `<base href>`. Values normalize to leading and trailing slashes, so `"react"` becomes `"/react/"`. Use `"auto"` or omit the field to resolve from the served document location. |

```json
{ "basePath": "/react/" }
```

Registry-level `basePath` overrides a value from the tenant source
`config.json`, which lets one source bundle be published at different mounts.
For launch-specific builds, prefer a command-line or environment override over
editing committed tenant config:

```bash
pagenary build fortemi-docs --base /server
PAGENARY_BASE=/server pagenary build fortemi-docs
PAGENARY_BASE=auto pagenary build fortemi-docs
```

Precedence is `--base` / `PAGENARY_BASE`, then registry `basePath`, then tenant
`config.json` `basePath`, then auto-detection. For local preview of a hard-pinned
build, serve the tenant at the same mount:

```bash
pagenary serve --mount /server
```

#### Docs map (relationship view)

Opt-in `docsMap` adds a standalone **Docs Map** page — a framework-free SVG view
that clusters your pages by concept (from the same index that powers search) so
readers can see how the docs relate. It appears in the nav and at `#docs-map`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `docsMap.enabled` | boolean | `false` | Add the Docs Map page + nav entry |
| `docsMap.title` | string | `"Docs Map"` | Nav/heading label |
| `docsMap.renderer` | `"svg"`, `"cytoscape"`, `"fortemi-react"`, `"fortemi-react-2d"`, or `"fortemi-react-3d"` | `"svg"` | Graph renderer. `svg` is the framework-free fallback; `fortemi-react` mounts the React `GraphView` control from `@pagenary/react/docs-map`; `fortemi-react-2d` (Sigma live explorer with hover dimming, camera focus, ⌘-click re-anchor) and `fortemi-react-3d` (Three.js force graph) are heavier interactive tiers. The interactive tiers need the React runtime (`runtime.mode: hybrid`/`react-spa`) **and** their optional peer dependencies installed at build time — 2d: `sigma graphology graphology-layout-forceatlas2`; 3d: `react-force-graph-3d three`. The build fails with an actionable message when peers are missing; without the React runtime these values fall back to `svg`. Only the opted-in tier is bundled — static tenants ship zero Sigma/Three bytes. |
| `docsMap.palette` | `"community"`, `"greyscale"`, or `["#hex", …]` | `"community"` | Community palette for the interactive tiers: `community` hashes ids (matches SVG/GraphView), `greyscale` maps rank→warm greys (largest cluster darkest), a custom array maps by community rank. |
| `docsMap.draggable` | boolean | `false` | Opt-in node dragging on the `fortemi-react` GraphView tier — drag pins a node and re-settles the layout around it; shift-click releases the pin. |
| `docsMap.snapshot` | boolean | `true` | Emit `docs-map/render-graph.json` — a deterministic baked-position graph snapshot (sorted nodes/links, byte-stable across rebuilds) that warm-start-capable renderer tiers load to skip live layout settling. Baking runs inside the optional `@pagenary/react` adapter; when the adapter is not installed the artifact is silently skipped. Set `false` to suppress. |

```json
{ "docsMap": { "enabled": true, "renderer": "fortemi-react" } }
```

The graph is computed **at build time** from your actual page content using the
vendored Fortemi graph adapter. Each page's body is run through the Fortemi
concept procedure: pages cluster into communities by nav group, and pages that
share salient concepts are linked with weighted `related` edges. The build
embeds the Fortemi graph plus compact node/relationship metadata as
`docs-map-data.js`; the SVG renderer uses that metadata for subtle hover titles,
edge weight, confidence, shared-concept details, zoom/pan controls, neighbor
highlighting, and pinned node popups. The default renderer is the framework-free
SVG view; the React Fortemi renderer replaces the same `#docsMapRoot` only after
the tenant React bundle loads, so the SVG output remains the final fallback.
Tenants with too little content fall back to a lightweight manifest-derived
graph, and small or empty corpora render a friendly placeholder. When disabled,
nothing is emitted.

When static snapshots are enabled, the build also writes
`/pages/docs-map.html`. JavaScript-enabled browsers redirect from that snapshot
to the interactive `#docs-map` route, while no-JS readers get a short fallback
description and a link to the interactive version. This keeps static nav,
sitemap entries, and crawler-facing artifacts valid even though the graph itself
is a dynamic section module.

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
    "discoverabilityProfile": "standard",
    "ogImage": "/assets/og-card.png",
    "generateSitemap": true,
    "generateStaticPages": true,
    "rootHtmlFallback": true,
    "generateRobotsTxt": true,
    "generateLlmsTxt": true,
    "generateCorpusArtifacts": false,
    "noIndex": false,
    "aiCrawlers": {
      "search": true,
      "aiInput": false,
      "aiTrain": false
    },
    "robots": {
      "allow": ["/", "/pages/"],
      "disallow": ["/sections/", "/lib/"],
      "sitemap": true
    },
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
| `discoverabilityProfile` | `"standard"`, `"open"`, `"limited"`, or `"locked"` | `"standard"` | High-level preset for sitemap, robots, `llms.txt`, static snapshots, root fallback, and machine-readable corpus artifacts |
| `ogImage` | string | - | Social share image for `og:image` / `twitter:image`. Absolute URL or site-relative path (joined to the base URL). When set, `twitter:card` is upgraded to `summary_large_image`. Per-section override: set `ogImage` on a manifest entry. |
| `generateSitemap` | boolean | `true` | Emit `sitemap.xml` |
| `generateStaticPages` | boolean | `true` | Emit per-section static HTML snapshots under `/pages/` (crawler-friendly; the SPA uses hash routing) |
| `rootHtmlFallback` | boolean | `true` | Embed the default page's rendered HTML inside the root SPA shell (`index.html`) so the root URL is readable without JavaScript. Set `false` for a JS-only shell. |
| `generateRobotsTxt` | boolean | `true` | Emit `robots.txt` |
| `generateLlmsTxt` | boolean | profile-aware | Emit `llms.txt` |
| `generateCorpusArtifacts` | boolean | profile-aware | Emit `content-index.json`, `documents.jsonl`, per-page JSON/text extracts, and size-guarded `llms-full.txt` |
| `noIndex` | boolean | `false` | Emit `noindex, nofollow` static-page metadata and a restrictive `robots.txt` (`Disallow: /`) without a sitemap pointer |
| `aiCrawlers.search` | boolean | profile-aware | Advisory content signal for search crawler use |
| `aiCrawlers.aiInput` | boolean | profile-aware | Advisory content signal for AI answer/input grounding use |
| `aiCrawlers.aiTrain` | boolean | profile-aware | Advisory content signal for AI training use |
| `robots.userAgent` | string | `"*"` | User-agent line for generated `robots.txt` |
| `robots.allow` | string[] | `["/", "/pages/"]` | `Allow:` directives for generated `robots.txt` |
| `robots.disallow` | string[] | `["/sections/", "/lib/"]` | `Disallow:` directives for generated `robots.txt` |
| `robots.sitemap` | boolean | `true` | Include a `Sitemap:` directive when a sitemap is generated |
| `robots.blockAll` | boolean | `false` | Emit `Disallow: /` for the configured user agent |
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

**Root HTML fallback:** `seo.rootHtmlFallback` controls the human-facing root
`index.html`, not the `/pages/` snapshots. It is enabled by default so browsers,
crawlers, and extractors that do not run JavaScript still receive the default
page content at the site root. Disable it only when you intentionally want an
empty JS-only SPA shell.

**Discoverability profiles:** `standard` preserves the public-doc defaults.
`open` additionally emits machine-readable corpus artifacts and permissive
content signals. `limited` suppresses sitemap, `llms.txt`, and corpus artifacts
while adding noindex metadata. `locked` additionally disables static snapshots
and root fallback by default and emits `Disallow: /`. Low-level generation fields
override profile artifact defaults, but these profiles remain static-site
crawler preferences rather than access control.

**Open corpus artifacts:** the `open` profile emits `content-index.json`,
`documents.jsonl`, `/pages/<id>.json`, `/pages/<id>.txt`, and a size-guarded
`llms-full.txt`. Records include page id, title, summary, parent, canonical URL,
static HTML URL, extract URLs, body text, and build timestamp. URLs are absolute
when `domain` or `seo.siteUrl` is configured.

**Search visibility:** use `seo.noIndex: true` for static bundles that should not
invite indexing. Use `seo.robots` to customize advisory crawler directives while
preserving the generated output flow. Robots directives and noindex metadata are
not authorization; private docs still need hosting-layer access control. See
[Tenant Security and Privacy Controls](TENANT-CONTROLS.md).

**AI crawler signals:** `seo.aiCrawlers` emits an advisory `Content-Signal:` line
in `robots.txt`. These preferences are not universal and do not guarantee AI
training or generated-answer exclusion.

#### Markdown delivery (`markdownDelivery`)

Markdown delivery is opt-in. It emits a clean, deterministic Markdown
representation for each eligible canonical page and a route map used by capable
servers or edge adapters for HTTP content negotiation:

```json
{
  "markdownDelivery": {
    "enabled": true,
    "contentNegotiation": true,
    "directArtifacts": true,
    "observability": {
      "responseHeader": false
    }
  }
}
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `false` | Emit `/markdown/<route>.md` and `markdown-routes.json` |
| `contentNegotiation` | boolean | `true` | Let the preview server or an edge/origin adapter return Markdown when it is preferred by `Accept` |
| `directArtifacts` | boolean | `true` | Publish directly addressable Markdown artifacts; setting this false disables generation and negotiation |
| `observability.responseHeader` | boolean | `false` | Add `X-Pagenary-Representation: html\|markdown` on negotiable routes without logging request headers |

For example:

```bash
curl -H 'Accept: text/markdown, text/html;q=0.5' \
  https://docs.example.com/pages/guides--install.html
```

The negotiated response uses `Content-Type: text/markdown; charset=utf-8`,
`Vary: Accept`, `Content-Location`, and an `ETag`. HTML wins equal-quality ties;
`text/markdown;q=0` explicitly excludes Markdown. Requests without `Accept` and
normal browser requests continue receiving HTML.

Markdown-authored pages retain their frontmatter-free authored structure and
normalized internal links. HTML, generated, collection, JavaScript-module, and
React-SPA pages use their static semantic content. Application chrome, scripts,
styles, and generated viewer controls are excluded. Code fences, tables, links,
image alt text, captions, and descriptions remain in the text representation.

`limited`, `locked`, and `seo.noIndex: true` disable Markdown output even when
the feature is requested, and stale artifacts are removed on the next build.
These settings are publication controls, not authorization; private sites still
need hosting-layer access control. See [Deployment](DEPLOYMENT.md#markdown-content-negotiation)
for preview, static-host, and Cloudflare behavior.

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
    "showDate": true,
    "watermark": {
      "enabled": true,
      "text": "Generated for ACME Docs"
    }
  }
}
```

For content-control boundaries, watermarking recommendations, and hosting-layer
privacy/security controls, see [Tenant Security and Privacy Controls](TENANT-CONTROLS.md).

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | `true` | Master switch. `false` removes the Export button entirely. |
| `scopes` | string[] | `["page", "site"]` | Which options appear: `page` (current section) and/or `site` (everything). An empty list also disables export. |
| `logo` | string | `embed` | `embed` (inline the `.public/` logo), `reference` (link it by `logoPath`), or omit for a text-only header. |
| `logoPath` | string | — | Path within `.public/` to the export header logo. |
| `showTagline` | bool | `true` | Show the tenant `tagline` under the export header. |
| `showDate` | bool | `true` | Show the generated-on date in the export header. |
| `watermark` | string/object | — | Optional visible watermark for exported print/PDF output. Use a string or `{ "enabled": true, "text": "..." }`. This is an intent signal, not DRM. |

Disable export for a tenant, or restrict it to single-page exports:

```json
{ "export": { "enabled": false } }
{ "export": { "scopes": ["page"] } }
```

Add a visible export watermark without blocking print, copy, or selection:

```json
{ "export": { "watermark": "Generated for ACME Docs" } }
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
| `sourceId` / `docbaseId` | string | collection `path` | Stable source identity used by cross-site blog aggregators |
| `sourceTitle` / `docbaseTitle` | string | collection `title` | Human-readable source label, for example `Server` or `React` |
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

- **`index.json`** — a stable versioned contract:
  `{ schemaVersion: "1.0.0", title, route, source, docbase, count, generated, posts: [...] }`.
  Each post is `{ id, slug, title, date, summary, hero, heroAlt, tags,
  reading_time, reading_label, reading_length, word_count, checklist_progress,
  progress, source, docbase, url, canonical, path }`, sorted per
  `sortBy`/`order`. `source`/`docbase` identify the publishing docbase so
  multi-docbase aggregators can label entries without guessing. `url` and
  `canonical` are absolute static-page URLs when `seo.siteUrl` or `domain` is
  configured; otherwise they remain site-root paths.
- **`feed.xml`** *(when `feed: true`)* — RSS 2.0 of the same set.

Serve public `index.json` and `feed.xml` artifacts with permissive CORS for the
consumer sites you support. The bundled Caddyfile uses
`Access-Control-Allow-Origin: *` for these generated data artifacts. If a CDN or
Cloudflare zone protects the docs site, add an edge rule that allows build-time
fetches for `*/index.json` and `*/feed.xml`; consumers should not need a spoofed
browser `User-Agent` or stale local seed.

Consumers can aggregate one or more docbases with `@pagenary/blog-client`:

```js
import { aggregateBlogIndexes } from '@pagenary/blog-client';

const { posts, errors } = await aggregateBlogIndexes([
  'https://docs.fortemi.com/server/blog/index.json',
  'https://docs.fortemi.com/react/blog/index.json'
], { limit: 10 });
```

For a drop-in runtime embed, self-host `@pagenary/embed` and use:

```html
<pagenary-blog
  sources="https://docs.fortemi.com/server/blog/index.json,https://docs.fortemi.com/react/blog/index.json"
  limit="10"
  show-source="true"></pagenary-blog>
```

See [Consuming and Embedding Blog Updates](BLOG-CONSUMPTION.md) for full
client, embed, CORS, CDN, Cloudflare, CSP, and troubleshooting guidance.

> A collection's posts are still rendered as normal pages (each `.md` becomes a
> section). The manifest/feed are additive, machine-readable indexes.

For mixed docs + blog sites, the collection folder must live under the detected
content root. With the common flat layout, use `content/posts/*.md` and set
`collections[].path` to `"posts"`:

```json
{
  "layout": "docs",
  "collections": [
    {
      "path": "posts",
      "route": "/blog",
      "title": "Blog",
      "layout": "blog",
      "manifest": true,
      "feed": true
    }
  ]
}
```

The build then does two things for the same Markdown files:

- renders each post as a normal hash-routed section such as `#posts/launch`;
- emits `dist/blog/index.json` and `feed.xml` for the blog index/feed.

The `path` field in `index.json` is hash-routed for Pagenary-generated
collection indexes, for example `/#posts/launch`. The bundled blog index also
uses the section `id` and links cards to `#posts/launch` so the hash-routed SPA
loads the post. If you build a custom index UI from `index.json`, use `id` for
in-app navigation unless you also emit and serve real per-post route pages.

Tenants with an explicit `manifest.json` keep their curated docs navigation.
Configured collection posts are appended automatically under the collection
route group, such as `blog -> posts/launch`; only files under configured
`collections[].path` folders are added, so unrelated unlisted content is not
strict-link-checked or published as a section.

## Form Embeds

Opt-in embedding of third-party **hosted forms** (feedback, contact, waitlist, a
per-page "was this helpful?") via a generic **provider seam**. Authors reference
a form by id instead of pasting provider embed markup. Pagenary is static — the
form posts to the provider; form ids are public, **never secrets**.

**Providers.** Tally is the first provider (fence id `tally`). Adding another host
is a single registry entry in `src/lib/form-providers.js` — the authoring surface
and runtime are generic.

### Per-page (fenced block)

A fenced block whose **fence id is the provider** drops a form exactly where you
place it. Inline renders an iframe in the page flow; popup renders a button that
opens the form in the provider's focus-trapping, Esc-closable modal:

````markdown
```tally
id: w4XyZ9
mode: inline          # inline | popup
title: Customer survey  # iframe / modal accessible title
```

```tally
id: w4XyZ9
mode: popup
button: Send feedback   # popup trigger label
title: Contact us
```
````

### Site-wide (`siteForm`)

A tenant-level `config.json` block renders a persistent floating affordance on
every page:

```json
{ "siteForm": { "provider": "tally", "id": "w4XyZ9", "mode": "popup", "button": "Feedback" } }
```

### Behavior (all providers)

- **Conditional script loading** — a provider's embed script loads only on pages
  that use that provider (per-page), or globally only when a `siteForm` of that
  provider is configured. Never unconditionally site-wide.
- **Progressive enhancement** — the static page contains only a real link to the
  hosted form, so with JS off (or before the script resolves) the form is always
  reachable. The iframe / popup button is a JS enhancement (gated under
  `html.has-js`); the page is complete as static markup.
- **Accessibility** — the inline iframe carries a `title`; the popup trigger is a
  real `<button>` with `aria-label`; the provider modal traps focus and closes on
  Esc.
- **Privacy / CSP** — strictly opt-in. Tenants enforcing a Content-Security-Policy
  must allow the provider's hosts. For **Tally**: add `https://tally.so` to
  `script-src` and `frame-src` (its embed script and form iframe). No tokens or
  secrets are emitted.

## Share Control (`share`)

The optional `share` block adds a topbar Share control. It loads no third-party
SDKs, trackers, or background network calls. Desktop targets are plain outbound
URLs opened only after user action; touch devices can use the browser-native Web
Share sheet when available.

```json
{
  "share": {
    "enabled": true,
    "native": "auto",
    "services": ["copy", "email", "linkedin", "x", "reddit", "mastodon"],
    "mastodon": {
      "mode": "configured-instance",
      "instance": "https://fosstodon.org"
    }
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `false` | Shows or removes the Share control. |
| `native` | `auto` | `auto` uses `navigator.share()` on touch/coarse-pointer devices when available; `always` uses it wherever available; `never` always opens the Pagenary menu. |
| `services` | `["copy", "email"]` | Desktop fallback menu targets. Copy Link and Email are always added as a safe baseline. |
| `mastodon.instance`, `misskey.instance`, `lemmy.instance` | built-in public defaults | Optional instance origin for federated/decentralized targets. |

Built-in service ids: `copy`, `email`, `x`, `linkedin`, `facebook`, `threads`,
`bluesky`, `reddit`, `hackernews`, `lobsters`, `producthunt`, `slashdot`, `sms`,
`whatsapp`, `telegram`, `signal`, `messenger`, `mastodon`, `misskey`, `lemmy`,
`instapaper`, `pinboard`, `raindrop`, `teams`, `notion`, `trello`,
`pinterest`, and `tumblr`.

Pagenary ships local default share icons for every built-in id. Full-color SVGs
live under `src/assets/share-icons/color/`; monochrome equivalents live under
`src/assets/share-icons/mono/`. The runtime menu uses local full-color assets,
so no icon CDN or third-party network request is made just to render the menu.
Brand icons available from the acquired Simple Icons set are used as source
marks; utility actions and services without an acquired redistributable icon use
local fallback marks. Brand names and logos remain trademarks of their owners.

Some platforms have limited web share/deep-link surfaces. Slack and Discord do
not provide stable generic share URLs suitable for a built-in catalog entry; add
them as custom targets only when your tenant has a workspace-specific route.
Teams links may depend on the user's Microsoft 365 state, and federated services
work best with a configured instance. For anything tenant-specific, add a custom
target:

```json
{
  "share": {
    "enabled": true,
    "services": [
      "copy",
      "email",
      {
        "id": "internal-community",
        "label": "Community",
        "urlTemplate": "https://community.example/share?url={url}&title={title}",
        "icon": {
          "color": "./assets/icons/community-color.svg",
          "mono": "./assets/icons/community-mono.svg"
        }
      }
    ]
  }
}
```

Custom templates support `{url}`, `{title}`, `{text}`, and `{description}`. Values
are URL-encoded automatically. Templates must use `https:`, `http:`, `mailto:`,
`sms:`, `sgnl://`, or `fb-messenger://`. Custom icon paths must be local paths;
remote icon URLs are intentionally rejected.

Static snapshots include a visible canonical URL and basic share links when
sharing is enabled, so no-JS users still have a usable share path. Share payloads
use the current page title, section summary, and the canonical `/pages/*.html`
URL when `seo.siteUrl` or `domain` is configured.

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
    "file": "guides/index.md",
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

Groups can also provide `file` alongside `subsections`. When present, the group
becomes its own navigable section heading page at its route, with authored
content plus generated links to child pages. When omitted, the group remains a
navigation container and selecting it routes to the first child.

Use section heading pages for real introductions, orientation, summaries, and
child-page discovery. Do not use them as doorway pages, keyword-stuffed topic
copies, or hidden SEO-only variants of existing child content.

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
- **Keyboard pan**: Focus the viewport and use arrow keys (Shift uses larger steps)
- **Pan**: Pointer or pen drag to move the diagram
- **Pinch zoom**: Touch devices support pinch gestures
- **Auto-scroll**: Diagrams larger than viewport are scrollable
- **Shared behavior**: The same bounded 50–300% controller powers interactive images

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

`overrides/styles.css` is a full replacement, not a patch. If you use it, copy
forward the current generated rules for runtime features you still enable
(`pageToc`, blog shell, post navigation, forms, media, page effects, theme
picker). For smaller brand customizations, prefer theme config, `.public/`
assets, or an extra stylesheet linked by an `overrides/index.html` shell so the
base runtime CSS stays intact.

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
