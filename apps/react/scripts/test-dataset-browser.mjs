import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactTenant } from '../src/index.js';

const { chromium } = await import(process.env.PAGENARY_PLAYWRIGHT_MODULE || 'playwright');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'pagenary-dataset-browser-'));
const sourceDir = fileURLToPath(new URL('../../publisher/examples/dataset-authoring', import.meta.url));
let browser;
let server;
try {
  const config = JSON.parse(await readFile(path.join(sourceDir, 'config.json'), 'utf8'));
  const built = await buildReactTenant({ tenantId: 'dataset-authoring-example', sourceDir, distDir: temporary,
    config, runtime: config.runtime.react });
  const entry = built.emittedAssets.find((asset) => asset.isEntry);
  let emittedBytes = 0;
  let entryBytes = 0;
  for (const asset of built.emittedAssets) {
    assert.doesNotMatch(asset.file, /\.wasm$|pglite/i);
    const bytes = (await readFile(path.join(temporary, asset.file))).length;
    emittedBytes += bytes;
    if (asset === entry) entryBytes = bytes;
  }
  server = http.createServer(async (request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dataset browser checks</title>
        <style>:root{--surface:#fff;--ink:#172333;--accent:#1769aa}body{background:var(--surface);color:var(--ink);margin:0;font:16px sans-serif}</style></head>
        <body><h1>Authoring example</h1><button id="open-authoring">Open authoring</button><main id="content">Overview</main>
        <script>document.getElementById('open-authoring').onclick=()=>{location.hash='authoring';document.getElementById('content').innerHTML='<div id="dataset-authoring-root"></div>'}</script>
        <script type="module" src="/${entry.file}"></script></body></html>`);
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(temporary, `.${pathname}`);
    if (!file.startsWith(`${temporary}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    try {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true,
    ...(process.env.PAGENARY_BROWSER_BIN ? { executablePath: process.env.PAGENARY_BROWSER_BIN } : {}) });
  const page = await browser.newPage();
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: 'networkidle' });
  assert.equal((await page.evaluate(() => indexedDB.databases())).length, 0, 'Overview opened IndexedDB');
  assert.equal(requests.filter((url) => url.includes('/assets/react/assets/')).length, 0, 'Overview loaded dataset chunks');
  await page.getByRole('button', { name: 'Open authoring' }).click();
  await page.getByRole('heading', { name: 'Import local pages' }).waitFor();
  const corpus = { items: [{ id: 'one', title: 'First', text: 'Private imported text' }, { id: 'two', text: 'Second' }] };
  await page.locator('#dataset-source').setInputFiles({ name: 'pages.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(corpus)) });
  await page.locator('#dataset-source').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'dataset-policy');
  await page.getByRole('button', { name: 'Check source', exact: true }).click();
  await page.getByRole('button', { name: 'Preview import', exact: true }).waitFor();
  await page.waitForFunction(() => document.activeElement.id === 'dataset-author-heading');
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('heading', { name: 'Preview', exact: true }).waitFor();
  assert.equal(await page.getByText('Private imported text', { exact: true }).count(), 0);
  const counts = () => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fortemi-dataset-authoring-example-records');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const readCount = (table) => new Promise((resolve, reject) => {
        const request = db.transaction(table).objectStore(table).count();
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      return { notes: await readCount('note'), journal: await readCount('journal') };
    } finally { db.close(); }
  });
  assert.deepEqual(await counts(), { notes: 0, journal: 0 });
  await page.getByRole('button', { name: 'Review plan', exact: true }).click();
  await page.getByRole('button', { name: 'Approve import', exact: true }).click();
  await page.getByText(/Import complete: 2 of 2 records/).waitFor();
  assert.equal((await counts()).notes, 2);
  const committed = await counts();
  await page.getByRole('button', { name: 'Approve import', exact: true }).click();
  await page.getByText(/Import complete: 2 of 2 records/).waitFor();
  assert.deepEqual(await counts(), committed, 'Repeated approval added mutations');
  const many = { items: Array.from({ length: 30 }, (_, index) => ({ id: `cancel-${index}`, text: `Additional page ${index}` })) };
  await page.locator('#dataset-source').setInputFiles({ name: 'many.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(many)) });
  await page.locator('#dataset-batch-size').fill('1');
  await page.getByRole('button', { name: 'Check source', exact: true }).click();
  await page.getByRole('button', { name: 'Preview import', exact: true }).click();
  await page.getByRole('button', { name: 'Review plan', exact: true }).click();
  await page.getByRole('button', { name: 'Approve import', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
  await page.getByRole('button', { name: 'Retry run', exact: true }).waitFor();
  const cancelledCounts = await counts();
  assert.ok(cancelledCounts.notes < 32, 'Cancellation did not stop the remaining batches');
  await page.getByRole('button', { name: 'Retry run', exact: true }).click();
  await page.getByText(/Import complete: 30 of 30 records/).waitFor();
  assert.equal((await counts()).notes, 32, 'Retry lost or duplicated records');
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile horizontal overflow');
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--surface', '#15202b');
    document.documentElement.style.setProperty('--ink', '#f2f5f7');
    document.documentElement.style.setProperty('--accent', '#86c5ff');
  });
  const appearance = await page.locator('.pagenary-dataset').evaluate((element) => ({
    color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
    animation: getComputedStyle(element.querySelector('button')).animationName
  }));
  assert.equal(appearance.color, 'rgb(242, 245, 247)');
  assert.equal(appearance.background, 'rgb(21, 32, 43)');
  assert.equal(appearance.animation, 'none');
  assert.ok(await page.locator('[role="status"][aria-live="polite"]').count());
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks: ['lazy route loading', 'keyboard/focus', 'redacted preview', 'approval',
    'IndexedDB persistence', 'repeated approval', 'cancel/retry', 'mobile layout', 'dark theme', 'reduced motion', 'live status'],
    entryBytes, emittedBytes, artifacts: built.emittedAssets.map((asset) => asset.file) }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
