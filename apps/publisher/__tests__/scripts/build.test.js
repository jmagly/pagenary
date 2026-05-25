/**
 * Tests for build.js - Core build pipeline
 *
 * Tests cover:
 * - Directory creation and cleanup
 * - File copying with transformations
 * - Build timestamp injection
 * - Minification toggle (dev vs prod)
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');
const BUILD_SCRIPT = path.join(PUBLISHER_ROOT, 'scripts', 'build.js');

// Helper to run build script with options
function runBuild(env = {}, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [BUILD_SCRIPT, ...args], {
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

// Helper to create temp directory for isolated builds
async function createTempBuildDir() {
  const tempDir = path.join(PUBLISHER_ROOT, '.test-dist-' + Date.now());
  return tempDir;
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
    });

    test('NODE_ENV=development skips minification', async () => {
      const result = await runBuild({
        BUILD_OUTPUT: tempDist,
        NODE_ENV: 'development'
      });

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/dev copy/);
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

    test('production build attempts minification', async () => {
      const result = await runBuild({
        BUILD_OUTPUT: tempDist,
        NODE_ENV: 'production'
      });

      expect(result.code).toBe(0);
      // Should mention minification status (either minified or terser not found)
      expect(result.stdout).toMatch(/minified|Terser/i);
    });
  });

  describe('error handling', () => {
    test('fails gracefully if src directory missing', async () => {
      const tempDir = path.join(PUBLISHER_ROOT, '.test-empty-' + Date.now());
      await fsp.mkdir(tempDir, { recursive: true });

      try {
        const proc = spawn(process.execPath, [BUILD_SCRIPT], {
          cwd: tempDir, // Run from empty directory
          env: { ...process.env },
          stdio: 'pipe'
        });

        const result = await new Promise((resolve) => {
          let stderr = '';
          proc.stderr.on('data', (data) => { stderr += data; });
          proc.on('close', (code) => resolve({ code, stderr }));
        });

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
