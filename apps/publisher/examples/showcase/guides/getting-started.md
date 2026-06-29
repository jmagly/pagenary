---
title: Getting started
template: guide
summary: Point Pagenary at a folder of Markdown and ship — this guide walks the docs shell, in the docs shell.
---

# Getting started

This page declares `template: guide` in its frontmatter. Because `guide` is a
registered template with a schema, the build validates this file's frontmatter
(here: a required `title`) and fails with a precise message if it is missing —
the same way the link and SEO checks gate.

## Prerequisites

- Node 18+ and npm.
- A folder of Markdown. Navigation and titles are auto-discovered; no manifest
  is required to start.

## Steps

1. Add a `config.json` with your branding and any opt-in features.
2. Put your docs pages at the content root, and a dated `posts/` folder for a
   blog collection.
3. Mark the collection `layout: "blog"` to render its posts in the blog shell.

```json
{
  "layout": "docs",
  "collections": [
    { "path": "posts", "route": "/posts", "title": "Blog", "layout": "blog" }
  ]
}
```

### Verify

Build the bundle and serve it:

```bash
npm run build:tenants
npm run serve
```

## What you get

A docs site whose blog section renders in a reading-first shell — without a
second deploy. Read on in [Page-effects in docs](#guides/page-effects), or jump
to the [Blog](#blog).
