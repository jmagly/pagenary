#!/usr/bin/env node
/* Build tenant-specific bundles with optional branding overrides */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const root = process.cwd();
const DEFAULT_TENANTS_DIR = path.join(root, 'tenants');
const DEFAULT_DIST_DIR = path.join(root, 'dist');
const DEFAULT_REGISTRY_PATH = path.join(root, 'tenants.json');
const DEFAULT_CONTENT_DIR = 'content';
const TENANT_MANIFEST = 'manifest.json';

/**
 * Parse CLI arguments
 * Usage: node build-tenants.js [tenant1 tenant2 ...] [options]
 *
 * Options:
 *   --registry, -r   Path to tenant registry JSON file
 *   --target, -t     Override target directory for all tenants
 *   --list, -l       List available tenants
 *   --help, -h       Show help
 *
 * Examples:
 *   node build-tenants.js                          # Build all tenants
 *   node build-tenants.js tenant-alpha             # Build only tenant-alpha
 *   node build-tenants.js --registry /etc/tenants.json  # Use external registry
 *   node build-tenants.js --target /var/www        # Override target for all
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    tenants: [],
    registry: null,
    target: null,
    list: false,
    help: false
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--target' || arg === '-t') {
      result.target = args[i + 1];
      if (!result.target) {
        console.error('Error: --target requires a path argument');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--registry' || arg === '-r') {
      result.registry = args[i + 1];
      if (!result.registry) {
        console.error('Error: --registry requires a path argument');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--list' || arg === '-l') {
      result.list = true;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
    } else if (arg.startsWith('-')) {
      console.error(`Error: Unknown option ${arg}`);
      process.exit(1);
    } else {
      result.tenants.push(arg);
      i++;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage: node build-tenants.js [tenant...] [options]

Build tenant-specific documentation bundles.

Arguments:
  tenant              One or more tenant IDs to build (default: all tenants)

Options:
  -r, --registry      Path to tenant registry JSON file (default: tenants.json)
  -t, --target        Override target directory for all tenants
  -l, --list          List available tenants and exit
  -h, --help          Show this help message

Registry Format (tenants.json):
  {
    "tenants": [
      {
        "id": "tenant-alpha",
        "enabled": true,
        "source": { "type": "local", "path": "/path/to/source" },
        "target": { "type": "local", "path": "/path/to/target" },
        "domains": ["alpha.example.com"],
        "config": { "title": "Alpha Docs" }
      }
    ],
    "defaults": {
      "source": { "type": "local", "path": "./tenants" },
      "target": { "type": "local", "path": "./dist" }
    }
  }

Fallback Behavior:
  If no registry is found, scans ./tenants/ directory for tenant folders.
  Source defaults to ./tenants/<id>/, target defaults to ./dist/<id>/

Examples:
  node build-tenants.js                              Build all tenants
  node build-tenants.js tenant-alpha                 Build only tenant-alpha
  node build-tenants.js --registry /etc/tenants.json Use external registry
  node build-tenants.js tenant-alpha -t /var/www     Build one, override target
  node build-tenants.js --list                       Show available tenants
`);
}

async function pathExists(target) {
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Expand environment variables in a path string
 * Supports $VAR and ${VAR} syntax
 */
function expandEnvVars(pathStr) {
  if (!pathStr) return pathStr;
  return pathStr
    .replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '')
    .replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name) => process.env[name] || '');
}

/**
 * Resolve a path relative to publisher root, expanding env vars
 */
function resolvePath(pathStr, base = root) {
  if (!pathStr) return null;
  const expanded = expandEnvVars(pathStr);
  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  return path.resolve(base, expanded);
}

/**
 * Load tenant registry from JSON file or fall back to directory scan
 */
async function loadRegistry(registryPath) {
  const effectivePath = registryPath || process.env.TENANT_REGISTRY || DEFAULT_REGISTRY_PATH;

  // Try to load registry file
  if (await pathExists(effectivePath)) {
    try {
      const raw = await fsp.readFile(effectivePath, 'utf8');
      const registry = JSON.parse(raw);
      console.log(`Loaded registry from ${effectivePath}`);
      return normalizeRegistry(registry);
    } catch (err) {
      console.error(`Error loading registry ${effectivePath}: ${err.message}`);
      process.exit(1);
    }
  }

  // Fall back to scanning tenants/ directory
  if (await pathExists(DEFAULT_TENANTS_DIR)) {
    console.log('No registry found, scanning tenants/ directory...');
    return await scanTenantsDirectory();
  }

  // No registry and no tenants directory
  return { tenants: [], defaults: getDefaultConfig() };
}

/**
 * Get default source/target configuration
 */
function getDefaultConfig() {
  return {
    source: { type: 'local', path: './tenants' },
    target: { type: 'local', path: './dist' }
  };
}

/**
 * Normalize registry structure and apply defaults
 */
function normalizeRegistry(registry) {
  const defaults = { ...getDefaultConfig(), ...(registry.defaults || {}) };
  const tenants = (registry.tenants || []).map(tenant => normalizeTenant(tenant, defaults));
  return { tenants, defaults };
}

/**
 * Normalize a single tenant entry with defaults
 */
function normalizeTenant(tenant, defaults) {
  const id = tenant.id;
  if (!id) {
    throw new Error('Tenant entry missing required "id" field');
  }

  // Source resolution
  let source = tenant.source || {};
  if (!source.path) {
    // Default source path: <defaults.source.path>/<id>/
    const basePath = defaults.source?.path || './tenants';
    source = { type: 'local', path: path.join(basePath, id) };
  }
  source.type = source.type || 'local';
  source.resolvedPath = resolvePath(source.path);

  // Target resolution
  let target = tenant.target || {};
  if (!target.path) {
    // Default target path: <defaults.target.path>/<id>/
    const basePath = defaults.target?.path || './dist';
    target = { type: 'local', path: path.join(basePath, id) };
  }
  target.type = target.type || 'local';
  target.resolvedPath = resolvePath(target.path);

  return {
    id,
    enabled: tenant.enabled !== false,
    source,
    target,
    domains: tenant.domains || [],
    config: tenant.config || {}
  };
}

/**
 * Scan tenants/ directory and create registry entries for each subdirectory
 */
async function scanTenantsDirectory() {
  const defaults = getDefaultConfig();
  const entries = await fsp.readdir(DEFAULT_TENANTS_DIR, { withFileTypes: true });
  const tenants = entries
    .filter(entry => entry.isDirectory())
    .map(entry => normalizeTenant({ id: entry.name }, defaults));

  return { tenants, defaults };
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

async function processTenantManifest(sourceDir, distDir, tenantId) {
  const manifestPath = path.join(sourceDir, TENANT_MANIFEST);
  if (!(await pathExists(manifestPath))) return;
  const contentDir = path.join(sourceDir, DEFAULT_CONTENT_DIR);
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

/**
 * Build a single tenant using registry entry
 */
async function buildTenant(tenant, targetOverride) {
  const tenantId = tenant.id;
  const sourceDir = tenant.source.resolvedPath;
  const targetDir = targetOverride
    ? path.join(resolvePath(targetOverride), tenantId)
    : tenant.target.resolvedPath;

  // Validate source exists
  if (!(await pathExists(sourceDir))) {
    console.warn(`Skipping ${tenantId}: source directory not found at ${sourceDir}`);
    return false;
  }

  // Load config from registry or source directory
  let config = { ...tenant.config };
  const configPath = path.join(sourceDir, 'config.json');
  if (await pathExists(configPath)) {
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      const fileConfig = JSON.parse(raw);
      // Registry config takes precedence over file config
      config = { ...fileConfig, ...config };
    } catch (err) {
      console.warn(`  ↳ ${tenantId}: unable to parse config.json (${err.message})`);
    }
  }

  // Build to a temporary location in dist/ first, then copy to target
  const buildOutput = path.join('dist', tenantId);
  const distDir = path.join(root, 'dist', tenantId);

  console.log(`Building tenant ${tenantId}`);
  console.log(`  source: ${sourceDir}`);
  console.log(`  target: ${targetDir}`);

  await runBuild(buildOutput);

  // Process manifest from source directory
  await processTenantManifest(sourceDir, distDir, tenantId);

  // Apply branding and config
  if (Object.keys(config).length > 0) {
    await applyBranding(distDir, config, tenantId);
    await applyAccent(distDir, config, tenantId);
    await applyWelcome(distDir, config, tenantId);
  }

  // Apply file overrides from source
  const overridesDir = path.join(sourceDir, 'overrides');
  if (await pathExists(overridesDir)) {
    await copyDirectory(overridesDir, distDir);
    console.log(`  ↳ applied file overrides for ${tenantId}`);
  }

  // Copy to final target if different from dist
  if (targetDir !== distDir) {
    // Ensure target parent exists
    await fsp.mkdir(path.dirname(targetDir), { recursive: true });

    // Remove existing target if it exists
    if (await pathExists(targetDir)) {
      await fsp.rm(targetDir, { recursive: true, force: true });
    }

    await copyDirectory(distDir, targetDir);
    console.log(`  ↳ deployed to ${targetDir}`);
  }

  console.log(`Tenant ${tenantId} ready`);
  return true;
}

async function main() {
  const args = parseArgs(process.argv);

  // Handle --help
  if (args.help) {
    printHelp();
    return;
  }

  // Load registry
  const registry = await loadRegistry(args.registry);

  // Handle --list
  if (args.list) {
    if (registry.tenants.length === 0) {
      console.log('No tenants found.');
    } else {
      console.log('Available tenants:');
      registry.tenants.forEach((t) => {
        const status = t.enabled ? '' : ' (disabled)';
        console.log(`  - ${t.id}${status}`);
        console.log(`      source: ${t.source.resolvedPath}`);
        console.log(`      target: ${t.target.resolvedPath}`);
        if (t.domains.length > 0) {
          console.log(`      domains: ${t.domains.join(', ')}`);
        }
      });
    }
    return;
  }

  if (registry.tenants.length === 0) {
    console.log('No tenant configurations detected.');
    return;
  }

  // Determine which tenants to build
  let tenantsToBuild = registry.tenants.filter(t => t.enabled);
  if (args.tenants.length > 0) {
    const allIds = registry.tenants.map(t => t.id);
    const invalid = args.tenants.filter(t => !allIds.includes(t));
    if (invalid.length > 0) {
      console.error(`Error: Unknown tenant(s): ${invalid.join(', ')}`);
      console.error(`Available tenants: ${allIds.join(', ')}`);
      process.exit(1);
    }
    tenantsToBuild = registry.tenants.filter(t => args.tenants.includes(t.id));
  }

  if (tenantsToBuild.length === 0) {
    console.log('No tenants to build (all may be disabled).');
    return;
  }

  // Validate target override if specified
  if (args.target) {
    const targetPath = resolvePath(args.target);
    const targetParent = path.dirname(targetPath);
    if (!(await pathExists(targetParent))) {
      console.error(`Error: Target parent directory does not exist: ${targetParent}`);
      process.exit(1);
    }
    if (!(await pathExists(targetPath))) {
      await fsp.mkdir(targetPath, { recursive: true });
      console.log(`Created target directory: ${targetPath}`);
    }
  }

  // Build tenants
  const tenantIds = tenantsToBuild.map(t => t.id);
  console.log(`Building ${tenantsToBuild.length} tenant(s): ${tenantIds.join(', ')}`);
  console.log('');

  let successCount = 0;
  let failCount = 0;

  for (const tenant of tenantsToBuild) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const success = await buildTenant(tenant, args.target);
      if (success) successCount++;
      else failCount++;
    } catch (err) {
      console.error(`Error building ${tenant.id}: ${err.message}`);
      failCount++;
    }
    console.log('');
  }

  console.log(`Build complete. Success: ${successCount}, Failed: ${failCount}`);
  if (args.target) {
    console.log(`Tenant files deployed to: ${resolvePath(args.target)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
