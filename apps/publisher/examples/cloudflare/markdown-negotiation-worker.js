/**
 * Cloudflare Pages/Workers reference adapter for Pagenary Markdown delivery.
 * Bind the static deployment as env.ASSETS and route requests through onRequest.
 */

export function parseAcceptHeader(header) {
  const source = String(header || '').trim();
  if (!source) return [];
  const parts = [];
  let current = '';
  let quoted = false;
  for (const char of source) {
    if (char === '"') quoted = !quoted;
    if (char === ',' && !quoted) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts.map((part, order) => {
    const segments = part.split(';').map((item) => item.trim()).filter(Boolean);
    const mediaType = String(segments.shift() || '').toLowerCase();
    if (!/^[^\s/]+\/[^\s/]+$/.test(mediaType)) return null;
    let quality = 1;
    for (const segment of segments) {
      const [name, raw = ''] = segment.split('=', 2);
      if (name.trim().toLowerCase() !== 'q') continue;
      const value = Number(raw.trim().replace(/^"|"$/g, ''));
      quality = Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0;
    }
    return { mediaType, quality, order };
  }).filter(Boolean);
}

function qualityFor(ranges, type) {
  const [wantedType, wantedSubtype] = type.split('/');
  let winner = null;
  for (const range of ranges) {
    const [rangeType, rangeSubtype] = range.mediaType.split('/');
    if (rangeType !== '*' && rangeType !== wantedType) continue;
    if (rangeSubtype !== '*' && rangeSubtype !== wantedSubtype) continue;
    const specificity = (rangeType === '*' ? 0 : 1) + (rangeSubtype === '*' ? 0 : 1);
    if (!winner || specificity > winner.specificity ||
      (specificity === winner.specificity && range.order < winner.order)) {
      winner = { quality: range.quality, specificity, order: range.order };
    }
  }
  return winner?.quality || 0;
}

export function prefersMarkdown(header) {
  const ranges = parseAcceptHeader(header);
  const markdown = qualityFor(ranges, 'text/markdown');
  const html = qualityFor(ranges, 'text/html');
  return markdown > 0 && markdown > html;
}

function normalizePath(value) {
  const path = String(value || '/').replace(/\/{2,}/g, '/');
  return path !== '/' && path.endsWith('/') ? path.slice(0, -1) : path;
}

function responseWithHeaders(response, additions) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(additions)) {
    if (name.toLowerCase() === 'vary' && headers.has('Vary')) {
      const current = headers.get('Vary');
      if (current.trim() !== '*') {
        const values = `${current},${value}`.split(',').map((item) => item.trim()).filter(Boolean);
        headers.set('Vary', values.filter((item, index) =>
          values.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index
        ).join(', '));
      }
    } else {
      headers.set(name, value);
    }
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleMarkdownRequest(request, assets, options = {}) {
  if (!assets || typeof assets.fetch !== 'function') throw new TypeError('A Cloudflare ASSETS binding is required.');
  if (request.method !== 'GET' && request.method !== 'HEAD') return assets.fetch(request);

  const url = new URL(request.url);
  const configuredBase = String(options.basePath || '').replace(/^\/$|\/$/g, '');
  const routeMapUrl = new URL(`${configuredBase}/markdown-routes.json`.replace(/\/{2,}/g, '/'), url.origin);
  const routeMapResponse = await assets.fetch(new Request(routeMapUrl, { method: 'GET' }));
  if (!routeMapResponse.ok) return assets.fetch(request);
  let routeMap;
  try {
    routeMap = await routeMapResponse.json();
  } catch {
    return assets.fetch(request);
  }
  if (routeMap?.version !== 1 || routeMap.contentNegotiation !== true) return assets.fetch(request);

  const basePath = String(routeMap.basePath || '').replace(/\/$/, '');
  if (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) return assets.fetch(request);
  const localPath = normalizePath(basePath ? url.pathname.slice(basePath.length) || '/' : url.pathname);
  const route = routeMap.routes?.[localPath];
  if (!route) return assets.fetch(request);

  const observe = routeMap.observability?.responseHeader === true;
  if (!prefersMarkdown(request.headers.get('Accept'))) {
    const response = await assets.fetch(request);
    return responseWithHeaders(response, {
      Vary: 'Accept',
      ...(observe ? { 'X-Pagenary-Representation': 'html' } : {})
    });
  }

  if (!/^\/markdown\/[a-zA-Z0-9._-]+\.md$/.test(route.artifact || '')) return new Response('Invalid Markdown route mapping', { status: 500 });
  const artifactUrl = new URL(`${basePath}${route.artifact}`, url.origin);
  const artifactRequest = new Request(artifactUrl, { method: request.method, headers: request.headers });
  const response = await assets.fetch(artifactRequest);
  if (!response.ok) return response;
  return responseWithHeaders(response, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Location': `${basePath}${route.canonical}` || '/',
    Vary: 'Accept',
    ...(observe ? { 'X-Pagenary-Representation': 'markdown' } : {})
  });
}

export async function onRequest(context) {
  return handleMarkdownRequest(context.request, context.env.ASSETS, {
    basePath: context.env.PAGENARY_BASE_PATH || ''
  });
}
