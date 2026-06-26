#!/usr/bin/env node
/**
 * Browser accessibility smoke tests for generated Pagenary output.
 *
 * This intentionally avoids a runtime dependency on axe-core so the package
 * stays lean. The checks are deterministic DOM/browser rules that catch common
 * generated-output regressions and report route, selector, rule, and
 * remediation details. CI should run with --require after installing Playwright.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 5192);
const TENANT = process.env.SMOKE_TENANT || 'pagenary';
const ORIGIN = `http://127.0.0.1:${PORT}/`;
const BASE = `${ORIGIN}${TENANT}/`;
const REQUIRE = process.argv.includes('--require') || process.env.SMOKE_REQUIRE === '1';

const findings = [];

function addFinding(finding) {
  findings.push(finding);
  console.error(
    `  FAIL ${finding.route} ${finding.rule} ${finding.selector || '-'}: ` +
    `${finding.message} Remediation: ${finding.remediation}`
  );
}

function pass(route, rule, detail = '') {
  console.log(`  OK ${route} ${rule}${detail ? ` - ${detail}` : ''}`);
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

function run(command, args, cwd = PKG_DIR) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`));
    });
  });
}

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) {
    try {
      const mod = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
      return mod.chromium ? mod : null;
    } catch {
      return null;
    }
  }
  try {
    const mod = await import('playwright');
    return mod.chromium ? mod : null;
  } catch {
    return null;
  }
}

async function ensureBuilt() {
  const shell = path.join(PKG_DIR, 'dist', TENANT, 'index.html');
  const blog = path.join(PKG_DIR, 'dist', 'blog-demo', 'index.html');
  const effects = path.join(PKG_DIR, 'dist', 'page-effects', 'index.html');
  if (fs.existsSync(shell) && fs.existsSync(blog) && fs.existsSync(effects)) return;
  console.log('Building docs tenant and example tenants for browser accessibility smoke...');
  await run('node', ['scripts/build-tenants.js', TENANT]);
  await run('npm', ['run', 'build:examples:site']);
}

async function scanRoute(page, route, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app', { timeout: 5000 }).catch(() => {});
  const routeFindings = await page.evaluate((routeName) => {
    function selectorFor(el) {
      if (!el) return '';
      if (el.id) return `#${CSS.escape(el.id)}`;
      const testId = el.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;
      const parts = [];
      let current = el;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) part += `.${Array.from(current.classList).slice(0, 2).map((c) => CSS.escape(c)).join('.')}`;
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(' > ');
    }

    function textOf(el) {
      if (!el) return '';
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        return labelledBy.split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim();
      }
      return (
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.getAttribute('title') ||
        el.textContent ||
        ''
      ).replace(/\s+/g, ' ').trim();
    }

    function finding(el, rule, message, remediation) {
      return { route: routeName, selector: selectorFor(el), rule, message, remediation };
    }

    const out = [];
    const lang = document.documentElement.getAttribute('lang');
    if (!lang) {
      out.push(finding(document.documentElement, 'document-language', 'Document <html> has no lang attribute.', 'Set a page language such as lang="en".'));
    }

    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('alt') && img.getAttribute('aria-hidden') !== 'true') {
        out.push(finding(img, 'image-alt', 'Image is missing alt text.', 'Add alt text or mark decorative images as aria-hidden with empty alt.'));
      }
    });

    document.querySelectorAll('iframe').forEach((iframe) => {
      if (!textOf(iframe)) {
        out.push(finding(iframe, 'iframe-title', 'Iframe has no accessible title.', 'Add a title that describes the embedded content.'));
      }
    });

    document.querySelectorAll('a[href], button, input, select, textarea').forEach((el) => {
      const hidden = el.closest('[hidden], [aria-hidden="true"]');
      if (hidden) return;
      if (el.matches('input[type="hidden"]')) return;
      if (!textOf(el)) {
        out.push(finding(el, 'accessible-name', 'Interactive element has no accessible name.', 'Add visible text, aria-label, aria-labelledby, alt, or title.'));
      }
    });

    document.querySelectorAll('a[href]').forEach((link) => {
      const text = textOf(link).toLowerCase();
      if (!text) return;
      if (['click here', 'here', 'read more', 'more', 'learn more', 'link'].includes(text)) {
        out.push(finding(link, 'link-text', `Link text "${text}" is ambiguous.`, 'Use destination-specific link text.'));
      }
    });

    document.querySelectorAll('table').forEach((table) => {
      if (!table.querySelector('th')) {
        out.push(finding(table, 'table-headers', 'Table has no header cells.', 'Use th cells for data tables or avoid tables for layout.'));
      }
    });

    const ids = new Map();
    document.querySelectorAll('[id]').forEach((el) => {
      const id = el.id;
      if (!ids.has(id)) {
        ids.set(id, el);
        return;
      }
      out.push(finding(el, 'duplicate-id', `Duplicate id "${id}".`, 'Use unique id values in generated output.'));
    });

    let previousHeading = 0;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
      const level = Number(heading.tagName.slice(1));
      if (previousHeading && level > previousHeading + 1) {
        out.push(finding(heading, 'heading-order', `Heading jumps from h${previousHeading} to h${level}.`, 'Use sequential heading levels.'));
      }
      previousHeading = level;
    });

    if (!document.querySelector('main, [role="main"], #app')) {
      out.push(finding(document.body, 'main-landmark', 'Page has no main landmark.', 'Wrap primary content in main or role="main".'));
    }

    return out;
  }, route);

  if (routeFindings.length === 0) pass(route, 'dom-accessibility-scan');
  routeFindings.forEach(addFinding);
}

async function checkCommandPalette(page) {
  const route = 'pagenary#command-palette';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyK');
  await page.keyboard.up('Control');
  await page.waitForSelector('#commandPalette:not([hidden])', { timeout: 4000 });
  const labelled = await page.evaluate(() => {
    const dialog = document.querySelector('#commandPalette');
    const input = document.querySelector('#commandInput');
    return {
      dialogRole: dialog?.getAttribute('role'),
      labelled: Boolean(dialog?.getAttribute('aria-labelledby') && document.getElementById(dialog.getAttribute('aria-labelledby'))),
      inputName: Boolean(input?.labels?.length || input?.getAttribute('aria-label') || input?.getAttribute('aria-labelledby')),
      activeInput: document.activeElement === input
    };
  });
  if (labelled.dialogRole === 'dialog' && labelled.labelled && labelled.inputName && labelled.activeInput) {
    pass(route, 'keyboard-command-palette', 'dialog labelled and input focused');
  } else {
    addFinding({
      route,
      selector: '#commandPalette',
      rule: 'keyboard-command-palette',
      message: `Command palette state ${JSON.stringify(labelled)}`,
      remediation: 'Ctrl+K must open a labelled dialog and focus the search input.'
    });
  }
  await page.fill('#commandInput', 'deploy');
  await page.waitForFunction(
    () => document.querySelectorAll('#commandList li').length > 0,
    { timeout: 5000 }
  ).catch(() => {});
  const results = await page.evaluate(() => ({
    count: document.querySelectorAll('#commandList li').length,
    named: Array.from(document.querySelectorAll('#commandList li')).every((item) => item.textContent.trim().length > 0)
  }));
  if (results.count > 0 && results.named) {
    pass(route, 'command-palette-search', `${results.count} result(s)`);
  } else {
    addFinding({
      route,
      selector: '#commandList',
      rule: 'command-palette-search',
      message: `Command search state ${JSON.stringify(results)}`,
      remediation: 'Command-palette search should return named keyboard-selectable results.'
    });
  }
  await page.keyboard.press('Escape');
}

async function checkPrimaryNav(page) {
  const route = 'pagenary#primary-nav';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#nav', { timeout: 4000 });
  const state = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('#nav button, #nav a'));
    const first = controls[0] || null;
    if (first) first.focus();
    return {
      count: controls.length,
      named: controls.every((control) => control.textContent.trim().length > 0 || control.getAttribute('aria-label')),
      firstFocused: Boolean(first && document.activeElement === first)
    };
  });
  if (state.count > 0 && state.named && state.firstFocused) {
    pass(route, 'primary-nav-keyboard', `${state.count} control(s)`);
  } else {
    addFinding({
      route,
      selector: '#nav',
      rule: 'primary-nav-keyboard',
      message: `Primary nav state ${JSON.stringify(state)}`,
      remediation: 'Primary navigation should expose named focusable links or buttons.'
    });
  }
}

async function checkExportControls(page) {
  const route = 'pagenary#export';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click('#exportBtn');
  await page.waitForSelector('.export-options-overlay.active', { timeout: 4000 });
  const controls = await page.evaluate(() => ({
    optionButtons: document.querySelectorAll('.export-option-btn').length,
    cancelButtons: document.querySelectorAll('.export-cancel-btn').length,
    namedOptions: Array.from(document.querySelectorAll('.export-option-btn')).every((button) => button.textContent.trim().length > 0),
    activeElementInModal: Boolean(document.activeElement?.closest('.export-options-modal'))
  }));
  if (controls.optionButtons > 0 && controls.cancelButtons === 1 && controls.namedOptions) {
    pass(route, 'export-controls', `${controls.optionButtons} option(s)`);
  } else {
    addFinding({
      route,
      selector: '.export-options-modal',
      rule: 'export-controls',
      message: `Export modal state ${JSON.stringify(controls)}`,
      remediation: 'Export modal must expose named option buttons and a cancel control.'
    });
  }
  await page.click('.export-cancel-btn');
}

async function checkDocsMap(page) {
  const route = 'docs-map#docs-map';
  await page.goto(`${ORIGIN}docs-map/#docs-map`, { waitUntil: 'networkidle' });
  const enabled = await page.waitForSelector('#docsMapRoot .docs-map-svg', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!enabled) {
    addFinding({
      route,
      selector: '#docsMapRoot',
      rule: 'docs-map-render',
      message: 'Docs map route did not render an SVG graph.',
      remediation: 'Ensure docsMap.enabled tenants render the docs-map section.'
    });
    return;
  }
  const state = await page.evaluate(() => ({
    controls: Array.from(document.querySelectorAll('#docsMapRoot .docs-map-control')).map((button) => button.textContent.trim() || button.getAttribute('aria-label') || ''),
    searchNamed: Boolean(document.querySelector('#docsMapRoot .docs-map-search input')?.getAttribute('aria-label') || document.querySelector('#docsMapRoot .docs-map-search label')),
    popupHidden: document.querySelector('#docsMapRoot .docs-map-popup')?.hidden ?? true
  }));
  if (state.controls.length >= 7 && state.controls.every(Boolean) && state.searchNamed && state.popupHidden) {
    pass(route, 'docs-map-keyboard-controls', `${state.controls.length} control(s)`);
  } else {
    addFinding({
      route,
      selector: '#docsMapRoot',
      rule: 'docs-map-keyboard-controls',
      message: `Docs map state ${JSON.stringify(state)}`,
      remediation: 'Docs map controls and search must have accessible names and start with the popup hidden.'
    });
  }
}

async function checkBlogPostNav(page) {
  const route = 'blog-demo#post-nav';
  await page.goto(`${ORIGIN}blog-demo/#posts/designing-for-living-scroll`, { waitUntil: 'networkidle' });
  const rendered = await page.waitForSelector('.bottom-nav--posts', { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!rendered) {
    addFinding({
      route,
      selector: '.bottom-nav--posts',
      rule: 'post-navigation',
      message: 'Post navigation did not render for a collection post.',
      remediation: 'Collection posts should render named previous/next/index navigation links.'
    });
    return;
  }
  const nav = await page.evaluate(() => ({
    links: Array.from(document.querySelectorAll('.bottom-nav--posts a')).map((link) => link.textContent.trim()),
    labelled: document.querySelector('.bottom-nav--posts')?.getAttribute('aria-label') || ''
  }));
  if (nav.links.length >= 2 && nav.links.every(Boolean)) {
    pass(route, 'post-navigation', `${nav.links.length} link(s)`);
  } else {
    addFinding({
      route,
      selector: '.bottom-nav--posts',
      rule: 'post-navigation',
      message: `Post nav state ${JSON.stringify(nav)}`,
      remediation: 'Post navigation must render named previous/next/index links.'
    });
  }
}

async function checkPageEffectsReducedMotion(page) {
  const route = 'page-effects#reduced-motion';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${ORIGIN}page-effects/`, { waitUntil: 'networkidle' });
  const state = await page.evaluate(() => ({
    heroes: document.querySelectorAll('.pe-hero').length,
    ctas: document.querySelectorAll('.pe-cta').length,
    readingProgress: document.querySelectorAll('.reading-progress').length,
    hiddenReveals: Array.from(document.querySelectorAll('[data-pe-reveal]')).filter((el) => {
      const style = getComputedStyle(el);
      return style.visibility === 'hidden' || style.opacity === '0';
    }).length
  }));
  if (state.heroes > 0 && state.ctas > 0 && state.hiddenReveals === 0) {
    pass(route, 'page-effects-reduced-motion', `${state.heroes} hero(s), ${state.ctas} CTA(s)`);
  } else {
    addFinding({
      route,
      selector: '.pe-hero',
      rule: 'page-effects-reduced-motion',
      message: `Page effects state ${JSON.stringify(state)}`,
      remediation: 'Reduced-motion mode must keep page-effect content visible and interactive.'
    });
  }
  await page.emulateMedia({ reducedMotion: null });
}

async function main() {
  const pw = await loadPlaywright();
  if (!pw) {
    const msg =
      'Playwright is not installed - skipping browser accessibility smoke.\n' +
      '  Enable it once with: npm i -D playwright && npx playwright install chromium';
    if (REQUIRE) {
      console.error(`FAIL ${msg}`);
      process.exit(1);
    }
    console.log(msg);
    process.exit(0);
  }

  await ensureBuilt();
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

    await scanRoute(page, 'pagenary', BASE);
    await scanRoute(page, 'docs-map', `${ORIGIN}docs-map/#docs-map`);
    await scanRoute(page, 'blog-demo', `${ORIGIN}blog-demo/`);
    await scanRoute(page, 'page-effects', `${ORIGIN}page-effects/`);

    await checkPrimaryNav(page);
    await checkCommandPalette(page);
    await checkExportControls(page);
    await checkDocsMap(page);
    await checkBlogPostNav(page);
    await checkPageEffectsReducedMotion(page);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }

  if (findings.length) {
    console.error(`\nBrowser accessibility smoke failed with ${findings.length} finding(s).`);
    process.exit(1);
  }
  console.log('\nBrowser accessibility smoke passed.');
}

main().catch((err) => {
  console.error(`Browser accessibility smoke crashed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
