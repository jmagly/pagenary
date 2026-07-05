import {
  aggregateBlogIndexes,
  normalizeBlogIndex,
  sortBlogPosts
} from '../../../../blog-client/src/index.js';

describe('@pagenary/blog-client', () => {
  test('normalizes old and new blog index shapes with source identity', () => {
    const posts = normalizeBlogIndex({
      title: 'Server Updates',
      route: '/server/blog',
      source: { id: 'server', title: 'Server', url: 'https://docs.example.com/server/blog' },
      posts: [{ id: 'posts/a', slug: 'a', title: 'A', date: '2026-07-02', canonical: 'https://docs.example.com/pages/a.html' }]
    });

    expect(posts).toHaveLength(1);
    expect(posts[0].source.id).toBe('server');
    expect(posts[0].docbase.title).toBe('Server');
    expect(posts[0].url).toBe('https://docs.example.com/pages/a.html');
  });

  test('sorts newest-first and respects limits while preserving source errors', async () => {
    const fetch = async (url) => {
      if (url.includes('react')) return { ok: false, status: 403 };
      return {
        ok: true,
        json: async () => ({
          title: 'Server',
          source: { id: 'server', title: 'Server', url: 'https://docs.example.com/server/blog' },
          posts: [
            { slug: 'older', title: 'Older', date: '2026-07-01', canonical: 'https://docs.example.com/older' },
            { slug: 'newer', title: 'Newer', date: '2026-07-03', canonical: 'https://docs.example.com/newer' }
          ]
        })
      };
    };

    const result = await aggregateBlogIndexes([
      'https://docs.example.com/server/blog/index.json',
      'https://docs.example.com/react/blog/index.json'
    ], { fetch, limit: 1 });

    expect(result.posts.map((post) => post.slug)).toEqual(['newer']);
    expect(result.posts[0].source.title).toBe('Server');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].url).toContain('/react/blog/index.json');
  });

  test('sortBlogPosts leaves undated posts after dated posts', () => {
    const sorted = sortBlogPosts([
      { slug: 'undated' },
      { slug: 'dated', date: '2026-07-04' }
    ]);
    expect(sorted.map((post) => post.slug)).toEqual(['dated', 'undated']);
  });
});
