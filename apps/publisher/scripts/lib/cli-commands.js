// Command registry for the pagenary CLI.
//
// Each command declares display metadata (group, summary, usage, flags) plus a
// `run(rest, ctx)` handler returning a Promise<number> exit code. Spawn-based
// commands delegate to internal scripts/*.js; inline commands (doctor, new,
// clean, version) own their output so --json works cleanly. Hidden entries are
// backward-compatible aliases kept out of the help listing.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  spawnScript,
  captureScript,
  readPackageJson,
  resolveRegistryPath,
  extractFlag,
  stripFlags,
  hasFlag,
  firstPositional
} from './cli-util.js';
import { runDoctor } from './cli-doctor.js';
import { scaffoldTenant } from './cli-scaffold.js';

const TENANT_FLAGS = new Set([
  '--all', '--target', '-t', '--registry', '-r', '--incremental', '-i',
  '--diff-only', '--keep-cache', '--clean-cache', '--files', '-f',
  '--cache-dir', '--git-depth', '--no-sparse', '--list'
]);

function flagBase(arg) {
  const eq = arg.indexOf('=');
  return eq > 0 ? arg.slice(0, eq) : arg;
}

// --- build -----------------------------------------------------------------

function runBuild(rest) {
  const positional = firstPositional(rest);
  const usesTenantPath =
    positional !== null || rest.some((a) => TENANT_FLAGS.has(flagBase(a)));
  if (usesTenantPath) {
    // `--all` is a CLI affordance meaning "every tenant" — build-tenants.js
    // builds all tenants when given no positional, so just drop the flag.
    return spawnScript('build-tenants.js', stripFlags(rest, ['--all']));
  }
  return spawnScript('build.js', rest);
}

// --- serve ------------------------------------------------------------------

function runServe(rest) {
  const { value: port, rest: rest2 } = extractFlag(rest, ['--port', '-p']);
  const env = {};
  if (port !== null) {
    if (!/^\d+$/.test(port)) {
      process.stderr.write(`pagenary: --port expects a number, got "${port}"\n`);
      return Promise.resolve(1);
    }
    env.PORT = port;
  }
  return spawnScript('serve.js', rest2, { env });
}

// --- tenants ----------------------------------------------------------------

function readRegistry(rest) {
  const { value: registry } = extractFlag(rest, ['--registry', '-r']);
  const registryPath = resolveRegistryPath(registry);
  if (!fs.existsSync(registryPath)) {
    return { error: `No tenant registry at ${path.relative(process.cwd(), registryPath) || registryPath}` };
  }
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const tenants = Array.isArray(data.tenants) ? data.tenants : [];
    return { registryPath, tenants };
  } catch (err) {
    return { error: `Registry is not valid JSON: ${err.message}` };
  }
}

function tenantsList(rest, { json }) {
  if (json) {
    const { tenants, error } = readRegistry(rest);
    if (error) {
      process.stdout.write(JSON.stringify({ ok: false, error }) + '\n');
      return 1;
    }
    const out = tenants.map((t) => ({
      id: t.id,
      enabled: t.enabled !== false,
      domains: t.domains || [],
      strictLinks: t.strictLinks === true
    }));
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return 0;
  }
  // Human output: delegate to the builder's own listing.
  const passthrough = rest.filter((a) => a !== 'list');
  return spawnScript('build-tenants.js', ['--list', ...passthrough]);
}

function runTenants(rest, ctx) {
  const sub = firstPositional(rest) || 'list';
  const subRest = rest.filter((a) => a !== sub);
  if (sub === 'list') return tenantsList(subRest, ctx);
  if (sub === 'diff') return spawnScript('build-tenants.js', ['--diff-only', ...subRest]);
  process.stderr.write(`pagenary: unknown tenants subcommand "${sub}" (expected: list, diff)\n`);
  return Promise.resolve(1);
}

// --- check ------------------------------------------------------------------

const CHECK_TARGETS = {
  content: ['lint-content.js'],
  accessibility: ['check-accessibility.js', 'check-accessibility-linter.js', 'check-accessibility-report.js'],
  media: ['check-media-renderers.js'],
  narration: ['check-narration.js'],
  reading: ['check-reading-metadata.js'],
  seo: ['seo-smoke.js']
};
// `pagenary check` (no target) mirrors `npm run check`: read-only checks, then
// a build, then the SEO smoke test (which inspects the built dist/).
const CHECK_ALL = ['content', 'accessibility', 'media', 'narration', 'reading', '__build__', 'seo'];

async function checkOne(target, { json }) {
  if (target === '__build__') {
    const code = json ? (await captureScript('build.js', [])).code : await spawnScript('build.js', []);
    return { name: 'build', ok: code === 0, exitCode: code };
  }
  const scripts = CHECK_TARGETS[target];
  let exitCode = 0;
  for (const script of scripts) {
    const code = json ? (await captureScript(script, [])).code : await spawnScript(script, []);
    if (code !== 0) { exitCode = code; if (!json) break; }
  }
  return { name: target, ok: exitCode === 0, exitCode };
}

async function runCheck(rest, { json }) {
  const target = firstPositional(rest);
  if (target && !CHECK_TARGETS[target]) {
    const valid = Object.keys(CHECK_TARGETS).join(', ');
    process.stderr.write(`pagenary: unknown check "${target}" (expected: ${valid})\n`);
    return 1;
  }
  const targets = target ? [target] : CHECK_ALL;
  const results = [];
  let ok = true;
  for (const t of targets) {
    const res = await checkOne(t, { json });
    results.push(res);
    if (!res.ok) { ok = false; if (!json) return res.exitCode; }
  }
  if (json) {
    process.stdout.write(JSON.stringify({ ok, checks: results }, null, 2) + '\n');
  }
  return ok ? 0 : 1;
}

// --- clean ------------------------------------------------------------------

function runClean(rest, { json }) {
  const distDir = path.join(process.cwd(), 'dist');
  let removed = false;
  try {
    if (fs.existsSync(distDir)) { fs.rmSync(distDir, { recursive: true, force: true }); removed = true; }
  } catch (err) {
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    else process.stderr.write(`pagenary: clean failed: ${err.message}\n`);
    return 1;
  }
  if (json) process.stdout.write(JSON.stringify({ ok: true, removed, target: 'dist' }) + '\n');
  else process.stdout.write(removed ? 'Removed dist/.\n' : 'Nothing to clean (dist/ absent).\n');
  return 0;
}

// --- caddy (optional docker passthrough) ------------------------------------

const CADDY_ARGS = {
  up: ['up', '-d', 'caddy'],
  down: ['down'],
  restart: ['restart', 'caddy'],
  reload: ['exec', 'caddy', 'caddy', 'reload', '--config', '/srv/app/Caddyfile'],
  logs: ['logs', '-f', 'caddy']
};

function runCaddy(rest) {
  const sub = firstPositional(rest);
  if (!sub || !CADDY_ARGS[sub]) {
    process.stderr.write(`pagenary: usage: pagenary caddy <${Object.keys(CADDY_ARGS).join('|')}>\n`);
    return Promise.resolve(1);
  }
  return new Promise((resolve) => {
    const child = spawn('docker', ['compose', ...CADDY_ARGS[sub]], { stdio: 'inherit', cwd: process.cwd() });
    child.on('error', (err) => {
      process.stderr.write(`pagenary: docker compose failed: ${err.message}\n`);
      resolve(1);
    });
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

// --- version ----------------------------------------------------------------

function runVersion(_rest, { json }) {
  const pkg = readPackageJson();
  if (json) process.stdout.write(JSON.stringify({ name: pkg.name, version: pkg.version }) + '\n');
  else process.stdout.write(`${pkg.name} ${pkg.version}\n`);
  return 0;
}

// --- registry ---------------------------------------------------------------

export const GROUPS = ['Build & preview', 'Tenants', 'Scaffold', 'Quality', 'Diagnostics', 'Hosting', 'Meta'];

export const COMMANDS = {
  build: {
    group: 'Build & preview',
    summary: 'Build the default bundle, or a tenant / all tenants.',
    usage: 'pagenary build [tenant] [options]',
    flags: [
      ['[tenant]', 'Build a single tenant by id (omit for the default bundle)'],
      ['--all', 'Build every enabled tenant'],
      ['--target <dir>', 'Override the output directory'],
      ['--registry <path>', 'Use an alternate tenant registry'],
      ['--incremental', 'Only rebuild changed content'],
      ['--diff-only', 'Show what changed without building'],
      ['--keep-cache', 'Reuse the git source cache'],
      ['--dev', 'Development build (no minify, default bundle only)']
    ],
    run: (rest) => runBuild(rest)
  },
  serve: {
    group: 'Build & preview',
    summary: 'Serve the built output over HTTP.',
    usage: 'pagenary serve [--dev] [--port <n>]',
    flags: [
      ['--dev', 'Disable caching for local development'],
      ['--port <n>', 'Port to listen on (default 5173, or $PORT)']
    ],
    run: (rest) => runServe(rest)
  },
  tenants: {
    group: 'Tenants',
    summary: 'List or diff configured tenants.',
    usage: 'pagenary tenants <list|diff> [--json] [--registry <path>]',
    flags: [
      ['list', 'List configured tenants'],
      ['diff', 'Show which tenant sources changed'],
      ['--json', 'Machine-readable output (list)'],
      ['--registry <path>', 'Use an alternate tenant registry']
    ],
    run: (rest, ctx) => runTenants(rest, ctx)
  },
  new: {
    group: 'Scaffold',
    summary: 'Scaffold a new tenant (dir + config + starter content).',
    usage: 'pagenary new <name> [--force] [--json]',
    flags: [
      ['<name>', 'Tenant id (lowercase, hyphenated)'],
      ['--force', 'Overwrite an existing tenant directory'],
      ['--json', 'Machine-readable output']
    ],
    run: (rest, ctx) => scaffoldTenant(firstPositional(rest), { force: hasFlag(rest, '--force'), json: ctx.json })
  },
  init: {
    group: 'Scaffold',
    summary: 'Scaffold a tenant named after the current directory.',
    usage: 'pagenary init [name] [--force] [--json]',
    flags: [
      ['[name]', 'Tenant id (defaults to the current directory name)'],
      ['--force', 'Overwrite an existing tenant directory'],
      ['--json', 'Machine-readable output']
    ],
    run: (rest, ctx) => scaffoldTenant(firstPositional(rest), { force: hasFlag(rest, '--force'), json: ctx.json })
  },
  check: {
    group: 'Quality',
    summary: 'Run quality checks (all, or one of seo/accessibility/media/content/reading/narration).',
    usage: 'pagenary check [target] [--json]',
    flags: [
      ['[target]', 'seo | accessibility | media | content | reading | narration'],
      ['--json', 'Machine-readable pass/fail summary']
    ],
    run: (rest, ctx) => runCheck(rest, ctx)
  },
  lint: {
    group: 'Quality',
    summary: 'Lint content for trailing whitespace and tabs.',
    usage: 'pagenary lint',
    flags: [],
    run: (rest) => spawnScript('lint-content.js', rest)
  },
  clean: {
    group: 'Quality',
    summary: 'Remove the dist/ output directory.',
    usage: 'pagenary clean [--json]',
    flags: [['--json', 'Machine-readable output']],
    run: (rest, ctx) => runClean(rest, ctx)
  },
  sync: {
    group: 'Quality',
    summary: 'Regenerate section template modules.',
    usage: 'pagenary sync',
    flags: [],
    run: (rest) => spawnScript('generate-sections.js', rest)
  },
  doctor: {
    group: 'Diagnostics',
    summary: 'Check the environment and configuration; print fixes.',
    usage: 'pagenary doctor [--json]',
    flags: [['--json', 'Machine-readable diagnostics']],
    run: (_rest, ctx) => runDoctor({ json: ctx.json })
  },
  caddy: {
    group: 'Hosting',
    summary: 'Manage the Caddy container for multi-tenant domain testing.',
    usage: 'pagenary caddy <up|down|restart|reload|logs>',
    flags: [],
    run: (rest) => runCaddy(rest)
  },
  version: {
    group: 'Meta',
    summary: 'Print the CLI name and version.',
    usage: 'pagenary version [--json]',
    flags: [['--json', 'Machine-readable output']],
    run: (_rest, ctx) => runVersion(_rest, ctx)
  },

  // --- backward-compatible aliases (hidden from help) ---
  'build:tenants': {
    hidden: true,
    group: 'Build & preview',
    summary: 'Alias: build all tenants (use `pagenary build --all`).',
    run: (rest) => spawnScript('build-tenants.js', stripFlags(rest, ['--all']))
  },
  'build:tenant': {
    hidden: true,
    group: 'Build & preview',
    summary: 'Alias: build a tenant (use `pagenary build <tenant>`).',
    run: (rest) => spawnScript('build-tenants.js', rest)
  },
  'tenants:list': {
    hidden: true,
    group: 'Tenants',
    summary: 'Alias: list tenants (use `pagenary tenants list`).',
    run: (rest, ctx) => tenantsList(rest, ctx)
  },
  'tenants:diff': {
    hidden: true,
    group: 'Tenants',
    summary: 'Alias: diff tenants (use `pagenary tenants diff`).',
    run: (rest) => spawnScript('build-tenants.js', ['--diff-only', ...rest])
  }
};
