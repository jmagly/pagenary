#!/usr/bin/env node
/**
 * Browser smoke test (#32) — verifies the things the jest/node suite can't:
 * real-browser base-URL resolution under a subpath mount, asset loading, nav +
 * section render, the runtime <title> brand (guards #29), Fortemi command-
 * palette search, and Docs Map controls when enabled. Captures a screenshot for
 * visual review.
 *
 * Playwright is intentionally NOT a package dependency — kept fully out of the
 * tree so the core install stays lean (leaner than optionalDependencies, which
 * would pull a browser engine on every `npm install`). The script dynamically
 * imports it and skips with install instructions when absent. Make it a hard
 * requirement in CI with `--require` (or SMOKE_REQUIRE=1).
 *
 * Usage:
 *   npm run test:browser                 # skips cleanly if Playwright is absent
 *   SMOKE_REQUIRE=1 npm run test:browser # fails if Playwright is absent (CI)
 *   The harness binds an owned ephemeral port and awaits server shutdown.
 *
 * One-time setup to enable it:
 *   npm i -D playwright && npx playwright install chromium
 */
import { startPreviewServer, runManagedProcess, fetchWithDeadline } from './lib/process-lifecycle.js';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '..');
const TENANT = process.env.SMOKE_TENANT || 'pagenary';
let BASE;
const REQUIRE = process.argv.includes('--require') || process.env.SMOKE_REQUIRE === '1';
const SHOT_DIR = path.join(PKG_DIR, '.playwright-mcp'); // gitignored
const SHOT = path.join(SHOT_DIR, `smoke-${TENANT}.png`);

// Console errors we tolerate (cosmetic, not behavioural).
const IGNORED_CONSOLE = [/favicon\.png/i, /favicon\.ico/i];

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function waitForServer(url) {
  const response = await fetchWithDeadline(url);
  if (!response.ok) throw new Error(`Owned preview server returned HTTP ${response.status} at ${url}`);
  await response.arrayBuffer();
}
async function run(command, args, cwd = PKG_DIR) {
  const result = await runManagedProcess(command, args, { cwd }, 1_200_000);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.code ?? result.signal}`);
}

async function ensureBuilt() {
  console.log(`• Building fresh dist/${TENANT} from current source…`);
  await run(process.execPath, ['scripts/build-tenants.js', TENANT]);
}

// This harness builds one local tenant from the default or TENANT_REGISTRY
// registry. Match build-tenants.js local path/config precedence explicitly;
// unsupported resolution must fail rather than manufacture a disabled feature.
async function expectedLocalDocsMap() {
  const registryPath = path.resolve(PKG_DIR, process.env.TENANT_REGISTRY || 'tenants.json');
  const registry = JSON.parse(await fsp.readFile(registryPath, 'utf8'));
  if (!Array.isArray(registry.tenants)) throw new Error('Smoke registry must declare tenants');
  const matches = registry.tenants.filter((tenant) => tenant?.id === TENANT);
  if (matches.length !== 1 || matches[0].enabled === false) {
    throw new Error(`Smoke requires one enabled registry entry for ${TENANT}`);
  }
  const tenant = matches[0];
  if (tenant.source?.type && tenant.source.type !== 'local') {
    throw new Error('Smoke Docs Map expectation requires a local tenant source');
  }
  const sourcePath = tenant.source?.path || path.join(registry.defaults?.source?.path || './tenants', TENANT);
  if (typeof sourcePath !== 'string' || /[$~]/.test(sourcePath)) {
    throw new Error('Smoke Docs Map expectation requires a literal local source path');
  }
  const configPath = path.join(path.resolve(PKG_DIR, sourcePath), 'config.json');
  let fileConfig = {};
  try { fileConfig = JSON.parse(await fsp.readFile(configPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const config of [fileConfig, tenant.config || {}]) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('Smoke tenant config must be an object');
    }
  }
  // Registry overrides replace top-level file fields, exactly as the build does.
  const config = { ...fileConfig, ...(tenant.config || {}) };
  if (config.docsMap !== undefined && (!config.docsMap || typeof config.docsMap !== 'object' || Array.isArray(config.docsMap))) {
    throw new Error('Smoke docsMap config must be an object');
  }
  if (config.docsMap?.enabled !== undefined && typeof config.docsMap.enabled !== 'boolean') {
    throw new Error('Smoke docsMap.enabled must be a boolean');
  }
  return config.docsMap?.enabled === true;
}

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  try {
    const mod = await import('playwright');
    return mod.chromium ? mod : null;
  } catch {
    return null;
  }
}

async function checkSearchResourceIsolation(page) {
  const indexUrl = `${BASE}search-index/manifest.json`;
  const moduleUrl = `${BASE}sections/inert-search-fixture.js`;
  const imageUrl = `${BASE}inert-search-resource-probe.svg`;
  const requests = [];
  const indexRoute = route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  const moduleRoute = route => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: `export const load = async () => ({ html: '<p>&#105;ndexingresourceprobe</p><img src="${imageUrl}" alt="Fixture">' });` });
  const imageRoute = route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
  };
  await page.route(indexUrl, indexRoute);
  await page.route(moduleUrl, moduleRoute);
  await page.route(imageUrl, imageRoute);
  try {
    const result = await page.evaluate(async () => {
      const search = await import(new URL('lib/search.js', document.baseURI).href);
      search.resetSearchState();
      return search.searchContentPage([{ id: 'inert-fixture', title: 'Fixture',
        module: './sections/inert-search-fixture.js' }], 'indexingresourceprobe');
    });
    check('fallback indexing preserves decoded body text', result.source === 'legacy'
      && result.total === 1 && result.items[0]?.id === 'inert-fixture', JSON.stringify(result));
    // Give a resource request triggered by detached DOM insertion time to reach
    // the browser network observer. The sentinel route records it even if valid.
    await page.waitForTimeout(100);
    check('fallback indexing does not fetch embedded resources', requests.length === 0, JSON.stringify(requests));
  } finally {
    await page.unroute(indexUrl, indexRoute);
    await page.unroute(moduleUrl, moduleRoute);
    await page.unroute(imageUrl, imageRoute);
  }
}

async function main() {
  const pw = await loadPlaywright();
  if (!pw) {
    const msg =
      'Playwright is not installed — skipping browser smoke.\n' +
      '  Enable it once with:  npm i -D playwright && npx playwright install chromium';
    if (REQUIRE) {
      console.error(`✗ ${msg}`);
      process.exit(1);
    }
    console.log(`• ${msg}`);
    process.exit(0);
  }

  await ensureBuilt();
  await fsp.mkdir(SHOT_DIR, { recursive: true });

  // Serve in dev mode (no-store) so the browser never reads a stale bundle.
  const server = await startPreviewServer('scripts/serve.js', { cwd: PKG_DIR });
  BASE = `${server.origin}/${TENANT}/`;

  let browser;
  try {
    await waitForServer(BASE);
    browser = await pw.chromium.launch();
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) {
        consoleErrors.push(`${m.text()} [${m.location().url || 'unknown source'}]`);
      }
    });
    const responses = new Map();
    const failedResources = [];
    page.on('response', (res) => {
      responses.set(res.url(), res.status());
      if (res.status() >= 400) failedResources.push({ url: res.url(), status: res.status() });
    });
    page.on('requestfailed', (request) => {
      failedResources.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
    });

    await page.goto(BASE, { waitUntil: 'networkidle' });

    // 1) <base href> resolves to the tenant root (#22 / base-URL fix).
    const baseURI = await page.evaluate(() => document.baseURI);
    check(`<base href> resolves to /${TENANT}/`, baseURI.endsWith(`/${TENANT}/`), baseURI);

    // 2) Check actual document references, including content-addressed filenames.
    // Observed browser responses must succeed; a separate fetch cannot hide a
    // stylesheet/module that the document failed to load.
    const referenced = await page.evaluate(() => ({
      styles: Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'), (node) => node.href),
      modules: Array.from(document.querySelectorAll('script[type="module"][src]'), (node) => node.src)
    }));
    for (const [kind, urls] of Object.entries(referenced)) {
      const observed = urls.map((url) => ({ url, status: responses.get(url) ?? null }));
      check(`document ${kind} loaded (200)`, observed.length > 0 && observed.every(({ url, status }) =>
        url.startsWith(BASE) && status === 200), JSON.stringify(observed));
    }

    // 3) Nav renders.
    const navCount = await page.evaluate(
      () => document.querySelectorAll('#nav .nav-title').length
    );
    check('nav renders items', navCount > 0, `${navCount} item(s)`);

    // 4) A section's content rendered.
    const contentLen = await page.evaluate(
      () => (document.getElementById('app')?.innerText || '').trim().length
    );
    check('section content rendered', contentLen > 80, `${contentLen} chars`);

    // 5) Runtime <title> is "<page> · <brand>" (guards #29).
    const title = await page.title();
    check('document.title is "<page> · brand"', / · .+/.test(title) && !/· Documentation$/.test(title), title);

    // 6) Command palette opens and Fortemi search returns ranked results.
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyK');
    await page.keyboard.up('Control');
    await page.waitForSelector('#commandPalette:not([hidden])', { timeout: 4000 });
    await page.fill('#commandInput', 'deploy');
    await page.waitForFunction(
      () => document.querySelectorAll('#commandList li').length > 0,
      { timeout: 5000 }
    ).catch(() => {});
    const resultCount = await page.evaluate(
      () => document.querySelectorAll('#commandList li').length
    );
    check('command palette returns search results', resultCount > 0, `${resultCount} result(s)`);
    await page.keyboard.press('Escape');

    // SITE_CONFIG intentionally exports runtime navigation/SEO fields, not docsMap.
    // Expectation comes from the same local build input, independently of output.
    const docsMapEnabled = await expectedLocalDocsMap();

    // 7) Docs Map interaction smoke (#39) when the tenant enables it.
    await page.goto(`${BASE}#docs-map`, { waitUntil: 'networkidle' });
    if (docsMapEnabled) {
      await page.waitForSelector('#docsMapRoot .docs-map-svg, #docsMapRoot [data-testid="pagenary-docs-map"]', { timeout: 10000 });
      const reactMap = page.locator('#docsMapRoot [data-testid="pagenary-docs-map"]');
      if (await reactMap.count()) {
        const focus = reactMap.getByLabel('Focus', { exact: true });
        await focus.fill('welcome');
        await reactMap.locator('.pagenary-docs-map__matches button').first().waitFor();
        check('React docs map search returns named pages', await reactMap.locator('.pagenary-docs-map__matches button').count() > 0);
        await reactMap.getByRole('button', { name: 'Reset', exact: true }).click();
        check('React docs map reset clears search', await focus.inputValue() === '');
      } else {
      const graphStats = await page.evaluate(() => ({
        nodes: document.querySelectorAll('#docsMapRoot .docs-map-node').length,
        controls: document.querySelectorAll('#docsMapRoot .docs-map-control').length,
        popupHidden: document.querySelector('#docsMapRoot .docs-map-popup')?.hidden ?? true
      }));
      check('docs map renders SVG graph', graphStats.nodes > 1, `${graphStats.nodes} node(s)`);
      check('docs map renders controls', graphStats.controls >= 7, `${graphStats.controls} control(s)`);
      check('docs map popup starts hidden', graphStats.popupHidden);

      const initialTransform = await page.evaluate(
        () => document.querySelector('#docsMapRoot .docs-map-viewport')?.getAttribute('transform')
      );
      await page.getByRole('button', { name: 'Zoom in' }).click();
      const zoomTransform = await page.evaluate(
        () => document.querySelector('#docsMapRoot .docs-map-viewport')?.getAttribute('transform')
      );
      check('docs map zoom control changes view', zoomTransform !== initialTransform, zoomTransform || '');

      await page.fill('#docsMapRoot .docs-map-search input', 'welcome');
      await page.waitForFunction(
        () => !document.querySelector('#docsMapRoot .docs-map-popup')?.hidden,
        { timeout: 4000 }
      ).catch(() => {});
      const focused = await page.evaluate(() => ({
        activeNodes: document.querySelectorAll('#docsMapRoot .docs-map-node.is-active').length,
        popupHidden: document.querySelector('#docsMapRoot .docs-map-popup')?.hidden ?? true,
        title: document.querySelector('#docsMapRoot .docs-map-popup h2')?.textContent || ''
      }));
      check('docs map search focuses a node', focused.activeNodes === 1, `${focused.activeNodes} active node(s)`);
      check('docs map search opens detail popup', !focused.popupHidden, focused.title);

      await page.click('#docsMapRoot .docs-map-popup-open');
      await page.waitForFunction(() => location.hash !== '#docs-map', { timeout: 4000 }).catch(() => {});
      const hashAfterOpen = await page.evaluate(() => location.hash);
      check('docs map popup open navigates to page', hashAfterOpen !== '#docs-map', hashAfterOpen);
      }
    } else {
      console.log(`• Docs map checks skipped: disabled in authoritative local build input for ${TENANT}.`);
    }

    // Hybrid React tenant smoke (#131): one ordinary docs route and one React
    // app route must both load from the same static host output.
    if (TENANT === 'hybrid-react') {
      await page.goto(`${BASE}#overview`, { waitUntil: 'networkidle' });
      const docsText = await page.evaluate(
        () => (document.getElementById('app')?.innerText || '').trim()
      );
      check('hybrid docs route loads', /ordinary Pagenary documentation route/i.test(docsText));

      await page.goto(`${BASE}#diagnostics`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="react-diagnostics-panel"]', { timeout: 8000 }).catch(() => {});
      const reactState = await page.evaluate(() => ({
        fallback: /Fallback status/i.test(document.getElementById('app')?.innerText || ''),
        panel: document.querySelector('[data-testid="react-diagnostics-panel"]')?.textContent || ''
      }));
      check('hybrid React route has static fallback route', reactState.fallback || /React diagnostics online/i.test(reactState.panel));
      check('hybrid React route mounts panel', /React diagnostics online/i.test(reactState.panel));
    }

    await checkSearchResourceIsolation(page);

    // 8) Screenshot for visual review.
    await page.screenshot({ path: SHOT, fullPage: false });
    check('screenshot captured', fs.existsSync(SHOT), path.relative(PKG_DIR, SHOT));

    // 9) No unexpected console errors.
    check('no console errors (favicon ignored)', consoleErrors.length === 0, JSON.stringify({ consoleErrors, failedResources }));
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      await server.stop();
    }
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\nBrowser smoke: ${checks.length - failed.length}/${checks.length} passed.`);
  if (failed.length) {
    console.error(`✗ FAIL: ${failed.map((c) => c.name).join('; ')}`);
    process.exit(1);
  }
  console.log('✓ All browser smoke checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(`✗ Browser smoke crashed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
