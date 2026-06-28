// `pagenary doctor` — environment + configuration diagnostics.
//
// Checks Node version, git availability, registry/config presence, and write
// access to the default output target. Prints actionable fixes and exits
// non-zero when any check fails. Supports --json for CI consumption.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PKG_ROOT, readPackageJson, resolveRegistryPath } from './cli-util.js';

const MIN_NODE_MAJOR = 16;

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  const ok = major >= MIN_NODE_MAJOR;
  return {
    name: 'node-version',
    status: ok ? 'pass' : 'fail',
    detail: `Node ${process.versions.node} (requires >= ${MIN_NODE_MAJOR})`,
    fix: ok ? null : `Install Node ${MIN_NODE_MAJOR}+ (see https://nodejs.org).`
  };
}

function checkGit() {
  const res = spawnSync('git', ['--version'], { encoding: 'utf8' });
  const ok = res.status === 0;
  return {
    name: 'git',
    status: ok ? 'pass' : 'warn',
    detail: ok ? res.stdout.trim() : 'git not found on PATH',
    fix: ok ? null : 'Install git — required for tenants whose source is a git repo.'
  };
}

function checkRegistry() {
  const registryPath = resolveRegistryPath(null);
  if (!fs.existsSync(registryPath)) {
    return {
      name: 'registry',
      status: 'warn',
      detail: `No tenant registry at ${path.relative(process.cwd(), registryPath) || registryPath}`,
      fix: 'Run `pagenary new <name>` to scaffold a tenant, or pass --registry <path>.'
    };
  }
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const count = Array.isArray(data.tenants) ? data.tenants.length : 0;
    return {
      name: 'registry',
      status: 'pass',
      detail: `${count} tenant(s) configured`,
      fix: null
    };
  } catch (err) {
    return {
      name: 'registry',
      status: 'fail',
      detail: `Registry is not valid JSON: ${err.message}`,
      fix: 'Fix the JSON syntax in your tenant registry.'
    };
  }
}

function checkBuildConfig() {
  const configPath = path.join(PKG_ROOT, 'build.config.json');
  if (!fs.existsSync(configPath)) {
    return {
      name: 'build-config',
      status: 'warn',
      detail: 'No build.config.json (defaults will be used)',
      fix: null
    };
  }
  try {
    JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { name: 'build-config', status: 'pass', detail: 'build.config.json is valid', fix: null };
  } catch (err) {
    return {
      name: 'build-config',
      status: 'fail',
      detail: `build.config.json is not valid JSON: ${err.message}`,
      fix: 'Fix the JSON syntax in build.config.json.'
    };
  }
}

function checkWriteTarget() {
  const target = process.cwd();
  try {
    fs.accessSync(target, fs.constants.W_OK);
    return { name: 'write-target', status: 'pass', detail: `Working directory is writable`, fix: null };
  } catch {
    return {
      name: 'write-target',
      status: 'fail',
      detail: `Working directory is not writable`,
      fix: 'Run from a writable directory or adjust permissions.'
    };
  }
}

const SYMBOL = { pass: '✓', warn: '!', fail: '✗' };

/** Run all diagnostics. Returns the process exit code. */
export function runDoctor({ json = false } = {}) {
  const pkg = readPackageJson();
  const checks = [checkNode(), checkGit(), checkRegistry(), checkBuildConfig(), checkWriteTarget()];
  const failed = checks.filter((c) => c.status === 'fail');
  const ok = failed.length === 0;

  if (json) {
    process.stdout.write(JSON.stringify({ tool: pkg.name, version: pkg.version, ok, checks }, null, 2) + '\n');
    return ok ? 0 : 1;
  }

  const lines = [`pagenary doctor — ${pkg.name} v${pkg.version}`, ''];
  for (const c of checks) {
    lines.push(`  ${SYMBOL[c.status] || '?'} ${c.name.padEnd(14)} ${c.detail}`);
    if (c.fix) lines.push(`      → ${c.fix}`);
  }
  lines.push('');
  lines.push(ok ? 'All required checks passed.' : `${failed.length} check(s) failed.`);
  process.stdout.write(lines.join('\n') + '\n');
  return ok ? 0 : 1;
}
