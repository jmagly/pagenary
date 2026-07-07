# Consuming and Embedding Blog Updates

Pagenary publishes blog collections as JSON so other sites can render updates
pages without scraping HTML or copying Vite plugins. Use this guide when a
marketing site, product portal, or docs family page needs posts from one or more
Pagenary docbases.

## Published Contract

Every collection with `manifest !== false` emits:

```text
<docbase>/<collection-route>/index.json
```

The file is a stable, versioned contract:

```json
{
  "schemaVersion": "1.0.0",
  "title": "Blog",
  "route": "/blog",
  "source": {
    "id": "server",
    "title": "Server",
    "url": "https://docs.fortemi.com/server/blog",
    "baseUrl": "https://docs.fortemi.com/server/blog"
  },
  "posts": [
    {
      "id": "posts/release-notes",
      "slug": "release-notes",
      "title": "Release notes",
      "date": "2026-07-05",
      "summary": "What changed this week.",
      "source": {
        "id": "server",
        "title": "Server",
        "url": "https://docs.fortemi.com/server/blog",
        "baseUrl": "https://docs.fortemi.com/server/blog"
      },
      "url": "https://docs.fortemi.com/server/pages/posts--release-notes.html",
      "canonical": "https://docs.fortemi.com/server/pages/posts--release-notes.html",
      "path": "/#posts/release-notes"
    }
  ]
}
```

Use `source` or `docbase` to label posts in multi-docbase views. Use `url` or
`canonical` for links from external sites. Use `id` or `path` only for in-app
navigation inside the same Pagenary SPA.

## Configure Source Identity

For an aggregator-friendly collection, set stable source fields in the tenant
`config.json`:

```json
{
  "domain": "docs.fortemi.com",
  "collections": [
    {
      "path": "posts",
      "route": "/server/blog",
      "title": "Server updates",
      "sourceId": "server",
      "sourceTitle": "Server",
      "manifest": true,
      "feed": true,
      "sortBy": "date",
      "order": "desc"
    }
  ]
}
```

Set `domain` or `seo.siteUrl` when external sites will consume the feed. Without
one, generated `url` and `canonical` values are site-root paths instead of
absolute URLs.

## Monthly Updates Docbase

For a monthly updates flow consumed by bespoke SPAs such as `magly.net` and
`integrolabs.io`, publish the update once in a Pagenary tenant and expose the
collection manifest plus optional RSS feed:

```json
{
  "title": "Monthly Updates",
  "domain": "updates.example.com",
  "layout": "blog",
  "blog": { "sidebar": "hidden", "indexTitle": "Monthly updates" },
  "collections": [
    {
      "path": "updates",
      "route": "/updates",
      "title": "Monthly updates",
      "sourceId": "monthly-updates",
      "sourceTitle": "Monthly Updates",
      "manifest": true,
      "feed": true,
      "sortBy": "date",
      "order": "desc"
    }
  ]
}
```

Place each update in `updates/*.md` with at least `title`, `date`, and
`summary` front matter. Consumers should use:

- `https://updates.example.com/updates/index.json` as the stable data contract.
- `https://updates.example.com/updates/feed.xml` for RSS readers or simple link
  discovery.
- `@pagenary/blog-client` at build time when the host SPA wants to render cards
  in its own design system.
- `<pagenary-blog>` when the host SPA wants a runtime embed with partial-failure
  handling already built in.

External sites should link post cards to each entry's `url` or `canonical`
field. They should not construct `/pages/*.html` paths themselves.

## Build-Time Aggregation

Install the client in the consuming site:

```bash
npm install @pagenary/blog-client
```

Fetch and merge one or many docbases:

```js
import { aggregateBlogIndexes } from '@pagenary/blog-client';

const { posts, errors } = await aggregateBlogIndexes([
  'https://docs.fortemi.com/server/blog/index.json',
  'https://docs.fortemi.com/react/blog/index.json'
], { limit: 10 });

for (const error of errors) {
  console.warn(`Pagenary blog source unavailable: ${error.url}`);
}
```

`aggregateBlogIndexes()` returns posts sorted newest first. Each post includes a
normalized `source`, `docbase`, `url`, and `canonical`, even when the source uses
an older index shape.

For static sites, run this in the site generator, Vite plugin, Astro loader,
Next.js build step, or any other server/build context. Render `posts` into the
host site's own components when you want zero browser fetches.

## Runtime Embed

Install and self-host the embed package:

```bash
npm install @pagenary/embed
```

Import it from your app bundle or vendor the module into your public assets:

```js
import '@pagenary/embed';
```

Then add the custom element:

```html
<pagenary-blog
  sources="https://docs.fortemi.com/server/blog/index.json,https://docs.fortemi.com/react/blog/index.json"
  limit="10"
  show-source="true"></pagenary-blog>
```

Attributes:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `sources` | yes | Comma-separated `index.json` URLs. |
| `limit` | no | Maximum number of posts to render after merging. |
| `show-source` | no | Show each post's source label. Use `show-source="true"` or a bare `show-source`. |

The element renders reachable sources and shows a quiet notice for unreachable
ones. It does not fail the host page when one docbase is down.

## Styling the Embed

The web component uses shadow DOM and exposes CSS custom properties plus
`part()` hooks:

```css
pagenary-blog {
  --pagenary-blog-color: #101827;
  --pagenary-blog-muted: #667085;
  --pagenary-blog-border: #d0d5dd;
  --pagenary-blog-link: #0b4a6f;
  --pagenary-blog-gap: 1rem;
}

pagenary-blog::part(title) {
  font-weight: 700;
}

pagenary-blog::part(source) {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

Available parts: `root`, `list`, `item`, `title`, `meta`, `source`, `summary`,
and `notice`.

## CORS Requirements

Runtime embeds fetch from the browser, so every source URL must allow the host
site's origin. Public blog indexes should usually send:

```http
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=300
Content-Type: application/json
```

If the docs site is private, use an explicit allow-list instead of `*`:

```http
Access-Control-Allow-Origin: https://www.example.com
Vary: Origin
```

Do not require cookies or credentials for public blog indexes. The embed does
not send credentialed requests, and credentialed cross-origin feeds make static
portal pages brittle.

### Caddy

The bundled publisher Caddyfile includes this reusable snippet:

```caddyfile
(blog_data_headers) {
  @blog_data path */index.json */feed.xml
  header @blog_data Access-Control-Allow-Origin "*"
  header @blog_data Cache-Control "public, max-age=300"
}

docs.example.com {
  root * /srv/docs
  import blog_data_headers
  file_server
}
```

### Nginx

```nginx
location ~ /(index\.json|feed\.xml)$ {
  add_header Access-Control-Allow-Origin "*" always;
  add_header Cache-Control "public, max-age=300" always;
  try_files $uri =404;
}
```

### Static Hosts and CDNs

For Netlify, Vercel, Cloudflare Pages, S3/CloudFront, GitHub Pages fronted by a
CDN, or similar hosts, configure response headers for:

```text
*/index.json
*/feed.xml
```

Use a short positive cache such as 5 minutes unless your publishing process
purges the CDN on every deploy.

## Cloudflare and Bot Protection

Build-time fetches and server-side renders often use Node's default user agent,
not a browser. If Cloudflare bot protection is enabled on the docs domain, add a
WAF or cache rule that bypasses bot challenges for public blog data:

```text
URI Path ends with /index.json
OR URI Path ends with /feed.xml
```

Recommended behavior for those paths:

- Skip browser integrity checks, managed challenges, and JavaScript challenges.
- Keep normal HTTPS, cache, rate-limit, and origin protection in place.
- Cache successful JSON/XML responses at the edge.

This removes the need for consumers to spoof a browser `User-Agent` or keep a
stale local seed file.

## CSP and Self-Hosting

The embed package is dependency-light and can be self-hosted. A strict CSP can
load it from the same site:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://docs.fortemi.com
```

Add every docs source host to `connect-src` when using the runtime embed. If the
host site does not allow cross-origin browser fetches, prefer the build-time
`@pagenary/blog-client` path and render static markup.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser console shows CORS errors | Source `index.json` lacks `Access-Control-Allow-Origin` for the host site | Add CORS headers for `*/index.json` and `*/feed.xml` |
| Build fetch gets `403` but browser works | CDN or Cloudflare bot protection challenges Node/build requests | Add a WAF/cache rule for blog data paths |
| Links point to `/pages/...` on the host site | Source docbase did not set `domain` or `seo.siteUrl` | Configure an absolute site URL and rebuild the docbase |
| Source labels are generic | Collection lacks `sourceId`/`sourceTitle` | Add stable source identity to the collection config |
| One source hides all posts | Consumer is not handling partial failures | Use `aggregateBlogIndexes()` or `<pagenary-blog>`, both preserve reachable sources |
