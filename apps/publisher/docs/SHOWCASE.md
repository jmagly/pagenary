---
title: Showcase — one system, many styles
summary: The same Pagenary build renders reference docs, marketing heroes, interactive components, and scrollytelling. This page is the proof.
hero:
  eyebrow: Showcase
  title: One system, many styles
  subtitle: Heroes, reveal-on-scroll, accordions, scroll-snap, scrollytelling — every style on this site comes out of the same static build.
  fullBleed: true
  align: center
  cta:
    - { label: "Start building", href: "#quickstart", style: primary }
    - { label: "See it as a story", href: "#showcase-story", style: ghost }
banner:
  title: All of this is one Markdown folder and one build.
  text: No runtime framework, no second deploy — opt-in effects that degrade to plain, readable content with JavaScript off.
  fullBleed: true
  cta:
    - { label: "Read the Page Effects guide", href: "#page-effects", style: primary }
---

# One system, many styles

Pagenary turns a folder of Markdown into a static site — and that same site can
read like crisp reference docs, a marketing landing page, an interactive product
tour, or a scrollytelling story. Everything below is rendered by the build you
already have: no framework, no server, no second deploy.

> Every effect is **opt-in** and **accessible**. With JavaScript off or
> `prefers-reduced-motion` set, motion holds still and no content is ever hidden
> behind a script — the page is complete either way.

## Capabilities, revealed as you scroll

The cards rise into place as they enter the viewport (`data-reveal-stagger`), and
appear instantly under reduced motion.

```html
<style>
  .sc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: 1rem; }
  .sc-card { border: 1px solid var(--grid-line); border-radius: 12px; padding: 1.1rem 1.2rem; background: rgba(var(--surface-rgb), 0.6); }
  .sc-card h3 { margin: 0 0 0.35rem; font-size: 1.05rem; }
  .sc-card p { margin: 0; color: var(--muted); line-height: 1.5; }
</style>
<div class="pe-card-grid sc-grid" data-reveal-stagger>
  <section class="sc-card"><h3>Rich heroes</h3><p>Full-bleed, overlaid, parallax — authored from frontmatter, no markup.</p></section>
  <section class="sc-card"><h3>Reveal on scroll</h3><p>Content fades and rises into place; instant under reduced motion.</p></section>
  <section class="sc-card"><h3>Disclosure</h3><p>Native &lt;details&gt; accordions — keyboard-operable, complete with zero JavaScript.</p></section>
  <section class="sc-card"><h3>Scroll-snap</h3><p>Self-contained snapping regions for landing and portfolio sections.</p></section>
  <section class="sc-card"><h3>Scrollytelling</h3><p>A sticky stage that updates as steps scroll past.</p></section>
  <section class="sc-card"><h3>Blog layout</h3><p>Chronological index, hero posts, bylines, and tags — same engine.</p></section>
  <section class="sc-card"><h3>Theming</h3><p>Surface / ink / accent tokens restyle every primitive at once.</p></section>
  <section class="sc-card"><h3>Search &amp; data</h3><p>Ranked hybrid search and a knowledge graph, built at publish time.</p></section>
  <section class="sc-card"><h3>Accessible</h3><p>WCAG-minded defaults; every effect degrades to readable, static content.</p></section>
</div>
```

## Interactive, without a framework

Disclosures are native `<details>` — open, close, and keyboard focus work with no
JavaScript. The only thing the script adds is single-open grouping.

```html
<div class="pe-accordion" data-pe-single>
  <details open>
    <summary>Is this really one build?</summary>
    <p>Yes. This page, the reference docs, and the blog demos are the same static
       output — the effects are CSS plus a small progressive-enhancement layer.</p>
  </details>
  <details>
    <summary>Does it work with JavaScript off?</summary>
    <p>Every effect degrades. Heroes become static banners, reveals show instantly,
       and scrollytelling becomes plain readable steps.</p>
  </details>
  <details>
    <summary>Can I theme it?</summary>
    <p>Set a few color tokens and every primitive — hero, accordion, cards — follows
       automatically.</p>
  </details>
</div>
```

## A landing section, snapped

`.pe-snap` makes a bounded region snap its panels as you scroll *inside* it — it
never hijacks the page scroll, and every panel stays reachable by keyboard.

```html
<div class="pe-snap">
  <section class="pe-snap__panel"><h2>Author</h2><p>Markdown, HTML, or JS modules — your content, your structure.</p></section>
  <section class="pe-snap__panel"><h2>Brand</h2><p>Shared templates and theme tokens turn it into a tenant-specific site.</p></section>
  <section class="pe-snap__panel"><h2>Ship</h2><p>The build emits static files. Host them anywhere, or let CI deploy them.</p></section>
</div>
```

## See it as a story

The [Storytelling](#showcase-story) page puts the same engine into a scrollytelling
layout — a sticky stage that advances as you read. Same Markdown folder, same
build, a completely different feel.
