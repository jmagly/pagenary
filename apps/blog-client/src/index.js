export const BLOG_INDEX_SCHEMA_VERSION = '1.0.0';

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return value ? [value] : [];
}

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function sourceFromUrl(indexUrl) {
  if (!indexUrl) return null;
  try {
    const url = new URL(indexUrl, 'https://pagenary.invalid/');
    const path = url.pathname.replace(/\/index\.json$/i, '').replace(/\/+$/, '');
    const id = path.split('/').filter(Boolean).pop() || url.hostname || 'blog';
    const baseUrl = url.origin === 'https://pagenary.invalid' ? path || '/' : `${url.origin}${path || ''}`;
    return { id, title: id, url: baseUrl, baseUrl };
  } catch {
    return null;
  }
}

export function normalizeBlogIndex(input, options = {}) {
  const indexUrl = options.url || options.indexUrl || '';
  const posts = Array.isArray(input) ? input
    : (Array.isArray(input?.posts) ? input.posts
      : (Array.isArray(input?.entries) ? input.entries : []));
  const indexSource = input?.source || input?.docbase || null;
  const fallbackSource = options.source || indexSource || sourceFromUrl(indexUrl) || {};
  const route = input?.route || '';
  const baseUrl = trimSlash(fallbackSource.baseUrl || fallbackSource.url || '');
  const source = {
    id: String(fallbackSource.id || input?.id || route || indexUrl || 'blog'),
    title: String(fallbackSource.title || input?.title || fallbackSource.id || 'Blog'),
    url: fallbackSource.url || baseUrl || '',
    baseUrl: fallbackSource.baseUrl || fallbackSource.url || baseUrl || ''
  };

  return posts.map((post) => {
    const postSource = post?.source || post?.docbase || source;
    const canonical = post?.canonical || post?.url || '';
    const path = post?.path || (post?.id ? `/#${post.id}` : '');
    const url = post?.url || canonical || (baseUrl && path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : path);
    return {
      ...post,
      source: {
        id: String(postSource.id || source.id),
        title: String(postSource.title || source.title),
        url: postSource.url || source.url,
        baseUrl: postSource.baseUrl || postSource.url || source.baseUrl
      },
      docbase: {
        id: String(postSource.id || source.id),
        title: String(postSource.title || source.title),
        url: postSource.url || source.url,
        baseUrl: postSource.baseUrl || postSource.url || source.baseUrl
      },
      url,
      canonical: canonical || url,
      path
    };
  });
}

export function sortBlogPosts(posts, options = {}) {
  const direction = options.order === 'asc' ? 1 : -1;
  return [...posts].sort((a, b) => {
    const av = a?.date ? Date.parse(a.date) : Number.NaN;
    const bv = b?.date ? Date.parse(b.date) : Number.NaN;
    if (Number.isNaN(av) && Number.isNaN(bv)) return 0;
    if (Number.isNaN(av)) return 1;
    if (Number.isNaN(bv)) return -1;
    return av === bv ? 0 : (av < bv ? -1 : 1) * direction;
  });
}

export async function fetchBlogIndex(source, options = {}) {
  const url = typeof source === 'string' ? source : source?.url;
  if (!url) throw new TypeError('fetchBlogIndex requires a source URL');
  const fetchImpl = options.fetch || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new TypeError('No fetch implementation available');
  const response = await fetchImpl(url, {
    headers: options.headers || undefined,
    signal: options.signal,
    cache: options.cache || 'default'
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const data = await response.json();
  return {
    url,
    data,
    posts: normalizeBlogIndex(data, { url, source: typeof source === 'object' ? source : undefined })
  };
}

export async function aggregateBlogIndexes(sources, options = {}) {
  const normalizedSources = asArray(sources);
  const results = await Promise.all(normalizedSources.map(async (source) => {
    try {
      if (typeof source === 'string' || source?.url) return await fetchBlogIndex(source, options);
      return {
        url: source?.indexUrl || '',
        data: source,
        posts: normalizeBlogIndex(source, { source: source?.source || source?.docbase, url: source?.indexUrl })
      };
    } catch (error) {
      if (options.throwOnError) throw error;
      return { url: typeof source === 'string' ? source : source?.url || source?.indexUrl || '', error, posts: [] };
    }
  }));

  const posts = sortBlogPosts(results.flatMap((result) => result.posts), options);
  return {
    posts: typeof options.limit === 'number' ? posts.slice(0, options.limit) : posts,
    sources: results,
    errors: results.filter((result) => result.error).map((result) => ({ url: result.url, error: result.error }))
  };
}
