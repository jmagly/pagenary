---
template: post
title: Accessible by default
date: 2026-04-30
author: Pagenary Team
summary: Semantic landmarks, real links and buttons, keyboard order, and progressive enhancement are not add-ons in Pagenary — they are the baseline the blog layout is built on.
tags: [accessibility]
hero: assets/images/hero-3.svg
---

# Accessible by default

A blog that looks modern but traps keyboard users, or hides its text behind an
animation that never finishes, is not modern — it is broken with nicer paint. The
Pagenary blog layout starts from the opposite premise: the accessible version
*is* the version. Everything else is layered on top of a page that already works
for everyone.

## The baseline

Before any styling or motion, a post page is built from real, meaningful HTML:

- Real `<article>`, `<time>`, `<a>`, and `<nav>` elements — not click handlers
  bolted onto `<div>`s.
- One `<h1>` per page, with headings in order, so the document outline makes
  sense to a screen reader and to a search crawler.
- Semantic landmarks and a working skip link, so keyboard and assistive-tech
  users can jump straight to the content.
- Focus order that follows reading order — you tab through the page the way you
  read it.
- Text and background colors drawn from theme tokens that are checked for
  contrast, in light and dark alike.

If you turned off the stylesheet entirely, you would still have a coherent,
navigable document. That is the test.

## Progressive enhancement, not graceful degradation

The order of operations matters. We do not build a flashy page and then try to
claw back accessibility for the readers it excluded. We build the readable page
first and *enhance* it for readers who can take the enhancement.

Concretely: the reveal-on-scroll base state is hidden only when scripting is
present (`html.has-js`) and the reader allows motion. So the no-JavaScript reader
and the reduced-motion reader never have content hidden from them — there is
nothing to "recover", because they were never excluded in the first place.

> Accessibility is not a feature you add at the end. It is the shape of the thing
> you started with.

## Motion is a preference, and we honor it

Every animation in the blog — reveal-on-scroll, hero parallax, the works — is
wrapped in `@media (prefers-reduced-motion: no-preference)`. When the reader has
told their operating system they want less motion, the page obliges completely:
no fades, no parallax, no movement. The content is simply present.

This is not a fallback we tolerate; it is a first-class path we test. A reduced-
motion reader should get a blog that feels intentional and calm, not a stripped
one that feels broken.

## Navigation you can actually operate

The post navigation at the foot of every page is a labelled `<nav>` of real
links. You can reach it by keyboard, you can tell where each link goes from its
text alone, and screen readers announce it as a navigation region. The same is
true of the command palette, the theme picker, and the sidebar: real controls,
real focus management, real labels.

## Why bother being strict

Two reasons, and only one of them is ethics.

The first is that the readers excluded by inaccessible design are real and many —
keyboard-only users, screen-reader users, people with vestibular conditions for
whom unbidden motion is genuinely unpleasant. A docs or blog tool that quietly
locks them out is failing at its one job: communication.

The second is that accessible markup is *better engineering*. Semantic HTML is
more robust, more searchable, easier to style, and easier to maintain than a pile
of `<div>`s wearing ARIA as a costume. Doing it right is not a tax on the modern,
dynamic feel — it is the foundation that lets the dynamic layer be added safely.

Accessible and dynamic were never in tension. One is just the floor the other
stands on.
