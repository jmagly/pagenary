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
      const index = await fsp.readFile(path.join(distDir, 'index.html'), 'utf8');
      const manifestJs = await fsp.readFile(path.join(distDir, 'manifest.js'), 'utf8');

      // Shell assets are base-relative (resolve against the runtime <base href>),
      // which works for both domain-root (base "/") and subpath (base "/<tenant>/").
      expect(index).toContain('href="./styles.css"');
      expect(index).toContain('src="./app.js"');
      // The base-resolution bootstrap is wired with this tenant id.
      expect(index).toContain("document.write('<base");
      expect(index).toContain(`var t = "${TEST_TENANT_ID}"`);
      // Module paths are relative so dynamic import() resolves against app.js's
      // (base-resolved) URL.
      expect(manifestJs).toContain('"module": "./sections/blog--post.js"');
      expect(manifestJs).not.toContain('"module": "/sections/');
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
      // The build-time dark override replaced the hardcoded light code background.
      expect(dark).not.toMatch(/rgba\(0, 0, 0, 0\.04\)/);
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
      expect(manifest).toMatch(/"module":\s*"\.\/sections\/docs-map\.js"/);
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
      expect(sect).toMatch(/docs-map-data\.js/);
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
