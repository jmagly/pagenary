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

### Managed Hosting Fields

These fields are optional for ordinary static publishing. They define the public
contract used by `pagenary managed-hosting` and the concierge managed-hosting
flow.

| Property | Required | Description |
|----------|----------|-------------|
| `plan` | No | Hosting plan gate: `free`, `pro`, or `team` (default `free`) |
| `accountId` | No | Hosting account/group id used to enforce plan site limits across tenants |
| `subdomain` | No | Public `name.pagenary.app` label; defaults to the tenant id |
| `siteCount` | No | Number of hosted sites consumed by the account for plan limits |
| `privateRepo` | No | Whether the connected source repo is private; requires Pro or Team |
| `repoCredentialRef` | No | Name/reference for the private control-plane deploy key or OAuth credential |
| `webhookSecretRef` | No | Name/reference for the private control-plane webhook secret |
| `paymentStatus` | No | Concierge billing state: `free`, `manual-pending`, `active`, `past-due`, or `canceled` |
| `verifiedDomains` | No | Custom domains that the private control plane has verified for DNS/TLS readiness |
| `suspendedDomains` | No | Paid custom domains disabled by a downgrade/cancel event and retained for recovery |
| `whiteLabel` | No | White-label entitlement request; requires Team |
| `sso` | No | SSO entitlement request; requires Team |

See [Managed Hosting MVP](MANAGED-HOSTING.md) for plan entitlements, Stripe
Payment Link onboarding, and generated Caddy routing.

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
| `blog.livingScroll` | bool | `false` | Blog only: reveal post content on scroll + a reading-progress bar (opt-in, reduced-motion + JS-off safe). See [Blog Layout](#blog-layout). |
| `collections` | array | — | Folders the build scans as dated post collections (emits `index.json` + `feed.xml`). See [Blog Layout](#blog-layout). |

`top` and `bottom` render navigation as a horizontal bar; `hybrid` adds a
horizontal primary strip (built from your top-level sections) above the left
rail. See the [Theming Recipes gallery](THEMING-RECIPES.md) for screenshots of
each.

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

For the current token contract and intentional non-token exceptions, see
[Theme Token Audit](THEME-TOKEN-AUDIT.md).

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
  post is `{ slug, title, date, summary, hero, tags, reading_time, canonical, path }`,
  sorted per `sortBy`/`order`. `canonical` is the absolute static-page URL (uses
  the same base URL as [SEO](#seo-seo)); `reading_time` is estimated from the body.
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

Configure bottom navigation bar behavior in root `_manifest.json` or `manifest.json`:

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
| `bottomNav` | string | `"mobile"` | When to show **docs** bottom nav: `"mobile"`, `"always"`, or `"never"` |
| `bottomNavSections` | string[] | `[]` | Section IDs to include (empty array = all sections) |
| `postNav` | object \| bool | all on | **Blog** post navigation affordances. `false` disables it; an object toggles `{ prev, next, index, label }`. Posts always get a persistent prev/next + back-to-index control regardless of `bottomNav`. |

**Behavior:**
- `"mobile"` - Show only on small screens (default)
- `"always"` - Show on all screen sizes
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
