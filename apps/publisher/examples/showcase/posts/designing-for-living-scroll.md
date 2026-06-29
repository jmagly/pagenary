---
template: post
title: Designing for living scroll
date: 2026-05-22
author: Pagenary Team
summary: A blog should feel alive as you read it — content arriving as it enters view, a sense of progress, motion that flows. Here is how we think about it, accessibly.
tags: [design, motion, accessibility]
hero: assets/images/hero-2.svg
---

# Designing for living scroll

"Living scroll" is the feeling that a page is responding to you as you move
through it. Sections settle into place as they enter the viewport. A slim bar at
the top tracks how far you have read. Nothing snaps; everything flows. Done well,
you stop noticing the mechanics and simply feel that the page is *with* you.

This post is itself an example. As you scroll, each block you are reading arrived
a moment ago, and the bar along the top has been creeping rightward the whole
time. If you have reduced motion turned on, none of that happened — and you have
not missed a single word. That is the whole design philosophy in one sentence.

## The reader sets the terms

Motion is an enhancement, never a requirement. We hold three rules, in order:

1. **The words come first.** With JavaScript disabled, the full article is on the
   page — nothing is hidden waiting for a script to run. The reveal only ever
   *delays* paint for readers who can run it; it never gates content.
2. **Reduced motion wins.** Every animation lives inside
   `@media (prefers-reduced-motion: no-preference)`. If the reader has asked the
   operating system for less motion, the content is simply there, fully visible,
   with no transitions at all.
3. **It degrades to plain.** Old browser, flaky connection, script error — any
   failure leaves a complete, readable blog behind, because the dynamic layer is
   added on top of a page that already works.

If a feature cannot honor all three, it does not ship.

## How the reveal actually works

The trick is where the hidden state lives. It would be easy — and wrong — to hide
every block in JavaScript and reveal it on scroll, because then a reader with no
JavaScript sees nothing. Instead the base "hidden" state is **CSS**, scoped under
three conditions at once: the page has opted in, scripting is present, and the
reader allows motion.

```css
html.has-js body[data-blog-living-scroll] .doc-content > * {
  opacity: 0;
  transform: translateY(14px);
}
```

The `html.has-js` class is only added when scripts run, so a no-JavaScript page
never matches this rule and shows everything. The media query handles reduced
motion. Only when all three line up does a block start hidden — and then an
`IntersectionObserver` adds a `revealed` class as it scrolls into view.

Blocks already on screen when the page loads reveal at once, as a gentle
entrance. Everything below the fold arrives as you reach it. There is no list of
hard-coded timings to maintain; the viewport is the timeline.

## A sense of progress

The reading-progress bar is deliberately the quietest element on the page: three
pixels tall, the accent color, pinned to the top, and marked `aria-hidden`
because it carries no information a screen reader needs — it mirrors the scrollbar
the reader already has. It exists for the same reason a book's thickness in your
hand does: a glanceable sense of *how much is left*.

## Motion that flows, not motion that shows off

It is tempting to reach for parallax on everything, snap-scrolling between
full-screen panels, and text that types itself out. Each of those can be lovely
and each can be exhausting. Our test for any effect is simple:

> Does it help the reader move through the writing, or does it ask the reader to
> watch it perform?

Reveal-on-scroll passes — it paces the page to your scrolling. A hero parallax
passes in small doses — it adds depth without demanding attention. A full-screen
typewriter on the article body fails — it slows the one thing the reader came to
do. So we ship the first two as defaults, keep the rest opt-in, and gate all of
it on the reader's stated preference.

## Turning it on

Living scroll is one key:

```json
{ "blog": { "livingScroll": true } }
```

That sets two body hooks at build time — one for the reveal, one for the progress
bar — and the runtime does the rest, per render, tearing the observers down when
you navigate away. Leave it off and the blog is calm and static. Turn it on and
the blog feels alive — for every reader who wants it, and invisibly out of the
way for every reader who doesn't.
