---
title: Storytelling — a sticky stage that reads
summary: A scrollytelling layout where the stage advances as each step scrolls into view — built from one Markdown file.
hero:
  eyebrow: Showcase
  title: A story that reads itself
  subtitle: Scrollytelling, a sticky stage, and reveal-on-scroll — the same build, a completely different feel.
  fullBleed: true
  align: center
  cta:
    - { label: "Back to the gallery", href: "#showcase-gallery", style: ghost }
---

# A story that reads itself

Scrollytelling pairs a **sticky stage** with a column of steps; the stage updates
as each step scrolls into view. The active step is found by the same rect-based
scroll math as the on-this-page scroll-spy — there is no animation engine. With
JavaScript off it is plain, readable content and the stage shows its layers
statically, so the narrative is complete either way.

```html
<div class="pe-scrolly">
  <div class="pe-scrolly__stage">
    <div data-pe-step="capture"><h2>1 · Capture</h2></div>
    <div data-pe-step="compose"><h2>2 · Compose</h2></div>
    <div data-pe-step="publish"><h2>3 · Publish</h2></div>
  </div>
  <div class="pe-scrolly__steps">
    <section data-pe-step="capture">
      <p>Write in Markdown, HTML, or a JS module. Structure comes from your folders
         and filenames — no manifest required to get started.</p>
    </section>
    <section data-pe-step="compose">
      <p>Shared templates and theme tokens turn your content into a branded,
         tenant-specific site — without touching the content itself.</p>
    </section>
    <section data-pe-step="publish">
      <p>The build emits static files. Host them anywhere, or let a CI workflow
         deploy them on every push.</p>
    </section>
  </div>
</div>
```

## One engine, many shapes

This page is scrollytelling. The [Showcase](#showcase-gallery) is a landing
gallery with heroes and snapped sections. The rest of this site is reference
documentation. All three are one Markdown folder and one static build — the
difference is entirely in opt-in, accessible presentation.
