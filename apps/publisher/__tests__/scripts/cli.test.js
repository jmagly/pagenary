// CLI dispatch, help, version, error-path, and read-only command tests for the
// `pagenary` binary. These exercise the real dispatcher (scripts/lib/cli.js) via
// the bin entry to confirm the documented invocation surface behaves as promised
// in issue #92: grouped help, per-command help, actionable unknown-command
// errors with non-zero exit, --json output, and the doctor/new diagnostics.

import { spawnSync } from 'node:child_process';
import { startPreviewServer, startManagedProcess, runManagedProcess, fetchWithDeadline } from '../../scripts/lib/process-lifecycle.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..', '..');
const BIN = path.join(PKG_ROOT, 'bin', 'pagenary.mjs');
const SERVE_SCRIPT = path.join(PKG_ROOT, 'scripts', 'serve.js');

/** Run the CLI and capture stdout/stderr/exit code. */
function cli(args, opts = {}) {
  const res = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    timeout: 30000,
    cwd: opts.cwd || PKG_ROOT,
    env: { ...process.env, ...(opts.env || {}) }
  });
  if (res.error) throw res.error;
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

describe('pagenary CLI dispatch', () => {
  test('--help lists grouped commands and exits 0', () => {
    const { code, stdout } = cli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Build & preview:');
    expect(stdout).toContain('build');
    expect(stdout).toContain('serve');
    expect(stdout).toContain('doctor');
    // Hidden aliases must not appear in the grouped listing.
    expect(stdout).not.toContain('build:tenants ');
  });

  test('no command prints help and exits 0', () => {
    const { code, stdout } = cli([]);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage:');
  });

  test('per-command --help documents flags', () => {
    const { code, stdout } = cli(['build', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('pagenary build');
    expect(stdout).toContain('--all');
    expect(stdout).toContain('--target');
    expect(stdout).toContain('--base');
  });

  test('serve --help documents mount preview flags', () => {
    const { code, stdout } = cli(['serve', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('pagenary serve');
    expect(stdout).toContain('--mount');
    expect(stdout).toContain('--base');
  });

  test('--version prints name and version', () => {
    const { code, stdout } = cli(['--version']);
    expect(code).toBe(0);
    expect(stdout).toMatch(/@pagenary\/publisher\s+\d/);
  });

  test('version --json is parseable', () => {
    const { code, stdout } = cli(['version', '--json']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.name).toBe('@pagenary/publisher');
    expect(typeof parsed.version).toBe('string');
  });
});

describe('pagenary CLI error paths', () => {
  test('unknown command exits non-zero with suggestions', () => {
    const { code, stderr } = cli(['biuld']);
    expect(code).toBe(1);
    expect(stderr).toContain('unknown command "biuld"');
    expect(stderr).toContain('Did you mean');
    expect(stderr).toContain('build');
  });

  test('unknown command does not leak internal script paths', () => {
    const { stderr } = cli(['nope']);
    expect(stderr).not.toContain('scripts/');
    expect(stderr).not.toContain('.js');
  });

  test('unknown tenants subcommand exits non-zero', () => {
    const { code, stderr } = cli(['tenants', 'frobnicate']);
    expect(code).toBe(1);
    expect(stderr).toContain('unknown tenants subcommand');
  });

  test('unknown check target exits non-zero', () => {
    const { code, stderr } = cli(['check', 'bogus']);
    expect(code).toBe(1);
    expect(stderr).toContain('unknown check');
  });
});

describe('pagenary read-only commands', () => {
  test('tenants list --json returns an array of tenants', () => {
    const { code, stdout } = cli(['tenants', 'list', '--json']);
    expect(code).toBe(0);
    const tenants = JSON.parse(stdout);
    expect(Array.isArray(tenants)).toBe(true);
    expect(tenants.some((t) => t.id === 'pagenary')).toBe(true);
  });

  test('tenants:list alias works', () => {
    const { code, stdout } = cli(['tenants:list', '--json']);
    expect(code).toBe(0);
    expect(Array.isArray(JSON.parse(stdout))).toBe(true);
  });

  test('doctor --json reports ok and checks', () => {
    const { code, stdout } = cli(['doctor', '--json']);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.ok).toBe(true);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.some((c) => c.name === 'node-version')).toBe(true);
    expect(Array.isArray(report.renderers)).toBe(true);
    expect(report.renderers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'inline-latex', package: 'katex', version: '0.18.1', available: true }),
      expect.objectContaining({ id: 'mermaid', package: 'mermaid', version: '11.16.0', available: true }),
      expect.objectContaining({ id: 'latex-standard-web', command: 'latexmlc' }),
      expect.objectContaining({ id: 'latex-portable-subset', command: 'pandoc' }),
      expect.objectContaining({ id: 'latex-pdf', command: 'tectonic' }),
      expect.objectContaining({ id: 'plantuml', command: 'plantuml' }),
      expect.objectContaining({ id: 'java', command: 'java' })
    ]));
    for (const renderer of report.renderers) {
      expect(typeof renderer.available).toBe('boolean');
      expect(typeof renderer.offlineReady).toBe('boolean');
      expect(Array.isArray(renderer.profiles)).toBe(true);
      expect(renderer.securityProfile).toEqual(expect.any(String));
      if (!renderer.available) expect(renderer.diagnostic).toEqual(expect.any(String));
    }
  });
});

describe('pagenary serve mount preview', () => {
  test('serves the only tenant at --mount for deploy-path previews (#107)', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-serve-'));
    let server;
    try {
      const tenantDir = path.join(tmp, 'dist', 'fortemi-docs');
      await fsp.mkdir(tenantDir, { recursive: true });
      await fsp.writeFile(path.join(tenantDir, 'index.html'), '<!doctype html><title>Fortemi</title>', 'utf8');
      await fsp.writeFile(path.join(tenantDir, 'styles.css'), 'body { color: black; }', 'utf8');
      server = await startPreviewServer(SERVE_SCRIPT, {
        cwd: tmp, env: { PAGENARY_SERVE_MOUNT: '/server' }
      });
      const rootRes = await fetchWithDeadline(`${server.origin}/server/`);
      expect(rootRes.status).toBe(200);
      expect(await rootRes.text()).toContain('Fortemi');
      const cssRes = await fetchWithDeadline(`${server.origin}/server/styles.css`);
      expect(cssRes.status).toBe(200);
      expect(await cssRes.text()).toContain('color: black');
    } finally {
      try { await server?.stop(); }
      finally { await fsp.rm(tmp, { recursive: true, force: true }); }
    }
  });
});

describe('pagenary scaffold (new/init)', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pagenary-cli-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('new <name> scaffolds a tenant and registers it', () => {
    const { code, stdout } = cli(['new', 'acme-docs', '--json'], { cwd: tmp });
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(result.id).toBe('acme-docs');

    expect(fs.existsSync(path.join(tmp, 'tenants', 'acme-docs', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'tenants', 'acme-docs', 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'tenants', 'acme-docs', 'content', 'welcome.md'))).toBe(true);

    const registry = JSON.parse(fs.readFileSync(path.join(tmp, 'tenants.json'), 'utf8'));
    expect(registry.tenants.some((t) => t.id === 'acme-docs')).toBe(true);
  });

  test('new rejects an invalid tenant id', () => {
    const { code, stderr } = cli(['new', 'Bad_Name'], { cwd: tmp });
    expect(code).toBe(1);
    expect(stderr).toContain('Invalid tenant id');
  });

  test('new refuses to overwrite without --force', () => {
    cli(['new', 'dup', '--json'], { cwd: tmp });
    const { code, stderr } = cli(['new', 'dup'], { cwd: tmp });
    expect(code).toBe(1);
    expect(stderr).toContain('already exists');
  });
});


describe('owned child lifecycle failures', () => {
  test('startup failure rejects readiness and cleanup observes an already exited child', async () => {
    const child = startManagedProcess(process.execPath, ['-e', 'process.stderr.write("startup fixture"); process.exit(7)']);
    try {
      await expect(child.waitForOutput(/never-ready/)).rejects.toThrow(/Child exited before readiness/);
      const completed = await child.completion;
      expect(completed.code).toBe(7);
      expect(await child.stop()).toEqual(completed);
    } finally { await child.stop(); }
  });

  test('a stalled process is terminated and reported as a timeout', async () => {
    await expect(runManagedProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {}, 100))
      .rejects.toThrow(/Child exceeded 100ms/);
  });
});


describe('published publisher package', () => {
  test('real prepack bundles the shared contract and detached package builds a tenant', async () => {
    const temporary = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-installed-package-'));
    const stage = path.join(temporary, 'workspace', 'apps', 'publisher');
    const detached = path.join(temporary, 'installed');
    const dependencies = path.resolve(PKG_ROOT, '../..', 'node_modules');
    const childEnv = { ...process.env, NODE_ENV: 'development' };
    delete childEnv.NODE_OPTIONS;
    delete childEnv.NODE_PATH;
    delete childEnv.TENANT_REGISTRY;
    const run = async (command, args, cwd, timeout = 180000) => {
      const result = await runManagedProcess(command, args, { cwd, env: childEnv }, timeout);
      if (result.code !== 0 || result.signal) {
        throw new Error(`Installed-package action failed (${result.code ?? result.signal}) in ${cwd}: ${command}\n${result.stderr}\n${result.stdout}`);
      }
      return result;
    };
    try {
      // Pack in a private source workspace: prepack's site/dist cannot race other
      // publisher tests. Materialize documentation symlinks while copying.
      await fsp.cp(PKG_ROOT, stage, { recursive: true, dereference: true, filter(source) {
        const parts = path.relative(PKG_ROOT, source).split(path.sep);
        return !parts.some(part => ['node_modules', 'dist', 'site', '.cache', '.playwright-mcp', '.git'].includes(part));
      } });
      const canonical = path.join(temporary, 'workspace', 'apps', 'authoring-contract', 'index.cjs');
      await fsp.mkdir(path.dirname(canonical), { recursive: true });
      await fsp.copyFile(path.resolve(PKG_ROOT, '../authoring-contract/index.cjs'), canonical);
      await fsp.symlink(dependencies, path.join(stage, 'node_modules'), 'junction');
      const bundled = path.join(stage, 'scripts/lib/authoring-contract.cjs');
      await fsp.writeFile(bundled, 'module.exports = { staleBundle: true };\n');
      // A stale packed copy must not hide changes to the workspace contract.
      await run(process.execPath, ['--input-type=module', '-e', String.raw`
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        import contract from './scripts/lib/authoring-contract.js';
        const require = createRequire(import.meta.url);
        assert.strictEqual(contract, require('../authoring-contract/index.cjs'));
        assert.equal(contract.staleBundle, undefined);
      `], stage);
      const packed = await run(process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['pack', '--json', '--pack-destination', temporary], stage);
      const [metadata] = JSON.parse(packed.stdout);
      expect(metadata.files.some(file => file.path === 'scripts/lib/authoring-contract.cjs')).toBe(true);
      expect(metadata.files.some(file => file.path === 'site/index.html')).toBe(true);
      await fsp.mkdir(detached);
      await run('tar', ['-xzf', path.join(temporary, metadata.filename), '-C', detached], temporary);
      const installed = path.join(detached, 'package');
      // External dependencies may resolve from the installed dependency tree;
      // publisher code and the authoring contract must come from this tarball.
      const installedMetadata = JSON.parse(await fsp.readFile(path.join(installed, 'package.json'), 'utf8'));
      for (const name of Object.keys({ ...installedMetadata.dependencies, ...installedMetadata.optionalDependencies })) {
        const dependency = path.join(dependencies, name);
        if (!fs.existsSync(dependency) && installedMetadata.optionalDependencies?.[name]) continue;
        const target = path.join(installed, 'node_modules', name);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.symlink(await fsp.realpath(dependency), target, 'junction');
      }
      expect(fs.existsSync(path.join(installed, 'node_modules', '@pagenary'))).toBe(false);
      expect(fs.existsSync(path.join(detached, 'authoring-contract'))).toBe(false);
      await run(process.execPath, ['--input-type=module', '-e', String.raw`
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        import contract from './scripts/lib/authoring-contract.js';
        import { markdownToHtml } from './scripts/build-tenants.js';
        import { createPlantUmlAdapter } from './scripts/lib/plantuml-renderer.js';
        import './scripts/lib/mermaid-build-adapter.js';
        const require = createRequire(import.meta.url);
        assert.strictEqual(contract, require('./scripts/lib/authoring-contract.cjs'));
        const matches = contract.scanRichFences('\x60\x60\x60puml title="Published"\nAlice -> Bob\n\x60\x60\x60');
        assert.equal(matches.length, 1);
        assert.deepEqual(contract.parseRichFenceInfo(matches[0][1], matches[0][2]),
          { authored: 'puml', renderer: 'plantuml', title: 'Published' });
        assert.ok(markdownToHtml('# Installed contract').includes('Installed contract'));
        assert.throws(() => createPlantUmlAdapter(), { code: 'RTC_PLANTUML_UNAVAILABLE' });
      `], installed);
      const project = path.join(temporary, 'consumer');
      await fsp.mkdir(path.join(project, 'content'), { recursive: true });
      await fsp.writeFile(path.join(project, 'content', 'welcome.md'), '# Detached package works\n\nPublished build sentinel.\n');
      await fsp.writeFile(path.join(project, 'tenants.json'), JSON.stringify({ tenants: [{
        id: 'installed', source: { type: 'local', path: './content' }, config: { title: 'Detached package', docsMap: false }
      }] }));
      await run(process.execPath, [path.join(installed, 'bin/pagenary.mjs'), 'build', 'installed', '--registry', 'tenants.json'], project);
      const html = await fsp.readFile(path.join(project, 'dist/installed/index.html'), 'utf8');
      expect(html).toContain('Detached package');
      const section = await fsp.readFile(path.join(project, 'dist/installed/sections/welcome.js'), 'utf8');
      expect(section).toContain('Published build sentinel.');
    } finally {
      await fsp.rm(temporary, { recursive: true, force: true });
    }
  }, 240000);
});
