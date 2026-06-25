---
title: Parallax & sticky recipes
summary: A sticky hero authored from frontmatter, plus a hand-authored full-bleed hero and CTA band via fenced HTML.
hero:
  eyebrow: Recipe
  title: A sticky hero
  subtitle: This hero pins to the top of the reading area as you scroll. Pure CSS — JS only adds a stuck-state shadow.
  image: assets/images/ridge.svg
  fullBleed: true
  overlay: true
  sticky: true
  align: start
  cta:
    - { label: "Back to the showcase", href: "#index", style: ghost }
---

# Parallax & sticky recipes

Scroll down — the hero above stays pinned to the top of the reading area, and
picks up a soft shadow once it is *stuck*. The sticking is pure CSS
(`position: sticky`); the only JavaScript is a class toggle, so it works the
same under `prefers-reduced-motion`.

Below is the same hero, **hand-authored** with a fenced `html` block — the
markup the declarative `hero:` block writes for you. Use this path when you want
full control over the content.

```html
<section class="pe-hero pe-hero--full-bleed pe-hero--overlay" data-pe-parallax
         style="--pe-hero-image:url(assets/images/aurora.svg)">
  <div class="pe-hero-bg" aria-hidden="true"></div>
  <div class="pe-hero-scrim" aria-hidden="true"></div>
  <div class="pe-hero-content" data-pe-align="center">
    <p class="pe-hero-eyebrow">Hand-authored</p>
    <h2 class="pe-hero-title">Same primitives, your markup</h2>
    <p class="pe-hero-subtitle">A parallax background, an overlay scrim, and a CTA — written by hand.</p>
    <div class="pe-hero-actions">
      <a class="pe-cta pe-cta--primary" href="#index">Start over</a>
      <a class="pe-cta pe-cta--ghost" href="https://docs.pagenary.com/#page-effects">Docs</a>
    </div>
  </div>
</section>
```

## A hand-authored CTA band

The CTA band primitive is just as portable:

```html
<aside class="pe-banner pe-banner--full-bleed">
  <div class="pe-banner-inner">
    <div class="pe-banner-text">
      <p class="pe-banner-title">Build your own front door</p>
      <p class="pe-banner-sub">Every primitive reads your theme tokens — no extra config.</p>
    </div>
    <div class="pe-banner-actions">
      <a class="pe-cta pe-cta--primary" href="https://docs.pagenary.com/#quickstart">Get started</a>
    </div>
  </div>
</aside>
```

Keep scrolling to confirm the sticky hero releases at the end of the page.
