# Blog Layout

Pagenary ships two layout families. The default is **docs** — the header + sidebar
+ content shell tuned for reference material. Set `layout: "blog"` and a tenant
becomes a **blog**: a chronological index of post cards plus reading-first post
pages with hero images, bylines, and tags. It reuses the same Markdown and the
existing collections engine — only the *shape* changes.

> Phase 1 ships the layout itself with no required JavaScript motion. A later
> phase adds opt-in, accessibility-gated transitions ("living scroll").

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

## Config reference

| Key | Default | Description |
|-----|---------|-------------|
| `layout` | `docs` | `docs` (sidebar shell) or `blog` (reading-first). |
| `blog.sidebar` | `hidden` | `hidden` (single centered column) or `rail` (content + a posts/tags rail). |
| `blog.indexTitle` | the collection title | Heading shown above the post list. |
| `blog.collection` | first collection | `path` of the collection the index renders, when several are declared. |
| `collections[]` | — | The collections the build scans. See [Tenant Configuration](#tenant-config). |

### Post frontmatter

| Field | Used for |
|-------|----------|
| `title` | Card + page heading (falls back to the first `#`). |
| `date` | Sort order and the byline (formatted in UTC). |
| `author` | Byline (`By …`). |
| `summary` / `description` | Index card excerpt and the page summary line. |
| `tags` | Tag chips on the card and the page. |
| `hero` / `image` | Banner image on the card and atop the post. |

## How it renders

- **Index** — a card grid built client-side from the collection's `index.json`,
  newest first. Each card carries the hero thumb, title, date, author, reading
  time, tags, and excerpt, and links to the post.
- **Post page** — the hero banner renders above the title, the byline
  (`date · By author · N min read`) below it, and tag chips after the summary.
  The reading column keeps a comfortable measure.

## Accessibility

The blog layout is built on semantic landmarks and real `<a>`/`<article>`/`<time>`
elements, preserves focus and reading order, and keeps the skip link working.
Phase 1 adds no motion, so nothing is hidden waiting on JavaScript — the page is
complete and readable as static markup. The forthcoming transitions layer is
opt-in and gated on `prefers-reduced-motion`.

## See also

- [Tenant Configuration](#tenant-config) — every `config.json` option.
- [Theming Recipes](#theming-recipes) — colors, fonts, and layout recipes.
