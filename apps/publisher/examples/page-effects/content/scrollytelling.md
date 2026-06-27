---
title: Scrollytelling
summary: A sticky stage beside content steps — the stage updates as each step scrolls into view. JS-off shows the steps as plain content.
hero:
  eyebrow: Primitive
  title: Scrollytelling
  subtitle: A sticky stage that reacts as you read past each step — built from sticky layout + scroll position, no animation engine.
  align: start
---

# Scrollytelling

A `.pe-scrolly` block pairs a **sticky stage** with a column of `[data-pe-step]`
content steps. As each step scrolls into view, the stage's matching layer
crossfades in. With JavaScript off, the steps are ordinary readable content and
the stage shows its layers statically — the swap is a pure enhancement.

```html
<div class="pe-scrolly">
  <div class="pe-scrolly__stage">
    <div data-pe-step="capture"><h2>Capture</h2></div>
    <div data-pe-step="compose"><h2>Compose</h2></div>
    <div data-pe-step="publish"><h2>Publish</h2></div>
  </div>
  <div class="pe-scrolly__steps">
    <section data-pe-step="capture"><p>Write your content as Markdown, HTML, or a JS module.</p></section>
    <section data-pe-step="compose"><p>Shared templates turn it into a branded, tenant-specific site.</p></section>
    <section data-pe-step="publish"><p>Build emits static files — host them anywhere.</p></section>
  </div>
</div>
```

<div class="pe-scrolly">
  <div class="pe-scrolly__stage">
    <div data-pe-step="capture"><h2>1 · Capture</h2></div>
    <div data-pe-step="compose"><h2>2 · Compose</h2></div>
    <div data-pe-step="publish"><h2>3 · Publish</h2></div>
  </div>
  <div class="pe-scrolly__steps">
    <section data-pe-step="capture"><p>Write your content as Markdown, HTML, or a JS module — the stage shows <strong>Capture</strong>.</p></section>
    <section data-pe-step="compose"><p>Shared templates turn it into a branded, tenant-specific site — the stage swaps to <strong>Compose</strong>.</p></section>
    <section data-pe-step="publish"><p>The build emits static files you can host anywhere — the stage lands on <strong>Publish</strong>.</p></section>
  </div>
</div>

The active step is the last one to scroll past the upper-middle of the viewport —
the same rect-based detection scroll-spy uses, so no bespoke animation engine is
needed. The crossfade is gated under `prefers-reduced-motion: no-preference`.
