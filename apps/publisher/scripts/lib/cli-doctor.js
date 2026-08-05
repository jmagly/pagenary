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

function commandCapability(id, command, args, purpose, fix, { required = false } = {}) {
  const res = spawnSync(command, args, { encoding: 'utf8', timeout: 3000, windowsHide: true, shell: false });
  const available = res.status === 0;
  const output = String(res.stdout || res.stderr || '').trim().split(/\r?\n/, 1)[0];
  return {
    id,
    kind: 'executable',
    command,
    available,
    required,
    version: available ? (output || 'available (version not reported)') : null,
    purpose,
    diagnostic: available ? null : fix
  };
}

/** Report rich-content renderer support without installing or executing a render. */
export function checkRendererCapabilities() {
  const pkg = readPackageJson();
  const declared = { ...(pkg.dependencies || {}), ...(pkg.optionalDependencies || {}), ...(pkg.devDependencies || {}) };
  const capabilities = [
    {
      id: 'inline-latex',
      kind: 'bundled-library',
      package: 'katex',
      available: Boolean(declared.katex),
      required: true,
      version: declared.katex || null,
      purpose: 'Build-time inline and display LaTeX to HTML + MathML',
      diagnostic: declared.katex ? null : 'Install the publisher dependencies; KaTeX must remain pinned to an exact reviewed version.'
    },
    {
      id: 'mermaid',
      kind: 'bundled-library',
      package: 'mermaid',
      available: Boolean(declared.mermaid),
      required: true,
      version: declared.mermaid || null,
      purpose: 'Pinned local Mermaid rendering (no CDN dependency)',
      diagnostic: declared.mermaid ? null : 'Install the publisher dependencies; Mermaid must remain pinned to an exact reviewed version.'
    },
    commandCapability('latex-standard-web', 'latexmlc', ['--version'], 'Full LaTeX pages using the standard-web-v1 semantic profile', 'Install LaTeXML and put `latexmlc` on PATH, or explicitly select portable-subset-v1 when its limits are acceptable.'),
    commandCapability('latex-portable-subset', 'pandoc', ['--version'], 'Portable LaTeX subset to semantic HTML + MathML', 'Install Pandoc and put `pandoc` on PATH to enable portable-subset-v1.'),
    commandCapability('latex-pdf', 'tectonic', ['--version'], 'Optional LaTeX PDF artifact generation', 'Install Tectonic and put `tectonic` on PATH only when PDF output is required.'),
    commandCapability('plantuml', 'plantuml', ['-version'], 'Build-time PlantUML diagrams', 'Install PlantUML and put `plantuml` on PATH; builds using PlantUML will otherwise follow the configured failure policy.'),
    commandCapability('java', 'java', ['-version'], 'Java runtime for PlantUML jar-based installations', 'Install a supported Java runtime if PlantUML is provided as a jar.')
  ];
  const missingRequired = capabilities.filter((item) => item.required && !item.available);
  const optionalAvailable = capabilities.filter((item) => !item.required && item.available).length;
  return {
    name: 'renderers',
    status: missingRequired.length ? 'fail' : optionalAvailable ? 'pass' : 'warn',
    detail: `${capabilities.filter((item) => item.available).length}/${capabilities.length} renderer capabilities available`,
    fix: missingRequired.length ? missingRequired.map((item) => item.diagnostic).join(' ') : null,
    capabilities
  };
}

const SYMBOL = { pass: '✓', warn: '!', fail: '✗' };

/** Run all diagnostics. Returns the process exit code. */
export function runDoctor({ json = false } = {}) {
  const pkg = readPackageJson();
  const checks = [checkNode(), checkGit(), checkRegistry(), checkBuildConfig(), checkWriteTarget(), checkRendererCapabilities()];
  const failed = checks.filter((c) => c.status === 'fail');
  const ok = failed.length === 0;

  if (json) {
    process.stdout.write(JSON.stringify({
      tool: pkg.name,
      version: pkg.version,
      ok,
      checks,
      renderers: checks.find((check) => check.name === 'renderers').capabilities
    }, null, 2) + '\n');
    return ok ? 0 : 1;
  }

  const lines = [`pagenary doctor — ${pkg.name} v${pkg.version}`, ''];
  for (const c of checks) {
    lines.push(`  ${SYMBOL[c.status] || '?'} ${c.name.padEnd(14)} ${c.detail}`);
    if (c.fix) lines.push(`      → ${c.fix}`);
    if (c.name === 'renderers') {
      for (const renderer of c.capabilities) {
        const label = renderer.available ? renderer.version : 'not found';
        lines.push(`      ${renderer.available ? '✓' : '·'} ${renderer.id.padEnd(22)} ${label}`);
        if (!renderer.available && renderer.diagnostic) lines.push(`        → ${renderer.diagnostic}`);
      }
    }
  }
  lines.push('');
  lines.push(ok ? 'All required checks passed.' : `${failed.length} check(s) failed.`);
  process.stdout.write(lines.join('\n') + '\n');
  return ok ? 0 : 1;
}
