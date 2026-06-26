/**
 * Tests for nested content directory support in build-tenants.js
 *
 * Tests cover:
 * - Content root detection (flat vs nested)
 * - Section ID derivation from paths
 * - Path encoding for output filenames
 * - Directory manifest loading
 * - Humanizing filenames to titles
 * - Recursive directory scanning
 * - Backward compatibility with flat structure
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');
const BUILD_TENANTS_SCRIPT = path.join(PUBLISHER_ROOT, 'scripts', 'build-tenants.js');
const TEST_REGISTRY_PATH = path.join(PUBLISHER_ROOT, '__test-nested-tenants.json');

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
    if (fs.existsSync(TEST_REGISTRY_PATH)) {
      await fsp.rm(TEST_REGISTRY_PATH);
    }
  }
}

// Helper to create a nested tenant structure
async function createNestedTenant(tenantId, structure) {
  const tenantDir = path.join(PUBLISHER_ROOT, 'tenants', tenantId);
  await fsp.mkdir(tenantDir, { recursive: true });

  // Create config.json if provided
  if (structure.config) {
    await fsp.writeFile(
      path.join(tenantDir, 'config.json'),
      JSON.stringify(structure.config, null, 2)
    );
  }

  // Create root manifest.json if provided
  if (structure.manifest) {
    await fsp.writeFile(
      path.join(tenantDir, 'manifest.json'),
      JSON.stringify(structure.manifest, null, 2)
    );
  }

  // Create directory structure
  if (structure.directories) {
    for (const [dirPath, dirContent] of Object.entries(structure.directories)) {
      const fullDirPath = path.join(tenantDir, dirPath);
      await fsp.mkdir(fullDirPath, { recursive: true });

      // Create _manifest.json if provided
      if (dirContent._manifest) {
        await fsp.writeFile(
          path.join(fullDirPath, '_manifest.json'),
          JSON.stringify(dirContent._manifest, null, 2)
        );
      }

      // Create content files
      if (dirContent.files) {
        for (const [filename, fileContent] of Object.entries(dirContent.files)) {
          await fsp.writeFile(path.join(fullDirPath, filename), fileContent);
        }
      }
    }
  }

  // Create root-level files
  if (structure.files) {
    for (const [filename, fileContent] of Object.entries(structure.files)) {
      await fsp.writeFile(path.join(tenantDir, filename), fileContent);
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

describe('nested content directories', () => {
  describe('content root detection', () => {
    const TEST_ID = '__test-nested-detection-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('detects flat content/ structure', async () => {
      // Create tenant with traditional flat content/ directory
      tenantDir = path.join(PUBLISHER_ROOT, 'tenants', TEST_ID);
      await fsp.mkdir(path.join(tenantDir, 'content'), { recursive: true });
      await fsp.writeFile(path.join(tenantDir, 'config.json'), '{}');
      await fsp.writeFile(
        path.join(tenantDir, 'manifest.json'),
        JSON.stringify({ sections: [{ id: 'test', title: 'Test', file: 'test.md' }] })
      );
      await fsp.writeFile(path.join(tenantDir, 'content', 'test.md'), '# Test');

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/manifest-driven content/);
    });

    test('detects nested directory structure', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: { title: 'Nested Test' },
        directories: {
          'getting-started': {
            files: {
              'index.md': '# Getting Started',
              'quick-start.md': '# Quick Start'
            }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);
      // Should use nested scanning
      expect(result.stdout).toMatch(/nested content/i);
    });
  });

  describe('section ID derivation', () => {
    const TEST_ID = '__test-nested-ids-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('index.md becomes directory ID', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'getting-started': {
            files: { 'index.md': '# Getting Started' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      // Section should be named getting-started (not getting-started/index)
      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/getting-started/);
      expect(manifestContent).not.toMatch(/getting-started\/index/);
    });

    test('nested files get path-based IDs', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'docs': {
            files: { 'overview.md': '# Overview' }
          },
          'docs/api': {
            files: { 'reference.md': '# API Reference' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      // Check that nested section ID exists
      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/docs\/api\/reference|docs--api--reference/);
    });
  });

  describe('output filename encoding', () => {
    const TEST_ID = '__test-nested-encoding-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('encodes / as -- in output filenames', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'getting-started': {
            files: { 'quick-start.md': '# Quick Start Guide' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      // Output file should use -- encoding
      const sectionsDir = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'sections');
      const files = await fsp.readdir(sectionsDir);
      expect(files.some(f => f.includes('getting-started--quick-start'))).toBe(true);
    });
  });

  describe('exclusion rules', () => {
    const TEST_ID = '__test-nested-exclusion-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('excludes underscore-prefixed files', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'docs': {
            files: {
              'published.md': '# Published',
              '_draft.md': '# Draft (should be excluded)'
            }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const sectionsDir = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'sections');
      const files = await fsp.readdir(sectionsDir);
      expect(files.some(f => f.includes('published'))).toBe(true);
      expect(files.some(f => f.includes('draft'))).toBe(false);
    });

    test('excludes dot-prefixed files and directories', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'docs': {
            files: {
              'readme.md': '# Readme',
              '.hidden.md': '# Hidden (should be excluded)'
            }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const sectionsDir = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'sections');
      const files = await fsp.readdir(sectionsDir);
      expect(files.some(f => f.includes('readme'))).toBe(true);
      expect(files.some(f => f.includes('hidden'))).toBe(false);
    });

    test('excludes underscore-prefixed directories', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'public': {
            files: { 'intro.md': '# Public Intro' }
          },
          '_private': {
            files: { 'secret.md': '# Secret (should be excluded)' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/public/);
      expect(manifestContent).not.toMatch(/private/);
      expect(manifestContent).not.toMatch(/secret/);
    });
  });

  describe('directory manifest (_manifest.json)', () => {
    const TEST_ID = '__test-nested-manifest-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('applies title from _manifest.json', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'getting-started': {
            _manifest: { title: 'Quick Start Guide' },
            files: { 'index.md': '# Getting Started' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/Quick Start Guide/);
    });

    test('applies ordering from _manifest.json', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'docs': {
            _manifest: { order: ['second', 'first'] },
            files: {
              'first.md': '# First',
              'second.md': '# Second'
            }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');

      // Check that second appears before first in the manifest
      const secondIdx = manifestContent.indexOf('second');
      const firstIdx = manifestContent.indexOf('first');
      expect(secondIdx).toBeLessThan(firstIdx);
    });
  });

  describe('backward compatibility', () => {
    const TEST_ID = '__test-nested-compat-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('flat content/ structure still works', async () => {
      // Create a traditional flat structure
      tenantDir = path.join(PUBLISHER_ROOT, 'tenants', TEST_ID);
      await fsp.mkdir(path.join(tenantDir, 'content'), { recursive: true });
      await fsp.writeFile(path.join(tenantDir, 'config.json'), '{}');
      await fsp.writeFile(
        path.join(tenantDir, 'manifest.json'),
        JSON.stringify({
          sections: [
            { id: 'welcome', title: 'Welcome', file: 'welcome.md' },
            { id: 'guide', title: 'Guide', file: 'guide.md' }
          ]
        })
      );
      await fsp.writeFile(path.join(tenantDir, 'content', 'welcome.md'), '# Welcome');
      await fsp.writeFile(path.join(tenantDir, 'content', 'guide.md'), '# Guide');

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      // Verify sections were created
      const sectionsDir = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'sections');
      expect(fs.existsSync(path.join(sectionsDir, 'welcome.js'))).toBe(true);
      expect(fs.existsSync(path.join(sectionsDir, 'guide.js'))).toBe(true);
    });

    test('existing sample tenants (tenant-alpha, tenant-beta) still build', async () => {
      // Use a local registry to avoid git clone delays
      const result = await runBuildTenantsWithRegistry([
        { id: 'tenant-alpha' },
        { id: 'tenant-beta' }
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/tenant-alpha/);
      expect(result.stdout).toMatch(/tenant-beta/);

      // Verify outputs exist
      expect(fs.existsSync(path.join(PUBLISHER_ROOT, 'dist', 'tenant-alpha', 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(PUBLISHER_ROOT, 'dist', 'tenant-beta', 'index.html'))).toBe(true);
    });
  });

  describe('humanized titles', () => {
    const TEST_ID = '__test-nested-titles-' + Date.now();
    let tenantDir;

    afterEach(async () => {
      if (tenantDir) await cleanup(tenantDir);
      await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
    });

    test('converts kebab-case to Title Case', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'my-awesome-section': {
            files: { 'index.md': '# Content' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/My Awesome Section/);
    });

    test('handles abbreviations correctly', async () => {
      tenantDir = await createNestedTenant(TEST_ID, {
        config: {},
        directories: {
          'api-reference': {
            files: { 'index.md': '# API Reference' }
          }
        }
      });

      const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
      expect(result.code).toBe(0);

      const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
      const manifestContent = await fsp.readFile(manifestFile, 'utf8');
      expect(manifestContent).toMatch(/API Reference/);
    });
  });
});

// Blog post navigation (#55): collection-scoped prev/next + back-to-index config.
// Builds a real blog-layout tenant and dynamically imports the generated,
// self-contained manifest.js to exercise getAdjacentSections end-to-end.
describe('blog post navigation (#55)', () => {
  const TEST_ID = '__test-post-nav-' + Date.now();
  let tenantDir;

  const post = (title, date) =>
    `---\ntitle: ${title}\ndate: ${date}\nsummary: ${title} summary.\n---\n\n# ${title}\n\nBody of ${title}.\n`;

  afterEach(async () => {
    if (tenantDir) await cleanup(tenantDir);
    await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
  });

  async function buildBlogManifest() {
    tenantDir = await createNestedTenant(TEST_ID, {
      config: {
        title: 'Post Nav Demo',
        layout: 'blog',
        blog: { sidebar: 'hidden', indexTitle: 'Latest posts' },
        collections: [
          {
            path: 'posts',
            route: '/posts',
            title: 'Posts',
            manifest: true,
            sortBy: 'date',
            order: 'desc'
          }
        ]
      },
      directories: {
        posts: {
          files: {
            'alpha.md': post('Alpha', '2026-06-10'),
            'bravo.md': post('Bravo', '2026-05-22'),
            'charlie.md': post('Charlie', '2026-04-30')
          }
        }
      }
    });

    const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
    expect(result.code).toBe(0);

    const manifestFile = path.join(PUBLISHER_ROOT, 'dist', TEST_ID, 'manifest.js');
    // Cache-bust so repeated dynamic imports across tests don't collide.
    const mod = await import(`file://${manifestFile}?t=${Date.now()}`);
    return mod;
  }

  test('SITE_CONFIG exposes the blog index target and title', async () => {
    const { SITE_CONFIG } = await buildBlogManifest();
    expect(SITE_CONFIG.blogIndex).toBe('blog');
    expect(SITE_CONFIG.blogIndexTitle).toBe('Latest posts');
  });

  test('adjacency is scoped to the collection (newest→oldest)', async () => {
    const { getAdjacentSections } = await buildBlogManifest();

    // Newest post: no prev, next is the second post — never the blog index.
    const first = getAdjacentSections('posts/alpha');
    expect(first.prev).toBeNull();
    expect(first.next && first.next.id).toBe('posts/bravo');

    // Middle post: both neighbors are posts.
    const middle = getAdjacentSections('posts/bravo');
    expect(middle.prev && middle.prev.id).toBe('posts/alpha');
    expect(middle.next && middle.next.id).toBe('posts/charlie');

    // Oldest post: prev is a post, next is null (does not wrap to the index).
    const last = getAdjacentSections('posts/charlie');
    expect(last.prev && last.prev.id).toBe('posts/bravo');
    expect(last.next).toBeNull();
  });

  test('the blog index itself is not part of post adjacency', async () => {
    const { getAdjacentSections } = await buildBlogManifest();
    // The synthetic "blog" index has no collection, so it never appears as a
    // post neighbor (verified above) and its own adjacency stays docs-style.
    const atIndex = getAdjacentSections('blog');
    expect(atIndex.prev === null || atIndex.prev.id !== 'blog').toBe(true);
  });
});

// Configurable export (publisher opt-out / scope subset). EXPORT_CONFIG drives
// whether the SPA shows the export button and which scopes it offers.
describe('export configuration', () => {
  const TEST_ID = '__test-export-cfg-' + Date.now();
  let tenantDir;

  afterEach(async () => {
    if (tenantDir) await cleanup(tenantDir);
    await cleanup(path.join(PUBLISHER_ROOT, 'dist', TEST_ID));
  });

  // Read EXPORT_CONFIG from the generated manifest as text. (Dynamic import is
  // avoided here: jest's ESM loader caches by path and ignores the cache-busting
  // query, so successive builds in this block would return the first module.)
  async function buildWithExport(exportCfg) {
    tenantDir = await createNestedTenant(TEST_ID, {
      config: exportCfg === undefined ? {} : { export: exportCfg },
      directories: { docs: { files: { 'index.md': '# Docs\n\nBody.' } } }
    });
    const result = await runBuildTenantsWithRegistry([{ id: TEST_ID }]);
    expect(result.code).toBe(0);
    const distDir = path.join(PUBLISHER_ROOT, 'dist', TEST_ID);
    const files = (await fsp.readdir(distDir)).filter((f) => /^manifest.*\.js$/.test(f));
    let text = '';
    for (const f of files) {
      const t = await fsp.readFile(path.join(distDir, f), 'utf8');
      if (t.includes('EXPORT_CONFIG')) { text = t; break; }
    }
    const m = text.match(/EXPORT_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!m) throw new Error('EXPORT_CONFIG not found in generated manifest');
    return JSON.parse(m[1]);
  }

  test('defaults to enabled with both scopes', async () => {
    const cfg = await buildWithExport(undefined);
    expect(cfg.enabled).toBe(true);
    expect(cfg.scopes).toEqual(['page', 'site']);
  });

  test('export.enabled:false disables export', async () => {
    const cfg = await buildWithExport({ enabled: false });
    expect(cfg.enabled).toBe(false);
  });

  test('a scope subset is honored (and filtered to known scopes)', async () => {
    const cfg = await buildWithExport({ scopes: ['page', 'bogus'] });
    expect(cfg.scopes).toEqual(['page']);
    expect(cfg.enabled).toBe(true);
  });

  test('an empty scope list disables export', async () => {
    const cfg = await buildWithExport({ scopes: [] });
    expect(cfg.enabled).toBe(false);
    expect(cfg.scopes).toEqual([]);
  });
});
