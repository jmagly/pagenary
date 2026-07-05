# @pagenary/embed

Framework-agnostic custom elements for surfacing Pagenary content on any site.

```html
<script type="module" src="/vendor/pagenary-embed.js"></script>

<pagenary-blog
  sources="https://docs.fortemi.com/server/blog/index.json,https://docs.fortemi.com/react/blog/index.json"
  limit="10"
  show-source="true"></pagenary-blog>
```

`<pagenary-blog>` fetches one or many Pagenary blog indexes, renders the
reachable posts newest first, and shows a quiet notice for unreachable sources.
It is themeable with CSS custom properties and `part()` selectors, including
`root`, `list`, `item`, `title`, `meta`, `source`, `summary`, and `notice`.

For build-time or SSR rendering, use `@pagenary/blog-client` directly and render
the returned `posts` in the host framework.
