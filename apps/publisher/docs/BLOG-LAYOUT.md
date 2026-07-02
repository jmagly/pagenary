# Blog Layout

Pagenary ships two layout families. The default is **docs** — the header + sidebar
+ content shell tuned for reference material. Set `layout: "blog"` and a tenant
becomes a **blog**: a chronological index of post cards plus reading-first post
pages with hero images, bylines, and tags. It reuses the same Markdown and the
existing collections engine — only the *shape* changes.

> The layout itself needs no JavaScript — it is complete as static markup. It
> pairs with **post navigation** (prev/next + back-to-index) and the opt-in,
> accessibility-gated [page effects](#page-effects) (reveal-on-scroll, rich
> heroes); all of it degrades cleanly with JS off or reduced motion.

## Quick start

1. Set the layout and declare a collection in `config.json`:

   ```json
   {
     "title": "Fieldnotes",
     "layout": "blog",
     "blog": { "sidebar": "hidden", "indexTitle": "Latest posts" },
     "collections": [
       {
         "path": "posts",
         "route": "/posts",
         "title": "Posts",
         "manifest": true,
         "feed": true,
         "sortBy": "date",
         "order": "desc",
         "showDate": true,
         "showSummary": true,
         "showReadingTime": true
       }
     ]
   }
   ```

2. Put one Markdown file per post under the collection folder (`posts/`), each
   with frontmatter:

   ```markdown
   ---
   title: Launching the Pagenary blog layout
   date: 2026-06-10
   author: Pagenary Team
   summary: A one-line excerpt used on the index card and the post header.
   tags: [announcement, layout]
   hero: assets/images/hero-1.svg
   ---

   # Launching the Pagenary blog layout

   Your post body…
   ```

3. Build. The collection emits `posts/index.json` (and `feed.xml`), each post
   becomes a routable page, and a **blog index** section is wired as the landing
   page. The example lives at `examples/blog-demo/` — build it with
   `npm run build:examples` and open `dist/blog-demo/`.

### Mixed docs + blog site

A tenant can keep `layout: "docs"` as the default shell and mark only a
collection as blog content:

```json
{
  "layout": "docs",
  "collections": [
    {
      "path": "posts",
      "route": "/blog",
      "title": "Blog",
      "layout": "blog",
      "manifest": true,
      "feed": true
    }
  ]
}
```

Put the posts under the tenant content root, for example
`content/posts/launch.md`. The build renders that file as the SPA section
`#posts/launch` and also includes it in `dist/blog/index.json`. The bundled blog
index uses the section `id` for card links, so clicks stay inside the hash router
and load the post. If you replace the blog index with custom JavaScript, prefer
`entry.id` for in-app links (`#${entry.id}`). `entry.path` is also hash-routed
for Pagenary-generated collection indexes; use route-style links only if your
consumer adds and serves separate per-post route pages.

Tenants with an explicit `manifest.json` do not need to hand-list every post.
The manifest remains the curated docs navigation, and the build appends any
configured collection posts under the collection route group, for example
`blog -> posts/launch`. Only files under configured `collections[].path`
folders are added this way; unrelated unlisted content is not scanned into the
site.

## Config reference

| Key | Default | Description |
|-----|---------|-------------|
| `layout` | `docs` | `docs` (sidebar shell) or `blog` (reading-first). |
| `blog.sidebar` | `hidden` | `hidden` (single centered column) or `rail` (content + a posts/tags rail). |
| `blog.indexTitle` | the collection title | Heading shown above the post list. |
| `blog.collection` | first collection | `path` of the collection the index renders, when several are declared. |
| `blog.livingScroll` | `false` | Reveal post content as it scrolls into view, plus a reading-progress bar. See [Living scroll](#living-scroll). |
| `collections[]` | — | The collections the build scans. See [Tenant Configuration](#tenant-config). |

### Post frontmatter

| Field | Used for |
|-------|----------|
| `title` | Card + page heading (falls back to the first `#`). |
| `date` | Sort order and the byline (formatted in UTC). |
| `author` | Byline (`By …`). |
| `summary` / `description` | Index card excerpt and the page summary line. |
| `tags` | Tag chips on the card and the page. |
| `hero` / `image` | Banner image on the card and atop the post. A string is a simple image; an *object* is a rich [page-effects](#page-effects) hero. |

## How it renders

- **Index** — a card grid built client-side from the collection's `index.json`,
  newest first. Each card carries the hero thumb, title, date, author, reading
  time, tags, and excerpt, and links to the post.
- **Post page** — the hero banner renders above the title, the byline
  (`date · By author · N min read`) below it, and tag chips after the summary.
  A persistent [post navigation](#post-navigation) control closes the page. The
  reading column keeps a comfortable measure.

## Post navigation

Every post ends with a persistent, accessible control — **previous post · back
to index · next post** — so readers can move through the blog even with the
sidebar hidden. Prev/next are scoped to the collection (newest→oldest, with
titles) and never jump out to the index or another group.

It is a real `<nav aria-label="Post navigation">` of `<a>` links, visible on all
screen sizes — like the docs prev/next article nav, which is also visible on all
screens by default (`bottomNav: "always"`). Trim or disable the affordances with
`postNav` in config:

```json
{ "postNav": { "prev": true, "next": true, "index": true, "label": "All posts" } }
```

Set `"postNav": false` to remove it entirely. See
[Tenant Configuration](#tenant-config) for the full reference.

## Living scroll

Set `blog.livingScroll: true` and a post *reads* as you scroll: each content
block reveals as it enters the viewport, and a slim reading-progress bar tracks
how far you have read.

```json
{ "blog": { "sidebar": "hidden", "livingScroll": true } }
```

It is built on the [page-effects](#page-effects) runtime, so it inherits the same
guarantees: the hidden base state is scoped under `html.has-js` and
`prefers-reduced-motion: no-preference`, so a no-JavaScript or reduced-motion
reader sees the **full article immediately** — nothing is gated on motion. Blocks
already on screen reveal at once as a gentle entrance; the rest arrive on scroll.
Only post content is affected; the index and its cards keep their own reveal.

Reading length uses the shared weighted metadata model: cards prefer
`reading_label`, while `reading_length` keeps word/code/table/image/checklist
counts for dashboards or future table-of-contents states. For a progress bar
without reveal animation, use tenant `reader.progress.enabled` or document
frontmatter `progress.enabled`.

## Theming a blog

A blog themes exactly like the docs layout — the same `theme` presets
(`dark`, `matrix`), `accentColor` / `surfaceColor` / `inkColor`, and fonts all
apply. `blog.sidebar: "rail"` swaps the single centered column for a posts rail
on the trailing edge. The [Theming Recipes gallery](#theming-recipes) ships
ready-made blog looks — dark, editorial (serif), posts-rail, vivid, and matrix —
each one this same demo with a different `config`.

Posts can also carry a [page-effects](#page-effects) `hero` block in frontmatter
for a full-bleed, overlaid banner, and use `data-reveal` for reveal-on-scroll —
both opt-in, accessible, and reduced-motion safe.

If a tenant uses `overrides/styles.css`, treat it as a complete replacement of
the generated stylesheet. Copy forward the current blog and `pageToc` rules for
features the tenant still enables. In particular, `pageToc.placement: "rail"`
expects the generated `.page-toc--rail` flex-column rules so the title and
prev/next controls remain visible while only the heading list scrolls.

## Accessibility

The blog layout is built on semantic landmarks and real `<a>`/`<article>`/`<time>`
elements, preserves focus and reading order, and keeps the skip link working.
The layout itself adds no motion, so nothing is hidden waiting on JavaScript —
the page is complete and readable as static markup (and is captured in the
prerendered SEO snapshots). Any page effects layered on top are opt-in and gated
on `prefers-reduced-motion`.

## See also

- [Page Effects](#page-effects) — heroes, reveal-on-scroll, parallax, and more.
- [Tenant Configuration](#tenant-config) — every `config.json` option.
- [Theming Recipes](#theming-recipes) — colors, fonts, layout, and blog themes.
