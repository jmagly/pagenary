#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5197);
const base = `http://127.0.0.1:${port}/syntax-gallery/`;
const requireBrowser = process.argv.includes('--require') || process.env.SMOKE_REQUIRE === '1';
const browser = findBrowser();

if (!browser) {
  const message = 'Chrome/Chromium is unavailable; syntax-gallery browser smoke skipped.';
  if (requireBrowser) throw new Error(message);
  console.log(message);
  process.exit(0);
}

run(process.execPath, [
  'scripts/build-tenants.js', '--registry', 'examples/recipes.tenants.json', 'syntax-gallery'
]);

const server = spawn(process.execPath, ['scripts/serve.js', '--dev'], {
  cwd: packageRoot,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'ignore', 'inherit']
});

try {
  await waitForServer(base);
  const diagrams = dumpDom(`${base}#diagrams`);
  const math = dumpDom(`${base}#inline-latex`);
  const latexPage = dumpDom(`${base}#latex-page`);

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
  server.kill('SIGTERM');
}

function findBrowser() {
  for (const command of [process.env.CHROME_PATH, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return command;
  }
  return null;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: packageRoot, encoding: 'utf8', stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited ${result.status}`);
}

function dumpDom(url) {
  const result = spawnSync(browser, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--virtual-time-budget=8000', '--dump-dom', url
  ], { cwd: packageRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Browser failed for ${url}: ${result.stderr}`);
  return result.stdout;
}

function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() >= deadline) reject(new Error(`Server did not start at ${url}`));
        else setTimeout(poll, 150);
      });
    };
    poll();
  });
}

function count(value, pattern) {
  return [...String(value).matchAll(pattern)].length;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Browser assertion failed: ${message}`);
  console.log(`  PASS ${message}`);
}
