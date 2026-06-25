---
title: Designing for living scroll
date: 2026-05-22
author: Pagenary Team
summary: A blog should feel alive as you read it — content arriving as it enters view, a sense of progress, motion that flows. Here is how we think about it, accessibly.
tags: [design, motion, accessibility]
hero: assets/images/hero-2.svg
---

# Designing for living scroll

"Living scroll" is the feeling that a page is responding to you as you move through
it: sections settle into place as they enter the viewport, a progress indicator
tracks how far you've read, and transitions flow rather than snap.

## Motion that respects the reader

Motion is an enhancement, never a requirement. Every transition is gated on
`prefers-reduced-motion`, and the page is fully readable with JavaScript disabled —
nothing is hidden waiting for an animation to run. The dynamic layer is opt-in and
configurable; the words come first.

## Configurable, not prescriptive

Reveal-on-scroll is the default flavor, but continuous feeds and full-bleed
scroll-snap sections are options a publisher can turn on per tenant. The goal is a
modern, dynamic blog that still passes an accessibility audit.
