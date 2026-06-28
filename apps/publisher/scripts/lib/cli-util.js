// Shared helpers for the pagenary CLI dispatcher.
//
// Path resolution anchors to the installed package (this file lives at
// <pkg>/scripts/lib/cli-util.js), never the caller's CWD, so the right
// generator code runs regardless of where `pagenary` is invoked. Tenant
// source/target/registry paths remain relative to the caller's CWD.

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the package root (where tenants.json / package.json live). */
export const PKG_ROOT = path.resolve(__dirname, '..', '..');
/** Absolute path to the internal scripts directory the CLI delegates to. */
export const SCRIPTS_DIR = path.join(PKG_ROOT, 'scripts');

/** Read the package.json once, tolerating a missing/corrupt file. */
export function readPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  } catch {
    return { name: '@pagenary/publisher', version: '0.0.0' };
  }
}

/**
 * Resolve the tenant registry path using the same precedence as
 * build-tenants.js: explicit override → TENANT_REGISTRY env → <cwd>/tenants.json.
 * Tenant source/registry paths are caller-relative, so the default anchors to
 * the working directory, matching the builder (build-tenants.js `root`).
 */
export function resolveRegistryPath(override) {
  if (override) return path.resolve(process.cwd(), override);
  if (process.env.TENANT_REGISTRY) return path.resolve(process.cwd(), process.env.TENANT_REGISTRY);
  return path.join(process.cwd(), 'tenants.json');
}

/** Spawn an internal script and resolve with its exit code (stdio inherited). */
export function spawnScript(script, args = [], { env } = {}) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: env ? { ...process.env, ...env } : process.env
    });
    child.on('error', (err) => {
      process.stderr.write(`pagenary: failed to run ${script}: ${err.message}\n`);
      resolve(1);
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        // Re-raise the signal so the caller terminates the same way.
        process.kill(process.pid, signal);
      } else {
        resolve(code ?? 0);
      }
    });
  });
}

/** Run an internal script capturing its output; resolves with {code, stdout, stderr}. */
export function captureScript(script, args = [], { env } = {}) {
  return new Promise((resolve) => {
    const scriptPath = path.join(SCRIPTS_DIR, script);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: env ? { ...process.env, ...env } : process.env
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: stderr + err.message }));
    child.on('exit', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

/** True if any of `names` appears as a standalone token in `args`. */
export function hasFlag(args, names) {
  const set = new Set(Array.isArray(names) ? names : [names]);
  return args.some((a) => set.has(a));
}

/**
 * Pull a value flag (`--name value` or `--name=value`) out of an argument list.
 * Returns { value, rest } with the flag and its value removed from `rest`.
 * `value` is null when the flag is absent.
 */
export function extractFlag(args, names) {
  const set = new Set(Array.isArray(names) ? names : [names]);
  const rest = [];
  let value = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const eq = arg.indexOf('=');
    if (eq > 0 && set.has(arg.slice(0, eq))) {
      value = arg.slice(eq + 1);
      continue;
    }
    if (set.has(arg)) {
      value = args[i + 1] ?? null;
      i++; // consume the value token
      continue;
    }
    rest.push(arg);
  }
  return { value, rest };
}

/** Remove specific boolean flags from an argument list. */
export function stripFlags(args, names) {
  const set = new Set(Array.isArray(names) ? names : [names]);
  return args.filter((a) => !set.has(a));
}

/** The first non-flag positional token, or null. */
export function firstPositional(args) {
  return args.find((a) => !a.startsWith('-')) ?? null;
}

/** Classic Levenshtein distance for "did you mean" suggestions. */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return row[n];
}
