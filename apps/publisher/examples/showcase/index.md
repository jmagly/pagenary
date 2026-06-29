---
title: One site, two shells
summary: A single Pagenary deploy that renders a docs shell and a blog shell side by side — plus page-effects, an on-this-page TOC, code-copy, and an opt-in form.
hero:
  eyebrow: Pagenary Showcase
  title: One site, two shells
  subtitle: Docs pages and blog posts in one deploy — the shell switches per route.
  image: assets/images/aurora.svg
  fullBleed: true
  overlay: true
  parallax: true
  align: center
  cta:
    - { label: "Read a guide", href: "#guides/getting-started", style: primary }
    - { label: "Visit the blog", href: "#blog", style: ghost }
---

# One site, two shells

This is **one tenant, one deploy**. The page you are reading renders in the
**docs shell** — sidebar, content, and an on-this-page table of contents in the
right rail. Open a post from the [Blog](#blog) and the **blog shell** takes over:
a reading-first column with a hero and byline. Navigate back to a docs page and
the docs shell returns. Nothing reloads; the shell is resolved per route.

## What this showcase demonstrates

Everything below is configuration, not bespoke code — it all comes from one
`config.json` and a folder of Markdown.

- **Section-scoped layouts** — a docs group and a blog collection coexist; the
  shell is `section ?? collection ?? group ?? tenant`.
- **On-this-page TOC** — the right rail is generated from this page's headings.
- **Code-copy** — hover any code block for a copy button (selectable with JS off).
- **Living scroll** — blog posts reveal as they enter view, with a progress bar.
- **Form embeds** — the floating **Feedback** button (and the form below) are an
  opt-in Tally embed; with JS off they fall back to a real link.

## Try the docs shell

The on-this-page rail to the right tracks these headings as you scroll. Here is a
code block — hover it for the copy control:

```bash
# Build every example tenant, including this showcase
npm run build:examples
```

### A nested heading

The TOC nests `h3`s under their `h2`. This sub-section exists only to show that.

## Tell us what you think

The form below is an **inline** Tally embed; the floating button is the same form
as a **popup**. Both load the provider script only because this site uses them,
and both fall back to a plain link without JavaScript.

```tally
id: xXo4Kd
mode: inline
title: Was this showcase helpful?
```

## Where to next

- [Getting started](#guides/getting-started) — a docs guide with steps and code.
- [Page-effects in docs](#guides/page-effects) — heroes and reveal-on-scroll.
- [Blog](#blog) — the same site, in the blog shell.
