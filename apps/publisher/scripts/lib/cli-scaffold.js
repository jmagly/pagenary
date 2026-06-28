// `pagenary new <name>` / `pagenary init [name]` — scaffold a buildable tenant.
//
// Creates tenants/<name>/{config.json, manifest.json, content/welcome.md} under
// the caller's CWD and registers the tenant in tenants.json, so the result
// builds immediately with `pagenary build <name>`. All paths are caller-relative
// to match build-tenants.js.

import fs from 'node:fs';
import path from 'node:path';
import { resolveRegistryPath } from './cli-util.js';

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

function titleCase(id) {
  return id
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function tenantConfig(id) {
  const title = titleCase(id);
  return {
    title: `${title} Docs`,
    brandMark: title,
    brandSub: 'Docs',
    tagline: 'Where documentation takes shape.',
    description: `Documentation for ${title}.`,
    accentColor: '#111111',
    welcome: {
      eyebrow: 'Getting started',
      headline: `Welcome to ${title}`,
      lead: 'Replace this starter content with your own Markdown in the content/ directory.',
      pillars: [
        'Write docs as plain Markdown files.',
        'Build a fast, searchable static site.',
        'Host it yourself for next to nothing.'
      ]
    }
  };
}

function tenantManifest(id) {
  return {
    default: `${id}-welcome`,
    sections: [
      {
        id: `${id}-welcome`,
        title: 'Welcome',
        summary: 'Starter landing page for this tenant.',
        file: 'welcome.md'
      }
    ]
  };
}

function welcomeMarkdown(id) {
  const title = titleCase(id);
  return [
    `# Welcome to ${title}`,
    '',
    'This is a starter page scaffolded by `pagenary new`. Edit the files in',
    '`content/` and update `manifest.json` to add more sections.',
    '',
    '## Next steps',
    '',
    `- Build this tenant: \`pagenary build ${id}\``,
    '- Preview it: `pagenary serve`',
    '- Add pages under `content/` and register them in `manifest.json`.',
    ''
  ].join('\n');
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function registerTenant(registryPath, id) {
  let registry = { tenants: [] };
  if (fs.existsSync(registryPath)) {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    if (!Array.isArray(registry.tenants)) registry.tenants = [];
  }
  const exists = registry.tenants.some((t) => t && t.id === id);
  if (!exists) {
    registry.tenants.push({ id });
    writeJson(registryPath, registry);
    return 'registered';
  }
  return 'already-registered';
}

/**
 * Scaffold a tenant. Returns the process exit code.
 * @param {string|null} rawName tenant id (defaults to the CWD basename for `init`)
 * @param {{force?: boolean, json?: boolean}} opts
 */
export function scaffoldTenant(rawName, { force = false, json = false } = {}) {
  const id = (rawName || path.basename(process.cwd()) || 'docs').toLowerCase();

  if (!ID_RE.test(id)) {
    const msg = `Invalid tenant id "${id}". Use lowercase letters, digits, and hyphens (must start alphanumeric).`;
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write(`pagenary: ${msg}\n`);
    return 1;
  }

  const tenantDir = path.join(process.cwd(), 'tenants', id);
  const contentDir = path.join(tenantDir, 'content');

  if (fs.existsSync(tenantDir) && !force) {
    const msg = `tenants/${id} already exists. Pass --force to overwrite its starter files.`;
    if (json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write(`pagenary: ${msg}\n`);
    return 1;
  }

  fs.mkdirSync(contentDir, { recursive: true });
  writeJson(path.join(tenantDir, 'config.json'), tenantConfig(id));
  writeJson(path.join(tenantDir, 'manifest.json'), tenantManifest(id));
  fs.writeFileSync(path.join(contentDir, 'welcome.md'), welcomeMarkdown(id));

  const registryPath = resolveRegistryPath(null);
  const registration = registerTenant(registryPath, id);

  if (json) {
    process.stdout.write(
      JSON.stringify({
        ok: true,
        id,
        tenantDir: path.relative(process.cwd(), tenantDir),
        registry: path.relative(process.cwd(), registryPath),
        registration
      }, null, 2) + '\n'
    );
    return 0;
  }

  const rel = path.relative(process.cwd(), tenantDir) || tenantDir;
  process.stdout.write(
    [
      `Created tenant "${id}":`,
      `  ${rel}/config.json`,
      `  ${rel}/manifest.json`,
      `  ${rel}/content/welcome.md`,
      registration === 'registered'
        ? `  Registered in ${path.relative(process.cwd(), registryPath) || 'tenants.json'}`
        : `  Already present in ${path.relative(process.cwd(), registryPath) || 'tenants.json'}`,
      '',
      `Build it:   pagenary build ${id}`,
      `Preview it: pagenary serve`,
      ''
    ].join('\n')
  );
  return 0;
}
