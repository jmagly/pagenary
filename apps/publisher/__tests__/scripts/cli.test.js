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
