# Theming Recipes

Copy-paste starting points for the most common ways to customize a Pagenary
tenant. Every recipe below is **the same documentation set** rebuilt with a
different tenant `config.json` — the look is **data, not code**. There is no
generator fork, no CSS surgery, and no per-recipe content.

All recipes live in [`../examples/`](../examples/) and are registered in
[`../examples/recipes.tenants.json`](../examples/recipes.tenants.json). Build the
whole gallery and serve it locally:

```bash
npm run build:examples      # builds dist/<recipe-id>/ for every recipe
npm run serve:dev           # then open http://localhost:5173/<recipe-id>/
```

The screenshots below were captured from those builds. For the full list of
config keys, see [`TENANT-CONFIG.md`](TENANT-CONFIG.md).

### Live demos

Every recipe is deployed alongside this site, so you can click through the real
thing — not just a screenshot:

| Recipe | Live demo |
| --- | --- |
| Custom palette | [docs.pagenary.com/theme-colors/](https://docs.pagenary.com/theme-colors/) |
| Dark preset | [docs.pagenary.com/theme-dark/](https://docs.pagenary.com/theme-dark/) |
| Matrix preset | [docs.pagenary.com/theme-matrix/](https://docs.pagenary.com/theme-matrix/) |
| Fonts + brand | [docs.pagenary.com/basic-styles/](https://docs.pagenary.com/basic-styles/) |
| Nav: left | [docs.pagenary.com/nav-left/](https://docs.pagenary.com/nav-left/) |
| Nav: right | [docs.pagenary.com/nav-right/](https://docs.pagenary.com/nav-right/) |
| Nav: top | [docs.pagenary.com/nav-top/](https://docs.pagenary.com/nav-top/) |
| Nav: bottom | [docs.pagenary.com/nav-bottom/](https://docs.pagenary.com/nav-bottom/) |
| Nav: hybrid | [docs.pagenary.com/nav-hybrid/](https://docs.pagenary.com/nav-hybrid/) |
| Theme picker (runtime) | [docs.pagenary.com/theme-picker/](https://docs.pagenary.com/theme-picker/) |
| Docs map (relationship view) | [docs.pagenary.com/docs-map/#docs-map](https://docs.pagenary.com/docs-map/#docs-map) |
| Page effects | [docs.pagenary.com/page-effects/](https://docs.pagenary.com/page-effects/) |
| Interocitor showcase | [docs.pagenary.com/interocitor/](https://docs.pagenary.com/interocitor/) |
| Blog (default) | [docs.pagenary.com/blog-demo/](https://docs.pagenary.com/blog-demo/) |
| Blog: dark | [docs.pagenary.com/blog-dark/](https://docs.pagenary.com/blog-dark/) |
| Blog: editorial | [docs.pagenary.com/blog-editorial/](https://docs.pagenary.com/blog-editorial/) |
| Blog: posts rail | [docs.pagenary.com/blog-rail/](https://docs.pagenary.com/blog-rail/) |
| Blog: vivid | [docs.pagenary.com/blog-vivid/](https://docs.pagenary.com/blog-vivid/) |
| Blog: matrix | [docs.pagenary.com/blog-matrix/](https://docs.pagenary.com/blog-matrix/) |

> **Where recipes get their content.** The color/style/nav recipes share one
> small docs set in [`../examples/content-base/`](../examples/content-base/) and
> override only their branding/theme/layout via the registry's inline `config`.
> The [blog themes](#blog-themes) do the same with one set of posts from
> [`../examples/blog-demo/`](../examples/blog-demo/). The
> [interocitor showcase](#fully-bespoke-showcase-interocitor) goes beyond
> config — its own content, overlay stylesheet, and overrides under
> [`../examples/interocitor/`](../examples/interocitor/).

---

## Colors

### Custom palette (`theme-colors`)

A light theme with a bold accent and a tinted surface — the legacy per-color
keys, no preset.

![Custom palette recipe](images/recipes/recipe-theme-colors.png)

```json
{
  "brandMark": "Aurora",
  "brandSub": "Docs",
  "accentColor": "#7c3aed",
  "surfaceColor": "#faf5ff",
  "inkColor": "#2e1065",
  "mutedColor": "#6d5b9c",
  "gridLineColor": "rgba(124, 58, 237, 0.16)"
}
```

### Dark preset (`theme-dark`)

The built-in `dark` preset — one key flips the entire color scheme, including
code blocks, tables, and the command palette.

![Dark theme recipe](images/recipes/recipe-theme-dark.png)

```json
{
  "brandMark": "Nocturne",
  "brandSub": "Docs",
  "theme": "dark"
}
```

### Matrix preset (`theme-matrix`)

The built-in `matrix` preset — a green-on-black terminal aesthetic.

![Matrix theme recipe](images/recipes/recipe-theme-matrix.png)

```json
{
  "brandMark": "Oracle",
  "brandSub": "Terminal",
  "theme": "matrix"
}
```

> `theme` accepts the presets `light`, `dark`, and `matrix`, **or** a full custom
> object (`{ "colorScheme": "dark", "surface": "...", "accent": "...", ... }`).
> The interocitor showcase below uses a custom object.

---

## Basic style changes

### Fonts + brand (`basic-styles`)

Swap typography and the wordmark without touching colors. `fontBody` and
`fontMono` accept any CSS font stack.

![Basic styles recipe](images/recipes/recipe-basic-styles.png)

```json
{
  "brandMark": "Foundry",
  "brandSub": "Press",
  "accentColor": "#b45309",
  "fontBody": "Georgia, 'Times New Roman', serif",
  "fontMono": "'Courier New', Courier, monospace"
}
```

---

## Navigation positions

`navPosition` controls where navigation sits. Five values are supported:

| Value | Layout |
| --- | --- |
| `left` *(default)* | Vertical sidebar on the leading edge |
| `right` | Vertical sidebar on the trailing edge |
| `top` | Horizontal bar above the content |
| `bottom` | Horizontal bar below the content |
| `hybrid` | Horizontal primary strip **and** the left rail |

### Left (`nav-left`, default)

![Left nav recipe](images/recipes/recipe-nav-left.png)

```json
{ "navPosition": "left" }
```

### Right (`nav-right`)

![Right nav recipe](images/recipes/recipe-nav-right.png)

```json
{ "navPosition": "right" }
```

### Top (`nav-top`)

The sidebar becomes a horizontal bar; top-level groups lay out across the top
with their children inline.

![Top nav recipe](images/recipes/recipe-nav-top.png)

```json
{ "navPosition": "top" }
```

### Bottom (`nav-bottom`)

The same horizontal bar, anchored beneath the content.

![Bottom nav recipe](images/recipes/recipe-nav-bottom.png)

```json
{ "navPosition": "bottom" }
```

### Hybrid (`nav-hybrid`)

A horizontal **primary strip** of top-level sections under the header, plus the
full **left rail** for deep navigation. The strip is generated at build time
from the tenant's manifest — no extra config.

![Hybrid nav recipe](images/recipes/recipe-nav-hybrid.png)

```json
{ "accentColor": "#2563eb", "navPosition": "hybrid" }
```

> **How it works.** Layout rules are scoped to a `data-nav-position` attribute on
> `<body>`, set at build time from `navPosition`. `left` is the default and adds
> nothing. `hybrid` additionally injects a `<nav class="nav-strip">` after the
> header, linking each top-level section to its first page.

---

## Runtime theme picker (`theme-picker`)

Let readers choose the theme themselves. `themePicker` adds a header control;
the choice persists across visits and the first visit honors the reader's
`prefers-color-scheme`. The build emits one stylesheet per theme and swaps it
live — instant and pixel-correct.

```json
{
  "themePicker": {
    "enabled": true,
    "themes": ["light", "dark", "matrix"],
    "default": "light"
  }
}
```

Try it on the [live demo](https://docs.pagenary.com/theme-picker/) — the
**Theme** dropdown is in the header. Full options in
[`TENANT-CONFIG.md`](TENANT-CONFIG.md).

---

## Docs map (`docs-map`)

An opt-in **Docs Map** page — a framework-free SVG view powered by the Fortemi
graph artifact. It clusters pages by nav group, draws weighted concept
relationships, and gives readers an inspectable viewport with zoom, drag-pan,
neighbor highlighting, and pinned node details before they choose to open a page.

```json
{ "docsMap": { "enabled": true, "renderer": "svg" } }
```

See the [live demo](https://docs.pagenary.com/docs-map/#docs-map). The graph is
computed at build time from page content and emitted as static JS — no server,
no React; small corpora get a friendly placeholder. `svg` is the
default/fallback renderer. Options in
[`TENANT-CONFIG.md`](TENANT-CONFIG.md).

---

## Fully-bespoke showcase: Interocitor

The recipes above are **config-only**. This one is the other tier: a tenant that
bears **no resemblance to the default shell** — a deep-space instrument console
for a fictitious company that builds **interociters** — yet still uses nothing
but Pagenary's own tools. No generator fork, `src/` untouched.

![Interocitor showcase](images/recipes/recipe-interocitor.png)

It layers three mechanisms on top of the config theme:

| Mechanism | What it does here |
| --- | --- |
| `config.json` | Custom dark `theme` object, `hybrid` nav, custom fonts, wordmark |
| [`overrides/`](../examples/interocitor/overrides/index.html) | Replaces `index.html` to link a bespoke overlay stylesheet (and tag `<body class="interocitor">`) |
| [`.public/`](../examples/interocitor/.public/interocitor.css) | Ships `interocitor.css` — restyles header, nav, rail, type, tables, code, and adds the focal-triad aperture motif |
| Custom content | [`overview.html`](../examples/interocitor/content/overview.html) is a hand-authored hero, not the stock doc layout |

The base stylesheet still provides all the *behavior* (routing, command palette,
search, mobile nav); the overlay only restyles the *look*. Every Pagenary control
still works — try Quick Find on the [live demo](https://docs.pagenary.com/interocitor/).

The config is in
[`../examples/interocitor/config.json`](../examples/interocitor/config.json); the
overlay stylesheet in
[`../examples/interocitor/.public/interocitor.css`](../examples/interocitor/.public/interocitor.css).

> **Two tiers, one toolkit.** Reach for config for the common cases above; reach
> for `overrides/` + `.public/` + custom content when you need a wholly distinct
> product surface like this one.

---

## Page effects (`page-effects`)

A landing-page recipe: a **full-bleed parallax hero** with overlay text and CTAs,
**reveal-on-scroll** cards, a **sticky** hero, and a **CTA band** — all opt-in,
theme-token aware, and accessible (static and fully readable with JS off or under
reduced motion). The hero and band are declared in Markdown frontmatter; nothing
in `src/` changes.

```markdown
---
hero:
  title: Heroes that earn the scroll
  image: assets/images/hero.svg
  fullBleed: true
  overlay: true
  parallax: true
  cta:
    - { label: "Get started", href: "#start", style: primary }
---
```

The example lives at [`../examples/page-effects/`](../examples/page-effects/) —
build the gallery (`npm run build:examples`) and open `dist/page-effects/`. See
the [Page Effects](#page-effects) guide for every primitive, authoring path, and
the full config reference.

---

## Blog themes

The [blog layout](#blog-layout) (`layout: "blog"`) themes exactly like the docs
layout — same `theme` presets, `accentColor`/`surfaceColor`/`inkColor`, and
fonts. The recipes below are **one set of posts, many looks**: each reuses
[`../examples/blog-demo/`](../examples/blog-demo/) and overrides only its inline
`config`. They all keep the post navigation (prev/next + back-to-index) and have
[living scroll](#living-scroll) on — content reveals as you read, with a
reading-progress bar — so scroll through a post to see it.

### Dark (`blog-dark`)

A dark blog via the `dark` preset with a violet accent:

```json
{ "brandMark": "Umbra", "theme": "dark", "accentColor": "#a78bfa" }
```

### Editorial (`blog-editorial`)

A warm, serif reading experience — `surfaceColor`/`inkColor` plus a serif
`fontBody`:

```json
{
  "brandMark": "The Quill",
  "accentColor": "#9a3412",
  "surfaceColor": "#fbf7f0",
  "inkColor": "#2b2118",
  "fontBody": "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
}
```

### Posts rail (`blog-rail`)

`blog.sidebar: "rail"` keeps a navigation rail on the trailing edge instead of
the single centered column — handy when readers want to jump between posts:

```json
{ "brandMark": "Dispatch", "accentColor": "#2563eb", "blog": { "sidebar": "rail" } }
```

### Vivid (`blog-vivid`)

A bright, high-accent palette:

```json
{
  "brandMark": "Prism",
  "accentColor": "#db2777",
  "surfaceColor": "#fff7fb",
  "inkColor": "#3b0a2a"
}
```

### Matrix (`blog-matrix`)

The `matrix` preset, for a terminal-green blog:

```json
{ "brandMark": "Terminal", "theme": "matrix" }
```

> Want a richer post page? Add a [page-effects](#page-effects) `hero` block to a
> post's frontmatter for a full-bleed, overlaid banner — it composes with the
> blog layout and the post navigation.

---

## In the wild

Real documentation sites built with Pagenary — each a different brand, theme,
and content set from the same toolkit:

- [docs.pagenary.com](https://docs.pagenary.com) — this site (Pagenary's own docs)
- [docs.aiwg.io](https://docs.aiwg.io) — AI Writing Guide
- [docs.fortemi.com](https://docs.fortemi.com) — Fortémi
- [docs.roko.network](https://docs.roko.network) — Roko Network

Running a Pagenary site you'd like listed here? Open a PR adding it.

---

## Reproduce any recipe

1. Copy a config block above into a tenant's `config.json` (or an inline
   `config` in your registry).
2. Build: `npm run build:tenants` (or `npm run build:examples` for the gallery).
3. Serve and compare: `npm run serve:dev`, then open
   `http://localhost:5173/<tenant-id>/`.

Screenshots are regenerated from the live builds, so what you see here is exactly
what the config produces.
