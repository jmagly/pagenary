/**
 * Tests for build-tenants.js - Multi-tenant bundle generation
 *
 * Tests cover:
 * - Tenant discovery from tenants/ directory
 * - Manifest parsing and validation
 * - Content conversion (Markdown, HTML, JS)
 * - Per-tenant bundle isolation
 * - Branding application
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');
const BUILD_TENANTS_SCRIPT = path.join(PUBLISHER_ROOT, 'scripts', 'build-tenants.js');
const DEFAULT_REGISTRY_PATH = path.join(PUBLISHER_ROOT, 'tenants.json');
const TEST_REGISTRY_PATH = path.join(PUBLISHER_ROOT, '__test-tenants.json');

// Helper to run build-tenants script
function runBuildTenants(args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [BUILD_TENANTS_SCRIPT, ...args], {
      cwd: PUBLISHER_ROOT,
      env: { ...process.env, ...env },
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data; });
    proc.stderr.on('data', (data) => { stderr += data; });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', reject);
  });
}

// Helper to run build-tenants with a custom test registry
async function runBuildTenantsWithRegistry(tenants, args = [], env = {}) {
  // Create a test registry with the specified tenants
  const registry = {
    "$schema": "./tenants.schema.json",
    "defaults": {
      "source": { "type": "local", "path": "./tenants" },
      "target": { "type": "local", "path": "./dist" }
    },
    "tenants": tenants
  };
  await fsp.writeFile(TEST_REGISTRY_PATH, JSON.stringify(registry, null, 2));

  try {
    return await runBuildTenants(['-r', TEST_REGISTRY_PATH, ...args], env);
  } finally {
    // Clean up test registry
    if (fs.existsSync(TEST_REGISTRY_PATH)) {
      await fsp.rm(TEST_REGISTRY_PATH);
    }
  }
}

// Helper to create a test tenant
async function createTestTenant(tenantId, config = {}, manifest = null, content = {}) {
  const tenantDir = path.join(PUBLISHER_ROOT, 'tenants', tenantId);
  await fsp.mkdir(tenantDir, { recursive: true });

  // Write config.json
  if (Object.keys(config).length > 0) {
    await fsp.writeFile(
      path.join(tenantDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  // Write manifest.json
  if (manifest) {
    await fsp.writeFile(
      path.join(tenantDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create content directory and files
    const contentDir = path.join(tenantDir, 'content');
    await fsp.mkdir(contentDir, { recursive: true });

    for (const [filename, fileContent] of Object.entries(content)) {
      const target = path.join(contentDir, filename);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, fileContent);
    }
  }

  return tenantDir;
}

// Cleanup helper
async function cleanup(dir) {
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

function extractShellAsset(html, attr, prefix) {
  const re = new RegExp(`${attr}="\\.\\/(${prefix}\\.[^"]+)"`);
  const match = html.match(re);
  return match ? match[1] : null;
}

async function readRuntimeManifest(distDir) {
  const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
  const appFile = extractShellAsset(index, 'src', 'app');
  const app = await fsp.readFile(path.join(distDir, appFile || 'app.js'), 'utf8');
  const manifestMatch = app.match(/from"\.\/(manifest\.[a-f0-9]+\.js)"/) ||
    app.match(/from ['"]\.\/(manifest\.[a-f0-9]+\.js)['"]/);
  const manifestFile = manifestMatch ? manifestMatch[1] : 'manifest.js';
  return {
    index,
    appFile,
    manifestFile,
    manifestJs: await fsp.readFile(path.join(distDir, manifestFile), 'utf8')
  };
}

function extractManifestArray(manifestJs) {
  const match = manifestJs.match(/export const MANIFEST\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!match) return [];
  return JSON.parse(match[1]);
}

function flattenModules(entries, out = new Map()) {
  for (const entry of entries || []) {
    if (entry?.id && entry.module) out.set(entry.id, entry.module);
    flattenModules(entry?.subsections || entry?.sections, out);
  }
  return out;
}

function hashedRuntimeFiles(distDir) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile()) {
        const rel = path.relative(distDir, abs).split(path.sep).join('/');
        if (/[a-f0-9]{12}\.[a-z0-9]+$/i.test(rel)) files.push(rel);
      }
    }
  }
  walk(distDir);
  return files.sort();
}

async function expectFilenameHashMatches(distDir, relPath) {
  const match = path.basename(relPath).match(/\.([a-f0-9]{12})\.[^.]+$/);
  expect(match).not.toBeNull();
  const data = await fsp.readFile(path.join(distDir, relPath));
  const actual = createHash('sha256').update(data).digest('hex').slice(0, 12);
  expect(actual).toBe(match[1]);
}

describe('build-tenants.js', () => {
  describe('existing tenants', () => {
    // Use a test registry with only local tenants to avoid git clone delays
    const LOCAL_TENANTS = [{ id: 'tenant-alpha' }, { id: 'tenant-beta' }];

    test('builds existing sample tenants successfully', async () => {
      const result = await runBuildTenantsWithRegistry(LOCAL_TENANTS);

      expect(result.code).toBe(0);
      // Should find tenant-alpha and tenant-beta
      expect(result.stdout).toMatch(/tenant-alpha/);
      expect(result.stdout).toMatch(/tenant-beta/);
    });

    test('creates separate dist directories for each tenant', async () => {
      await runBuildTenantsWithRegistry(LOCAL_TENANTS);

      const alphaDir = path.join(PUBLISHER_ROOT, 'dist', 'tenant-alpha');
      const betaDir = path.join(PUBLISHER_ROOT, 'dist', 'tenant-beta');

      expect(fs.existsSync(alphaDir)).toBe(true);
      expect(fs.existsSync(betaDir)).toBe(true);
    });

    test('each tenant bundle has index.html', async () => {
      await runBuildTenantsWithRegistry(LOCAL_TENANTS);

      const alphaIndex = path.join(PUBLISHER_ROOT, 'dist', 'tenant-alpha', 'index.html');
      const betaIndex = path.join(PUBLISHER_ROOT, 'dist', 'tenant-beta', 'index.html');

      expect(fs.existsSync(alphaIndex)).toBe(true);
      expect(fs.existsSync(betaIndex)).toBe(true);
    });
  });

  describe('tenant isolation', () => {
    const LOCAL_TENANTS = [{ id: 'tenant-alpha' }, { id: 'tenant-beta' }];

    test('tenant bundles are independent', async () => {
      await runBuildTenantsWithRegistry(LOCAL_TENANTS);

      const alphaDir = path.join(PUBLISHER_ROOT, 'dist', 'tenant-alpha');
      const betaDir = path.join(PUBLISHER_ROOT, 'dist', 'tenant-beta');

      // Each should have its own manifest.js
      const alphaManifest = path.join(alphaDir, 'manifest.js');
      const betaManifest = path.join(betaDir, 'manifest.js');

      expect(fs.existsSync(alphaManifest)).toBe(true);
      expect(fs.existsSync(betaManifest)).toBe(true);

      // Content should be different
      const alphaContent = await fsp.readFile(alphaManifest, 'utf8');
      const betaContent = await fsp.readFile(betaManifest, 'utf8');

      // Both should have MANIFEST export
      expect(alphaContent).toMatch(/export const MANIFEST/);
      expect(betaContent).toMatch(/export const MANIFEST/);
    });
  });

  describe('custom tenant creation', () => {
    const TEST_TENANT_ID = '__test-tenant-' + Date.now();
    let testTenantDir;

    afterEach(async () => {
      // Clean up test tenant
      if (testTenantDir) {
        await cleanup(testTenantDir);
      }
      // Clean up dist
      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      await cleanup(distDir);
    });

    test('builds tenant with minimal config', async () => {
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {
        title: 'Test Tenant'
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(new RegExp(TEST_TENANT_ID));
    });

    test('applies branding from config.json', async () => {
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {
        title: 'Custom Test Title',
        brandMark: 'TestBrand'
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const distIndex = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'index.html');
      const content = await fsp.readFile(distIndex, 'utf8');

      expect(content).toMatch(/Custom Test Title/);
    });

    test('processes markdown content files', async () => {
      const manifest = {
        sections: [
          { id: 'test-section', title: 'Test Section', file: 'test.md' }
        ]
      };

      const content = {
        'test.md': '# Hello World\n\nThis is a test.'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      // Check that section was created
      const sectionFile = path.join(
        PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'sections', 'test-section.js'
      );
      expect(fs.existsSync(sectionFile)).toBe(true);

      // Check content was converted
      const sectionContent = await fsp.readFile(sectionFile, 'utf8');
      expect(sectionContent).toMatch(/Hello World/);
      // Headings now have auto-generated IDs (ADR-011)
      expect(sectionContent).toMatch(/h1 id=/);
    });

    test('preserves responsive image media markup in static snapshots', async () => {
      const manifest = {
        sections: [
          { id: 'gallery', title: 'Gallery', file: 'gallery.md' }
        ]
      };
      const content = {
        'gallery.md': [
          '# Gallery',
          '',
          '```media',
          'type: image',
          'src: assets/default.jpg',
          'portrait: assets/portrait.jpg',
          'landscape: assets/landscape.jpg',
          'alt: Product view',
          '```'
        ].join('\n')
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const sectionContent = await fsp.readFile(path.join(
        PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'sections', 'gallery.js'
      ), 'utf8');
      expect(sectionContent).toContain('<picture>');
      expect(sectionContent).toContain('srcset=\\"assets/portrait.jpg\\"');
      expect(sectionContent).toContain('srcset=\\"assets/landscape.jpg\\"');

      const staticHtml = await fsp.readFile(path.join(
        PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'pages', 'gallery.html'
      ), 'utf8');
      expect(staticHtml).toContain('<picture>');
      expect(staticHtml).toContain('srcset="assets/portrait.jpg"');
      expect(staticHtml).toContain('srcset="assets/landscape.jpg"');
      expect(staticHtml).toContain('<img src="assets/default.jpg" alt="Product view" loading="lazy">');
    });

    test('emits a Fortemi search index with full body text extracted', async () => {
      const manifest = {
        sections: [
          { id: 'searchable', title: 'Searchable', file: 'searchable.md' }
        ]
      };
      const content = {
        'searchable.md': '# Searchable\n\nThe quick brown fox jumps over the lazy dog.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const indexDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'search-index');
      const manifestJson = JSON.parse(await fsp.readFile(path.join(indexDir, 'manifest.json'), 'utf8'));
      expect(manifestJson.schema_version).toBe('aiwg.fortemi.index.chunk-manifest.v1');
      expect(manifestJson.total).toBeGreaterThanOrEqual(1);
      expect(manifestJson.source.build_hash).toMatch(/^[0-9a-f]{16}$/);

      // The real spawned build imports the section module and extracts body text
      // (not just title/summary) — verify the page body made it into the index.
      const part = JSON.parse(await fsp.readFile(path.join(indexDir, manifestJson.parts[0].href), 'utf8'));
      const record = part.items.find((item) => item.id === 'docs:page:searchable');
      expect(record).toBeTruthy();
      expect(record.text).toMatch(/quick brown fox jumps over the lazy dog/);
    });

    test('embeds default page HTML in the root shell for no-JS fallback', async () => {
      const manifest = {
        default: 'fallback-page',
        sections: [
          {
            id: 'guides',
            title: 'Guides',
            sections: [
              { id: 'fallback-page', title: 'Fallback Page', file: 'fallback.md' },
              { id: 'nested/deep-page', title: 'Deep Page', file: 'nested/deep-page.md' }
            ]
          }
        ]
      };
      const content = {
        'fallback.md': '# Fallback Page\n\nRoot HTML fallback body. [Deep](#nested/deep-page) [Local](#local-anchor) [External](https://example.com).',
        'nested/deep-page.md': '# Deep Page\n\nNested static page.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const index = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'index.html'), 'utf8');
      expect(index).toMatch(/<main id="app" class="canvas" tabindex="-1" aria-live="polite"><section class="section doc markdown">/);
      expect(index).toContain('Fallback Page');
      expect(index).toContain('Root HTML fallback body.');
      expect(index).toContain('href="./pages/nested--deep-page.html"');
      expect(index).toContain('href="#local-anchor"');
      expect(index).toContain('href="https://example.com"');
      expect(index).toContain('<nav id="nav" class="nav nav-static-fallback" aria-label="Primary">');
      expect(index).toMatch(/<div class="nav-group expanded">/);
      expect(index).toContain('href="./pages/fallback-page.html"');
      expect(index).toContain('href="./pages/nested--deep-page.html"');
      expect(index).toMatch(/<script type="module" src="\.\/app\.[a-f0-9]+\.js"><\/script>/);
    });

    test('embeds root fallback into tenant shell variants and emits root SEO metadata', async () => {
      const manifest = {
        default: 'welcome',
        sections: [
          {
            id: 'welcome',
            title: 'Welcome',
            summary: 'Start here with the published docs.',
            file: 'welcome.md'
          }
        ]
      };
      const content = {
        'welcome.md': '# Welcome\n\nVariant shell fallback body.'
      };
      testTenantDir = await createTestTenant(
        TEST_TENANT_ID,
        {
          title: 'Variant Docs',
          description: 'Generic site description.',
          domain: 'docs.example.com',
          seo: { ogImage: '/social.png' }
        },
        manifest,
        content
      );
      const overridesDir = path.join(testTenantDir, 'overrides');
      await fsp.mkdir(overridesDir, { recursive: true });
      await fsp.writeFile(path.join(overridesDir, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Override Shell</title>
    <meta name="description" content="Override description." />
    <script>var t = "__PAGENARY_TENANT__"; var configuredBase = "__PAGENARY_BASE_PATH__";</script>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <nav id="nav" class="nav" aria-label="Primary"></nav>
    <main id="app" class="main-panel" tabindex="-1" aria-live="polite"></main>
    <script type="module" src="./app.js"></script>
  </body>
</html>
`);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const index = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'index.html'), 'utf8');
      expect(index).toMatch(/<main id="app" class="main-panel" tabindex="-1" aria-live="polite"><section class="section doc markdown">/);
      expect(index).toContain('Variant shell fallback body.');
      expect(index).toContain('<title>Welcome · Variant Docs</title>');
      expect(index).toContain('<meta name="description" content="Start here with the published docs." />');
      expect(index).toContain('<link rel="canonical" href="https://docs.example.com/" />');
      expect(index).toContain('<meta property="og:title" content="Welcome · Variant Docs" />');
      expect(index).toContain('<meta property="og:description" content="Start here with the published docs." />');
      expect(index).toContain('<meta property="og:type" content="website" />');
      expect(index).toContain('<meta property="og:url" content="https://docs.example.com/" />');
      expect(index).toContain('<meta property="og:image" content="https://docs.example.com/social.png" />');
      expect(index).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(index).toContain('<meta name="twitter:title" content="Welcome · Variant Docs" />');
      expect(index).toContain('<meta name="twitter:description" content="Start here with the published docs." />');
      expect(index).toContain('<meta name="twitter:image" content="https://docs.example.com/social.png" />');
    });

    test('can disable the root shell HTML fallback per tenant', async () => {
      const manifest = {
        default: 'fallback-page',
        sections: [
          { id: 'fallback-page', title: 'Fallback Page', file: 'fallback.md' }
        ]
      };
      const content = {
        'fallback.md': '# Fallback Page\n\nRoot HTML fallback body.'
      };
      testTenantDir = await createTestTenant(
        TEST_TENANT_ID,
        { seo: { rootHtmlFallback: false } },
        manifest,
        content
      );

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const index = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'index.html'), 'utf8');
      expect(index).toMatch(/<main id="app" class="canvas" tabindex="-1" aria-live="polite"><\/main>/);
      expect(index).toMatch(/<nav id="nav" class="nav" aria-label="Primary"><\/nav>/);
      expect(index).not.toContain('nav-static-fallback');
      expect(index).not.toContain('Root HTML fallback body.');
    });

    test('emits base-relative shell + module URLs resolved via the tenant base', async () => {
      const manifest = {
        sections: [
          { id: 'blog/post', title: 'Post', file: 'blog/post.md' }
        ]
      };

      const content = {
        'blog/post.md': '# Post\n\nNested route content.'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const { index, appFile, manifestFile, manifestJs } = await readRuntimeManifest(distDir);
      const cssFile = extractShellAsset(index, 'href', 'styles');

      // Shell assets are base-relative (resolve against the runtime <base href>),
      // which works for both domain-root (base "/") and subpath (base "/<tenant>/").
      expect(cssFile).toMatch(/^styles\.[a-f0-9]{12}\.css$/);
      expect(appFile).toMatch(/^app\.[a-f0-9]{12}\.js$/);
      expect(manifestFile).toMatch(/^manifest\.[a-f0-9]{12}\.js$/);
      // The base-resolution bootstrap is wired with this tenant id.
      expect(index).toContain("document.write('<base");
      expect(index).toContain(`var t = "${TEST_TENANT_ID}"`);
      // Module paths are relative so dynamic import() resolves against app.js's
      // (base-resolved) URL.
      expect(manifestJs).toMatch(/"module": "\.\/sections\/blog--post\.[a-f0-9]{12}\.js"/);
      expect(manifestJs).not.toContain('"module": "/sections/');
    });

    test('contentHash is the default cache strategy and stable mode is an explicit opt-out', async () => {
      const manifest = {
        sections: [
          { id: 'home', title: 'Home', file: 'home.md' }
        ]
      };
      const content = { 'home.md': '# Home\n\nDefault cache strategy.' };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);
      let result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      let distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      let runtime = await readRuntimeManifest(distDir);
      const cssFile = extractShellAsset(runtime.index, 'href', 'styles');
      const modules = flattenModules(extractManifestArray(runtime.manifestJs));
      expect(runtime.index).toMatch(/src="\.\/app\.[a-f0-9]{12}\.js"/);
      expect(runtime.index).toMatch(/href="\.\/styles\.[a-f0-9]{12}\.css"/);
      expect(runtime.manifestJs).toMatch(/"\.\/sections\/home\.[a-f0-9]{12}\.js"/);
      await expectFilenameHashMatches(distDir, runtime.appFile);
      await expectFilenameHashMatches(distDir, runtime.manifestFile);
      await expectFilenameHashMatches(distDir, cssFile);
      await expectFilenameHashMatches(distDir, modules.get('home').replace(/^\.\//, ''));

      await cleanup(testTenantDir);
      await cleanup(distDir);

      testTenantDir = await createTestTenant(TEST_TENANT_ID, { cacheStrategy: 'stable' }, manifest, content);
      result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      runtime = await readRuntimeManifest(distDir);
      expect(runtime.index).toContain('src="./app.js"');
      expect(runtime.index).toContain('href="./styles.css"');
      expect(runtime.manifestJs).toContain('"module": "./sections/home.js"');
    });

    test('explicit basePath decouples public mount from tenant id (#61)', async () => {
      const manifest = {
        sections: [
          { id: 'home', title: 'Home', file: 'home.md' }
        ]
      };
      const content = { 'home.md': '# Home\n\nMounted away from tenant id.' };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);
      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID, basePath: 'react' }]);
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      expect(index).toContain(`var t = "${TEST_TENANT_ID}"`);
      expect(index).toContain('var configuredBase = "/react/"');
      expect(index).toContain('var explicitBase = configuredBase && configuredBase.charAt(0) === "/" ? configuredBase : ""');
      expect(index).toContain('var autoBase = p.endsWith("/") ? p : p.slice(0, p.lastIndexOf("/") + 1)');
      expect(index).toContain('var base = explicitBase || autoBase || "/"');
    });

    test('build-time --base overrides committed tenant basePath (#107)', async () => {
      const manifest = {
        sections: [
          { id: 'home', title: 'Home', file: 'home.md' }
        ]
      };
      const content = { 'home.md': '# Home\n\nLaunch-specific mount.' };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);
      const result = await runBuildTenantsWithRegistry(
        [{ id: TEST_TENANT_ID, basePath: '/committed' }],
        ['--base', '/server']
      );
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      expect(index).toContain('var configuredBase = "/server/"');
      expect(index).not.toContain('var configuredBase = "/committed/"');
    });

    test('PAGENARY_BASE=auto omits explicit base for portable mount auto-detection (#107)', async () => {
      const manifest = {
        sections: [
          { id: 'home', title: 'Home', file: 'home.md' }
        ]
      };
      const content = { 'home.md': '# Home\n\nPortable mount.' };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);
      const result = await runBuildTenantsWithRegistry(
        [{ id: TEST_TENANT_ID, basePath: '/committed' }],
        [],
        { PAGENARY_BASE: 'auto' }
      );
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      expect(index).toContain('var configuredBase = ""');
      expect(index).toContain('var base = explicitBase || autoBase || "/"');
    });

    test('content-hashed filenames are deterministic across unchanged rebuilds', async () => {
      const manifest = {
        sections: [
          { id: 'one', title: 'One', file: 'one.md' },
          { id: 'two', title: 'Two', file: 'two.md' }
        ]
      };
      const content = {
        'one.md': '# One\n\nSame content.',
        'two.md': '# Two\n\nSame content.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      let result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const first = hashedRuntimeFiles(distDir);

      result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      const second = hashedRuntimeFiles(distDir);
      expect(second).toEqual(first);
    });

    test('changing one section changes only that section module hash', async () => {
      const manifest = {
        sections: [
          { id: 'one', title: 'One', file: 'one.md' },
          { id: 'two', title: 'Two', file: 'two.md' }
        ]
      };
      const content = {
        'one.md': '# One\n\nFirst content.',
        'two.md': '# Two\n\nSecond content.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      let result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const before = flattenModules(extractManifestArray((await readRuntimeManifest(distDir)).manifestJs));

      await fsp.writeFile(path.join(testTenantDir, 'content', 'one.md'), '# One\n\nFirst content changed.');
      result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);
      const after = flattenModules(extractManifestArray((await readRuntimeManifest(distDir)).manifestJs));

      expect(after.get('one')).toMatch(/^\.\/sections\/one\.[a-f0-9]{12}\.js$/);
      expect(after.get('two')).toMatch(/^\.\/sections\/two\.[a-f0-9]{12}\.js$/);
      expect(after.get('one')).not.toBe(before.get('one'));
      expect(after.get('two')).toBe(before.get('two'));
    });

    test('sets the shell <title> from the default page metadata title (#28)', async () => {
      const manifest = {
        sections: [
          { id: 'home', title: 'Getting Started', file: 'home.md' },
          { id: 'other', title: 'Other', file: 'other.md' }
        ]
      };
      const content = {
        'home.md': '# Getting Started\n\nIntro.',
        'other.md': '# Other\n\nMore.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, { title: 'Acme Docs' }, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      // Default page's metadata title + brand — not the generic brand alone.
      expect(index).toContain('<title>Getting Started · Acme Docs</title>');
      expect(index).not.toContain('<title>Acme Docs</title>');
    });

    test('uses collection frontmatter metadata for auto-discovered nav entries and sort order', async () => {
      testTenantDir = path.join(PUBLISHER_ROOT, 'tenants', TEST_TENANT_ID);
      await fsp.mkdir(path.join(testTenantDir, 'blog'), { recursive: true });
      await fsp.writeFile(path.join(testTenantDir, '_manifest.json'), JSON.stringify({
        title: 'Docs',
        sections: [
          { id: 'blog', title: 'Blog' }
        ]
      }, null, 2));
      await fsp.writeFile(path.join(testTenantDir, 'config.json'), JSON.stringify({
        title: 'Collection Test',
        collections: [
          {
            path: 'blog',
            route: '/blog',
            sortBy: 'date',
            order: 'desc',
            showDate: true,
            showSummary: true
          }
        ]
      }, null, 2));
      await fsp.writeFile(path.join(testTenantDir, 'blog', 'older.md'),
        '---\ntitle: Older Frontmatter Title\ndate: 2026-06-01\nsummary: Older summary\n---\n# Older Heading\n\nBody.');
      await fsp.writeFile(path.join(testTenantDir, 'blog', 'newer.md'),
        '---\ntitle: Newer Frontmatter Title\ndate: 2026-06-12\nsummary: Newer summary\n---\n# Newer Heading\n\nBody.');

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const manifestJs = await fsp.readFile(
        path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'manifest.js'),
        'utf8'
      );
      const newerIndex = manifestJs.indexOf('"title": "Newer Frontmatter Title"');
      const olderIndex = manifestJs.indexOf('"title": "Older Frontmatter Title"');

      expect(newerIndex).toBeGreaterThan(-1);
      expect(olderIndex).toBeGreaterThan(-1);
      expect(newerIndex).toBeLessThan(olderIndex);
      expect(manifestJs).toContain('"summary": "Newer summary"');
      expect(manifestJs).toContain('"date": "2026-06-12"');
      expect(manifestJs).toContain('"reading_time": 1');
      expect(manifestJs).toContain('"showDate": true');
      expect(manifestJs).toContain('"showSummary": true');
      expect(manifestJs).toContain('"showReadingTime": true');
    });

    test('processes HTML content files', async () => {
      const manifest = {
        sections: [
          { id: 'html-section', title: 'HTML Section', file: 'page.html' }
        ]
      };

      const content = {
        'page.html': '<div class="custom">Custom HTML Content</div>'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const sectionFile = path.join(
        PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'sections', 'html-section.js'
      );
      expect(fs.existsSync(sectionFile)).toBe(true);

      const sectionContent = await fsp.readFile(sectionFile, 'utf8');
      expect(sectionContent).toMatch(/Custom HTML Content/);
    });

    test('copies JavaScript module files', async () => {
      const manifest = {
        sections: [
          { id: 'js-section', title: 'JS Section', file: 'dynamic.js' }
        ]
      };

      const content = {
        'dynamic.js': 'export async function load() { return { html: "<div>Dynamic</div>" }; }'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const sectionFile = path.join(
        PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'sections', 'js-section.js'
      );
      expect(fs.existsSync(sectionFile)).toBe(true);

      const sectionContent = await fsp.readFile(sectionFile, 'utf8');
      expect(sectionContent).toMatch(/export async function load/);
    });
  });

  describe('manifest processing', () => {
    const TEST_TENANT_ID = '__test-manifest-' + Date.now();
    let testTenantDir;

    afterEach(async () => {
      if (testTenantDir) {
        await cleanup(testTenantDir);
      }
      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      await cleanup(distDir);
    });

    test('generates manifest.js with section metadata', async () => {
      const manifest = {
        sections: [
          { id: 'section-a', title: 'Section A', summary: 'First section', file: 'a.md' },
          { id: 'section-b', title: 'Section B', summary: 'Second section', file: 'b.md' }
        ]
      };

      const content = {
        'a.md': '# Section A\n\nContent A',
        'b.md': '# Section B\n\nContent B'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');

      expect(manifestContent).toMatch(/MANIFEST/);
      expect(manifestContent).toMatch(/section-a/);
      expect(manifestContent).toMatch(/section-b/);
      expect(manifestContent).toMatch(/Section A/);
      expect(manifestContent).toMatch(/Section B/);
    });

    test('supports nested sections in manifest', async () => {
      const manifest = {
        sections: [
          {
            id: 'parent',
            title: 'Parent Section',
            sections: [
              { id: 'child-a', title: 'Child A', file: 'child-a.md' },
              { id: 'child-b', title: 'Child B', file: 'child-b.md' }
            ]
          }
        ]
      };

      const content = {
        'child-a.md': '# Child A',
        'child-b.md': '# Child B'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');

      expect(manifestContent).toMatch(/subsections/);
      expect(manifestContent).toMatch(/child-a/);
      expect(manifestContent).toMatch(/child-b/);
    });

    test('materializes authored group sections as navigable heading pages', async () => {
      const manifest = {
        default: 'guides',
        sections: [
          {
            id: 'guides',
            title: 'Guides',
            summary: 'Practical guides for operating the product.',
            file: 'guides/index.md',
            sections: [
              { id: 'guides/install', title: 'Install', summary: 'Install the product.', file: 'guides/install.md' },
              { id: 'guides/deploy', title: 'Deploy', summary: 'Deploy the product.', file: 'guides/deploy.md' }
            ]
          }
        ]
      };
      const content = {
        'guides/index.md': '# Guides\n\nChoose the right guide for your task.',
        'guides/install.md': '# Install\n\nInstall content.',
        'guides/deploy.md': '# Deploy\n\nDeploy content.'
      };
      testTenantDir = await createTestTenant(TEST_TENANT_ID, {
        title: 'Docs Site',
        domain: 'https://docs.example.com'
      }, manifest, content);

      const result = await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);
      expect(result.code).toBe(0);

      const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID);
      const runtime = await readRuntimeManifest(distDir);
      const generatedManifest = extractManifestArray(runtime.manifestJs);
      const guides = generatedManifest[0];
      expect(guides.id).toBe('guides');
      expect(guides.module).toMatch(/^\.\/sections\/guides(?:\.[a-f0-9]{12})?\.js$/);
      expect(guides.subsections.map((entry) => entry.id)).toEqual(['guides/install', 'guides/deploy']);

      const guidesModule = await fsp.readFile(path.join(distDir, guides.module), 'utf8');
      expect(guidesModule).toContain('Choose the right guide for your task.');
      expect(guidesModule).toContain('In this section');
      expect(guidesModule).toContain('href=\\"#guides/install\\"');
      expect(guidesModule).toContain('href=\\"#guides/deploy\\"');

      const pageHtml = await fsp.readFile(path.join(distDir, 'pages', 'guides.html'), 'utf8');
      expect(pageHtml).toContain('<link rel="canonical" href="https://docs.example.com/pages/guides.html" />');
      expect(pageHtml).toContain('<meta property="og:url" content="https://docs.example.com/pages/guides.html" />');
      expect(pageHtml).toContain('<meta name="twitter:title" content="Guides" />');
      expect(pageHtml).toContain('Choose the right guide for your task.');
      expect(pageHtml).toContain('href="./guides--install.html"');
      expect(pageHtml).toContain('href="./guides--deploy.html"');

      const sitemap = await fsp.readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
      expect(sitemap).toContain('https://docs.example.com/pages/guides.html');
      const llms = await fsp.readFile(path.join(distDir, 'llms.txt'), 'utf8');
      expect(llms).toContain('[Guides](https://docs.example.com/pages/guides.html)');
    });

    test('honors SEO profiles for authored group heading pages', async () => {
      const manifest = {
        default: 'guides',
        sections: [
          {
            id: 'guides',
            title: 'Guides',
            summary: 'Practical guides for operating the product.',
            file: 'guides/index.md',
            sections: [
              { id: 'guides/install', title: 'Install', file: 'guides/install.md' }
            ]
          }
        ]
      };
      const content = {
        'guides/index.md': '# Guides\n\nHuman-authored section introduction.',
        'guides/install.md': '# Install\n\nInstall content.'
      };
      const cases = [
        { profile: 'standard', page: true, sitemap: true, llms: true, corpus: false, noindex: false },
        { profile: 'open', page: true, sitemap: true, llms: true, corpus: true, noindex: false },
        { profile: 'limited', page: true, sitemap: false, llms: false, corpus: false, noindex: true },
        { profile: 'locked', page: false, sitemap: false, llms: false, corpus: false, noindex: false }
      ];

      for (const profileCase of cases) {
        const tenantId = `${TEST_TENANT_ID}-${profileCase.profile}`;
        await createTestTenant(tenantId, {
          title: 'Docs Site',
          domain: `https://${profileCase.profile}.example.com`,
          seo: { discoverabilityProfile: profileCase.profile }
        }, manifest, content);
      }

      try {
        const result = await runBuildTenantsWithRegistry(cases.map((profileCase) => ({
          id: `${TEST_TENANT_ID}-${profileCase.profile}`
        })));
        expect(result.code).toBe(0);

        for (const profileCase of cases) {
          const tenantId = `${TEST_TENANT_ID}-${profileCase.profile}`;
          const distDir = path.join(PUBLISHER_ROOT, 'dist', tenantId);
          const pagePath = path.join(distDir, 'pages', 'guides.html');
          expect(fs.existsSync(pagePath)).toBe(profileCase.page);
          expect(fs.existsSync(path.join(distDir, 'sitemap.xml'))).toBe(profileCase.sitemap);
          expect(fs.existsSync(path.join(distDir, 'llms.txt'))).toBe(profileCase.llms);
          expect(fs.existsSync(path.join(distDir, 'content-index.json'))).toBe(profileCase.corpus);
          expect(fs.existsSync(path.join(distDir, 'documents.jsonl'))).toBe(profileCase.corpus);

          if (profileCase.page) {
            const pageHtml = await fsp.readFile(pagePath, 'utf8');
            expect(pageHtml).toContain('Human-authored section introduction.');
            expect(pageHtml).toContain('href="./guides--install.html"');
            if (profileCase.noindex) {
              expect(pageHtml).toContain('<meta name="robots" content="noindex, nofollow" />');
            } else {
              expect(pageHtml).not.toContain('<meta name="robots" content="noindex, nofollow" />');
            }
          }

          if (profileCase.corpus) {
            const contentIndex = JSON.parse(await fsp.readFile(path.join(distDir, 'content-index.json'), 'utf8'));
            expect(contentIndex.pages.some((page) => page.id === 'guides')).toBe(true);
            const documents = await fsp.readFile(path.join(distDir, 'documents.jsonl'), 'utf8');
            expect(documents).toContain('"id":"guides"');
          }
        }
      } finally {
        for (const profileCase of cases) {
          const tenantId = `${TEST_TENANT_ID}-${profileCase.profile}`;
          await cleanup(path.join(PUBLISHER_ROOT, 'tenants', tenantId));
          await cleanup(path.join(PUBLISHER_ROOT, 'dist', tenantId));
        }
      }
    });

    test('sets default section from manifest', async () => {
      const manifest = {
        default: 'section-b',
        sections: [
          { id: 'section-a', title: 'Section A', file: 'a.md' },
          { id: 'section-b', title: 'Section B', file: 'b.md' }
        ]
      };

      const content = {
        'a.md': '# A',
        'b.md': '# B'
      };

      testTenantDir = await createTestTenant(TEST_TENANT_ID, {}, manifest, content);

      await runBuildTenantsWithRegistry([{ id: TEST_TENANT_ID }]);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_TENANT_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');

      expect(manifestContent).toMatch(/DEFAULT_SECTION.*section-b/);
    });
  });

  describe('nav positions', () => {
    const NAV_MANIFEST = {
      default: 'home',
      sections: [
        { id: 'home', title: 'Home', file: 'home.md' },
        {
          id: 'guides',
          title: 'Guides',
          sections: [
            { id: 'install', title: 'Install', file: 'install.md' }
          ]
        },
        { id: 'reference', title: 'Reference', file: 'reference.md' }
      ]
    };
    const NAV_CONTENT = {
      'home.md': '# Home\n\nHome page.',
      'install.md': '# Install\n\nInstall page.',
      'reference.md': '# Reference\n\nReference page.'
    };

    let navTenantDir;
    let navTenantId;
    let navCounter = 0;

    async function buildWithNavPosition(navPosition) {
      navTenantId = '__test-nav-' + Date.now() + '-' + (navCounter++);
      const config = navPosition === undefined ? { title: 'Nav Test' } : { title: 'Nav Test', navPosition };
      navTenantDir = await createTestTenant(navTenantId, config, NAV_MANIFEST, NAV_CONTENT);
      const result = await runBuildTenantsWithRegistry([{ id: navTenantId }]);
      const indexPath = path.join(PUBLISHER_ROOT, 'dist', navTenantId, 'index.html');
      const html = await fsp.readFile(indexPath, 'utf8');
      return { result, html };
    }

    afterEach(async () => {
      if (navTenantDir) await cleanup(navTenantDir);
      if (navTenantId) await cleanup(path.join(PUBLISHER_ROOT, 'dist', navTenantId));
      navTenantDir = undefined;
      navTenantId = undefined;
    });

    test.each(['right', 'top', 'bottom', 'hybrid'])(
      'tags <body> with data-nav-position="%s"',
      async (pos) => {
        const { result, html } = await buildWithNavPosition(pos);
        expect(result.code).toBe(0);
        expect(html).toMatch(new RegExp(`<body[^>]*data-nav-position="${pos}"`));
      }
    );

    test('hybrid injects a horizontal nav strip from top-level sections', async () => {
      const { html } = await buildWithNavPosition('hybrid');
      expect(html).toMatch(/<nav class="nav-strip"/);
      // One strip link per top-level section, each resolving to a real route.
      const links = html.match(/class="nav-strip-link" href="#[a-z-]+"/g) || [];
      expect(links.length).toBe(3);
      // Group "guides" links to its first navigable child, not the group id.
      expect(html).toMatch(/class="nav-strip-link" href="#install">Guides</);
    });

    test('left (default) adds no data-nav-position attribute', async () => {
      const { html } = await buildWithNavPosition('left');
      expect(html).not.toMatch(/data-nav-position=/);
      expect(html).not.toMatch(/class="nav-strip"/);
    });

    test('omitted navPosition adds no data-nav-position attribute', async () => {
      const { html } = await buildWithNavPosition(undefined);
      expect(html).not.toMatch(/data-nav-position=/);
    });

    test('unknown navPosition warns and leaves the default layout', async () => {
      const { result, html } = await buildWithNavPosition('sideways');
      expect(result.code).toBe(0);
      expect(result.stdout + result.stderr).toMatch(/unknown navPosition/i);
      expect(html).not.toMatch(/data-nav-position=/);
    });
  });

  describe('nav alignment', () => {
    const ALIGN_MANIFEST = {
      default: 'home',
      sections: [
        { id: 'home', title: 'Home', file: 'home.md' },
        { id: 'reference', title: 'Reference', file: 'reference.md' }
      ]
    };
    const ALIGN_CONTENT = {
      'home.md': '# Home\n\nHome page.',
      'reference.md': '# Reference\n\nReference page.'
    };

    let alignTenantDir;
    let alignTenantId;
    let alignCounter = 0;

    async function buildWithNavAlign(navAlign) {
      alignTenantId = '__test-align-' + Date.now() + '-' + (alignCounter++);
      const config = navAlign === undefined ? { title: 'Align Test' } : { title: 'Align Test', navAlign };
      alignTenantDir = await createTestTenant(alignTenantId, config, ALIGN_MANIFEST, ALIGN_CONTENT);
      const result = await runBuildTenantsWithRegistry([{ id: alignTenantId }]);
      const indexPath = path.join(PUBLISHER_ROOT, 'dist', alignTenantId, 'index.html');
      const html = await fsp.readFile(indexPath, 'utf8');
      return { result, html };
    }

    afterEach(async () => {
      if (alignTenantDir) await cleanup(alignTenantDir);
      if (alignTenantId) await cleanup(path.join(PUBLISHER_ROOT, 'dist', alignTenantId));
      alignTenantDir = undefined;
      alignTenantId = undefined;
    });

    test.each(['spread', 'bottom', 'left', 'right'])(
      'tags <body> with data-nav-align="%s"',
      async (align) => {
        const { result, html } = await buildWithNavAlign(align);
        expect(result.code).toBe(0);
        expect(html).toMatch(new RegExp(`<body[^>]*data-nav-align="${align}"`));
      }
    );

    test('top (default) adds no data-nav-align attribute', async () => {
      const { html } = await buildWithNavAlign('top');
      expect(html).not.toMatch(/data-nav-align=/);
    });

    test('omitted navAlign adds no data-nav-align attribute', async () => {
      const { html } = await buildWithNavAlign(undefined);
      expect(html).not.toMatch(/data-nav-align=/);
    });

    test('unknown navAlign warns and leaves the default', async () => {
      const { result, html } = await buildWithNavAlign('diagonal');
      expect(result.code).toBe(0);
      expect(result.stdout + result.stderr).toMatch(/unknown navAlign/i);
      expect(html).not.toMatch(/data-nav-align=/);
    });
  });

  describe('blog layout', () => {
    let blogTenantDir;
    let blogTenantId;
    let blogCounter = 0;

    // Build a nested blog tenant directly (posts/ at the tenant root, no
    // content/ wrapper) so findContentRoot picks "nested" mode and the
    // collections engine + blog index wiring run.
    async function buildBlog(configOverrides = {}) {
      blogTenantId = '__test-blog-' + Date.now() + '-' + (blogCounter++);
      blogTenantDir = path.join(PUBLISHER_ROOT, 'tenants', blogTenantId);
      await fsp.mkdir(path.join(blogTenantDir, 'posts'), { recursive: true });

      const config = {
        title: 'Blog Test',
        layout: 'blog',
        collections: [{
          path: 'posts', route: '/posts', title: 'Posts',
          manifest: true, feed: true, sortBy: 'date', order: 'desc',
          showDate: true, showSummary: true, showReadingTime: true
        }],
        ...configOverrides
      };
      await fsp.writeFile(path.join(blogTenantDir, 'config.json'), JSON.stringify(config, null, 2));
      await fsp.writeFile(
        path.join(blogTenantDir, 'posts', 'hello-world.md'),
        '---\n' +
        'title: Hello World\n' +
        'date: 2026-06-10\n' +
        'author: Test Author\n' +
        'tags: [alpha, beta]\n' +
        'hero: assets/hero.svg\n' +
        'summary: A first post.\n' +
        '---\n\n# Hello World\n\nBody text here.\n'
      );

      const result = await runBuildTenantsWithRegistry([{ id: blogTenantId }]);
      const distDir = path.join(PUBLISHER_ROOT, 'dist', blogTenantId);
      const html = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      const manifest = await fsp.readFile(path.join(distDir, 'manifest.js'), 'utf8');
      let index = null;
      const indexPath = path.join(distDir, 'posts', 'index.json');
      if (fs.existsSync(indexPath)) index = JSON.parse(await fsp.readFile(indexPath, 'utf8'));
      return { result, html, manifest, index };
    }

    afterEach(async () => {
      if (blogTenantDir) await cleanup(blogTenantDir);
      if (blogTenantId) await cleanup(path.join(PUBLISHER_ROOT, 'dist', blogTenantId));
      blogTenantDir = undefined;
      blogTenantId = undefined;
    });

    test('tags <body> with data-layout="blog" and default hidden sidebar', async () => {
      const { result, html } = await buildBlog();
      expect(result.code).toBe(0);
      expect(html).toMatch(/<body[^>]*data-layout="blog"/);
      expect(html).toMatch(/<body[^>]*data-blog-sidebar="hidden"/);
    });

    test('honors blog.sidebar="rail"', async () => {
      const { html } = await buildBlog({ blog: { sidebar: 'rail' } });
      expect(html).toMatch(/data-blog-sidebar="rail"/);
    });

    test('wires the blog index section and makes it the default', async () => {
      const { manifest } = await buildBlog();
      expect(manifest).toMatch(/"id":\s*"blog"/);
      expect(manifest).toMatch(/DEFAULT_SECTION\s*=\s*"blog"/);
    });

    test('carries hero/tags/author onto the post manifest entry', async () => {
      const { manifest } = await buildBlog();
      expect(manifest).toMatch(/"hero"/);
      expect(manifest).toMatch(/"author":\s*"Test Author"/);
      expect(manifest).toMatch(/"alpha"/);
    });

    test('emits the collection index.json with post metadata', async () => {
      const { index } = await buildBlog();
      expect(index).toBeTruthy();
      const posts = index.posts || index.entries || index;
      expect(Array.isArray(posts)).toBe(true);
      expect(posts.length).toBe(1);
      expect(posts[0].id).toBe('posts/hello-world');
      expect(posts[0].author).toBe('Test Author');
      expect(posts[0].tags).toEqual(['alpha', 'beta']);
    });

    test('default layout (docs) adds no data-layout attribute', async () => {
      const { html } = await buildBlog({ layout: 'docs' });
      expect(html).not.toMatch(/data-layout=/);
    });

    test('unknown layout warns and leaves the default', async () => {
      const { result, html } = await buildBlog({ layout: 'magazine' });
      expect(result.code).toBe(0);
      expect(result.stdout + result.stderr).toMatch(/unknown layout/i);
      expect(html).not.toMatch(/data-layout=/);
    });
  });

  describe('GFM autolinks', () => {
    const AL_ID = '__test-autolink-' + Date.now();
    let alDir;

    afterEach(async () => {
      if (alDir) await cleanup(alDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', AL_ID));
      alDir = undefined;
    });

    async function renderAutolinkPage(body) {
      const manifest = { default: 'al', sections: [{ id: 'al', title: 'AL', file: 'al.md' }] };
      alDir = await createTestTenant(AL_ID, { title: 'AL' }, manifest, { 'al.md': body });
      const res = await runBuildTenantsWithRegistry([{ id: AL_ID }]);
      expect(res.code).toBe(0);
      const sec = path.join(PUBLISHER_ROOT, 'dist', AL_ID, 'sections', 'al.js');
      return await fsp.readFile(sec, 'utf8');
    }

    // Tolerate the JSON-string escaping of the embedded HTML (href=\"…\").
    const href = (u) => new RegExp('href=\\\\?"' + u.replace(/[.\/]/g, '\\$&') + '\\\\?"');

    test('angle-bracket autolink <https://…> becomes a link', async () => {
      const html = await renderAutolinkPage('Visit <https://example.com/a> today.');
      expect(html).toMatch(href('https://example.com/a'));
      expect(html).not.toMatch(/&lt;https:\/\/example\.com\/a&gt;/);
    });

    test('mailto autolink <mailto:…> becomes a link', async () => {
      const html = await renderAutolinkPage('Mail <mailto:hi@example.com> now.');
      expect(html).toMatch(href('mailto:hi@example.com'));
    });

    test('bare URL in prose is linkified', async () => {
      const html = await renderAutolinkPage('See https://example.com/bare for details.');
      expect(html).toMatch(href('https://example.com/bare'));
    });

    test('bare URL trailing punctuation is not absorbed', async () => {
      const html = await renderAutolinkPage('(visit https://example.com/x).');
      expect(html).toMatch(href('https://example.com/x'));
      // The closing paren/period must not end up inside the href.
      expect(html).not.toMatch(href('https://example.com/x\\)'));
    });

    test('existing [label](url) link is not double-wrapped', async () => {
      const html = await renderAutolinkPage('An [example](https://example.com/link) link.');
      const matches = html.match(/example\.com\/link/g) || [];
      // Appears once in href; the visible label is the word "example", not the URL.
      expect(matches.length).toBe(1);
      expect(html).not.toMatch(/<a[^>]*><a/);
    });

    test('URL inside a fenced code block is left as text', async () => {
      const html = await renderAutolinkPage('```\nsee https://example.com/incode\n```');
      // Code blocks never reach the inline autolinker → no anchor for this URL.
      expect(html).not.toMatch(href('https://example.com/incode'));
    });
  });

  describe('theme picker (#35)', () => {
    const TP_ID = '__test-themepicker-' + Date.now();
    let tpDir;

    afterEach(async () => {
      if (tpDir) await cleanup(tpDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TP_ID));
      tpDir = undefined;
    });

    async function buildWithConfig(config) {
      tpDir = await createTestTenant(TP_ID, config);
      const res = await runBuildTenantsWithRegistry([{ id: TP_ID }]);
      expect(res.code).toBe(0);
      const dist = path.join(PUBLISHER_ROOT, 'dist', TP_ID);
      return {
        index: await fsp.readFile(path.join(dist, 'index.html'), 'utf8'),
        has: (f) => fs.existsSync(path.join(dist, f))
      };
    }

    test('source stylesheet defines channel tokens used by themed surfaces', async () => {
      const css = await fsp.readFile(path.join(PUBLISHER_ROOT, 'src', 'styles.css'), 'utf8');
      expect(css).toMatch(/--surface-rgb:\s*255,\s*255,\s*255;/);
      expect(css).toMatch(/--ink-rgb:\s*11,\s*11,\s*11;/);
      expect(css).toMatch(/\.export-options-modal\s*{[\s\S]*background:\s*var\(--surface\);/);
      expect(css).toMatch(/\.export-loading-modal\s*{[\s\S]*background:\s*var\(--surface\);/);
      expect(css).not.toMatch(/\.export-options-modal\s*{[\s\S]*background:\s*white;/);
      expect(css).not.toMatch(/\.export-loading-modal\s*{[\s\S]*border:\s*2px solid #000;/);
    });

    test('enabled: emits per-theme stylesheets + injects control', async () => {
      const { index, has } = await buildWithConfig({
        title: 'TP',
        themePicker: { enabled: true, themes: ['light', 'dark', 'matrix'], default: 'light' }
      });
      expect(has('theme-light.css')).toBe(true);
      expect(has('theme-dark.css')).toBe(true);
      expect(has('theme-matrix.css')).toBe(true);
      expect(index).toMatch(/id="themePicker"/);
      expect(index).toMatch(/id="themeStylesheet"/);
      expect(index).toMatch(/data-themes=/);
      expect(index).toMatch(/data-default="light"/);
    });

    test('emitted dark variant carries dark palette + dark overrides', async () => {
      const { has } = await buildWithConfig({
        title: 'TP',
        themePicker: { enabled: true, themes: ['light', 'dark'] }
      });
      const dark = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TP_ID, 'theme-dark.css'), 'utf8');
      expect(dark).toMatch(/color-scheme: dark;/);
      expect(dark).toMatch(/--surface: #0a0a0e;/);
      expect(dark).toMatch(/--surface-rgb: 10, 10, 14;/);
      expect(dark).toMatch(/--ink-rgb: 224, 224, 224;/);
      // The build-time dark override replaced the hardcoded light code background.
      expect(dark).not.toMatch(/rgba\(0, 0, 0, 0\.04\)/);
    });

    test('emitted theme variants keep overlay and modal surfaces on tokens', async () => {
      await buildWithConfig({
        title: 'TP',
        themePicker: { enabled: true, themes: ['light', 'dark'] }
      });
      const light = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TP_ID, 'theme-light.css'), 'utf8');
      const dark = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TP_ID, 'theme-dark.css'), 'utf8');

      for (const css of [light, dark]) {
        expect(css).toMatch(/--ink-rgb:\s*\d+,\s*\d+,\s*\d+;/);
        expect(css).toMatch(/\.export-options-overlay\s*{[\s\S]*background:\s*rgba\(var\(--surface-rgb\), 0\.86\);/);
        expect(css).toMatch(/\.export-options-modal\s*{[\s\S]*background:\s*var\(--surface\);/);
        expect(css).toMatch(/\.export-loading-modal\s*{[\s\S]*background:\s*var\(--surface\);/);
        expect(css).not.toMatch(/\.export-options-modal\s*{[\s\S]*background:\s*white;/);
        expect(css).not.toMatch(/\.export-loading-modal\s*{[\s\S]*border:\s*2px solid #000;/);
      }
    });

    test('disabled/absent: no picker output, no extra markup', async () => {
      const { index, has } = await buildWithConfig({ title: 'TP' });
      expect(has('theme-light.css')).toBe(false);
      expect(has('theme-dark.css')).toBe(false);
      expect(index).not.toMatch(/id="themePicker"/);
      expect(index).not.toMatch(/id="themeStylesheet"/);
    });

    test('custom theme object is selectable as "custom"', async () => {
      const { index, has } = await buildWithConfig({
        title: 'TP',
        theme: { colorScheme: 'dark', surface: '#101820', accent: '#ff8800' },
        themePicker: { enabled: true, themes: ['light', 'custom'], default: 'custom' }
      });
      expect(has('theme-custom.css')).toBe(true);
      const custom = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', TP_ID, 'theme-custom.css'), 'utf8');
      expect(custom).toMatch(/--surface: #101820;/);
      expect(custom).toMatch(/--accent: #ff8800;/);
      expect(index).toMatch(/<option value="custom">/);
    });
  });

  describe('docs map (#33)', () => {
    const DM_ID = '__test-docsmap-' + Date.now();
    let dmDir;
    const DM_MANIFEST = {
      default: 'a',
      sections: [
        { id: 'a', title: 'Alpha', file: 'a.md' },
        { id: 'b', title: 'Bravo', file: 'b.md' },
        { id: 'c', title: 'Charlie', file: 'c.md' }
      ]
    };
    const DM_CONTENT = { 'a.md': '# Alpha', 'b.md': '# Bravo', 'c.md': '# Charlie' };

    afterEach(async () => {
      if (dmDir) await cleanup(dmDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', DM_ID));
      dmDir = undefined;
    });

    async function buildDocsMap(config) {
      dmDir = await createTestTenant(DM_ID, config, DM_MANIFEST, DM_CONTENT);
      const res = await runBuildTenantsWithRegistry([{ id: DM_ID }]);
      expect(res.code).toBe(0);
      const dist = path.join(PUBLISHER_ROOT, 'dist', DM_ID);
      return {
        has: (f) => fs.existsSync(path.join(dist, f)),
        manifest: await fsp.readFile(path.join(dist, 'manifest.js'), 'utf8')
      };
    }

    test('enabled: emits section module + injects MANIFEST entry', async () => {
      const { has, manifest } = await buildDocsMap({ title: 'DM', docsMap: { enabled: true } });
      expect(has('sections/docs-map.js')).toBe(true);
      expect(has('lib/docs-map.js')).toBe(true); // copied from src/lib by the base build
      expect(manifest).toMatch(/"id":\s*"docs-map"/);
      expect(manifest).toMatch(/"module":\s*"\.\/sections\/docs-map\.[a-f0-9]{12}\.js"/);
    });

    test('custom title is used for the MANIFEST entry', async () => {
      const { manifest } = await buildDocsMap({ title: 'DM', docsMap: { enabled: true, title: 'Atlas' } });
      expect(manifest).toMatch(/"title":\s*"Atlas"/);
    });

    test('renderer option is emitted for optional renderer selection', async () => {
      await buildDocsMap({ title: 'DM', docsMap: { enabled: true, renderer: 'cytoscape' } });
      const sect = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', DM_ID, 'sections', 'docs-map.js'), 'utf8');
      expect(sect).toMatch(/renderer:\s*"cytoscape"/);
    });

    test('unknown renderer values normalize to svg fallback', async () => {
      await buildDocsMap({ title: 'DM', docsMap: { enabled: true, renderer: 'unknown' } });
      const sect = await fsp.readFile(path.join(PUBLISHER_ROOT, 'dist', DM_ID, 'sections', 'docs-map.js'), 'utf8');
      expect(sect).toMatch(/renderer:\s*"svg"/);
    });

    test('disabled/absent: no docs-map output or entry', async () => {
      const { has, manifest } = await buildDocsMap({ title: 'DM' });
      expect(has('sections/docs-map.js')).toBe(false);
      expect(manifest).not.toMatch(/"id":\s*"docs-map"/);
    });

    test('rich corpus: embeds a concept graph with edges + communities', async () => {
      const manifest = {
        default: 'auth',
        sections: [
          { id: 'concepts', title: 'Concepts', sections: [
            { id: 'auth', title: 'Authentication', file: 'auth.md' }
          ] },
          { id: 'guides', title: 'Guides', sections: [
            { id: 'keys', title: 'API Keys', file: 'keys.md' },
            { id: 'errors', title: 'Errors', file: 'errors.md' }
          ] }
        ]
      };
      const content = {
        'auth.md': '# Authentication\nAuthentication authorizes requests using keys. Failures return errors.',
        'keys.md': '# API Keys\nAPI keys authorize requests. Authentication uses keys under rate limits.',
        'errors.md': '# Errors\nErrors share one shape. Authentication failures and rate limit errors.'
      };
      dmDir = await createTestTenant(DM_ID, { docsMap: { enabled: true } }, manifest, content);
      const res = await runBuildTenantsWithRegistry([{ id: DM_ID }]);
      expect(res.code).toBe(0);

      const dist = path.join(PUBLISHER_ROOT, 'dist', DM_ID);
      expect(fs.existsSync(path.join(dist, 'docs-map-data.js'))).toBe(true);

      const data = await fsp.readFile(path.join(dist, 'docs-map-data.js'), 'utf8');
      const m = data.match(/^export const DOCS_MAP_GRAPH = (.+);$/m);
      expect(m).not.toBeNull();
      const graph = JSON.parse(m[1]);
      expect(graph.nodes.length).toBe(3);
      expect(graph.edges.length).toBeGreaterThan(0);     // concept-derived edges
      expect(graph.communities.length).toBe(2);          // Concepts + Guides
      expect(graph.edges[0]).toEqual(expect.objectContaining({
        source: expect.any(String),
        target: expect.any(String),
        kind: 'related',
        weight: expect.any(Number)
      }));

      const metadataMatch = data.match(/^export const DOCS_MAP_METADATA = (.+);$/m);
      expect(metadataMatch).not.toBeNull();
      const metadata = JSON.parse(metadataMatch[1]);
      expect(metadata.nodes.length).toBe(3);
      expect(metadata.edges.length).toBeGreaterThan(0);
      expect(metadata.edges[0][1]).toEqual(expect.objectContaining({
        label: expect.stringMatching(/^Shares \d+ concept/),
        confidence: expect.any(Number),
        shared_concepts: expect.any(Array)
      }));

      const sect = await fsp.readFile(path.join(dist, 'sections', 'docs-map.js'), 'utf8');
      expect(sect).toMatch(/docs-map-data\.[a-f0-9]{12}\.js/);
      expect(sect).toMatch(/DOCS_MAP_DATA\.DOCS_MAP_METADATA/);
      expect(sect).toMatch(/loadDocsMap/);
    });
  });

  describe('error handling', () => {
    test('handles missing content files gracefully', async () => {
      const testTenantId = '__test-missing-' + Date.now();
      const manifest = {
        sections: [
          { id: 'missing', title: 'Missing', file: 'nonexistent.md' }
        ]
      };

      const tenantDir = await createTestTenant(testTenantId, {}, manifest, {});

      try {
        const result = await runBuildTenantsWithRegistry([{ id: testTenantId }]);

        // Should complete but warn about missing file
        expect(result.code).toBe(0);
        expect(result.stdout + result.stderr).toMatch(/missing content file/i);
      } finally {
        await cleanup(tenantDir);
        await cleanup(path.join(PUBLISHER_ROOT, 'dist', testTenantId));
      }
    });
  });
});
