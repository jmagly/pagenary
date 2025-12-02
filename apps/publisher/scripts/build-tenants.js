#!/usr/bin/env node
/* Build tenant-specific bundles with optional branding overrides */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const tenantsRoot = path.join(root, 'tenants');
const DEFAULT_CONTENT_DIR = 'content';
const TENANT_MANIFEST = 'manifest.json';

async function pathExists(target) {
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function runBuild(buildOutput) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join('scripts', 'build.js')], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, BUILD_OUTPUT: buildOutput }
    });
    proc.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Build failed for ${buildOutput} (exit ${code})`));
    });
    proc.on('error', reject);
  });
}

async function copyDirectory(from, to) {
  const entries = await fsp.readdir(from, { withFileTypes: true });
  await fsp.mkdir(to, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else if (entry.isFile()) {
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.copyFile(sourcePath, destPath);
    }
  }
}

async function applyBranding(distDir, config, tenantId) {
  const indexPath = path.join(distDir, 'index.html');
  if (!(await pathExists(indexPath))) return;
  let html = await fsp.readFile(indexPath, 'utf8');
  let mutated = false;

  if (config.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(config.title)}</title>`);
    mutated = true;
  }
  if (config.description) {
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(config.description)}" />`
    );
    mutated = true;
  }
  if (config.brandMark) {
    html = html.replace(
      /class="brand-mark">[^<]*</,
      `class="brand-mark">${escapeHtml(config.brandMark)}<`
    );
    mutated = true;
  }
  if (config.brandSub) {
    html = html.replace(
      /class="brand-sub">[^<]*</,
      `class="brand-sub">${escapeHtml(config.brandSub)}<`
    );
    mutated = true;
  }
  if (config.tagline) {
    html = html.replace(
      /<span>Reusable patterns for multi-tenant services\.<\/span>/,
      `<span>${escapeHtml(config.tagline)}</span>`
    );
    mutated = true;
  }

  if (mutated) {
    await fsp.writeFile(indexPath, html, 'utf8');
    console.log(`  ↳ applied branding to ${tenantId}`);
  }
}

async function applyAccent(distDir, config, tenantId) {
  if (!config.accentColor) return;
  const stylesPath = path.join(distDir, 'styles.css');
  if (!(await pathExists(stylesPath))) return;
  let css = await fsp.readFile(stylesPath, 'utf8');
  const updated = css.replace(/(--accent:\s*)([^;]+);/, `$1${config.accentColor};`);
  if (updated !== css) {
    await fsp.writeFile(stylesPath, updated, 'utf8');
    console.log(`  ↳ updated accent color for ${tenantId}`);
  }
}

function renderList(items, tag) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const lis = items.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n');
  return `<${tag}>\n${lis}\n      </${tag}>`;
}

function renderLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return '';
  const lis = links
    .map((link) => {
      if (!link || typeof link !== 'object') return '';
      const href = link.href ? escapeAttr(link.href) : '#';
      const label = escapeHtml(link.label || 'Link');
      return `        <li><a href="${href}">${label}</a></li>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<ul>\n${lis}\n      </ul>`;
}

async function applyWelcome(distDir, config, tenantId) {
  if (!config.welcome) return;
  const welcomePath = path.join(distDir, 'sections', 'welcome-overview.js');
  if (!(await pathExists(welcomePath))) return;
  const welcome = config.welcome;
  const eyebrow = escapeHtml(welcome.eyebrow || 'Welcome');
  const headline = escapeHtml(welcome.headline || 'Welcome');
  const lead = escapeHtml(welcome.lead || 'Tailor this intro per tenant.');
  const pillars = renderList(welcome.pillars, 'ul');
  const checklist = renderList(welcome.checklist, 'ol');
  const links = renderLinks(welcome.quickLinks);
  const quote = welcome.quote ? escapeHtml(welcome.quote) : null;

  const sections = [
    '  <div class="doc-content">',
    '    <header>',
    `      <p class="eyebrow">${eyebrow}</p>`,
    `      <h1>${headline}</h1>`,
    `      <p class="lead">${lead}</p>`,
    '    </header>'
  ];

  if (pillars) {
    sections.push('    <div>', '      <h2>Value pillars</h2>', `      ${pillars}`, '    </div>');
  }
  if (checklist) {
    sections.push('    <div>', '      <h2>Launch checklist</h2>', `      ${checklist}`, '    </div>');
  }
  if (links) {
    sections.push('    <aside>', '      <h3>Quick links</h3>', `      ${links}`, '    </aside>');
  }
  if (quote) {
    sections.push('    <blockquote>', `      <p>${quote}</p>`, '    </blockquote>');
  }
  sections.push('  </div>');

  const html = [
    '<section class="section doc" data-template="welcome">',
    ...sections,
    '</section>'
  ].join('\n');

  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.writeFile(welcomePath, moduleSource, 'utf8');
  console.log(`  ↳ customized welcome section for ${tenantId}`);
}

function parseInlineMarkdown(input) {
  if (!input) return '';
  let output = input.replace(/\r\n/g, '\n');
  // Links: [label](href)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  });
  // Bold: **text**
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: _text_
  output = output.replace(/_([^_]+)_/g, '<em>$1</em>');
  return escapeHtml(output)
    .replace(/&lt;strong&gt;([^]*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
    .replace(/&lt;em&gt;([^]*?)&lt;\/em&gt;/g, '<em>$1</em>')
    .replace(/&lt;a href=&quot;([^&]*)&quot;&gt;([^]*?)&lt;\/a&gt;/g, '<a href="$1">$2</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let inList = false;
  let inBlockquote = false;

  function closeList() {
    if (inList) {
      chunks.push('</ul>');
      inList = false;
    }
  }

  function openBlockquote() {
    if (!inBlockquote) {
      chunks.push('<blockquote>');
      inBlockquote = true;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      chunks.push('</blockquote>');
      inBlockquote = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      closeBlockquote();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = Math.min(headingMatch[1].length, 6);
      const text = parseInlineMarkdown(headingMatch[2].trim());
      chunks.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const listMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (listMatch) {
      closeBlockquote();
      if (!inList) {
        chunks.push('<ul>');
        inList = true;
      }
      const item = parseInlineMarkdown(listMatch[1].trim());
      chunks.push(`<li>${item}</li>`);
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      closeList();
      openBlockquote();
      const quoteLine = parseInlineMarkdown(quoteMatch[1]);
      chunks.push(`<p>${quoteLine}</p>`);
      continue;
    }

    closeList();
    closeBlockquote();
    const paragraph = parseInlineMarkdown(line);
    chunks.push(`<p>${paragraph}</p>`);
  }

  closeList();
  closeBlockquote();

  const body = chunks.join('\n');
  return `
<section class="section doc markdown">
  <div class="doc-content">
${body.split('\n').map((line) => (line ? `    ${line}` : '')).join('\n')}
  </div>
</section>
`.trim();
}

async function pruneSectionsDirectory(sectionsDir, keepFiles) {
  if (!(await pathExists(sectionsDir))) return;
  const entries = await fsp.readdir(sectionsDir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (keepFiles.has(entry.name)) return;
    const target = path.join(sectionsDir, entry.name);
    if (entry.isDirectory()) {
      await fsp.rm(target, { recursive: true, force: true });
    } else {
      await fsp.rm(target, { force: true });
    }
  }));
}

async function ensureHtmlModule(sourcePath, targetPath) {
  const html = await fsp.readFile(sourcePath, 'utf8');
  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, moduleSource, 'utf8');
}

async function ensureMarkdownModule(sourcePath, targetPath) {
  const raw = await fsp.readFile(sourcePath, 'utf8');
  const html = markdownToHtml(raw);
  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, moduleSource, 'utf8');
}

async function ensureJavascriptModule(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(sourcePath, targetPath);
}

async function processManifestEntries(entries, context) {
  const processed = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = entry.id;
    if (!id) {
      console.warn('  ↳ manifest entry missing id, skipping');
      continue;
    }
    const title = entry.title || id;
    const summary = entry.summary || '';
    if (Array.isArray(entry.sections) && entry.sections.length) {
      const subsections = await processManifestEntries(entry.sections, context);
      processed.push({ id, title, summary, subsections });
      continue;
    }

    const modulePath = await materializeSectionModule(entry, context);
    if (modulePath) {
      context.leafOrder.push(id);
      processed.push({ id, title, summary, module: modulePath });
    }
  }
  return processed;
}

async function materializeSectionModule(entry, context) {
  const id = entry.id;
  const relPath = entry.file || `${id}.md`;
  const sourcePath = path.join(context.contentDir, relPath);
  if (!(await pathExists(sourcePath))) {
    console.warn(`  ↳ ${context.tenantId}: missing content file ${relPath}`);
    return null;
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const outFile = `${id}.js`;
  const targetPath = path.join(context.sectionsDir, outFile);
  context.keepFiles.add(outFile);

  try {
    if (ext === '.md' || ext === '.markdown') {
      await ensureMarkdownModule(sourcePath, targetPath);
    } else if (ext === '.html' || ext === '.htm') {
      await ensureHtmlModule(sourcePath, targetPath);
    } else if (ext === '.js' || ext === '.mjs') {
      await ensureJavascriptModule(sourcePath, targetPath);
    } else {
      console.warn(`  ↳ ${context.tenantId}: unsupported extension ${ext} for ${relPath}`);
      return null;
    }
  } catch (err) {
    console.error(`  ↳ ${context.tenantId}: failed to generate module for ${relPath} (${err.message})`);
    return null;
  }

  return `./sections/${outFile}`;
}

function buildManifestModuleSource(manifestEntries, defaultSection) {
  const manifestJson = JSON.stringify(manifestEntries, null, 2);
  const defaultJson = JSON.stringify(defaultSection || null);
  return `export const MANIFEST = ${manifestJson};\nexport const DEFAULT_SECTION = ${defaultJson};\n\nconst SECTION_INDEX = new Map();\n\nfunction registerEntry(entry, parentId = null) {\n  if (parentId) entry.parentId = parentId;\n  SECTION_INDEX.set(entry.id, entry);\n  if (Array.isArray(entry.subsections)) {\n    entry.subsections.forEach((child) => registerEntry(child, entry.id));\n  }\n}\n\nMANIFEST.forEach((entry) => registerEntry(entry));\n\nexport function findSection(id) {\n  return SECTION_INDEX.get(id) || null;\n}\n`;
}

async function processTenantManifest(tenantDir, distDir, tenantId) {
  const manifestPath = path.join(tenantDir, TENANT_MANIFEST);
  if (!(await pathExists(manifestPath))) return;
  const contentDir = path.join(tenantDir, DEFAULT_CONTENT_DIR);
  if (!(await pathExists(contentDir))) {
    console.warn(`  ↳ ${tenantId}: manifest found but no content directory`);
    return;
  }

  let manifestData;
  try {
    const raw = await fsp.readFile(manifestPath, 'utf8');
    manifestData = JSON.parse(raw);
  } catch (err) {
    console.warn(`  ↳ ${tenantId}: unable to parse manifest.json (${err.message})`);
    return;
  }

  const entries = Array.isArray(manifestData) ? manifestData : manifestData.sections;
  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn(`  ↳ ${tenantId}: manifest has no sections`);
    return;
  }

  const sectionsDir = path.join(distDir, 'sections');
  const keepFiles = new Set(['section-templates.js']);
  await pruneSectionsDirectory(sectionsDir, keepFiles);

  const context = {
    contentDir,
    sectionsDir,
    tenantId,
    keepFiles,
    leafOrder: []
  };

  const processedManifest = await processManifestEntries(entries, context);
  if (!processedManifest.length) {
    console.warn(`  ↳ ${tenantId}: manifest did not produce any sections`);
    return;
  }

  const defaultSection = manifestData.default || manifestData.defaultSection || context.leafOrder[0];
  const manifestModule = buildManifestModuleSource(processedManifest, defaultSection);
  await fsp.writeFile(path.join(distDir, 'manifest.js'), manifestModule, 'utf8');
  console.log(`  ↳ applied manifest-driven content for ${tenantId}`);
}

async function buildTenant(tenantId) {
  const tenantDir = path.join(tenantsRoot, tenantId);
  const configPath = path.join(tenantDir, 'config.json');
  const overridesDir = path.join(tenantDir, 'overrides');
  let config = {};

  if (await pathExists(configPath)) {
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      config = JSON.parse(raw);
    } catch (err) {
      console.warn(`Skipping ${tenantId}: unable to parse config.json (${err.message})`);
      return;
    }
  }

  const buildOutput = path.join('dist', tenantId);
  console.log(`Building tenant ${tenantId} -> ${buildOutput}`);
  await runBuild(buildOutput);
  const distDir = path.join(root, 'dist', tenantId);

  await processTenantManifest(tenantDir, distDir, tenantId);

  if (Object.keys(config).length > 0) {
    await applyBranding(distDir, config, tenantId);
    await applyAccent(distDir, config, tenantId);
    await applyWelcome(distDir, config, tenantId);
  }

  if (await pathExists(overridesDir)) {
    await copyDirectory(overridesDir, distDir);
    console.log(`  ↳ applied file overrides for ${tenantId}`);
  }

  console.log(`Tenant ${tenantId} ready at ${buildOutput}`);
}

async function main() {
  if (!(await pathExists(tenantsRoot))) {
    console.log('No tenants directory found. Nothing to build.');
    return;
  }
  const entries = await fsp.readdir(tenantsRoot, { withFileTypes: true });
  const tenants = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (tenants.length === 0) {
    console.log('No tenant configurations detected.');
    return;
  }
  for (const tenantId of tenants) {
    // eslint-disable-next-line no-await-in-loop
    await buildTenant(tenantId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
