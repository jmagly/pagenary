---
title: Effect spike prototypes
summary: Throwaway prototypes for the next page-effects catalog candidates.
hero:
  eyebrow: Spike
  title: Prototype the next effects
  subtitle: Static, token-aware experiments for disclosure, snap panels, and figure zoom.
  image: assets/images/ridge.svg
  fullBleed: true
  overlay: true
  parallax: true
  align: start
  cta:
    - { label: "Findings doc", href: "https://docs.pagenary.com/#page-effects", style: ghost }
---

# Effect spike prototypes

This page is a **throwaway R&D surface** for #57. The classes below use the
`pe-spike-*` prefix on purpose: they are not production page-effects contracts.
They are here to judge value, accessibility, reduced-motion behavior, and
implementation shape before follow-up issues split the winning ideas.

```html
<style>
  .pe-spike-note {
    border: 1px solid var(--grid-line);
    border-radius: 8px;
    padding: 1rem 1.1rem;
    background: rgba(var(--surface-rgb), 0.78);
    color: var(--muted);
  }

  .pe-spike-stack {
    display: grid;
    gap: 0.75rem;
  }

  .pe-spike-disclosure {
    border: 1px solid var(--grid-line);
    border-radius: 8px;
    background: rgba(var(--surface-rgb), 0.7);
    overflow: hidden;
  }

  .pe-spike-disclosure summary {
    cursor: pointer;
    padding: 0.95rem 1rem;
    font-weight: 700;
    color: var(--ink);
  }

  .pe-spike-disclosure summary:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 3px;
  }

  .pe-spike-disclosure p {
    margin: 0;
    padding: 0 1rem 1rem;
    color: var(--muted);
  }

  .pe-spike-snap {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(min(82vw, 18rem), 1fr);
    gap: 1rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-block: 0.25rem 1rem;
  }

  .pe-spike-panel {
    scroll-snap-align: start;
    min-height: 13rem;
    border: 1px solid var(--grid-line);
    border-radius: 8px;
    padding: 1.1rem;
    background:
      linear-gradient(135deg, rgba(var(--surface-rgb), 0.92), rgba(var(--surface-rgb), 0.72)),
      radial-gradient(circle at top right, var(--accent), transparent 54%);
  }

  .pe-spike-panel h3 {
    margin: 0 0 0.45rem;
  }

  .pe-spike-panel p {
    margin: 0;
    color: var(--muted);
  }

  .pe-spike-lightbox {
    border: 1px solid var(--grid-line);
    border-radius: 8px;
    padding: 1rem;
    background: rgba(var(--surface-rgb), 0.72);
  }

  .pe-spike-lightbox summary {
    display: inline-flex;
    cursor: pointer;
    font-weight: 700;
    color: var(--accent);
  }

  .pe-spike-figure {
    margin: 1rem 0 0;
    display: grid;
    gap: 0.75rem;
  }

  .pe-spike-figure img {
    width: 100%;
    border-radius: 8px;
    border: 1px solid var(--grid-line);
    background: var(--surface);
  }

  .pe-spike-lightbox[open] .pe-spike-figure {
    max-width: min(100%, 52rem);
  }

  @media (prefers-reduced-motion: no-preference) {
    .pe-spike-panel,
    .pe-spike-lightbox {
      transition: border-color 180ms ease, transform 180ms ease;
    }

    .pe-spike-panel:focus-within,
    .pe-spike-lightbox:focus-within {
      transform: translateY(-2px);
      border-color: var(--accent);
    }
  }

  @media (max-width: 720px) {
    .pe-spike-snap {
      grid-auto-columns: minmax(78vw, 1fr);
    }
  }
</style>

<p class="pe-spike-note">
  JS-off check: every prototype below is usable without JavaScript. Reduced-motion
  check: motion is limited to minor focus transitions and disabled outside
  <code>prefers-reduced-motion: no-preference</code>.
</p>
```

## Prototype A: disclosure stack

Native `<details>` keeps the baseline accessible: keyboard operation, semantics,
and no JavaScript dependency.

```html
<div class="pe-spike-stack">
  <details class="pe-spike-disclosure" open>
    <summary>Why it belongs in the toolkit</summary>
    <p>Disclosure is common in docs, pricing pages, and onboarding guides. A native baseline can ship before enhanced tab behavior.</p>
  </details>
  <details class="pe-spike-disclosure">
    <summary>Production surface candidate</summary>
    <p><code>.pe-disclosure</code>, optional grouped accordion behavior, and token-aware spacing.</p>
  </details>
  <details class="pe-spike-disclosure">
    <summary>Risk notes</summary>
    <p>Do not replace real headings with hidden summaries; preserve readable content order and anchor targets.</p>
  </details>
</div>
```

## Prototype B: scroll-snap panels

Scroll-snap is CSS-first and useful for landing pages, but it must remain opt-in
so long-form docs do not feel trapped.

```html
<section class="pe-spike-snap" aria-label="Scroll-snap prototype panels">
  <article class="pe-spike-panel" tabindex="0">
    <h3>Plan</h3>
    <p>Present a short step with enough height to feel intentional without taking over the page.</p>
  </article>
  <article class="pe-spike-panel" tabindex="0">
    <h3>Build</h3>
    <p>Keep keyboard focus visible and avoid scroll locking; native overflow handles the interaction.</p>
  </article>
  <article class="pe-spike-panel" tabindex="0">
    <h3>Publish</h3>
    <p>Use theme tokens only, with any decorative motion kept behind reduced-motion gates.</p>
  </article>
</section>
```

## Prototype C: figure zoom

This uses native disclosure as a stand-in for a future lightbox. The important
baseline is that the caption, image, and control are all real document content.

```html
<details class="pe-spike-lightbox">
  <summary>Open larger figure</summary>
  <figure class="pe-spike-figure">
    <img src="assets/images/aurora.svg" alt="Abstract layered aurora illustration used by the page-effects demo.">
    <figcaption>
      A production version should preserve captions, escape to close, focus return,
      and direct image links before adding dialog animation.
    </figcaption>
  </figure>
</details>
```
