# @pagenary/blog-client

Dependency-free helpers for consuming one or more Pagenary blog indexes.

```js
import { aggregateBlogIndexes } from '@pagenary/blog-client';

const { posts, errors } = await aggregateBlogIndexes([
  'https://docs.fortemi.com/server/blog/index.json',
  'https://docs.fortemi.com/react/blog/index.json'
], { limit: 10 });
```

`aggregateBlogIndexes()` normalizes old and new index shapes, attaches
`source`/`docbase` identity to every post, keeps unreachable sources in
`errors`, and sorts posts newest first.

For source configuration, CORS headers, Cloudflare/CDN rules, and SSR examples,
see `apps/publisher/docs/BLOG-CONSUMPTION.md` in the Pagenary repository.
