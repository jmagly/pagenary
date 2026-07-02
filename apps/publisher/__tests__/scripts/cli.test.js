// CLI dispatch, help, version, error-path, and read-only command tests for the
// `pagenary` binary. These exercise the real dispatcher (scripts/lib/cli.js) via
// the bin entry to confirm the documented invocation surface behaves as promised
// in issue #92: grouped help, per-command help, actionable unknown-command
// errors with non-zero exit, --json output, and the doctor/new diagnostics.

import { spawn, spawnSync } from 'node:child_process';
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
    cwd: opts.cwd || PKG_ROOT,
    env: { ...process.env, ...(opts.env || {}) }
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

async function waitForHttp(url, deadlineMs = 5000) {
  const deadline = Date.now() + deadlineMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return res;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw lastErr || new Error(`server not ready at ${url}`);
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
  });
});

describe('pagenary serve mount preview', () => {
  test('serves the only tenant at --mount for deploy-path previews (#107)', async () => {
    const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-serve-'));
    const tenantDir = path.join(tmp, 'dist', 'fortemi-docs');
    await fsp.mkdir(tenantDir, { recursive: true });
    await fsp.writeFile(path.join(tenantDir, 'index.html'), '<!doctype html><title>Fortemi</title>', 'utf8');
    await fsp.writeFile(path.join(tenantDir, 'styles.css'), 'body { color: black; }', 'utf8');

    const port = 22000 + Math.floor(Math.random() * 1000);
    const child = spawn(process.execPath, [SERVE_SCRIPT, '--dev'], {
      cwd: tmp,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        PAGENARY_SERVE_MOUNT: '/server'
      },
      stdio: 'ignore'
    });

    try {
      const rootRes = await waitForHttp(`http://127.0.0.1:${port}/server/`);
      expect(rootRes.status).toBe(200);
      expect(await rootRes.text()).toContain('Fortemi');

      const cssRes = await fetch(`http://127.0.0.1:${port}/server/styles.css`);
      expect(cssRes.status).toBe(200);
      expect(await cssRes.text()).toContain('color: black');
    } finally {
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
      await fsp.rm(tmp, { recursive: true, force: true });
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
