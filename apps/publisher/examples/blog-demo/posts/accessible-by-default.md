---
title: Accessible by default
date: 2026-04-30
author: Pagenary Team
summary: Semantic landmarks, real links and buttons, keyboard order, and progressive enhancement are not add-ons in Pagenary — they are the baseline the blog layout is built on.
tags: [accessibility]
hero: assets/images/hero-3.svg
---

# Accessible by default

A blog that looks modern but traps keyboard users or hides text behind animations
is not modern — it is broken with nicer paint. The Pagenary blog layout starts
from the opposite premise.

## The baseline

- Real `<article>`, `<time>`, `<a>`, and `<button>` elements — not click-handlers
  on `<div>`s.
- Semantic landmarks and a working skip link.
- Focus order that follows reading order.
- Every animation wrapped in `@media (prefers-reduced-motion: no-preference)`.
- Progressive enhancement: content renders without JavaScript.

## Why it matters

Accessibility and "dynamic" are not in tension. The dynamic layer is layered *on
top of* a page that already works, so turning motion off — by preference or by
necessity — leaves a complete, readable blog behind.
