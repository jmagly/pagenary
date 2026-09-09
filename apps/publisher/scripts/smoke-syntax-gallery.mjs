#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { startPreviewServer, runManagedProcess, fetchWithDeadline } from './lib/process-lifecycle.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let base;
const requireBrowser = process.argv.includes('--require') || process.env.SMOKE_REQUIRE === '1';
const browser = findBrowser();

if (!browser) {
  const message = 'Chrome/Chromium is unavailable; syntax-gallery browser smoke skipped.';
  if (requireBrowser) throw new Error(message);
  console.log(message);
  process.exit(0);
}

await run(process.execPath, [
  'scripts/build-tenants.js', '--registry', 'examples/recipes.tenants.json', 'syntax-gallery'
]);

const server = await startPreviewServer('scripts/serve.js', { cwd: packageRoot });
base = `${server.origin}/syntax-gallery/`;

try {
  await waitForServer(base);
  const diagrams = await dumpDom(`${base}#diagrams`);
  const math = await dumpDom(`${base}#inline-latex`);
  const latexPage = await dumpDom(`${base}#latex-page`);

  assert(count(diagrams, /class="mermaid-content[^>]*>[\s\S]*?<svg\b/g) >= 5,
    'five representative Mermaid families render to SVG');
  assert(count(diagrams, /class="mermaid-diagram rich-diagram rich-diagram--mermaid(?:\s|")/g) >= 5
    && count(diagrams, /<figcaption id="mermaid-[^"]+-caption">/g) >= 5
    && count(diagrams, /<svg[^>]*role="img"[^>]*aria-labelledby="mermaid-[^"]+-caption"[^>]*>/g) >= 5,
  'Mermaid figures retain equivalent captions and accessible names');
  assert(count(diagrams, /<summary>Mermaid source<\/summary>/g) >= 5,
    'runtime Mermaid retains authored source fallbacks');
  assert(!/Syntax error in text|mermaid-error|data-render-error/i.test(diagrams),
    'Mermaid browser rendering has no syntax errors');
  assert(count(diagrams, /class="rich-content-fallback/g) >= 9,
    'optional PlantUML warning fallback preserves every source example');
  assert(/class="katex-mathml"/.test(math) && /class="katex-display"/.test(math),
    'inline and display LaTeX expose KaTeX MathML in a browser');
  assert(/class="section doc latex-page"/.test(latexPage),
    'the complete LaTeX source is the rendered page content');
  console.log('Syntax gallery browser smoke PASS');
} finally {
  await server.stop();
}

function findBrowser() {
  for (const command of [process.env.CHROME_PATH, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (probe.status === 0) return command;
  }
  return null;
}

async function run(command, args, cwd = packageRoot) {
  const result = await runManagedProcess(command, args, { cwd }, 1_200_000);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.code !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.code ?? result.signal}`);
}

async function dumpDom(url) {
  const result = await runManagedProcess(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=8000', '--dump-dom', url
  ], { cwd: packageRoot }, 45_000);
  if (result.code !== 0) throw new Error(`Browser failed for ${url}: ${result.stderr}`);
  return result.stdout;
}

async function waitForServer(url) {
  const response = await fetchWithDeadline(url);
  if (!response.ok) throw new Error(`Owned preview server returned HTTP ${response.status} at ${url}`);
  await response.arrayBuffer();
}

function count(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Browser assertion failed: ${message}`);
  console.log(`  PASS ${message}`);
}
