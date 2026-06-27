---
title: Scroll-snap sections
summary: A CSS-only .pe-snap region whose panels snap as you scroll — opt-in, no runtime, never traps the keyboard.
hero:
  eyebrow: Primitive
  title: Scroll-snap sections
  subtitle: Bounded snap panels for landing pages — pure CSS, and the keyboard is never trapped.
  align: start
---

# Scroll-snap sections

`.pe-snap` is a **self-contained, opt-in** scroll region whose `.pe-snap__panel`
children snap into place as you scroll it. It's pure CSS — no runtime — and uses
`scroll-snap-type: y proximity` (not `mandatory`) inside a bounded height, so it
never takes over the page scroll and never traps keyboard users.

```html
<div class="pe-snap">
  <section class="pe-snap__panel"><h2>Capture</h2><p>Scroll inside this region — each panel snaps to the top.</p></section>
  <section class="pe-snap__panel"><h2>Compose</h2><p>Proximity snapping, so you can still stop between panels.</p></section>
  <section class="pe-snap__panel"><h2>Publish</h2><p>Tab through; the keyboard is never trapped.</p></section>
</div>
```

Smooth glide to the snap points is gated under `prefers-reduced-motion:
no-preference`; reduced-motion readers get instant positioning. The panels are
ordinary sections, so the content is complete and reachable with or without
snapping.
