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
sidebar, and a reading column tuned for reference material. That shape is right
for documentation — you want the whole tree in front of you, and you jump around
more than you read top to bottom. It is the wrong shape for writing that is meant
to be *read*: a changelog, a field journal, a release blog, an essay.

So we added a second layout family. Set `layout: "blog"` and the same Markdown,
the same collections engine, and the same build produce a chronological index of
post cards and reading-first post pages — hero image, byline, tags, and a
comfortable measure. Nothing about your content changes. Only the silhouette does.

## What you get

A blog tenant is still just a folder of files, but the build now understands a
few new conventions:

- **A chronological index.** The landing page becomes a card grid built from your
  collection's `index.json`, newest first. Each card carries the hero thumbnail,
  title, date, author, reading time, tags, and excerpt.
- **Reading-first post pages.** The hero banner renders above the title, the
  byline (`date · By author · N min read`) sits below it, and tag chips follow
  the summary. The reading column holds a comfortable line length.
- **A feed.** Turn on `feed: true` for a collection and the build emits
  `feed.xml` alongside the index — RSS readers get your posts for free.
- **Two silhouettes.** `blog.sidebar: "hidden"` gives a single centered column;
  `blog.sidebar: "rail"` keeps a slim posts rail on the trailing edge.

None of this is a new content type. A post is a Markdown file with frontmatter,
exactly like a docs page — it just lives in a collection folder and carries a
`date`.

## Quick start

Declare the layout and a collection in `config.json`:

```json
{
  "title": "Fieldnotes",
  "layout": "blog",
  "blog": { "sidebar": "hidden", "indexTitle": "Latest posts", "livingScroll": true },
  "collections": [
    { "path": "posts", "route": "/posts", "manifest": true, "feed": true,
      "sortBy": "date", "order": "desc", "showDate": true, "showSummary": true }
  ]
}
```

Then write one Markdown file per post under `posts/`, each with a `title`,
`date`, `summary`, and optional `tags` and `hero`. Build with
`npm run build:examples` and open `dist/blog-demo/`. That is the entire workflow —
there is no admin panel, no database, and no per-post wiring.

## Moving between posts

With the sidebar hidden there is nowhere to put a full navigation tree, so each
post ends with a small, persistent control: previous post, back to the index,
next post. It is a real `<nav>` of links, scoped to the collection, and it is
keyboard-navigable. Readers never reach the end of a post and find themselves
stranded.

## It is still a static site

The blog layout inherits everything that makes a Pagenary docs site cheap and
durable. The output is plain static files: deploy them to any free static host or
CDN. Ranked search still works across your posts. The SEO pipeline still
prerenders a snapshot of every page, so crawlers and no-JavaScript readers get
the full article, not an empty shell.

> A blog should not cost more to run than a folder of text files. With Pagenary,
> it doesn't — it *is* a folder of text files.

## Make it yours

Because a blog themes exactly like a docs site, the same `theme` presets, accent
and surface colors, and fonts all apply. Want a dark journal, a warm serif
review, or a bright editorial palette? That is a few keys in `config.json`, not a
fork. The theme gallery ships several ready-made blog looks to start from.

## Where this is going

This first release is deliberately small: the layout, the index, the post page,
a feed, and post navigation. From here the interesting work is in how a post
*reads* — content that arrives as you scroll, a sense of progress, motion that
flows but never gets in the way. The next post digs into that, and into why every
bit of it stays optional and accessible.

If you keep your writing in a git repo today, you are already most of the way to
a blog. Point Pagenary at it, set `layout: "blog"`, and publish.
