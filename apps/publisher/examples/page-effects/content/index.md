---
title: Heroes that earn the scroll
summary: Full-bleed heroes with overlay text and CTAs, reveal-on-scroll, parallax, sticky, and CTA bands — all opt-in and accessible.
hero:
  eyebrow: Page Effects
  title: Heroes that earn the scroll
  subtitle: Full-bleed, overlaid, parallax — authored from frontmatter, no markup required.
  image: assets/images/aurora.svg
  fullBleed: true
  overlay: true
  parallax: true
  align: center
  cta:
    - { label: "See parallax & sticky", href: "#parallax-and-sticky", style: primary }
    - { label: "Read the docs", href: "https://docs.pagenary.com/#page-effects", style: ghost }
banner:
  title: Ready to give your docs a front door?
  text: Drop a hero block in frontmatter and ship — it degrades to a static banner with JS off.
  fullBleed: true
  cta:
    - { label: "Get started", href: "https://docs.pagenary.com/#quickstart", style: primary }
---

# Heroes that earn the scroll

This page is built from a single Markdown file. The hero above it — full-bleed,
overlaid, with a parallax background and two call-to-action buttons — came
entirely from a `hero:` block in the frontmatter. No HTML, no JavaScript on your
part. The CTA band at the bottom is a `banner:` block.

Everything here is **opt-in** and **accessible**. With JavaScript off or
`prefers-reduced-motion` set, the hero is a static, fully-readable banner: the
parallax simply holds still and nothing is hidden waiting on a script.

## The primitives, revealed as you scroll

The cards below use `data-reveal` — they fade and rise into place as they enter
the viewport, and appear instantly under reduced-motion.

```html
<style>
  .pe-demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 1rem;
  }
  .pe-demo-card {
    border: 1px solid var(--grid-line);
    border-radius: 12px;
    padding: 1.1rem 1.2rem;
    background: rgba(var(--surface-rgb), 0.6);
  }
  .pe-demo-card h3 { margin: 0 0 0.35rem; font-size: 1.05rem; }
  .pe-demo-card p { margin: 0; color: var(--muted); line-height: 1.5; }
</style>
<div class="pe-demo-grid">
  <section class="pe-demo-card" data-reveal="up">
    <h3>Full-bleed</h3>
    <p>Break out of the reading column to span the content area edge-to-edge.</p>
  </section>
  <section class="pe-demo-card" data-reveal="up">
    <h3>Overlay &amp; scrim</h3>
    <p>A token-tuned gradient keeps overlay text legible over any image or video.</p>
  </section>
  <section class="pe-demo-card" data-reveal="up">
    <h3>Parallax</h3>
    <p>The background drifts slower than the page — clamped so an edge never shows.</p>
  </section>
  <section class="pe-demo-card" data-reveal="up">
    <h3>Sticky</h3>
    <p>Pin a hero to the top of the scroll container, with a stuck-state hook.</p>
  </section>
  <section class="pe-demo-card" data-reveal="up">
    <h3>CTA band</h3>
    <p>A full-bleed call-to-action strip — like the one closing this page.</p>
  </section>
  <section class="pe-demo-card" data-reveal="up">
    <h3>Theme-aware</h3>
    <p>Every primitive reads the same surface / ink / accent tokens as your theme.</p>
  </section>
</div>
```

## Authoring paths

You have four ways to add a hero, from least to most control:

1. **Declarative frontmatter** — a `hero:` / `banner:` block, like this page.
2. **Fenced `html` blocks** — drop the `.pe-*` markup straight into Markdown
   (see the [parallax & sticky recipes](#parallax-and-sticky)).
3. **`.js` content modules** — return `{ html, afterRender }` for full control.
4. **`.public/` + `overrides/`** — ship a fully custom page.

The CSS primitives and the parallax/sticky behaviors are identical across all
four — the declarative block just writes the markup for you.
