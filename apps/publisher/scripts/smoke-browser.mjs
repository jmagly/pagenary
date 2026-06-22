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
 *   PORT=5191 npm run test:browser       # override the ephemeral serve port
 *
 * One-time setup to enable it:
 *   npm i -D playwright && npx playwright install chromium
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '..');
const TENANT = process.env.SMOKE_TENANT || 'pagenary';
const PORT = Number(process.env.PORT || 5190);
const BASE = `http://127.0.0.1:${PORT}/${TENANT}/`;
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

function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const ping = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error(`server not ready at ${url}`));
        else setTimeout(ping, 200);
      });
    };
    ping();
  });
}

async function ensureBuilt() {
  const shell = path.join(PKG_DIR, 'dist', TENANT, 'index.html');
  if (fs.existsSync(shell)) return;
  console.log(`• dist/${TENANT} missing — building tenant…`);
  await new Promise((resolve, reject) => {
    const b = spawn('node', ['scripts/build-tenants.js', TENANT], { cwd: PKG_DIR, stdio: 'inherit' });
    b.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))));
  });
}

async function loadPlaywright() {
  try {
    const mod = await import('playwright');
    return mod.chromium ? mod : null;
  } catch {
    return null;
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
  const server = spawn('node', ['scripts/serve.js', '--dev'], {
    cwd: PKG_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'inherit']
  });

  let browser;
  try {
    await waitForServer(BASE);
    browser = await pw.chromium.launch();
    const page = await browser.newPage();

    const consoleErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED_CONSOLE.some((re) => re.test(m.text()))) {
        consoleErrors.push(m.text());
      }
    });
    const assets = { styles: null, app: null };
    page.on('response', (res) => {
      const u = res.url();
      if (/\/styles\.css(\?|$)/.test(u)) assets.styles = res.status();
      if (/\/app\.js(\?|$)/.test(u)) assets.app = res.status();
    });

    await page.goto(BASE, { waitUntil: 'networkidle' });

    // 1) <base href> resolves to the tenant root (#22 / base-URL fix).
    const baseURI = await page.evaluate(() => document.baseURI);
    check(`<base href> resolves to /${TENANT}/`, baseURI.endsWith(`/${TENANT}/`), baseURI);

    // 2) Shell assets loaded 200 under the subpath.
    check('styles.css loaded (200)', assets.styles === 200, `status ${assets.styles}`);
    check('app.js loaded (200)', assets.app === 200, `status ${assets.app}`);

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

    // 7) Docs Map interaction smoke (#39) when the tenant enables it.
    await page.goto(`${BASE}#docs-map`, { waitUntil: 'networkidle' });
    const docsMapEnabled = await page.waitForSelector('#docsMapRoot .docs-map-svg', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (docsMapEnabled) {
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
    } else {
      check('docs map not enabled for smoke tenant', true, TENANT);
    }

    // 8) Screenshot for visual review.
    await page.screenshot({ path: SHOT, fullPage: false });
    check('screenshot captured', fs.existsSync(SHOT), path.relative(PKG_DIR, SHOT));

    // 9) No unexpected console errors.
    check('no console errors (favicon ignored)', consoleErrors.length === 0, consoleErrors.join(' | '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
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
