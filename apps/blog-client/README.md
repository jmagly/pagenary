<div align="center">

# Pagenary Blog Client

**Fetch and normalize Pagenary blog indexes from one or many docbases.**

`@pagenary/blog-client` is the small JavaScript client behind Pagenary blog
embeds. It fetches Pagenary blog indexes, accepts legacy and current index
shapes, attaches source identity to every post, keeps source failures visible,
and returns one newest-first feed that you can render in any framework.

Built with [AIWG](https://aiwg.io), the multi-agent AI framework used to plan,
audit, and ship Pagenary.

```bash
npm install @pagenary/blog-client
```

```js
import { aggregateBlogIndexes } from '@pagenary/blog-client';

const { posts, errors } = await aggregateBlogIndexes([
  'https://docs.example.com/product/blog/index.json',
  'https://docs.example.com/api/blog/index.json'
], { limit: 10 });
```

[![npm version](https://img.shields.io/npm/v/@pagenary/blog-client?label=npm&color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/blog-client)
[![npm downloads](https://img.shields.io/npm/dm/@pagenary/blog-client?color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/blog-client)
[![Docs](https://img.shields.io/badge/docs-docs.pagenary.com-22d3ee?style=flat-square&logo=readthedocs&logoColor=white)](https://docs.pagenary.com)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square)](../../LICENSE)
[![Node Version](https://img.shields.io/badge/node-%E2%89%A516.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![Built with AIWG](https://img.shields.io/npm/v/aiwg?label=built%20with%20%C2%B7%20aiwg&color=7c3aed&logo=npm&style=flat-square)](https://www.npmjs.com/package/aiwg)

[**Docs Site**](https://docs.pagenary.com) · [**Quick Start**](#quick-start) · [**API**](#api) · [**CORS**](#cors-and-hosting) · [**Troubleshooting**](#troubleshooting)

</div>

---

## What It Is

Pagenary can publish blog-style indexes from documentation sites. This package
is the consumer-side client for those indexes. It is intentionally framework
agnostic: use it from Node, server-side rendering, a static build step, a React
or Vue component, an Astro island, or a plain browser module.

The client does three jobs:

- **Fetch** one or more `blog/index.json` endpoints.
- **Normalize** old and new Pagenary index shapes into one post shape.
- **Aggregate** all reachable posts, sorted newest first, while returning
  unreachable sources in `errors` instead of dropping them silently.

Use this package when you want full rendering control. If you want a ready-made
HTML custom element, use [`@pagenary/embed`](https://www.npmjs.com/package/@pagenary/embed).

## Quick Start

Install the package:

```bash
npm install @pagenary/blog-client
```

Fetch one source:

```js
import { fetchBlogIndex } from '@pagenary/blog-client';

const result = await fetchBlogIndex('https://docs.example.com/blog/index.json');

for (const post of result.posts) {
  console.log(post.title, post.url);
}
```

Aggregate several docbases:

```js
import { aggregateBlogIndexes } from '@pagenary/blog-client';

const { posts, errors } = await aggregateBlogIndexes([
  {
    id: 'product',
    title: 'Product Docs',
    url: 'https://docs.example.com/product/blog/index.json'
  },
  {
    id: 'api',
    title: 'API Docs',
    url: 'https://docs.example.com/api/blog/index.json'
  }
], {
  limit: 12,
  cache: 'no-cache'
});

if (errors.length) {
  console.warn('Some blog sources are unavailable', errors);
}
```

Render in your own UI:

```js
function renderPosts(posts) {
  return `<ul>
    ${posts.map((post) => `<li>
      <a href="${post.url}">${post.title}</a>
      <small>${post.source.title}</small>
    </li>`).join('')}
  </ul>`;
}
```

## API

### `aggregateBlogIndexes(sources, options)`

Fetches or normalizes many sources and returns one feed.

```js
const result = await aggregateBlogIndexes(sources, options);
```

`sources` can be:

- A comma-separated string of index URLs.
- An array of index URL strings.
- An array of source objects with `url`, `id`, and `title`.
- Already-loaded index objects, useful at build time or in tests.

`options`:

| Option | Type | Purpose |
|--------|------|---------|
| `limit` | `number` | Return only the newest N posts after sorting. |
| `order` | `"desc"` or `"asc"` | Sort newest first by default; set `"asc"` for oldest first. |
| `fetch` | `Function` | Custom fetch implementation for tests, Node runtimes, or edge workers. |
| `headers` | `object` | Headers passed to each fetch request. |
| `signal` | `AbortSignal` | Cancels in-flight fetches. |
| `cache` | `RequestCache` | Browser fetch cache mode; defaults to `"default"`. |
| `throwOnError` | `boolean` | Throw on the first unreachable source instead of collecting `errors`. |

Returns:

```ts
{
  posts: Array<PagenaryBlogPost>,
  sources: Array<{ url: string, data?: unknown, posts: Array<PagenaryBlogPost>, error?: Error }>,
  errors: Array<{ url: string, error: Error }>
}
```

### `fetchBlogIndex(source, options)`

Fetches one index URL and returns the raw data plus normalized posts.

```js
const { url, data, posts } = await fetchBlogIndex(
  'https://docs.example.com/blog/index.json'
);
```

### `normalizeBlogIndex(input, options)`

Normalizes an already-loaded index without fetching.

```js
const posts = normalizeBlogIndex(rawIndex, {
  url: 'https://docs.example.com/blog/index.json',
  source: { id: 'docs', title: 'Docs', baseUrl: 'https://docs.example.com/blog' }
});
```

### `sortBlogPosts(posts, options)`

Sorts posts by `date`, newest first by default.

```js
const newestFirst = sortBlogPosts(posts);
const oldestFirst = sortBlogPosts(posts, { order: 'asc' });
```

## Post Shape

Each returned post preserves the original index fields and adds stable source
metadata:

```js
{
  id: 'release-2026-7-15',
  title: 'Release 2026.7.15',
  date: '2026-07-05',
  summary: 'Signed packages and trusted publishing.',
  url: 'https://docs.example.com/blog/#release-2026-7-15',
  canonical: 'https://docs.example.com/blog/#release-2026-7-15',
  path: '/#release-2026-7-15',
  source: {
    id: 'docs',
    title: 'Docs',
    url: 'https://docs.example.com/blog',
    baseUrl: 'https://docs.example.com/blog'
  },
  docbase: {
    id: 'docs',
    title: 'Docs',
    url: 'https://docs.example.com/blog',
    baseUrl: 'https://docs.example.com/blog'
  }
}
```

`source` and `docbase` intentionally carry the same identity so host
applications can use either naming convention while older embeds migrate.

## CORS and Hosting

Browser usage requires each source docbase to allow cross-origin fetches from
the host site. Server-side usage does not need browser CORS, but the published
embed does.

Minimum static-host headers for a public blog index:

```http
Access-Control-Allow-Origin: https://www.example.com
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Content-Type
Content-Type: application/json; charset=utf-8
```

Use `Access-Control-Allow-Origin: *` only for public indexes that do not expose
private data. If the host site uses a strict CSP, allow the source docbase in
`connect-src`.

The full guide, including Cloudflare/CDN examples, lives in the Pagenary repo:
[`BLOG-CONSUMPTION.md`](https://github.com/jmagly/pagenary/blob/main/apps/publisher/docs/BLOG-CONSUMPTION.md).

## When to Use It

Good fit:

- Rendering Pagenary blog posts inside an existing app or marketing site.
- Aggregating updates from several docbases into one product feed.
- Server-side rendering or static generation where you want control over HTML.
- Edge workers or build scripts that need a dependency-light blog index client.

Use `@pagenary/embed` instead when you want a drop-in custom element.
Use `@pagenary/publisher` when you need to create the documentation site and
blog index in the first place.

## Troubleshooting

### `Failed to fetch ...: 403` or browser CORS errors

The source docbase is reachable, but the browser is not allowed to read it from
your host origin. Add the host site to the docbase's CORS policy and confirm
the response includes `Access-Control-Allow-Origin`.

### Posts render without source names

Pass source objects with `id` and `title`, or publish indexes that include a
top-level `source` or `docbase` block. The client falls back to deriving source
identity from the index URL when metadata is missing.

### One source is down

`aggregateBlogIndexes()` keeps reachable posts and reports failures in
`errors`. Set `throwOnError: true` if your build should fail instead.

## Documentation

- [Pagenary docs](https://docs.pagenary.com)
- [Blog consumption guide](https://github.com/jmagly/pagenary/blob/main/apps/publisher/docs/BLOG-CONSUMPTION.md)
- [`@pagenary/embed`](https://www.npmjs.com/package/@pagenary/embed)
- [`@pagenary/publisher`](https://www.npmjs.com/package/@pagenary/publisher)
