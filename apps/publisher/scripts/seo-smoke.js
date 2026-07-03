#!/usr/bin/env node
/**
 * SEO smoke checks for Docs Toolkit.
 * Verifies dist/index.html contains core metadata and that manifest entries
 * include summaries and modules for shareability.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

function fail(message) {
  console.error(`✖ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✔ ${message}`);
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function ensureFile(file, label) {
  if (fs.existsSync(file)) pass(`${label} present`);
  else fail(`${label} missing`);
}

function checkGeneratedSeoArtifacts(distDir, label = 'dist') {
  const robots = readIfExists(path.join(distDir, 'robots.txt'));
  if (robots) {
    pass(`${label}: robots.txt present`);
    if (/User-agent:\s*\*/i.test(robots)) pass(`${label}: robots.txt declares a user agent`);
    else fail(`${label}: robots.txt missing User-agent directive`);
    if (/Sitemap:/i.test(robots) && !fs.existsSync(path.join(distDir, 'sitemap.xml'))) {
      fail(`${label}: robots.txt advertises sitemap.xml but sitemap.xml is missing`);
    }
    if (/Content-Signal:/i.test(robots) && !/Content-Signal:\s*search=(yes|no),\s*ai-input=(yes|no),\s*ai-train=(yes|no)/i.test(robots)) {
      fail(`${label}: robots.txt Content-Signal directive is malformed`);
    }
  }

  const sitemap = readIfExists(path.join(distDir, 'sitemap.xml'));
  if (sitemap) {
    pass(`${label}: sitemap.xml present`);
    if (/<urlset\b/i.test(sitemap) && /<loc>[^<]+<\/loc>/i.test(sitemap)) pass(`${label}: sitemap.xml contains URL entries`);
    else fail(`${label}: sitemap.xml missing urlset/loc entries`);
  }

  const pagesDir = path.join(distDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs.readdirSync(pagesDir).filter((file) => file.endsWith('.html'));
    if (pageFiles.length) {
      pass(`${label}: static pages present (${pageFiles.length})`);
      const sample = fs.readFileSync(path.join(pagesDir, pageFiles[0]), 'utf8');
      if (/<link\s+rel="canonical"\s+href="[^"]*\/pages\/[^"]+\.html"/i.test(sample)) pass(`${label}: static page canonical points to /pages/`);
      else fail(`${label}: static page ${pageFiles[0]} missing /pages/ canonical`);
      if (/<meta\s+property="og:url"\s+content="[^"]*\/pages\/[^"]+\.html"/i.test(sample)) pass(`${label}: static page og:url points to /pages/`);
      else fail(`${label}: static page ${pageFiles[0]} missing /pages/ og:url`);
    }
  }

  if (fs.existsSync(path.join(distDir, 'content-index.json'))) {
    try {
      const index = JSON.parse(fs.readFileSync(path.join(distDir, 'content-index.json'), 'utf8'));
      if (Array.isArray(index.pages) && index.pages.length > 0) pass(`${label}: content-index.json parses with pages`);
      else fail(`${label}: content-index.json has no pages array`);
    } catch (err) {
      fail(`${label}: content-index.json is not parseable JSON: ${err.message}`);
    }
    ensureFile(path.join(distDir, 'documents.jsonl'), `${label}: documents.jsonl`);
  }

  if (fs.existsSync(path.join(distDir, 'documents.jsonl'))) {
    const lines = fs.readFileSync(path.join(distDir, 'documents.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
    for (const [index, line] of lines.entries()) {
      try {
        const doc = JSON.parse(line);
        if (!doc.id || !doc.title || !doc.bodyText) fail(`${label}: documents.jsonl line ${index + 1} missing id/title/bodyText`);
      } catch (err) {
        fail(`${label}: documents.jsonl line ${index + 1} is not parseable JSON: ${err.message}`);
      }
    }
    if (lines.length) pass(`${label}: documents.jsonl parses (${lines.length} records)`);
  }
}

if (!fs.existsSync(DIST)) {
  fail('dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

if (!fs.existsSync(INDEX)) {
  fail('dist/index.html missing. Build may have failed.');
  process.exit(1);
}

const html = fs.readFileSync(INDEX, 'utf8');

const requiredPatterns = [
  { label: 'Meta description', pattern: /<meta\s+name="description"\s+content="[^"]+"/i },
  { label: 'Viewport tag', pattern: /<meta\s+name="viewport"\s+content="[^"]+"/i },
  { label: 'Document title', pattern: /<title>\s*[^<]+\s*<\/title>/i },
  { label: 'Stylesheet link', pattern: /<link\s+rel="stylesheet"\s+href="\.[^"]*styles\.css"/i }
];

for (const { label, pattern } of requiredPatterns) {
  if (pattern.test(html)) pass(`${label} present`);
  else fail(`${label} missing in dist/index.html`);
}

checkGeneratedSeoArtifacts(DIST);
for (const entry of fs.readdirSync(DIST, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const tenantDist = path.join(DIST, entry.name);
  if (fs.existsSync(path.join(tenantDist, 'index.html'))) {
    checkGeneratedSeoArtifacts(tenantDist, `dist/${entry.name}`);
  }
}

async function loadManifest() {
  const manifestUrl = pathToFileURL(path.join(ROOT, 'src', 'manifest.js')).href;
  try {
    const mod = await import(manifestUrl);
    if (!mod || !Array.isArray(mod.MANIFEST)) {
      fail('Manifest did not export an array.');
      return [];
    }
    return mod.MANIFEST;
  } catch (err) {
    fail(`Failed to import manifest: ${err.message}`);
    return [];
  }
}

function ensureSummary(entity, label) {
  if (!entity.summary || !String(entity.summary).trim()) {
    fail(`${label} missing summary`);
  }
}

function ensureModule(entity, label) {
  if (!entity.module || !String(entity.module).trim()) {
    fail(`${label} missing module path`);
  }
}

(async function run() {
  const manifest = await loadManifest();
  if (!manifest.length) {
    fail('Manifest has no sections.');
    return;
  }
  pass(`Manifest contains ${manifest.length} top-level entr${manifest.length === 1 ? 'y' : 'ies'}`);

  manifest.forEach((section) => {
    ensureSummary(section, `Section "${section.title}"`);
    if (section.subsections && Array.isArray(section.subsections)) {
      section.subsections.forEach((subsection) => {
        ensureSummary(subsection, `Subsection "${subsection.title}"`);
        ensureModule(subsection, `Subsection "${subsection.title}"`);
      });
    } else {
      ensureModule(section, `Section "${section.title}"`);
    }
  });
})();
