<div align="center">

# Pagenary Embed

**Drop Pagenary blog updates into any site with standards-based web components.**

`@pagenary/embed` provides framework-agnostic custom elements for showing
Pagenary content outside a Pagenary site. The first component,
`<pagenary-blog>`, reads one or many Pagenary blog indexes, renders reachable
posts newest first, and keeps source failures visible without taking down the
page.

Built with [AIWG](https://aiwg.io), the multi-agent AI framework used to plan,
audit, and ship Pagenary.

```bash
npm install @pagenary/embed
```

```html
<script type="module" src="/vendor/pagenary-embed.js"></script>

<pagenary-blog
  sources="https://docs.example.com/product/blog/index.json,https://docs.example.com/api/blog/index.json"
  limit="10"
  show-source="true"></pagenary-blog>
```

[![npm version](https://img.shields.io/npm/v/@pagenary/embed?label=npm&color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/embed)
[![npm downloads](https://img.shields.io/npm/dm/@pagenary/embed?color=CB3837&logo=npm&style=flat-square)](https://www.npmjs.com/package/@pagenary/embed)
[![Docs](https://img.shields.io/badge/docs-docs.pagenary.com-22d3ee?style=flat-square&logo=readthedocs&logoColor=white)](https://docs.pagenary.com)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg?style=flat-square)](../../LICENSE)
[![Node Version](https://img.shields.io/badge/node-%E2%89%A516.0.0-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org)
[![Built with AIWG](https://img.shields.io/npm/v/aiwg?label=built%20with%20%C2%B7%20aiwg&color=7c3aed&logo=npm&style=flat-square)](https://www.npmjs.com/package/aiwg)

[**Docs Site**](https://docs.pagenary.com) · [**Quick Start**](#quick-start) · [**Component API**](#component-api) · [**Styling**](#styling) · [**CORS**](#cors-and-hosting)

</div>

---

## What It Is

Pagenary publishes documentation sites and can expose blog-style indexes from
those sites. `@pagenary/embed` is the browser-side embed layer for bringing
those updates into another website: a product homepage, an app dashboard, a
support portal, a docs hub, or a customer-facing status page.

The package uses native custom elements, so it does not require React, Vue,
Svelte, Astro, or any other framework. The component renders into Shadow DOM,
exposes stable `part()` selectors, and delegates fetching/normalization to
[`@pagenary/blog-client`](https://www.npmjs.com/package/@pagenary/blog-client).

## Quick Start

Install the package:

```bash
npm install @pagenary/embed
```

Bundle it with your app:

```js
import '@pagenary/embed';
```

Then use the element in your HTML:

```html
<pagenary-blog
  sources="https://docs.example.com/product/blog/index.json"
  limit="5"></pagenary-blog>
```

For a static site that copies vendor assets, publish the module file from your
own origin and load it directly:

```html
<script type="module" src="/vendor/pagenary-embed.js"></script>
```

Aggregate several docbases:

```html
<pagenary-blog
  sources="https://docs.example.com/product/blog/index.json,https://docs.example.com/api/blog/index.json"
  limit="10"
  show-source="true"></pagenary-blog>
```

## Component API

### `<pagenary-blog>`

Renders a list of posts from one or many Pagenary blog indexes.

Attributes:

| Attribute | Required | Purpose |
|-----------|----------|---------|
| `sources` | Yes | Comma-separated list of Pagenary `blog/index.json` URLs. |
| `limit` | No | Maximum number of posts to render after newest-first sorting. |
| `show-source` | No | Show the source/docbase title beside each post. Use `show-source="true"` or a boolean attribute. |

The element reacts to attribute changes. Updating `sources`, `limit`, or
`show-source` re-renders the feed and aborts the previous in-flight fetch.

Example:

```html
<pagenary-blog
  sources="https://docs.example.com/blog/index.json"
  limit="3"
  show-source></pagenary-blog>
```

## Styling

The component is intentionally quiet by default and inherits typography from the
host page. Theme it with CSS custom properties:

```css
pagenary-blog {
  --pagenary-blog-color: #111827;
  --pagenary-blog-muted: #5f6673;
  --pagenary-blog-border: #d9dee8;
  --pagenary-blog-gap: 1rem;
  --pagenary-blog-link: #0f766e;
}
```

Use `part()` selectors for structural styling:

```css
pagenary-blog::part(list) {
  display: grid;
  gap: 1.25rem;
}

pagenary-blog::part(item) {
  padding-block-end: 1.25rem;
}

pagenary-blog::part(title) {
  font-weight: 700;
}

pagenary-blog::part(notice) {
  font-style: italic;
}
```

Available parts:

| Part | Purpose |
|------|---------|
| `root` | Component root inside Shadow DOM. |
| `list` | Rendered post list. |
| `item` | Individual list item. |
| `title` | Post title link. |
| `meta` | Metadata row containing date and optional source. |
| `source` | Source/docbase label when `show-source` is enabled. |
| `summary` | Post summary text. |
| `notice` | Loading, empty, or partial-failure notice. |

## CORS and Hosting

Runtime embeds fetch blog indexes from the visitor's browser. Each source
docbase must allow the host site to read the index.

Minimum static-host headers for a public blog index:

```http
Access-Control-Allow-Origin: https://www.example.com
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Content-Type
Content-Type: application/json; charset=utf-8
```

Use `Access-Control-Allow-Origin: *` only for public indexes that do not expose
private data. If the host page uses a strict CSP, include every Pagenary docbase
in `connect-src` and include the embed module's origin in `script-src`.

The full guide, including Cloudflare/CDN examples, lives in the Pagenary repo:
[`BLOG-CONSUMPTION.md`](https://github.com/jmagly/pagenary/blob/main/apps/publisher/docs/BLOG-CONSUMPTION.md).

## When to Use It

Good fit:

- Showing release notes or documentation updates on a product homepage.
- Aggregating posts from several Pagenary docbases into one news block.
- Adding docs updates to an existing CMS, marketing site, or support portal.
- Embedding without tying the host page to a JavaScript framework.

Use `@pagenary/blog-client` directly when you need build-time rendering, SSR, or
custom markup. Use `@pagenary/publisher` when you need to publish the source
documentation site and blog index.

## Troubleshooting

### The component only shows `Updates are unavailable right now.`

Open the browser network panel and inspect the `blog/index.json` request. The
most common cause is CORS: the source docbase did not include an
`Access-Control-Allow-Origin` header that allows the host site.

### The component only shows `No blog sources configured.`

The `sources` attribute is missing or empty. Provide one URL or a comma-separated
list of URLs.

### Some posts render, but there is an unavailable-source notice

At least one source failed while others succeeded. The component keeps the page
useful and reports the partial failure. Fix the failing source URL, CORS policy,
or hosting rule.

### Source names are missing

Add `show-source` to the element and publish indexes with source/docbase
metadata. The underlying client can derive a fallback source title from the URL,
but explicit source titles are better for users.

## Documentation

- [Pagenary docs](https://docs.pagenary.com)
- [Blog consumption guide](https://github.com/jmagly/pagenary/blob/main/apps/publisher/docs/BLOG-CONSUMPTION.md)
- [`@pagenary/blog-client`](https://www.npmjs.com/package/@pagenary/blog-client)
- [`@pagenary/publisher`](https://www.npmjs.com/package/@pagenary/publisher)
