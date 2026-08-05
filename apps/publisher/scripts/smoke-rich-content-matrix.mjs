#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5198);
const origin = `http://127.0.0.1:${port}`;
const base = `${origin}/syntax-gallery/`;
const requested = String(process.env.SMOKE_BROWSERS || 'chromium,firefox,webkit').split(',').map((v) => v.trim()).filter(Boolean);
const playwright = await loadPlaywright();
if (!playwright) throw new Error('Playwright is required; set PLAYWRIGHT_MODULE to its index.mjs');

await run(process.execPath, ['scripts/build-tenants.js', '--registry', 'examples/recipes.tenants.json', 'syntax-gallery']);
const server = spawn(process.execPath, ['scripts/serve.js', '--dev'], {
  cwd: packageRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'ignore', 'inherit']
});

try {
  await waitForServer(base);
  for (const name of requested) await qualifyBrowser(name, playwright[name]);
  console.log(`Rich-content browser matrix PASS (${requested.join(', ')})`);
} finally {
  server.kill('SIGTERM');
}

async function qualifyBrowser(name, browserType) {
  if (!browserType) throw new Error(`Unknown Playwright browser: ${name}`);
  const browser = await browserType.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.addInitScript(() => {
      globalThis.__pagenaryCspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        globalThis.__pagenaryCspViolations.push(`${event.violatedDirective}:${event.blockedURI}`);
      });
    });
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith(origin)) {
        external.push(url);
        return route.abort('blockedbyclient');
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'self'"
        }
      });
    });

    await page.goto(`${base}#inline-latex`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.katex-mathml math');
    const math = await page.evaluate(() => ({
      mathml: document.querySelectorAll('.katex-mathml math').length,
      display: document.querySelectorAll('.katex-display').length,
      visible: Array.from(document.querySelectorAll('.katex')).every((node) => getComputedStyle(node).display !== 'none')
    }));
    assert(math.mathml >= 5 && math.display >= 1 && math.visible, `${name}: MathML and display math semantics`);

    await page.goto(`${base}#diagrams`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('.mermaid-content svg').length >= 5);
    const diagrams = await page.evaluate(() => ({
      figures: document.querySelectorAll('figure.rich-diagram--mermaid').length,
      captions: document.querySelectorAll('figure.rich-diagram--mermaid figcaption').length,
      named: Array.from(document.querySelectorAll('figure.rich-diagram--mermaid svg')).every((svg) => svg.getAttribute('role') === 'img' && svg.getAttribute('aria-labelledby')),
      sources: document.querySelectorAll('figure.rich-diagram--mermaid details').length,
      order: Array.from(document.querySelectorAll('figure.rich-diagram--mermaid')).every((figure) => {
        const caption = figure.querySelector('figcaption');
        const source = figure.querySelector('details');
        return caption && source && Boolean(caption.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING);
      })
    }));
    assert(diagrams.figures >= 5 && diagrams.captions >= 5 && diagrams.named && diagrams.sources >= 5 && diagrams.order,
      `${name}: diagram alternatives and reading order ${JSON.stringify(diagrams)}`);

    await page.goto(`${base}#latex-page`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.section.doc.latex-page');
    const latexPage = await page.evaluate(() => ({
      page: Boolean(document.querySelector('.section.doc.latex-page')),
      heading: Boolean(document.querySelector('.section.doc.latex-page h1, .section.doc.latex-page h2')),
      sourceFallback: Boolean(document.querySelector('.rich-content-fallback, details'))
    }));
    assert(latexPage.page && latexPage.heading, `${name}: complete LaTeX page semantics ${JSON.stringify(latexPage)}`);

    await page.setViewportSize({ width: 320, height: 720 });
    const reflow = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      motion: matchMedia('(prefers-reduced-motion: reduce)').matches
    }));
    assert(!reflow.overflow && reflow.motion, `${name}: 320px reflow and reduced motion`);

    await page.emulateMedia({ media: 'screen', colorScheme: 'dark', forcedColors: 'active', reducedMotion: 'reduce' });
    const contrastMedia = await page.evaluate(() => ({
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
      contrast: matchMedia('(forced-colors: active)').matches,
      contentVisible: getComputedStyle(document.querySelector('.section.doc')).display !== 'none'
    }));
    assert(contrastMedia.dark && contrastMedia.contrast && contrastMedia.contentVisible,
      `${name}: dark and forced-colors media ${JSON.stringify(contrastMedia)}`);
    await page.emulateMedia({ media: 'print', reducedMotion: 'reduce' });
    const printMedia = await page.evaluate(() => ({
      print: matchMedia('print').matches,
      contentVisible: getComputedStyle(document.querySelector('.section.doc')).display !== 'none'
    }));
    assert(printMedia.print && printMedia.contentVisible, `${name}: print media ${JSON.stringify(printMedia)}`);

    await page.goto(`${base}pages/latex-page.html`, { waitUntil: 'networkidle' });
    await page.waitForURL(`${base}#latex-page`);
    assert(page.url() === `${base}#latex-page`, `${name}: static snapshot uses the self-hosted redirect`);

    const csp = await page.evaluate(() => globalThis.__pagenaryCspViolations || []);
    assert(csp.length === 0 && external.length === 0 && errors.length === 0,
      `${name}: offline self-CSP (${JSON.stringify({ csp, external, errors })})`);

    if (name === 'chromium') {
      const pdf = await page.pdf({ printBackground: true, format: 'A4' });
      assert(pdf.length > 10_000, `${name}: printable PDF artifact`);
      const session = await context.newCDPSession(page);
      const tree = await session.send('Accessibility.getFullAXTree');
      const names = tree.nodes.map((node) => node.name?.value || '').join(' ');
      assert(/Complete LaTeX page|Syntax gallery/i.test(names), `${name}: accessibility tree exposes page content`);
    }
    await context.close();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: name !== 'firefox',
      hasTouch: name !== 'firefox'
    });
    const mobilePage = await mobile.newPage();
    await mobilePage.goto(`${base}#inline-latex`, { waitUntil: 'networkidle' });
    const mobileState = await mobilePage.evaluate(() => ({
      math: document.querySelectorAll('.katex-mathml math').length,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    assert(mobileState.math >= 5 && !mobileState.overflow, `${name}: mobile math and reflow`);
    await mobile.close();
  } finally {
    await browser.close();
  }
}

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) {
    try { return await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href); } catch { return null; }
  }
  try { return await import('playwright'); } catch { return null; }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: packageRoot, stdio: 'inherit' });
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
    child.on('error', reject);
  });
}

function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => { response.resume(); resolve(); });
      request.on('error', () => Date.now() >= deadline ? reject(new Error(`Server did not start at ${url}`)) : setTimeout(poll, 150));
    };
    poll();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(`Browser matrix assertion failed: ${message}`);
  console.log(`  PASS ${message}`);
}
