/**
 * Tests for build.js - Core build pipeline
 *
 * Tests cover:
 * - Directory creation and cleanup
 * - File copying with transformations
 * - Build timestamp injection
 * - Reproducible builds with SOURCE_DATE_EPOCH
 * - Minification toggle (dev vs prod)
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'node:os';
import vm from 'node:vm';
import { runManagedProcess } from '../../scripts/lib/process-lifecycle.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');
const BUILD_SCRIPT = path.join(PUBLISHER_ROOT, 'scripts', 'build.js');

// Shared bounded child helper awaits termination on every path.
function runBuild(env = {}, args = [], cwd = PUBLISHER_ROOT) {
  return runManagedProcess(process.execPath, [BUILD_SCRIPT, ...args], {
    cwd, env: { ...process.env, SOURCE_DATE_EPOCH: '', FORCE_MINIFY: '', NODE_ENV: '', ...env }
  }, 45000);
}

async function createTempBuildDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-core-build-'));
}

// Cleanup helper
async function cleanup(dir) {
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
}

describe('build.js', () => {
  describe('basic build functionality', () => {
    let tempDist;

    beforeEach(async () => {
      tempDist = await createTempBuildDir();
    });

    afterEach(async () => {
      await cleanup(tempDist);
    });

    test('creates dist directory from src', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      expect(fs.existsSync(tempDist)).toBe(true);
    });

    test('copies index.html to dist', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      const indexPath = path.join(tempDist, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    test('injects build timestamp into index.html', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      const indexPath = path.join(tempDist, 'index.html');
      const content = await fsp.readFile(indexPath, 'utf8');

      expect(content).toMatch(/x-build/);
      expect(content).toMatch(/content="[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
    });

    test('uses SOURCE_DATE_EPOCH for reproducible build metadata', async () => {
      const epoch = '1704067200';
      const firstDist = tempDist;
      const secondDist = `${tempDist}-second`;
      try {
        const first = await runBuild({ BUILD_OUTPUT: firstDist, SOURCE_DATE_EPOCH: epoch });
        const second = await runBuild({ BUILD_OUTPUT: secondDist, SOURCE_DATE_EPOCH: epoch });

        expect(first.code).toBe(0);
        expect(second.code).toBe(0);
        expect(await fsp.readFile(path.join(firstDist, 'index.html'), 'utf8'))
          .toContain('content="2024-01-01T00:00:00.000Z"');

        async function snapshot(dir) {
          const result = new Map();
          async function visit(current) {
            for (const entry of (await fsp.readdir(current, { withFileTypes: true }))
              .sort((a, b) => a.name.localeCompare(b.name))) {
              const absolute = path.join(current, entry.name);
              const relative = path.relative(dir, absolute);
              if (entry.isDirectory()) await visit(absolute);
              else result.set(relative, await fsp.readFile(absolute));
            }
          }
          await visit(dir);
          return result;
        }

        const firstFiles = await snapshot(firstDist);
        const secondFiles = await snapshot(secondDist);
        expect([...firstFiles.keys()]).toEqual([...secondFiles.keys()]);
        for (const [name, content] of firstFiles) {
          expect(secondFiles.get(name).equals(content)).toBe(true);
        }
      } finally {
        await cleanup(secondDist);
      }
    });

    test('rejects an invalid SOURCE_DATE_EPOCH', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist, SOURCE_DATE_EPOCH: 'not-a-timestamp' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('SOURCE_DATE_EPOCH must be a non-negative integer');
    });

    test('copies JavaScript files to dist', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      const appPath = path.join(tempDist, 'app.js');
      expect(fs.existsSync(appPath)).toBe(true);
    });

    test('copies CSS files to dist', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      const stylesPath = path.join(tempDist, 'styles.css');
      expect(fs.existsSync(stylesPath)).toBe(true);
    });

    test('copies sections directory', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);
      const sectionsDir = path.join(tempDist, 'sections');
      expect(fs.existsSync(sectionsDir)).toBe(true);

      // Check section-templates.js exists
      const templatesPath = path.join(sectionsDir, 'section-templates.js');
      expect(fs.existsSync(templatesPath)).toBe(true);
    });

    test('vendors the pinned Mermaid browser runtime for offline rendering', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist }, ['--dev']);

      expect(result.code).toBe(0);
      const runtimePath = path.join(tempDist, 'vendor', 'mermaid', 'mermaid.min.js');
      expect(fs.existsSync(runtimePath)).toBe(true);
      expect((await fsp.stat(runtimePath)).size).toBeGreaterThan(1_000_000);

      const initializer = await fsp.readFile(path.join(tempDist, 'mermaid-init.js'), 'utf8');
      expect(initializer).toContain('./vendor/mermaid/mermaid.min.js');
      expect(initializer).not.toMatch(/https?:\/\//);
      expect(initializer).toContain("securityLevel: 'strict'");
      expect(initializer).toContain('suppressErrorRendering: true');
      expect(initializer).toContain('maxTextSize: 50000');
      expect(initializer).toContain('deterministicIds: true');
    });

    test('vendors KaTeX CSS and fonts for offline inline LaTeX', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist }, ['--dev']);

      expect(result.code).toBe(0);
      expect(fs.existsSync(path.join(tempDist, 'vendor', 'katex', 'katex.min.css'))).toBe(true);
      expect(fs.existsSync(path.join(tempDist, 'vendor', 'katex', 'fonts', 'KaTeX_Main-Regular.woff2'))).toBe(true);
      const index = await fsp.readFile(path.join(tempDist, 'index.html'), 'utf8');
      expect(index).toContain('./vendor/katex/katex.min.css');
    });
  });

  describe('dev mode', () => {
    let tempDist;

    beforeEach(async () => {
      tempDist = await createTempBuildDir();
    });

    afterEach(async () => {
      await cleanup(tempDist);
    });

    test('--dev flag skips minification', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist }, ['--dev']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/dev copy/);
      expect(await fsp.readFile(path.join(tempDist, 'app.js'), 'utf8'))
        .toBe(await fsp.readFile(path.join(PUBLISHER_ROOT, 'src/app.js'), 'utf8'));
    });

    test('NODE_ENV=development skips minification', async () => {
      const result = await runBuild({
        BUILD_OUTPUT: tempDist,
        NODE_ENV: 'development'
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/dev copy/);
      expect(await fsp.readFile(path.join(tempDist, 'app.js'), 'utf8'))
        .toBe(await fsp.readFile(path.join(PUBLISHER_ROOT, 'src/app.js'), 'utf8'));
    });
  });

  describe('production mode', () => {
    let tempDist;

    beforeEach(async () => {
      tempDist = await createTempBuildDir();
    });

    afterEach(async () => {
      await cleanup(tempDist);
    });

    test('production build minifies code while preserving its behavior', async () => {
      const fixture = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-minify-fixture-'));
      try {
        await fsp.mkdir(path.join(fixture, 'src'));
        const source = '/* a removable fixture comment */\nfunction addNumbers(first, second) { return first + second; }\nglobalThis.answer = addNumbers(19, 23);\n';
        await fsp.writeFile(path.join(fixture, 'src/probe.js'), source);
        const result = await runBuild({ BUILD_OUTPUT: tempDist, NODE_ENV: 'production' }, [], fixture);
        expect(result.code).toBe(0);
        const emitted = await fsp.readFile(path.join(tempDist, 'probe.js'), 'utf8');
        expect(emitted.length).toBeLessThan(source.length);
        expect(emitted).not.toContain('removable fixture comment');
        const context = {};
        vm.runInNewContext(emitted, context, { timeout: 1000 });
        expect(context.answer).toBe(42);
      } finally { await cleanup(fixture); }
    });
  });

  describe('error handling', () => {
    test('fails gracefully if src directory missing', async () => {
      const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-empty-build-'));

      try {
        const result = await runBuild({}, [], tempDir);

        expect(result.code).toBe(1);
        expect(result.stderr).toMatch(/src directory missing/);
      } finally {
        await cleanup(tempDir);
      }
    });
  });

  describe('output structure', () => {
    let tempDist;

    beforeEach(async () => {
      tempDist = await createTempBuildDir();
    });

    afterEach(async () => {
      await cleanup(tempDist);
    });

    test('preserves directory structure from src', async () => {
      const result = await runBuild({ BUILD_OUTPUT: tempDist });

      expect(result.code).toBe(0);

      // Check key files exist at correct paths
      const expectedFiles = [
        'index.html',
        'app.js',
        'styles.css',
        'manifest.js',
        'sections/section-templates.js'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(tempDist, file);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    });
  });
});
