# Page Effects

Pagenary ships a small set of **opt-in, accessible page effects** — modern
content-site patterns you add with a class, a `data-*` hook, or a frontmatter
block. They are layout-agnostic (docs or [blog](#blog-layout)), read your theme
tokens, and degrade cleanly: with JavaScript off or `prefers-reduced-motion`
set, nothing is hidden and nothing moves — the page is complete static markup.

Two layers ship together:

- **CSS primitives** — `.pe-*` classes and `data-*` hooks in `styles.css`. These
  are the contract; everything else just writes this markup for you.
- **A runtime** (`src/lib/page-effects.js`) — attaches reveal-on-scroll, a
  reading-progress bar, hero parallax, and a sticky stuck-state hook to each
  rendered section, and tears them down on navigation. Motion is gated on
  `prefers-reduced-motion`; the base hidden state for reveals is scoped under
  `html.has-js`, so a no-JS page shows everything.

> Live demo: build the example gallery with `npm run build:examples` and open
> `dist/page-effects/`. Its two pages exercise every primitive below.
> The example gallery also includes an R&D-only spike page for future candidate
> effects; those `pe-spike-*` classes are prototypes, not supported primitives.

## The primitives

### Reveal-on-scroll

Add `data-reveal` to any element. It fades and rises into place as it enters the
viewport, and appears instantly under reduced-motion or with JS off.

```html
<section data-reveal>…</section>
```

### Reading-progress bar

Set `reader.progress.enabled: true` in tenant config, or frontmatter
`progress.enabled: true` on a single Markdown document, to add a thin top
progress bar tracking the reading column. The lower-level `data-reading-progress`
body hook still works for custom modules and overrides. The bar is
presentational (`aria-hidden`) and updates passively on scroll.

### Rich hero

A hero is a `.pe-hero` block with an optional background, an overlay scrim, and
an overlaid content column (eyebrow, title, subtitle, CTAs). Modifiers compose:

| Class / hook | Effect |
|--------------|--------|
| `.pe-hero` | The hero container (a comfortable min-height, centered content). |
| `.pe-hero--full-bleed` | Break out of the reading column to span the content area edge-to-edge. |
| `.pe-hero--overlay` | Add the `.pe-hero-scrim` gradient for legible overlay text. |
| `.pe-hero--sticky` | Pin the hero to the top of the reading area (`position: sticky`). |
| `data-pe-parallax` | Drift the `.pe-hero-bg` layer slower than the page on scroll. |
| `data-pe-align="start\|center\|end"` | Align the content column (on `.pe-hero-content`). |
| `--pe-hero-image` | Background image, as `url(...)` on the hero (the `.pe-hero-bg` layer reads it). |
| `--pe-hero-height` | Override the hero min-height. |

The hand-authored markup:

```html
<section class="pe-hero pe-hero--full-bleed pe-hero--overlay" data-pe-parallax
         style="--pe-hero-image:url(assets/images/hero.svg)">
  <div class="pe-hero-bg" aria-hidden="true"></div>
  <div class="pe-hero-scrim" aria-hidden="true"></div>
  <div class="pe-hero-content" data-pe-align="center">
    <p class="pe-hero-eyebrow">Eyebrow</p>
    <h1 class="pe-hero-title">Heroes that earn the scroll</h1>
    <p class="pe-hero-subtitle">A tagline that sets up the page.</p>
    <div class="pe-hero-actions">
      <a class="pe-cta pe-cta--primary" href="#start">Get started</a>
      <a class="pe-cta pe-cta--ghost" href="#docs">Docs</a>
    </div>
  </div>
</section>
```

For a `<video>` background, put `<video class="pe-hero-video" autoplay muted loop
playsinline>` inside `.pe-hero-bg` instead of setting `--pe-hero-image`.

### CTA band

A full-width call-to-action strip — a `.pe-banner` with a text block and actions:

```html
<aside class="pe-banner pe-banner--full-bleed">
  <div class="pe-banner-inner">
    <div class="pe-banner-text">
      <p class="pe-banner-title">Ready to ship?</p>
      <p class="pe-banner-sub">Spin up a tenant in minutes.</p>
    </div>
    <div class="pe-banner-actions">
      <a class="pe-cta pe-cta--primary" href="#start">Get started</a>
    </div>
  </div>
</aside>
```

### CTA buttons

`.pe-cta` is the shared button primitive, with `--primary` (accent fill),
`--ghost` (outline), and `--plain` (text) variants. It reads the accent / ink /
surface tokens, so it matches any theme.

### Disclosure (accordion)

`.pe-accordion` is a production accordion built on native `<details>/<summary>`,
so every panel opens, closes, and takes keyboard focus with **zero JavaScript**.
The open/closed marker is a `+`/`−` glyph (not color alone), and the summary shows
a visible focus ring.

```html
<div class="pe-accordion" data-pe-single>
  <details open><summary>First</summary><p>…</p></details>
  <details><summary>Second</summary><p>…</p></details>
</div>
```

Add `data-pe-single` to make it single-open — opening one panel closes its
siblings. That grouping is the only thing JavaScript adds; drop the attribute (or
run with JS off) and every panel works independently. Theme-token styled.

### Staggered reveal

Put `data-reveal-stagger` on a container and its direct children arrive in a wave
as the container scrolls into view — each child carries an incremental delay.

```html
<div class="card-grid" data-reveal-stagger="80">
  <div>…</div>
  <div>…</div>
  <div>…</div>
</div>
```

The number is the per-child step in milliseconds (default `90`). Like
reveal-on-scroll, the hidden base state is gated under `html.has-js` +
no-preference, so JS-off and reduced-motion readers see every child immediately.

### Parallax (any element)

Heroes parallax their background automatically. To drift any other element against
the scroll, add `data-pe-parallax` with a speed:

```html
<img class="pe-aside" src="ridge.svg" alt="" data-pe-parallax="0.3" />
```

The value is the parallax speed (fraction of scroll offset), **clamped to 0–0.5**
so the drift stays gentle, and travel is bounded to a fraction of the element's
height. Parallax is motion-only: under `prefers-reduced-motion` it's skipped
entirely and the element sits in its normal position.

### Figure zoom

Mark a `<figure>` with `data-pe-zoom` and a reader can enlarge its image in a
modal:

```html
<figure class="pe-figure" data-pe-zoom>
  <img src="assets/images/pipeline.svg" alt="The Pagenary publishing pipeline: author, build, deploy." />
  <figcaption>The publishing pipeline — click to enlarge.</figcaption>
</figure>
```

The figure renders the image normally, so **with JS off the image is fully
visible** — zoom is an enhancement. With JS, the image becomes a `<button>` and
opens a native `<dialog>` (`showModal()`), which gives the focus trap, `Esc`-to-
close, inert backdrop, and focus-restore for free. No autoplaying motion.

### Scroll-snap sections

A `.pe-snap` region snaps its `.pe-snap__panel` children as you scroll it — a
CSS-only primitive for landing/portfolio pages, with **no runtime**:

```html
<div class="pe-snap">
  <section class="pe-snap__panel"><h2>One</h2><p>…</p></section>
  <section class="pe-snap__panel"><h2>Two</h2><p>…</p></section>
  <section class="pe-snap__panel"><h2>Three</h2><p>…</p></section>
</div>
```

It's a **self-contained scroll region** (bounded height), so it never takes over
the page scroll, and it uses `scroll-snap-type: y proximity` (not `mandatory`) so
keyboard users are never trapped — panels stay individually reachable. Smooth
glide to snap points is gated under `prefers-reduced-motion: no-preference`.

### Scrollytelling

A `.pe-scrolly` block pairs a sticky stage with a column of content steps; the
stage updates as each step scrolls into view:

```html
<div class="pe-scrolly">
  <div class="pe-scrolly__stage">
    <div data-pe-step="one"><h2>One</h2></div>
    <div data-pe-step="two"><h2>Two</h2></div>
  </div>
  <div class="pe-scrolly__steps">
    <section data-pe-step="one"><p>…</p></section>
    <section data-pe-step="two"><p>…</p></section>
  </div>
</div>
```

Each step and its stage layer share a `data-pe-step` value; the active step's
layer crossfades in (gated under `prefers-reduced-motion: no-preference`). The
active step is detected by the same rect-based scroll position as scroll-spy — no
animation engine. **With JS off** the steps are plain readable content and the
stage shows its layers statically, so the narrative is complete either way.

## Authoring paths

You have four ways to add these, from least to most control:

1. **Declarative frontmatter** — a `hero:` / `banner:` block in a Markdown file's
   frontmatter writes the markup for you (see [below](#declarative-config)).
2. **Fenced `html` blocks** — drop the `.pe-*` markup straight into Markdown.
3. **`.js` content modules** — export `load()` returning `{ html, afterRender }`
   for full programmatic control.
4. **`.public/` + `overrides/`** — ship a fully custom page.

The CSS primitives and the parallax/sticky behaviors are identical across all
four — the declarative block is purely a convenience.

## Declarative config

In a Markdown file's frontmatter, a `hero` and/or `banner` map emits the markup
above. The hero renders above the article; the banner renders below it.

```markdown
---
title: Heroes that earn the scroll
hero:
  eyebrow: Page Effects
  title: Heroes that earn the scroll
  subtitle: Authored from frontmatter — no markup required.
  image: assets/images/hero.svg
  fullBleed: true
  overlay: true
  parallax: true
  align: center
  cta:
    - { label: "Get started", href: "#start", style: primary }
    - { label: "Docs", href: "#docs", style: ghost }
banner:
  title: Ready to give your docs a front door?
  text: Drop a hero block in frontmatter and ship.
  fullBleed: true
  cta:
    - { label: "Get started", href: "#start", style: primary }
---

# Heroes that earn the scroll

Your article…
```

`hero` / `banner` fields:

| Field | Applies to | Meaning |
|-------|-----------|---------|
| `eyebrow` / `title` / `subtitle` | hero | Overlay text (all optional). |
| `title` / `text` (or `subtitle`) | banner | Band heading and supporting line. |
| `image` / `video` / `poster` | hero | Background media (`video` wins over `image`). |
| `fullBleed` | both | Span the content area edge-to-edge. |
| `overlay` | hero | Scrim for legibility (defaults on when media is present). |
| `parallax` | hero | Drift the background on scroll. |
| `sticky` | hero | Pin to the top of the reading area. |
| `align` | hero | `start` \| `center` \| `end`. |
| `height` | hero | Override the hero min-height (e.g. `60vh`). |
| `cta[]` | both | `{ label, href, style }` — `style` is `primary` \| `ghost` \| `plain`. |

A **string** `hero` (e.g. `hero: assets/x.svg`) keeps its older meaning — a
simple post image for the [blog layout](#blog-layout). Use the **object** form
above for a rich hero.

## Accessibility

- Real `<section>` / `<a>` / `<video>` elements; the overlay content keeps a
  single `<h1>` and normal reading order.
- **Reduced motion** — parallax holds still and reveals appear instantly; the
  sticky stuck-state is a class toggle only, so it carries no motion.
- **No JavaScript** — the reveal base state is scoped under `html.has-js`, so
  content is never hidden waiting on a script; heroes and bands are static,
  fully-readable markup (and appear in the prerendered SEO snapshots).
- Background layers and scrims are `aria-hidden` and decorative.

## See also

- [Blog Layout](#blog-layout) — the reading-first layout these heroes pair with.
- [Tenant Configuration](#tenant-config) — every `config.json` option.
- [Theming Recipes](#theming-recipes) — colors, fonts, and layout recipes.
