#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const publisher = process.env.PAGENARY_PUBLISHER_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  try { return await import('playwright'); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    const installed = path.join(os.tmpdir(), 'pagenary-playwright/node_modules/playwright/index.mjs');
    try { await fs.access(installed); }
    catch { throw new Error('Playwright is required: run the documented browser setup or set PLAYWRIGHT_MODULE.', { cause: error }); }
    return import(pathToFileURL(installed));
  }
}
const playwright = await loadPlaywright();
const { generateCollections } = await import(pathToFileURL(path.join(publisher, 'scripts/lib/collections-generator.js')));
const { buildStaticPage } = await import(pathToFileURL(path.join(publisher, 'scripts/lib/seo-generator.js')));
const engines = (process.env.PAGENARY_STYLE_BROWSERS || 'chromium').split(',');
const checks = [];
let server;
let temporary;
let stylesheet = 'src/styles.css';
const stylesheets = ['src/styles.css'];
try { await fs.access(path.join(publisher, 'site/styles.css')); stylesheets.push('site/styles.css'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const body = '<section class="pe-hero"><h1>Decorative hero</h1></section><section class="doc markdown"><div class="doc-content">' +
  Array.from({ length: 40 }, (_, i) => `<h2 id="heading-${i}">Heading ${i}</h2><p>Readable document content.</p>`).join('') + '</div></section>';
const manifest = `export const MANIFEST = [{id:'guide',title:'Guide',module:'./sections/style-fixture.js'}, {id:'next',title:'Next',module:'./sections/style-fixture.js'}];
export const DEFAULT_SECTION='guide'; export const SITE_CONFIG={title:'Style fixture',bottomNav:'always'}; export const EXPORT_CONFIG={};
export const findSection=id=>MANIFEST.find(x=>x.id===id); export const getAdjacentSections=id=>({prev:id==='next'?MANIFEST[0]:null,next:id==='guide'?MANIFEST[1]:null}); export const layoutForSection=()=> 'docs';`;
try {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-style-browser-'));
  let html = await fs.readFile(path.join(publisher, 'src/index.html'), 'utf8');
  html = html.replace(/<script src="\.\/bootstrap.js"[^>]*><\/script>/, '<script>document.documentElement.classList.add("has-js")</script>')
    .replace('<body>', '<body data-page-toc="right">')
    .replace('id="nav" class="nav"', 'id="nav" class="nav nav-static-fallback"')
    .replace('<nav id="nav" class="nav nav-static-fallback" aria-label="Primary"></nav>', '<nav id="nav" class="nav nav-static-fallback" aria-label="Primary"><div class="nav-sublist"><a href="#guide">Static Guide</a></div></nav>');
  const staticSnapshot = buildStaticPage({ sectionId: 'long', sectionTitle: 'Long document', sectionSummary: 'Scroll fixture', sectionParent: null, contentHtml: body, siteTitle: 'Style fixture', baseUrl: '', config: { title: 'Style fixture' } });
  server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://fixture');
      if (url.pathname === '/pages/long.html') { res.setHeader('Content-Type', 'text/html'); res.end(staticSnapshot); return; }
      if (url.pathname === '/styles.css') { res.setHeader('Content-Type', 'text/css'); res.end(await fs.readFile(path.join(publisher, stylesheet))); return; }
      if (url.pathname === '/src/index.html') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
      if (url.pathname === '/src/manifest.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(manifest); return; }
      if (url.pathname === '/src/sections/style-fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(`export const load=()=>({html:${JSON.stringify(body)}});`); return; }
      const target = url.pathname === '/src/styles.css'
        ? path.join(publisher, stylesheet)
        : path.resolve(publisher, '.' + decodeURIComponent(url.pathname));
      if (!target.startsWith(publisher + path.sep)) { res.writeHead(403); res.end(); return; }
      res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'application/octet-stream');
      res.end(await fs.readFile(target));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}/src/index.html`;
  const content = path.join(temporary, 'content');
  const dist = path.join(temporary, 'dist');
  await fs.mkdir(path.join(content, 'blog'), { recursive: true });
  await fs.writeFile(path.join(content, 'blog/post.md'), '---\ntitle: A & B\ndate: 2026-05-25\nsummary: <unsafe> & text\n---\n# Post');
  await generateCollections(dist, { title: 'Site', domain: 'docs.example', collections: [{ path: 'blog', title: 'Blog', feed: true }] }, content);
  const rss = await fs.readFile(path.join(dist, 'blog/feed.xml'), 'utf8');
  for (const variant of stylesheets) {
    stylesheet = variant;
  for (const engine of engines) {
    assert.ok(playwright[engine]?.launch, `Unknown browser ${engine}`);
    const browser = await playwright[engine].launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(15000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForSelector('.doc .bottom-nav');
      assert.equal(await page.locator('.pe-hero .bottom-nav').count(), 0, 'Bottom navigation must not mount inside the leading hero');
      assert.equal(await page.locator('#nav.nav-static-fallback').count(), 0, 'Interactive navigation must remove fallback class');
      assert.equal(await page.locator('#nav button[data-section="guide"]').count(), 1);
      checks.push({ name: `${variant}/${engine}: runtime navigation`, status: 'passed' });
      const disc = '.page-toc--right > details';
      await page.waitForFunction(selector => document.querySelector(selector)?.open === true, disc);
      await page.setViewportSize({ width: 480, height: 800 });
      await page.waitForFunction(selector => document.querySelector(selector)?.open === false, disc);
      assert.equal(await page.locator('.page-toc--right').evaluate(node => getComputedStyle(node).position), 'static');
      await page.locator(`${disc} > summary`).click();
      await page.waitForFunction(selector => document.querySelector(selector)?.open === true, disc);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForFunction(selector => document.querySelector(selector)?.open === true, disc);
      checks.push({ name: `${variant}/${engine}: responsive TOC state`, status: 'passed' });
      await page.evaluate(async () => {
        document.body.dataset.pageToc = 'rail';
        const { initPageEffects } = await import('./lib/page-effects.js');
        initPageEffects(document.getElementById('app'));
      });
      await page.waitForSelector('.page-toc--rail');
      const rail = await page.locator('.page-toc--rail').evaluate(node => {
        const disc = node.querySelector('details'); const list = node.querySelector('.page-toc__list');
        return { discHeight: disc.getBoundingClientRect().height, viewport: innerHeight, maxHeight: parseFloat(getComputedStyle(disc).maxHeight), listOverflow: getComputedStyle(list).overflowY, scrollable: list.scrollHeight > list.clientHeight, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, open: disc.open, listStyle: getComputedStyle(list).display, items: list.children.length };
      });
      assert.ok(rail.discHeight <= rail.maxHeight + 1 && rail.discHeight < rail.viewport);
      assert.equal(rail.listOverflow, 'auto'); assert.equal(rail.scrollable, true);
      await page.locator('.page-toc--rail .page-toc__list').evaluate(n => { n.scrollTop = 200; });
      assert.ok(await page.locator('.page-toc--rail .page-toc__list').evaluate(n => n.scrollTop > 0));
      checks.push({ name: `${variant}/${engine}: rail scroll containment`, status: 'passed' });
      await page.setViewportSize({ width: 480, height: 800 });
      await page.evaluate(() => {
        const actions = document.createElement('div'); actions.className = 'pe-hero-actions';
        actions.innerHTML = '<a class="pe-cta">A long mobile action label</a>'; document.querySelector('.pe-hero').append(actions);
      });
      assert.equal(await page.locator('.pe-hero-actions').evaluate(n => getComputedStyle(n).flexDirection), 'column');
      assert.equal(await page.locator('.pe-cta').evaluate(n => getComputedStyle(n).whiteSpace), 'normal');
      const flow = await page.evaluate(() => {
        const css = selector => getComputedStyle(document.querySelector(selector));
        return {
          heroAlignment: css('.pe-hero-actions').alignItems,
          actionAlignment: css('.pe-cta').justifyContent,
          bottomFlow: css('.bottom-nav__inner').flexDirection,
          bottomAlignment: css('.bottom-nav__inner').alignItems,
          bottomWhitespace: css('.bottom-nav-link').whiteSpace,
          bottomText: css('.bottom-nav-link').textAlign,
          canvasDisplay: css('.canvas').display,
          canvasWidth: document.querySelector('.canvas').getBoundingClientRect().width,
          viewport: innerWidth,
          tocPointer: css('.page-toc__title').pointerEvents,
          tocCursor: css('.page-toc__title').cursor
        };
      });
      assert.equal(flow.heroAlignment, 'stretch'); assert.equal(flow.actionAlignment, 'center');
      assert.equal(flow.bottomFlow, 'column'); assert.equal(flow.bottomAlignment, 'stretch');
      assert.equal(flow.bottomWhitespace, 'normal'); assert.equal(flow.bottomText, 'center');
      assert.equal(flow.canvasDisplay, 'grid'); assert.ok(flow.canvasWidth <= flow.viewport);
      assert.equal(flow.tocPointer, 'auto'); assert.equal(flow.tocCursor, 'pointer');
      checks.push({ name: `${variant}/${engine}: mobile action layout`, status: 'passed' });
      const parsed = await page.evaluate(xml => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return { error: doc.querySelector('parsererror')?.textContent || null, version: doc.documentElement.getAttribute('version'), title: doc.querySelector('channel > title')?.textContent, items: [...doc.querySelectorAll('item')].map(n => ({ title: n.querySelector('title')?.textContent, description: n.querySelector('description')?.textContent, link: n.querySelector('link')?.textContent })) };
      }, rss);
      assert.equal(parsed.error, null); assert.equal(parsed.version, '2.0'); assert.equal(parsed.title, 'Blog');
      assert.deepEqual(parsed.items, [{ title: 'A & B', description: '<unsafe> & text', link: 'https://docs.example/pages/blog--post.html' }]);
      checks.push({ name: `${variant}/${engine}: RSS XML validity and escaped data`, status: 'passed' });
      assert.deepEqual(errors, [], 'Runtime fixture must not hide JavaScript exceptions');
      await context.close();
      const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 480, height: 800 } });
      const staticPage = await noJs.newPage(); await staticPage.goto(url);
      assert.equal(await staticPage.locator('#nav a').isVisible(), true);
      assert.equal(await staticPage.locator('.mobile-menu-toggle').isVisible(), false);
      assert.equal(await staticPage.locator('.nav-sublist').evaluate(n => getComputedStyle(n).display), 'grid');
      const fallback = await staticPage.evaluate(() => {
        const sidebar = document.querySelector('.sidebar'); const canvas = document.querySelector('.canvas');
        return { bodyDisplay: getComputedStyle(document.body).display, sidebarDisplay: getComputedStyle(sidebar).display,
          sidebarPosition: getComputedStyle(sidebar).position, sidebarTransform: getComputedStyle(sidebar).transform,
          canvasOverflow: getComputedStyle(canvas).overflow, layoutOverflow: getComputedStyle(document.querySelector('.layout')).overflow };
      });
      assert.equal(fallback.bodyDisplay, 'block'); assert.equal(fallback.sidebarDisplay, 'block');
      assert.equal(fallback.sidebarPosition, 'relative'); assert.equal(fallback.sidebarTransform, 'none');
      assert.equal(fallback.canvasOverflow, 'visible'); assert.equal(fallback.layoutOverflow, 'visible');
      checks.push({ name: `${variant}/${engine}: no-JavaScript navigation`, status: 'passed' });
      await staticPage.goto(new URL('/pages/long.html', url).href);
      assert.equal(await staticPage.locator('h2').count(), 40);
      assert.equal(await staticPage.locator('#heading-39').textContent(), 'Heading 39');
      const staticDimensions = await staticPage.evaluate(() => ({ height: document.scrollingElement.scrollHeight, viewport: innerHeight, scroll: scrollY, lastHeading: document.getElementById('heading-39').getBoundingClientRect().top }));
      assert.ok(staticDimensions.height > staticDimensions.viewport, 'Generated snapshot must contain content below the viewport');
      await staticPage.mouse.move(240, 400);
      await staticPage.mouse.wheel(0, 700);
      // JavaScript-disabled pages cannot schedule the rAF polling used by waitForFunction.
      // Poll through the browser protocol from the host, preserving genuine wheel input.
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await staticPage.evaluate(() => scrollY > 0)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const staticPosition = await staticPage.evaluate(() => ({ scroll: scrollY, lastHeading: document.getElementById('heading-39').getBoundingClientRect().top }));
      assert.ok(staticPosition.scroll > staticDimensions.scroll, 'No-JavaScript reader must scroll the generated static snapshot');
      assert.ok(staticPosition.lastHeading < staticDimensions.lastHeading, 'Wheel input must move generated document content');
      checks.push({ name: `${variant}/${engine}: generated snapshot no-JavaScript scrolling`, status: 'passed' });
      await noJs.close();
    } finally { await browser.close(); }
  }
  }
  console.log(JSON.stringify({ checks, stylesheets, complete: true }));
} finally {
  try {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } finally {
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  }
}
