import {
  handleMarkdownRequest,
  prefersMarkdown
} from '../../examples/cloudflare/markdown-negotiation-worker.js';

function fakeAssets(routeMap) {
  const requests = [];
  return {
    requests,
    async fetch(request) {
      requests.push({ url: request.url, method: request.method });
      const url = new URL(request.url);
      if (url.pathname === '/docs/markdown-routes.json') {
        return new Response(JSON.stringify(routeMap), { headers: { 'Content-Type': 'application/json' } });
      }
      if (url.pathname === '/docs/markdown/guide.md') {
        return new Response(request.method === 'HEAD' ? null : '# Guide\n', {
          headers: { ETag: '"guide"', 'Content-Type': 'application/octet-stream', Vary: 'Accept-Encoding' }
        });
      }
      return new Response(request.method === 'HEAD' ? null : '<h1>HTML</h1>', {
        status: url.pathname.includes('missing') ? 404 : 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  };
}

const routeMap = {
  version: 1,
  basePath: '/docs',
  contentNegotiation: true,
  observability: { responseHeader: true },
  routes: {
    '/pages/guide.html': {
      id: 'guide', canonical: '/pages/guide.html', artifact: '/markdown/guide.md'
    }
  }
};

describe('Cloudflare Markdown delivery adapter (#163)', () => {
  it('keeps Accept parsing behavior aligned with the preview server', () => {
    expect(prefersMarkdown('text/markdown, text/html;q=0.2')).toBe(true);
    expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
    expect(prefersMarkdown('*/*')).toBe(false);
  });

  it('serves the mapped Markdown asset with negotiation and cache headers intact', async () => {
    const assets = fakeAssets(routeMap);
    const response = await handleMarkdownRequest(new Request('https://docs.example/docs/pages/guide.html', {
      headers: { Accept: 'text/markdown, text/html;q=0.5', 'If-None-Match': '"old"' }
    }), assets, { basePath: '/docs' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(response.headers.get('content-location')).toBe('/docs/pages/guide.html');
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Accept');
    expect(response.headers.get('etag')).toBe('"guide"');
    expect(response.headers.get('x-pagenary-representation')).toBe('markdown');
    expect(await response.text()).toBe('# Guide\n');
    expect(assets.requests.at(-1).url).toBe('https://docs.example/docs/markdown/guide.md');
  });

  it('returns HTML for ties and passes missing routes through unchanged', async () => {
    const assets = fakeAssets(routeMap);
    const html = await handleMarkdownRequest(new Request('https://docs.example/docs/pages/guide.html', {
      headers: { Accept: 'text/html, text/markdown' }
    }), assets, { basePath: '/docs' });
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(html.headers.get('vary')).toBe('Accept');
    expect(html.headers.get('x-pagenary-representation')).toBe('html');

    const missing = await handleMarkdownRequest(new Request('https://docs.example/docs/pages/missing', {
      headers: { Accept: 'text/markdown' }
    }), assets, { basePath: '/docs' });
    expect(missing.status).toBe(404);
    expect(missing.headers.get('vary')).toBeNull();
  });
});
