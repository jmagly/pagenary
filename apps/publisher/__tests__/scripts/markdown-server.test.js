import { spawn } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, '../../scripts/serve.js');

function waitFor(url, timeout = 10000) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => Date.now() >= deadline ? reject(new Error('server timeout')) : setTimeout(probe, 50));
    };
    probe();
  });
}

describe('preview server Markdown negotiation (#163)', () => {
  let cwd;
  let child;
  let origin;

  beforeAll(async () => {
    cwd = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-markdown-server-'));
    const tenant = path.join(cwd, 'dist/test');
    await fsp.mkdir(path.join(tenant, 'pages'), { recursive: true });
    await fsp.mkdir(path.join(tenant, 'markdown'), { recursive: true });
    await fsp.writeFile(path.join(tenant, 'index.html'), '<h1>Root HTML</h1>');
    await fsp.writeFile(path.join(tenant, 'pages/guide.html'), '<h1>Guide HTML</h1>');
    await fsp.writeFile(path.join(tenant, 'markdown/guide.md'), '# Guide Markdown\n');
    await fsp.writeFile(path.join(tenant, 'markdown-routes.json'), JSON.stringify({
      version: 1,
      contentNegotiation: true,
      directArtifacts: true,
      observability: { responseHeader: true },
      routes: {
        '/': { id: 'guide', canonical: '/pages/guide.html', artifact: '/markdown/guide.md' },
        '/pages/guide': { id: 'guide', canonical: '/pages/guide.html', artifact: '/markdown/guide.md' },
        '/pages/guide.html': { id: 'guide', canonical: '/pages/guide.html', artifact: '/markdown/guide.md' }
      }
    }));
    const port = 20000 + (process.pid % 20000);
    origin = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [SERVER, '--dev'], {
      cwd,
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DEFAULT_TENANT: 'test', PAGENARY_SERVE_MOUNT: '/docs' },
      stdio: 'ignore'
    });
    await waitFor(`${origin}/docs/`);
  });

  afterAll(async () => {
    child?.kill('SIGTERM');
    await fsp.rm(cwd, { recursive: true, force: true });
  });

  it('serves HTML normally and Markdown when it has the stronger preference', async () => {
    const html = await fetch(`${origin}/docs/pages/guide.html`, { headers: { Accept: 'text/html' } });
    expect(html.status).toBe(200);
    expect(html.headers.get('content-type')).toContain('text/html');
    expect(html.headers.get('vary')).toBe('Accept');
    expect(html.headers.get('x-pagenary-representation')).toBe('html');
    expect(await html.text()).toContain('Guide HTML');

    const markdown = await fetch(`${origin}/docs/pages/guide.html`, {
      headers: { Accept: 'text/markdown, text/html;q=0.5' }
    });
    expect(markdown.status).toBe(200);
    expect(markdown.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(markdown.headers.get('vary')).toBe('Accept');
    expect(markdown.headers.get('content-location')).toBe('/docs/pages/guide.html');
    expect(markdown.headers.get('x-pagenary-representation')).toBe('markdown');
    expect(await markdown.text()).toBe('# Guide Markdown\n');
  });

  it('supports HEAD, clean aliases, direct artifacts, and conditional requests', async () => {
    const head = await fetch(`${origin}/docs/pages/guide`, { method: 'HEAD', headers: { Accept: 'text/markdown' } });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-type')).toContain('text/markdown');
    expect(head.headers.get('content-location')).toBe('/docs/pages/guide.html');
    expect(await head.text()).toBe('');

    const negotiated = await fetch(`${origin}/docs/pages/guide.html`, { headers: { Accept: 'text/markdown' } });
    const negotiatedCached = await fetch(`${origin}/docs/pages/guide.html`, {
      headers: { Accept: 'text/markdown', 'If-None-Match': negotiated.headers.get('etag') }
    });
    expect(negotiatedCached.status).toBe(304);
    expect(negotiatedCached.headers.get('vary')).toBe('Accept');

    const html = await fetch(`${origin}/docs/pages/guide.html`, { headers: { Accept: 'text/html' } });
    const htmlCached = await fetch(`${origin}/docs/pages/guide.html`, {
      headers: { Accept: 'text/html', 'If-None-Match': html.headers.get('etag') }
    });
    expect(htmlCached.status).toBe(304);
    expect(htmlCached.headers.get('vary')).toBe('Accept');

    const direct = await fetch(`${origin}/docs/markdown/guide.md`);
    expect(direct.status).toBe(200);
    expect(direct.headers.get('content-type')).toContain('text/markdown');
    const etag = direct.headers.get('etag');
    expect(etag).toBeTruthy();
    const cached = await fetch(`${origin}/docs/markdown/guide.md`, { headers: { 'If-None-Match': etag } });
    expect(cached.status).toBe(304);
  });

  it('preserves redirect, q=0, tie, and 404 behavior', async () => {
    const redirect = await fetch(`${origin}/docs`, { redirect: 'manual' });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/docs/');

    for (const accept of ['text/markdown;q=0, text/html;q=0.5', 'text/markdown, text/html']) {
      const response = await fetch(`${origin}/docs/pages/guide.html`, { headers: { Accept: accept } });
      expect(response.headers.get('content-type')).toContain('text/html');
    }
    expect((await fetch(`${origin}/docs/pages/missing`, { headers: { Accept: 'text/markdown' } })).status).toBe(404);
  });
});
