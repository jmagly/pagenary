#!/usr/bin/env node
/* Lightweight static server for dist */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const root = path.join(process.cwd(), 'dist');
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let pathname = decodeURIComponent(parsed.pathname || '/');
  if (pathname === '/') pathname = '/index.html';
  let filePath = path.join(root, pathname);
  if (!filePath.startsWith(root)) {
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
});
