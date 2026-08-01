#!/usr/bin/env node
/* Lightweight static server for dist with tenant routing */
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { prefersMarkdown } from './lib/accept-negotiation.js';

const root = path.join(process.cwd(), 'dist');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '0.0.0.0';
const DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'tenant-default';
const SERVE_MOUNT = normalizeMount(process.env.PAGENARY_SERVE_MOUNT || '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// Detect tenant directories at startup
// Tenants can use tenant-* prefix or any custom name (e.g., aiwg-docs)
const tenantDirs = new Set();
const NON_TENANT_DIRS = new Set(['lib', 'sections', 'pages', 'assets', 'node_modules']);
try {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !NON_TENANT_DIRS.has(entry.name)) {
      tenantDirs.add(entry.name);
    }
  }
} catch {
  // dist may not exist yet
}

function normalizeMount(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '';
  const cleaned = raw.replace(/\\/g, '/').replace(/\/+/g, '/');
  const withLeading = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}

function mountedTenant() {
  if (tenantDirs.has(DEFAULT_TENANT)) return DEFAULT_TENANT;
  if (tenantDirs.size === 1) return [...tenantDirs][0];
  return null;
}

/**
 * Parse tenant from path. Returns { tenant, localPath }
 * e.g., /tenant-alpha/app.js -> { tenant: 'tenant-alpha', localPath: '/app.js' }
 *       /aiwg-docs/app.js -> { tenant: 'aiwg-docs', localPath: '/app.js' }
 *       /app.js -> { tenant: null, localPath: '/app.js' }
 */
function parseTenantPath(pathname) {
  if (SERVE_MOUNT && (pathname === SERVE_MOUNT || pathname.startsWith(`${SERVE_MOUNT}/`))) {
    const tenant = mountedTenant();
    if (tenant) {
      return {
        tenant,
        localPath: pathname.slice(SERVE_MOUNT.length) || '/'
      };
    }
  }
  const match = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (match && tenantDirs.has(match[1])) {
    return {
      tenant: match[1],
      localPath: match[2] || '/'
    };
  }
  return { tenant: null, localPath: pathname };
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  // Redirect root to default tenant
  if (pathname === '/' && SERVE_MOUNT && mountedTenant()) {
    res.writeHead(302, { Location: `${SERVE_MOUNT}/` });
    res.end();
    return;
  }

  if (SERVE_MOUNT && pathname === SERVE_MOUNT) {
    res.writeHead(302, { Location: `${SERVE_MOUNT}/` });
    res.end();
    return;
  }

  // Redirect root to default tenant
  if (pathname === '/' && tenantDirs.has(DEFAULT_TENANT)) {
    res.writeHead(302, { Location: `/${DEFAULT_TENANT}/` });
    res.end();
    return;
  }

  // Redirect tenant path without trailing slash to add it (for correct relative path resolution)
  const tenantOnlyMatch = pathname.match(/^\/([^/]+)$/);
  if (tenantOnlyMatch && tenantDirs.has(tenantOnlyMatch[1])) {
    res.writeHead(302, { Location: `${pathname}/` });
    res.end();
    return;
  }

  // Parse tenant from path
  const { tenant, localPath } = parseTenantPath(pathname);

  // If no tenant specified and not a root redirect, serve 404
  if (!tenant) {
    res.writeHead(404).end('Not Found - Please specify a tenant');
    return;
  }

  // Determine the root directory for this request
  const requestRoot = path.join(root, tenant);
  const markdownRoutes = readMarkdownRoutes(requestRoot);
  const routeKey = normalizeRouteKey(localPath);
  const markdownRoute = markdownRoutes?.contentNegotiation === true
    ? markdownRoutes.routes?.[routeKey]
    : null;
  const negotiableHeaders = markdownRoute
    ? {
        Vary: 'Accept',
        ...(markdownRoutes.observability?.responseHeader === true
          ? { 'X-Pagenary-Representation': 'html' }
          : {})
      }
    : {};

  if ((req.method === 'GET' || req.method === 'HEAD') && markdownRoute && prefersMarkdown(req.headers.accept)) {
    const artifact = String(markdownRoute.artifact || '');
    const artifactPath = safeArtifactPath(requestRoot, artifact);
    if (!artifactPath) {
      res.writeHead(500).end('Invalid Markdown route mapping');
      return;
    }
    fs.stat(artifactPath, (error, artifactStat) => {
      if (error || !artifactStat.isFile()) {
        res.writeHead(404).end('Not Found');
        return;
      }
      const routePrefix = pathname.slice(0, Math.max(0, pathname.length - localPath.length)).replace(/\/$/, '');
      const contentLocation = `${routePrefix}${markdownRoute.canonical || localPath}` || '/';
      streamFile(artifactPath, req, res, {
        Vary: 'Accept',
        'Content-Location': contentLocation,
        ...(markdownRoutes.observability?.responseHeader === true
          ? { 'X-Pagenary-Representation': 'markdown' }
          : {})
      }, artifactStat);
    });
    return;
  }

  // Resolve the local path within the tenant/root directory
  let resolvedPath = localPath === '/' ? '/index.html' : localPath;
  let filePath = path.join(requestRoot, resolvedPath);

  // Security check
  if (!filePath.startsWith(requestRoot)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (idxErr, idxStat) => {
        if (idxErr || !idxStat.isFile()) {
          res.writeHead(404).end('Not Found');
          return;
        }
        return streamFile(filePath, req, res, negotiableHeaders, idxStat);
      });
      return;
    }

    if (err || !stat.isFile()) {
      const noExt = !path.extname(filePath);
      if (noExt) {
        const htmlFallback = `${filePath}.html`;
        return fs.stat(htmlFallback, (htmlErr, htmlStat) => {
          if (htmlErr || !htmlStat.isFile()) {
            res.writeHead(404).end('Not Found');
            return;
          }
          streamFile(htmlFallback, req, res, negotiableHeaders, htmlStat);
        });
      }
      res.writeHead(404).end('Not Found');
      return;
    }
    streamFile(filePath, req, res, negotiableHeaders, stat);
  });
});

function normalizeRouteKey(localPath) {
  const value = String(localPath || '/').replace(/\/{2,}/g, '/');
  if (value === '/') return '/';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function safeArtifactPath(requestRoot, artifact) {
  if (!/^\/markdown\/[a-zA-Z0-9._-]+\.md$/.test(artifact)) return null;
  const resolvedRoot = path.resolve(requestRoot);
  const candidate = path.resolve(requestRoot, `.${artifact}`);
  return candidate.startsWith(`${resolvedRoot}${path.sep}`) ? candidate : null;
}

function readMarkdownRoutes(requestRoot) {
  try {
    const manifestPath = path.join(requestRoot, 'markdown-routes.json');
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return parsed && parsed.version === 1 && parsed.routes && typeof parsed.routes === 'object'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function streamFile(target, req, res, extraHeaders = {}, knownStat = null) {
  const ext = path.extname(target).toLowerCase();
  const send = (stat) => {
    const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      ETag: etag,
      ...extraHeaders
    };
    const revalidated = ext === '.html' || ext === '.md' || path.basename(target) === 'markdown-routes.json';
    headers['Cache-Control'] = DEV ? 'no-store' : (revalidated ? 'public, max-age=300, must-revalidate' : 'public, max-age=31536000, immutable');
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(target).pipe(res);
  };
  if (knownStat) send(knownStat);
  else fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) res.writeHead(404).end('Not Found');
    else send(stat);
  });
}

server.listen(port, host, () => {
  console.log(`Serving dist at http://${host}:${port} ${DEV ? '(dev cache disabled)' : ''}`);
  if (tenantDirs.size > 0) {
    console.log(`Tenants: ${[...tenantDirs].join(', ')}`);
  }
  if (SERVE_MOUNT) {
    const tenant = mountedTenant();
    console.log(`Mount: ${SERVE_MOUNT}/ -> ${tenant || '(no default tenant)'}`);
  }
});
