---
title: Launching the Pagenary blog layout
date: 2026-06-10
author: Pagenary Team
summary: Pagenary is no longer just a knowledge-base tool — the new blog layout turns a folder of dated Markdown into a chronological, hero-led publication.
tags: [announcement, layout]
hero: assets/images/hero-1.svg
---

# Launching the Pagenary blog layout

For a long time every Pagenary site shared one silhouette: a header, a left
sidebar, and a documentation tree. That shape is great for reference material and
wrong for almost everything else. Today the publisher gains a second layout
family — **blog** — and it is a first-class option, not a theme hack.

## What you get

Set `layout: "blog"` in a tenant's `config.json`, point a collection at a folder
of dated Markdown, and the build produces a chronological index of post cards plus
individual post pages with hero images, bylines, dates, reading time, and tags.

The content model is the same Markdown you already write; the difference is the
*shape* the publisher gives it.

## Built on what already shipped

The blog layout reuses Pagenary's collections engine — the same code that emits
`index.json` and an RSS `feed.xml` — so nothing about your content pipeline
changes. The layout is the new part, and it follows the established
`body[data-layout]` + scoped-CSS pattern used by nav position and alignment.
