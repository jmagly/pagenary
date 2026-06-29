---
title: Page-effects in docs
summary: Heroes and reveal-on-scroll are layout-agnostic — they work in the docs shell, not just the blog.
hero:
  eyebrow: Page Effects
  title: Effects belong in docs too
  subtitle: Reveal-on-scroll, parallax, and CTA bands — opt-in and accessible.
  image: assets/images/hero-2.svg
  fullBleed: true
  overlay: true
  parallax: true
  align: center
banner:
  title: Want the blog shell instead?
  text: Same site — open a post and the shell switches with no reload.
  fullBleed: true
  cta:
    - { label: "Visit the blog", href: "#blog", style: primary }
---

# Effects belong in docs too

Page-effects are layout-agnostic: the hero above and the reveal cards below are
the same primitives the blog uses, here in the **docs shell**. With JavaScript
off or `prefers-reduced-motion` set, the hero holds still and nothing is hidden
waiting on a script.

## Revealed as you scroll

The cards use `data-reveal` — they rise into place as they enter the viewport,
and appear instantly under reduced motion.

```html
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr));gap:1rem">
  <section data-reveal="up" style="border:1px solid var(--grid-line);border-radius:12px;padding:1.1rem">
    <h3 style="margin:0 0 .35rem">Docs shell</h3>
    <p style="margin:0;color:var(--muted)">Sidebar, content, and an on-this-page rail.</p>
  </section>
  <section data-reveal="up" style="border:1px solid var(--grid-line);border-radius:12px;padding:1.1rem">
    <h3 style="margin:0 0 .35rem">Blog shell</h3>
    <p style="margin:0;color:var(--muted)">A reading-first column with hero and byline.</p>
  </section>
  <section data-reveal="up" style="border:1px solid var(--grid-line);border-radius:12px;padding:1.1rem">
    <h3 style="margin:0 0 .35rem">One deploy</h3>
    <p style="margin:0;color:var(--muted)">The shell is resolved per route — no second build.</p>
  </section>
</div>
```

## Accessible by default

Every effect degrades to a complete, readable page. The hero is a static banner,
the reveal cards are visible, and the CTA band is a plain link list — all without
JavaScript.
