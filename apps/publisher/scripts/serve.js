#!/usr/bin/env node
/* Lightweight static server for dist with tenant routing */
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

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
        return streamFile(filePath, res);
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
          streamFile(htmlFallback, res);
        });
      }
      res.writeHead(404).end('Not Found');
      return;
    }
    streamFile(filePath, res);
  });
});

function streamFile(target, res) {
  const ext = path.extname(target).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  headers['Cache-Control'] = DEV ? 'no-store' : (ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable');
  res.writeHead(200, headers);
  fs.createReadStream(target).pipe(res);
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
