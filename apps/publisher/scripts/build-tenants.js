#!/usr/bin/env node
/* Build tenant-specific bundles with optional branding overrides */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { createHash } from 'crypto';
import os from 'os';

const root = process.cwd();
const DEFAULT_TENANTS_DIR = path.join(root, 'tenants');
const DEFAULT_DIST_DIR = path.join(root, 'dist');
const DEFAULT_REGISTRY_PATH = path.join(root, 'tenants.json');
const DEFAULT_CONTENT_DIR = 'content';
const TENANT_MANIFEST = 'manifest.json';
const DIRECTORY_MANIFEST = '_manifest.json';
const MAX_CONTENT_DEPTH = 10;

// Common abbreviations to preserve in title humanization
const ABBREVIATIONS = new Set(['api', 'sdk', 'cli', 'ui', 'ux', 'http', 'https', 'html', 'css', 'js', 'json', 'xml', 'sql', 'nosql', 'jwt', 'oauth', 'ocp', 'tap', 'ieee', 'ptp', 'ntp', 'mev', 'dao', 'nft', 'defi', 'faq', 'id', 'ids', 'url', 'urls', 'uri', 'uris']);

// Git defaults
const DEFAULT_GIT_DEPTH = 1;
const DEFAULT_GIT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const DEFAULT_GIT_RETRIES = 3;
const DEFAULT_CACHE_DIR = path.join(root, '.cache', 'git');

/**
 * Parse CLI arguments
 * Usage: node build-tenants.js [tenant1 tenant2 ...] [options]
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    tenants: [],
    registry: null,
    target: null,
    list: false,
    help: false,
    // Git options
    cacheDir: process.env.GIT_CACHE_DIR || null,
    keepCache: false,
    cleanCache: false,
    gitDepth: parseInt(process.env.GIT_CLONE_DEPTH, 10) || null,
    noSparse: false,
    // Incremental build options
    incremental: false,
    diffOnly: false,
    // Direct file targeting
    files: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === '--target' || arg === '-t') {
      result.target = args[i + 1];
      if (!result.target) {
        console.error('Error: --target requires a path argument');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--registry' || arg === '-r') {
      result.registry = args[i + 1];
      if (!result.registry) {
        console.error('Error: --registry requires a path argument');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--cache-dir') {
      result.cacheDir = args[i + 1];
      if (!result.cacheDir) {
        console.error('Error: --cache-dir requires a path argument');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--git-depth') {
      result.gitDepth = parseInt(args[i + 1], 10);
      if (isNaN(result.gitDepth) || result.gitDepth < 1) {
        console.error('Error: --git-depth requires a positive integer');
        process.exit(1);
      }
      i += 2;
    } else if (arg === '--keep-cache') {
      result.keepCache = true;
      i++;
    } else if (arg === '--clean-cache') {
      result.cleanCache = true;
      i++;
    } else if (arg === '--no-sparse') {
      result.noSparse = true;
      i++;
    } else if (arg === '--incremental' || arg === '-i') {
      result.incremental = true;
      i++;
    } else if (arg === '--diff-only') {
      result.diffOnly = true;
      result.incremental = true; // diff-only implies incremental
      i++;
    } else if (arg === '--files' || arg === '-f') {
      const filesArg = args[i + 1];
      if (!filesArg) {
        console.error('Error: --files requires a comma-separated list of files');
        process.exit(1);
      }
      result.files = filesArg.split(',').map(f => f.trim()).filter(Boolean);
      result.incremental = true; // --files implies incremental mode
      i += 2;
    } else if (arg === '--list' || arg === '-l') {
      result.list = true;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
      i++;
    } else if (arg.startsWith('-')) {
      console.error(`Error: Unknown option ${arg}`);
      process.exit(1);
    } else {
      result.tenants.push(arg);
      i++;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
Usage: node build-tenants.js [tenant...] [options]

Build tenant-specific documentation bundles.

Arguments:
  tenant              One or more tenant IDs to build (default: all tenants)

Options:
  -r, --registry      Path to tenant registry JSON file (default: tenants.json)
  -t, --target        Override target directory for all tenants
  -l, --list          List available tenants and exit
  -h, --help          Show this help message

Git Source Options:
  --cache-dir         Directory for caching git clones (default: .cache/git/)
  --keep-cache        Preserve git cache after build (default: clean up)
  --clean-cache       Force fresh git clones, ignoring cache
  --git-depth         Override clone depth for all git sources (default: 1)
  --no-sparse         Disable sparse checkout for monorepo paths

Incremental Build Options:
  -i, --incremental   Enable incremental builds (only rebuild changed content)
  --diff-only         Show changed files without building (implies --incremental)
  -f, --files         Comma-separated list of content files to rebuild (implies --incremental)

Environment Variables:
  TENANT_REGISTRY     Path to tenant registry (alternative to --registry)
  GIT_CACHE_DIR       Default cache directory for git clones
  GIT_CLONE_DEPTH     Default clone depth (default: 1)
  GIT_TERMINAL_PROMPT Set to 0 to disable interactive git prompts (recommended for CI)
  GIT_SSH_COMMAND     Custom SSH command (e.g., "ssh -i ~/.ssh/deploy_key")
  GIT_CREDENTIALS     HTTPS credentials in "username:token" format (not logged)

Registry Format (tenants.json):
  {
    "tenants": [
      {
        "id": "tenant-alpha",
        "enabled": true,
        "source": { "type": "local", "path": "/path/to/source" },
        "target": { "type": "local", "path": "/path/to/target" },
        "domains": ["alpha.example.com"],
        "config": { "title": "Alpha Docs" }
      },
      {
        "id": "tenant-beta",
        "source": {
          "type": "git",
          "url": "https://github.com/org/docs.git",
          "ref": "main",
          "path": "tenant-beta/"
        }
      }
    ]
  }

Git Source Properties:
  type      "git" (required)
  url       Git repository URL (HTTPS or SSH)
  ref       Branch, tag, or commit SHA (default: "main")
  path      Subdirectory within repo (default: repo root)
  sparse    Use sparse checkout for path (default: false)
  depth     Clone depth (default: 1)

Examples:
  node build-tenants.js                              Build all tenants
  node build-tenants.js tenant-alpha                 Build only tenant-alpha
  node build-tenants.js --registry /etc/tenants.json Use external registry
  node build-tenants.js tenant-alpha -t /var/www     Build one, override target
  node build-tenants.js --clean-cache                Force fresh git clones
  node build-tenants.js --list                       Show available tenants
  node build-tenants.js --incremental --keep-cache   Pull updates, rebuild only changed
  node build-tenants.js --diff-only                  Show what changed without building
  node build-tenants.js tenant-alpha -f launch-checklist.md  Rebuild single file
`);
}

async function pathExists(target) {
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Expand environment variables in a path string
 * Supports $VAR and ${VAR} syntax
 */
function expandEnvVars(pathStr) {
  if (!pathStr) return pathStr;
  return pathStr
    .replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] || '')
    .replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name) => process.env[name] || '');
}

/**
 * Resolve a path relative to publisher root, expanding env vars
 */
function resolvePath(pathStr, base = root) {
  if (!pathStr) return null;
  const expanded = expandEnvVars(pathStr);
  if (path.isAbsolute(expanded)) {
    return expanded;
  }
  return path.resolve(base, expanded);
}

/**
 * Check if git is available
 */
function isGitAvailable() {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a command with timeout and retry
 */
async function execWithRetry(command, options = {}) {
  const {
    cwd = root,
    timeout = DEFAULT_GIT_TIMEOUT,
    retries = DEFAULT_GIT_RETRIES,
    env = process.env
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const proc = spawn('sh', ['-c', command], {
          cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...env, GIT_TERMINAL_PROMPT: '0' },
          timeout
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
          }
        });

        proc.on('error', (err) => {
          reject(new Error(`Command error: ${err.message}`));
        });
      });
    } catch (err) {
      lastError = err;
      // Check if this is a retryable error (network issues)
      const isRetryable = err.message.includes('Could not resolve host') ||
                          err.message.includes('Connection refused') ||
                          err.message.includes('Connection timed out') ||
                          err.message.includes('Network is unreachable');

      if (!isRetryable || attempt === retries) {
        break;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`  ↳ Retry ${attempt}/${retries} in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Generate cache key for git source
 */
function getCacheKey(source) {
  const { url, ref = 'main', path: subPath = '' } = source;
  const hash = createHash('sha256')
    .update(`${url}:${ref}:${subPath}`)
    .digest('hex')
    .slice(0, 12);
  return `git-${hash}`;
}

/**
 * Check if a ref is immutable (tag or commit SHA)
 */
function isImmutableRef(ref) {
  // Commit SHA is 40 hex characters
  if (/^[0-9a-f]{40}$/i.test(ref)) return true;
  // Short SHA is 7+ hex characters (less reliable)
  if (/^[0-9a-f]{7,39}$/i.test(ref)) return true;
  // Version tags typically start with v
  if (/^v?\d+\.\d+/.test(ref)) return true;
  return false;
}

/**
 * Get the current HEAD commit SHA
 */
async function getHeadCommit(repoDir) {
  try {
    const { stdout } = await execWithRetry(`git -C "${repoDir}" rev-parse HEAD`, { cwd: root, retries: 1 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get list of changed files between two commits
 * Returns { added: [], modified: [], deleted: [] }
 */
async function getChangedFiles(repoDir, oldCommit, newCommit, subPath = '.') {
  const changes = { added: [], modified: [], deleted: [] };

  if (!oldCommit || !newCommit || oldCommit === newCommit) {
    return changes;
  }

  try {
    // Use --name-status to get file status (A=added, M=modified, D=deleted)
    const { stdout } = await execWithRetry(
      `git -C "${repoDir}" diff --name-status ${oldCommit} ${newCommit}`,
      { cwd: root, retries: 1 }
    );

    const lines = stdout.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const [status, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t'); // Handle filenames with tabs

      // Filter to subPath if specified
      if (subPath !== '.' && !filePath.startsWith(subPath + '/') && filePath !== subPath) {
        continue;
      }

      // Normalize path relative to subPath
      const relativePath = subPath === '.' ? filePath : filePath.slice(subPath.length + 1);

      if (!relativePath) continue;

      switch (status.charAt(0)) {
        case 'A':
          changes.added.push(relativePath);
          break;
        case 'M':
          changes.modified.push(relativePath);
          break;
        case 'D':
          changes.deleted.push(relativePath);
          break;
        case 'R': // Renamed - treat as add + delete
          changes.deleted.push(relativePath);
          if (pathParts[1]) {
            const newPath = subPath === '.' ? pathParts[1] : pathParts[1].slice(subPath.length + 1);
            if (newPath) changes.added.push(newPath);
          }
          break;
      }
    }
  } catch (err) {
    console.warn(`  ↳ could not compute diff: ${err.message}`);
  }

  return changes;
}

/**
 * Create a change result object
 */
function createChangeResult(sourcePath, type, oldCommit = null, newCommit = null, files = null) {
  return {
    sourcePath,
    changes: {
      type, // 'full' | 'incremental' | 'none'
      oldCommit,
      newCommit,
      files: files || { added: [], modified: [], deleted: [] }
    }
  };
}

/**
 * Clone or update a git repository with change tracking
 * Returns { sourcePath, changes: { type, oldCommit, newCommit, files } }
 */
async function cloneGitSource(source, cacheDir, options = {}) {
  const { url, ref = 'main', path: subPath = '.', sparse = false, depth = DEFAULT_GIT_DEPTH } = source;
  const { cleanCache = false, noSparse = false, gitDepth = null, incremental = false } = options;

  const effectiveDepth = gitDepth || depth;
  const effectiveSparse = sparse && !noSparse && subPath !== '.';

  const cacheKey = getCacheKey(source);
  const cloneDir = path.join(cacheDir, cacheKey);

  // Sanitize URL for logging (hide credentials)
  const safeUrl = url.replace(/\/\/[^@]+@/, '//***@');

  console.log(`  ↳ git source: ${safeUrl}`);
  console.log(`  ↳ ref: ${ref}, path: ${subPath || '(root)'}`);

  // Resolve the final source path
  const resolvedPath = subPath === '.' ? cloneDir : path.join(cloneDir, subPath);

  // Check cache
  const cacheExists = await pathExists(cloneDir);
  let oldCommit = null;
  let newCommit = null;
  let wasCloned = false;

  if (cacheExists && !cleanCache) {
    const isImmutable = isImmutableRef(ref);

    if (isImmutable) {
      console.log(`  ↳ using cached clone (immutable ref)`);
      // For immutable refs with cache, nothing changed
      newCommit = await getHeadCommit(cloneDir);

      if (!(await pathExists(resolvedPath))) {
        throw new Error(`Subdirectory '${subPath}' not found in repository ${safeUrl}`);
      }

      return createChangeResult(resolvedPath, 'none', newCommit, newCommit);
    } else {
      // Mutable ref - need to fetch and check for changes
      oldCommit = await getHeadCommit(cloneDir);
      console.log(`  ↳ updating cached clone...`);
      console.log(`  ↳ current HEAD: ${oldCommit ? oldCommit.slice(0, 7) : 'unknown'}`);

      try {
        await execWithRetry(`git -C "${cloneDir}" fetch origin ${ref} --depth ${effectiveDepth}`, { cwd: root });
        await execWithRetry(`git -C "${cloneDir}" checkout FETCH_HEAD`, { cwd: root });
        newCommit = await getHeadCommit(cloneDir);
        console.log(`  ↳ updated HEAD: ${newCommit ? newCommit.slice(0, 7) : 'unknown'}`);
      } catch (err) {
        console.warn(`  ↳ fetch failed, will re-clone: ${err.message}`);
        await fsp.rm(cloneDir, { recursive: true, force: true });
        oldCommit = null; // Force full rebuild
      }
    }
  }

  // Clone if not cached or cache was cleared
  if (!(await pathExists(cloneDir))) {
    console.log(`  ↳ cloning repository...`);
    await fsp.mkdir(cacheDir, { recursive: true });
    wasCloned = true;

    // Build clone command
    let cloneCmd = `git clone --depth ${effectiveDepth}`;

    // Add branch/ref
    // For commits, we can't use --branch, need to fetch after
    if (!isImmutableRef(ref) || /^v?\d+\.\d+/.test(ref)) {
      cloneCmd += ` --branch ${ref}`;
    }

    // Sparse checkout preparation
    if (effectiveSparse) {
      cloneCmd += ' --filter=blob:none --sparse';
    }

    cloneCmd += ` "${url}" "${cloneDir}"`;

    try {
      await execWithRetry(cloneCmd, { cwd: root });

      // If ref is a commit SHA, checkout after clone
      if (/^[0-9a-f]{7,40}$/i.test(ref) && !/^v?\d+\.\d+/.test(ref)) {
        await execWithRetry(`git -C "${cloneDir}" fetch --depth ${effectiveDepth} origin ${ref}`, { cwd: root });
        await execWithRetry(`git -C "${cloneDir}" checkout ${ref}`, { cwd: root });
      }

      // Set up sparse checkout if needed
      if (effectiveSparse) {
        await execWithRetry(`git -C "${cloneDir}" sparse-checkout set "${subPath}"`, { cwd: root });
      }

      newCommit = await getHeadCommit(cloneDir);
      console.log(`  ↳ cloned at: ${newCommit ? newCommit.slice(0, 7) : 'unknown'}`);
    } catch (err) {
      // Clean up partial clone on failure
      await fsp.rm(cloneDir, { recursive: true, force: true }).catch(() => {});

      // Provide helpful error message
      if (err.message.includes('Authentication failed') ||
          err.message.includes('could not read Username')) {
        throw new Error(`Git authentication failed for ${safeUrl}. Check SSH keys or GIT_CREDENTIALS env var.`);
      }
      if (err.message.includes('not found') || err.message.includes('does not exist')) {
        throw new Error(`Git ref '${ref}' not found in ${safeUrl}`);
      }
      throw err;
    }
  }

  // Validate the path exists
  if (!(await pathExists(resolvedPath))) {
    throw new Error(`Subdirectory '${subPath}' not found in repository ${safeUrl}`);
  }

  // Determine change type and compute diff if incremental
  if (wasCloned || !oldCommit) {
    // Fresh clone - full build required
    return createChangeResult(resolvedPath, 'full', null, newCommit);
  }

  if (oldCommit === newCommit) {
    // No changes
    console.log(`  ↳ no changes detected`);
    return createChangeResult(resolvedPath, 'none', oldCommit, newCommit);
  }

  // Changes detected - compute diff if incremental mode
  if (incremental) {
    console.log(`  ↳ computing changes...`);
    const files = await getChangedFiles(cloneDir, oldCommit, newCommit, subPath);
    const totalChanges = files.added.length + files.modified.length + files.deleted.length;
    console.log(`  ↳ ${totalChanges} file(s) changed (${files.added.length} added, ${files.modified.length} modified, ${files.deleted.length} deleted)`);
    return createChangeResult(resolvedPath, 'incremental', oldCommit, newCommit, files);
  }

  // Not incremental mode - treat as full build
  return createChangeResult(resolvedPath, 'full', oldCommit, newCommit);
}

/**
 * Resolve source to a local path (handles git cloning)
 * Returns { sourcePath, changes } for git sources, or { sourcePath, changes: null } for local
 */
async function resolveSource(source, cacheDir, options = {}) {
  if (source.type === 'git') {
    return await cloneGitSource(source, cacheDir, options);
  }
  // Local source - no change tracking
  return {
    sourcePath: source.resolvedPath,
    changes: null // Local sources don't track changes
  };
}

/**
 * Clean up git cache
 */
async function cleanupCache(cacheDir, keep = false) {
  if (keep) {
    console.log(`Git cache preserved at: ${cacheDir}`);
    return;
  }
  if (await pathExists(cacheDir)) {
    await fsp.rm(cacheDir, { recursive: true, force: true });
  }
}

/**
 * Load tenant registry from JSON file or fall back to directory scan
 */
async function loadRegistry(registryPath) {
  const effectivePath = registryPath || process.env.TENANT_REGISTRY || DEFAULT_REGISTRY_PATH;

  // Try to load registry file
  if (await pathExists(effectivePath)) {
    try {
      const raw = await fsp.readFile(effectivePath, 'utf8');
      const registry = JSON.parse(raw);
      console.log(`Loaded registry from ${effectivePath}`);
      return normalizeRegistry(registry);
    } catch (err) {
      console.error(`Error loading registry ${effectivePath}: ${err.message}`);
      process.exit(1);
    }
  }

  // Fall back to scanning tenants/ directory
  if (await pathExists(DEFAULT_TENANTS_DIR)) {
    console.log('No registry found, scanning tenants/ directory...');
    return await scanTenantsDirectory();
  }

  // No registry and no tenants directory
  return { tenants: [], defaults: getDefaultConfig() };
}

/**
 * Get default source/target configuration
 */
function getDefaultConfig() {
  return {
    source: { type: 'local', path: './tenants' },
    target: { type: 'local', path: './dist' }
  };
}

/**
 * Normalize registry structure and apply defaults
 */
function normalizeRegistry(registry) {
  const defaults = { ...getDefaultConfig(), ...(registry.defaults || {}) };
  const tenants = (registry.tenants || []).map(tenant => normalizeTenant(tenant, defaults));
  return { tenants, defaults };
}

/**
 * Normalize a single tenant entry with defaults
 */
function normalizeTenant(tenant, defaults) {
  const id = tenant.id;
  if (!id) {
    throw new Error('Tenant entry missing required "id" field');
  }

  // Source resolution
  let source = tenant.source || {};
  const sourceType = source.type || 'local';

  if (sourceType === 'git') {
    // Git source - validate required fields
    if (!source.url) {
      throw new Error(`Tenant ${id}: git source requires 'url' field`);
    }
    source = {
      type: 'git',
      url: source.url,
      ref: source.ref || 'main',
      path: source.path || '.',
      sparse: source.sparse || false,
      depth: source.depth || DEFAULT_GIT_DEPTH
    };
  } else {
    // Local source
    if (!source.path) {
      const basePath = defaults.source?.path || './tenants';
      source = { type: 'local', path: path.join(basePath, id) };
    }
    source.type = 'local';
    source.resolvedPath = resolvePath(source.path);
  }

  // Target resolution
  let target = tenant.target || {};
  if (!target.path) {
    const basePath = defaults.target?.path || './dist';
    target = { type: 'local', path: path.join(basePath, id) };
  }
  target.type = target.type || 'local';
  target.resolvedPath = resolvePath(target.path);

  return {
    id,
    enabled: tenant.enabled !== false,
    source,
    target,
    domains: tenant.domains || [],
    config: tenant.config || {}
  };
}

/**
 * Scan tenants/ directory and create registry entries for each subdirectory
 */
async function scanTenantsDirectory() {
  const defaults = getDefaultConfig();
  const entries = await fsp.readdir(DEFAULT_TENANTS_DIR, { withFileTypes: true });
  const tenants = entries
    .filter(entry => entry.isDirectory())
    .map(entry => normalizeTenant({ id: entry.name }, defaults));

  return { tenants, defaults };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function runBuild(buildOutput) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join('scripts', 'build.js')], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, BUILD_OUTPUT: buildOutput }
    });
    proc.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Build failed for ${buildOutput} (exit ${code})`));
    });
    proc.on('error', reject);
  });
}

async function copyDirectory(from, to) {
  const entries = await fsp.readdir(from, { withFileTypes: true });
  await fsp.mkdir(to, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else if (entry.isFile()) {
      await fsp.mkdir(path.dirname(destPath), { recursive: true });
      await fsp.copyFile(sourcePath, destPath);
    }
  }
}

async function applyBranding(distDir, config, tenantId) {
  const indexPath = path.join(distDir, 'index.html');
  if (!(await pathExists(indexPath))) return;
  let html = await fsp.readFile(indexPath, 'utf8');
  let mutated = false;

  if (config.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(config.title)}</title>`);
    mutated = true;
  }
  if (config.description) {
    html = html.replace(
      /<meta name="description" content="[^"]*" \/>/,
      `<meta name="description" content="${escapeAttr(config.description)}" />`
    );
    mutated = true;
  }
  if (config.brandMark) {
    html = html.replace(
      /class="brand-mark">[^<]*</,
      `class="brand-mark">${escapeHtml(config.brandMark)}<`
    );
    mutated = true;
  }
  if (config.brandSub) {
    html = html.replace(
      /class="brand-sub">[^<]*</,
      `class="brand-sub">${escapeHtml(config.brandSub)}<`
    );
    mutated = true;
  }
  if (config.tagline) {
    html = html.replace(
      /<span>Reusable patterns for multi-tenant services\.<\/span>/,
      `<span>${escapeHtml(config.tagline)}</span>`
    );
    mutated = true;
  }

  if (mutated) {
    await fsp.writeFile(indexPath, html, 'utf8');
    console.log(`  ↳ applied branding to ${tenantId}`);
  }
}

async function applyAccent(distDir, config, tenantId) {
  if (!config.accentColor) return;
  const stylesPath = path.join(distDir, 'styles.css');
  if (!(await pathExists(stylesPath))) return;
  let css = await fsp.readFile(stylesPath, 'utf8');
  const updated = css.replace(/(--accent:\s*)([^;]+);/, `$1${config.accentColor};`);
  if (updated !== css) {
    await fsp.writeFile(stylesPath, updated, 'utf8');
    console.log(`  ↳ updated accent color for ${tenantId}`);
  }
}

function renderList(items, tag) {
  if (!Array.isArray(items) || items.length === 0) return '';
  const lis = items.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n');
  return `<${tag}>\n${lis}\n      </${tag}>`;
}

function renderLinks(links) {
  if (!Array.isArray(links) || links.length === 0) return '';
  const lis = links
    .map((link) => {
      if (!link || typeof link !== 'object') return '';
      const href = link.href ? escapeAttr(link.href) : '#';
      const label = escapeHtml(link.label || 'Link');
      return `        <li><a href="${href}">${label}</a></li>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<ul>\n${lis}\n      </ul>`;
}

async function applyWelcome(distDir, config, tenantId) {
  if (!config.welcome) return;
  const welcomePath = path.join(distDir, 'sections', 'welcome-overview.js');
  if (!(await pathExists(welcomePath))) return;
  const welcome = config.welcome;
  const eyebrow = escapeHtml(welcome.eyebrow || 'Welcome');
  const headline = escapeHtml(welcome.headline || 'Welcome');
  const lead = escapeHtml(welcome.lead || 'Tailor this intro per tenant.');
  const pillars = renderList(welcome.pillars, 'ul');
  const checklist = renderList(welcome.checklist, 'ol');
  const links = renderLinks(welcome.quickLinks);
  const quote = welcome.quote ? escapeHtml(welcome.quote) : null;

  const sections = [
    '  <div class="doc-content">',
    '    <header>',
    `      <p class="eyebrow">${eyebrow}</p>`,
    `      <h1>${headline}</h1>`,
    `      <p class="lead">${lead}</p>`,
    '    </header>'
  ];

  if (pillars) {
    sections.push('    <div>', '      <h2>Value pillars</h2>', `      ${pillars}`, '    </div>');
  }
  if (checklist) {
    sections.push('    <div>', '      <h2>Launch checklist</h2>', `      ${checklist}`, '    </div>');
  }
  if (links) {
    sections.push('    <aside>', '      <h3>Quick links</h3>', `      ${links}`, '    </aside>');
  }
  if (quote) {
    sections.push('    <blockquote>', `      <p>${quote}</p>`, '    </blockquote>');
  }
  sections.push('  </div>');

  const html = [
    '<section class="section doc" data-template="welcome">',
    ...sections,
    '</section>'
  ].join('\n');

  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.writeFile(welcomePath, moduleSource, 'utf8');
  console.log(`  ↳ customized welcome section for ${tenantId}`);
}

function parseInlineMarkdown(input) {
  if (!input) return '';
  let output = input.replace(/\r\n/g, '\n');
  // Links: [label](href)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  });
  // Bold: **text**
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: _text_
  output = output.replace(/_([^_]+)_/g, '<em>$1</em>');
  return escapeHtml(output)
    .replace(/&lt;strong&gt;([^]*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
    .replace(/&lt;em&gt;([^]*?)&lt;\/em&gt;/g, '<em>$1</em>')
    .replace(/&lt;a href=&quot;([^&]*)&quot;&gt;([^]*?)&lt;\/a&gt;/g, '<a href="$1">$2</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let inList = false;
  let inBlockquote = false;

  function closeList() {
    if (inList) {
      chunks.push('</ul>');
      inList = false;
    }
  }

  function openBlockquote() {
    if (!inBlockquote) {
      chunks.push('<blockquote>');
      inBlockquote = true;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      chunks.push('</blockquote>');
      inBlockquote = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      closeBlockquote();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = Math.min(headingMatch[1].length, 6);
      const text = parseInlineMarkdown(headingMatch[2].trim());
      chunks.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    const listMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (listMatch) {
      closeBlockquote();
      if (!inList) {
        chunks.push('<ul>');
        inList = true;
      }
      const item = parseInlineMarkdown(listMatch[1].trim());
      chunks.push(`<li>${item}</li>`);
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      closeList();
      openBlockquote();
      const quoteLine = parseInlineMarkdown(quoteMatch[1]);
      chunks.push(`<p>${quoteLine}</p>`);
      continue;
    }

    closeList();
    closeBlockquote();
    const paragraph = parseInlineMarkdown(line);
    chunks.push(`<p>${paragraph}</p>`);
  }

  closeList();
  closeBlockquote();

  const body = chunks.join('\n');
  return `
<section class="section doc markdown">
  <div class="doc-content">
${body.split('\n').map((line) => (line ? `    ${line}` : '')).join('\n')}
  </div>
</section>
`.trim();
}

async function pruneSectionsDirectory(sectionsDir, keepFiles) {
  if (!(await pathExists(sectionsDir))) return;
  const entries = await fsp.readdir(sectionsDir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    if (keepFiles.has(entry.name)) return;
    const target = path.join(sectionsDir, entry.name);
    if (entry.isDirectory()) {
      await fsp.rm(target, { recursive: true, force: true });
    } else {
      await fsp.rm(target, { force: true });
    }
  }));
}

async function ensureHtmlModule(sourcePath, targetPath) {
  const html = await fsp.readFile(sourcePath, 'utf8');
  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, moduleSource, 'utf8');
}

async function ensureMarkdownModule(sourcePath, targetPath) {
  const raw = await fsp.readFile(sourcePath, 'utf8');
  const html = markdownToHtml(raw);
  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, moduleSource, 'utf8');
}

async function ensureJavascriptModule(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(sourcePath, targetPath);
}

// ============================================================================
// Nested Content Directory Support (ADR-010)
// ============================================================================

/**
 * Check if a file/directory name should be excluded from content discovery
 * Excludes: dot-prefixed (.), underscore-prefixed (_), and 'overrides' directory
 */
function isExcludedName(name) {
  return name.startsWith('.') || name.startsWith('_') || name === 'overrides';
}

/**
 * Check if a file is a content file based on extension
 */
function isContentFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.md', '.markdown', '.html', '.htm', '.js', '.mjs'].includes(ext);
}

/**
 * Convert filename or directory name to human-readable title
 * - Strips extension
 * - Replaces hyphens/underscores with spaces
 * - Title cases words (preserving abbreviations)
 */
function humanizeTitle(name) {
  // Strip extension if present
  const stem = name.replace(/\.[^.]+$/, '');

  // Replace hyphens and underscores with spaces
  const words = stem.replace(/[-_]+/g, ' ').trim().split(/\s+/);

  // Title case each word, preserving abbreviations
  return words.map(word => {
    const lower = word.toLowerCase();
    if (ABBREVIATIONS.has(lower)) {
      return lower.toUpperCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Derive section ID from filesystem path
 * - index.md -> parent directory ID
 * - file.md -> parentId/filename (without extension)
 */
function deriveSectionId(parentId, name, isIndex = false) {
  const stem = name.replace(/\.[^.]+$/, ''); // Strip extension

  if (isIndex || stem === 'index') {
    // index.md resolves to parent directory ID
    return parentId || stem;
  }

  if (parentId) {
    return `${parentId}/${stem}`;
  }
  return stem;
}

/**
 * Encode section ID for use in output filename
 * Replaces / with -- to create flat output structure
 */
function encodePathForFilename(sectionId) {
  return sectionId.replace(/\//g, '--');
}

/**
 * Load optional _manifest.json from a directory
 * Returns manifest data or null if not present/invalid
 */
async function loadDirectoryManifest(dirPath) {
  const manifestPath = path.join(dirPath, DIRECTORY_MANIFEST);
  if (!(await pathExists(manifestPath))) {
    return null;
  }

  try {
    const raw = await fsp.readFile(manifestPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`  ↳ warning: unable to parse ${DIRECTORY_MANIFEST} in ${dirPath}: ${err.message}`);
    return null;
  }
}

/**
 * Determine content root type and path for a tenant source directory
 * Returns: { type: 'nested' | 'flat' | 'root' | 'none', basePath: string }
 *
 * Priority:
 * 1. If content/ directory exists -> 'flat' (legacy mode)
 * 2. If subdirectories contain content files -> 'nested'
 * 3. If root has content files -> 'root'
 * 4. Otherwise -> 'none'
 */
async function findContentRoot(sourceDir) {
  // Check for traditional content/ subdirectory FIRST (backward compatibility)
  const contentDir = path.join(sourceDir, DEFAULT_CONTENT_DIR);
  const hasContentDir = await pathExists(contentDir);

  if (hasContentDir) {
    return { type: 'flat', basePath: contentDir };
  }

  // Check for content files directly in root (excluding special files)
  const rootEntries = await fsp.readdir(sourceDir, { withFileTypes: true });
  const rootContentFiles = rootEntries.filter(e =>
    e.isFile() && isContentFile(e.name) && !isExcludedName(e.name)
  );

  // Check for nested directories with content
  const subdirs = rootEntries.filter(e =>
    e.isDirectory() && !isExcludedName(e.name)
  );

  let hasNestedContent = false;
  for (const dir of subdirs) {
    const dirPath = path.join(sourceDir, dir.name);
    const dirEntries = await fsp.readdir(dirPath, { withFileTypes: true });
    if (dirEntries.some(e => e.isFile() && isContentFile(e.name) && !isExcludedName(e.name))) {
      hasNestedContent = true;
      break;
    }
  }

  // Nested structure: subdirectories contain content files
  if (hasNestedContent) {
    return { type: 'nested', basePath: sourceDir };
  }

  // Root-level content: files directly in source root
  if (rootContentFiles.length > 0) {
    return { type: 'root', basePath: sourceDir };
  }

  return { type: 'none', basePath: null };
}

/**
 * Recursively scan a directory for content files and subdirectories
 * Returns array of manifest entries with proper section IDs
 */
async function scanContentDirectory(dirPath, parentId, context, depth = 0) {
  if (depth > MAX_CONTENT_DEPTH) {
    console.warn(`  ↳ warning: maximum content depth (${MAX_CONTENT_DEPTH}) exceeded at ${dirPath}`);
    return [];
  }

  const sections = [];
  const manifest = await loadDirectoryManifest(dirPath);

  // Read directory contents
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });

  // Separate files and directories
  const files = entries.filter(e =>
    e.isFile() && isContentFile(e.name) && !isExcludedName(e.name)
  );
  const subdirs = entries.filter(e =>
    e.isDirectory() && !isExcludedName(e.name)
  );

  // Process index file first (if exists)
  const indexFile = files.find(f => /^index\.(md|markdown|html|htm|js|mjs)$/i.test(f.name));
  if (indexFile) {
    const sectionId = parentId || path.basename(dirPath);
    const title = manifest?.title || humanizeTitle(path.basename(dirPath));
    const summary = manifest?.summary || '';

    // Calculate relative path from content root
    const relPath = path.relative(context.contentRoot, path.join(dirPath, indexFile.name));

    sections.push({
      id: sectionId,
      title,
      summary,
      file: relPath,
      _isIndex: true
    });
  }

  // Process other content files
  for (const file of files) {
    if (indexFile && file.name === indexFile.name) continue; // Skip index, already processed

    const sectionId = deriveSectionId(parentId, file.name);
    const manifestEntry = manifest?.sections?.find(s =>
      s.id === sectionId || s.file === file.name || s.id === file.name.replace(/\.[^.]+$/, '')
    );

    const title = manifestEntry?.title || humanizeTitle(file.name);
    const summary = manifestEntry?.summary || '';
    const relPath = path.relative(context.contentRoot, path.join(dirPath, file.name));

    sections.push({
      id: sectionId,
      title,
      summary,
      file: relPath
    });
  }

  // Process subdirectories
  for (const subdir of subdirs) {
    const subdirPath = path.join(dirPath, subdir.name);
    const subdirId = deriveSectionId(parentId, subdir.name);
    const subdirManifest = await loadDirectoryManifest(subdirPath);

    const title = subdirManifest?.title || humanizeTitle(subdir.name);
    const summary = subdirManifest?.summary || '';

    const subsections = await scanContentDirectory(subdirPath, subdirId, context, depth + 1);

    if (subsections.length > 0) {
      // Check if there's an index page that should be the group's landing
      const indexEntry = subsections.find(s => s._isIndex);

      if (indexEntry) {
        // Remove index from subsections, it becomes the group itself
        const otherSections = subsections.filter(s => !s._isIndex);
        sections.push({
          id: subdirId,
          title,
          summary,
          file: indexEntry.file,
          subsections: otherSections.length > 0 ? otherSections : undefined
        });
      } else {
        // No index, just a group with subsections
        sections.push({
          id: subdirId,
          title,
          summary,
          subsections
        });
      }
    }
  }

  // Apply ordering from manifest or sort alphabetically
  if (manifest?.order && Array.isArray(manifest.order)) {
    const orderMap = new Map(manifest.order.map((id, idx) => [id, idx]));
    sections.sort((a, b) => {
      const aOrder = orderMap.get(a.id) ?? orderMap.get(a.id.split('/').pop()) ?? 999;
      const bOrder = orderMap.get(b.id) ?? orderMap.get(b.id.split('/').pop()) ?? 999;
      return aOrder - bOrder;
    });
  } else {
    // Alphabetical sort, but index always first
    sections.sort((a, b) => {
      if (a._isIndex) return -1;
      if (b._isIndex) return 1;
      return a.title.localeCompare(b.title);
    });
  }

  return sections;
}

/**
 * Process scanned sections into built modules
 * Materializes content files and builds manifest entries
 */
async function materializeScannedSections(sections, context) {
  const processed = [];

  for (const section of sections) {
    const { id, title, summary, file, subsections } = section;

    // Process subsections recursively
    let processedSubsections;
    if (subsections && subsections.length > 0) {
      processedSubsections = await materializeScannedSections(subsections, context);
    }

    // If this section has a file, materialize it
    if (file) {
      const sourcePath = path.join(context.contentRoot, file);
      if (!(await pathExists(sourcePath))) {
        console.warn(`  ↳ ${context.tenantId}: missing content file ${file}`);
        continue;
      }

      const ext = path.extname(sourcePath).toLowerCase();
      const outFile = `${encodePathForFilename(id)}.js`;
      const targetPath = path.join(context.sectionsDir, outFile);
      context.keepFiles.add(outFile);

      try {
        if (ext === '.md' || ext === '.markdown') {
          await ensureMarkdownModule(sourcePath, targetPath);
        } else if (ext === '.html' || ext === '.htm') {
          await ensureHtmlModule(sourcePath, targetPath);
        } else if (ext === '.js' || ext === '.mjs') {
          await ensureJavascriptModule(sourcePath, targetPath);
        } else {
          console.warn(`  ↳ ${context.tenantId}: unsupported extension ${ext} for ${file}`);
          continue;
        }
      } catch (err) {
        console.error(`  ↳ ${context.tenantId}: failed to generate module for ${file} (${err.message})`);
        continue;
      }

      context.leafOrder.push(id);

      if (processedSubsections && processedSubsections.length > 0) {
        processed.push({
          id,
          title,
          summary,
          module: `./sections/${outFile}`,
          subsections: processedSubsections
        });
      } else {
        processed.push({ id, title, summary, module: `./sections/${outFile}` });
      }
    } else if (processedSubsections && processedSubsections.length > 0) {
      // Group without its own content
      processed.push({ id, title, summary, subsections: processedSubsections });
    }
  }

  return processed;
}

/**
 * Process tenant content using nested directory scanning (ADR-010)
 */
async function processNestedContent(sourceDir, distDir, tenantId, contentRoot) {
  const sectionsDir = path.join(distDir, 'sections');
  const keepFiles = new Set(['section-templates.js']);
  await pruneSectionsDirectory(sectionsDir, keepFiles);

  const context = {
    contentRoot: contentRoot.basePath,
    sectionsDir,
    tenantId,
    keepFiles,
    leafOrder: []
  };

  // Scan content directory tree
  const scannedSections = await scanContentDirectory(contentRoot.basePath, null, context);

  if (scannedSections.length === 0) {
    console.warn(`  ↳ ${tenantId}: no content found in ${contentRoot.basePath}`);
    return;
  }

  // Materialize all sections
  const processedManifest = await materializeScannedSections(scannedSections, context);

  if (processedManifest.length === 0) {
    console.warn(`  ↳ ${tenantId}: no sections materialized`);
    return;
  }

  // Determine default section
  const defaultSection = context.leafOrder[0];

  // Generate manifest.js
  const manifestModule = buildManifestModuleSource(processedManifest, defaultSection);
  await fsp.writeFile(path.join(distDir, 'manifest.js'), manifestModule, 'utf8');
  console.log(`  ↳ applied nested content structure for ${tenantId} (${context.leafOrder.length} sections)`);
}

// ============================================================================
// End Nested Content Directory Support
// ============================================================================

async function processManifestEntries(entries, context) {
  const processed = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const id = entry.id;
    if (!id) {
      console.warn('  ↳ manifest entry missing id, skipping');
      continue;
    }
    const title = entry.title || id;
    const summary = entry.summary || '';
    if (Array.isArray(entry.sections) && entry.sections.length) {
      const subsections = await processManifestEntries(entry.sections, context);
      processed.push({ id, title, summary, subsections });
      continue;
    }

    const modulePath = await materializeSectionModule(entry, context);
    if (modulePath) {
      context.leafOrder.push(id);
      processed.push({ id, title, summary, module: modulePath });
    }
  }
  return processed;
}

async function materializeSectionModule(entry, context) {
  const id = entry.id;
  const relPath = entry.file || `${id}.md`;
  const sourcePath = path.join(context.contentDir, relPath);
  if (!(await pathExists(sourcePath))) {
    console.warn(`  ↳ ${context.tenantId}: missing content file ${relPath}`);
    return null;
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const outFile = `${id}.js`;
  const targetPath = path.join(context.sectionsDir, outFile);
  context.keepFiles.add(outFile);

  try {
    if (ext === '.md' || ext === '.markdown') {
      await ensureMarkdownModule(sourcePath, targetPath);
    } else if (ext === '.html' || ext === '.htm') {
      await ensureHtmlModule(sourcePath, targetPath);
    } else if (ext === '.js' || ext === '.mjs') {
      await ensureJavascriptModule(sourcePath, targetPath);
    } else {
      console.warn(`  ↳ ${context.tenantId}: unsupported extension ${ext} for ${relPath}`);
      return null;
    }
  } catch (err) {
    console.error(`  ↳ ${context.tenantId}: failed to generate module for ${relPath} (${err.message})`);
    return null;
  }

  return `./sections/${outFile}`;
}

function buildManifestModuleSource(manifestEntries, defaultSection) {
  const manifestJson = JSON.stringify(manifestEntries, null, 2);
  const defaultJson = JSON.stringify(defaultSection || null);
  return `export const MANIFEST = ${manifestJson};\nexport const DEFAULT_SECTION = ${defaultJson};\n\nconst SECTION_INDEX = new Map();\n\nfunction registerEntry(entry, parentId = null) {\n  if (parentId) entry.parentId = parentId;\n  SECTION_INDEX.set(entry.id, entry);\n  if (Array.isArray(entry.subsections)) {\n    entry.subsections.forEach((child) => registerEntry(child, entry.id));\n  }\n}\n\nMANIFEST.forEach((entry) => registerEntry(entry));\n\nexport function findSection(id) {\n  return SECTION_INDEX.get(id) || null;\n}\n`;
}

/**
 * Main entry point for processing tenant content
 * Detects content structure type and delegates to appropriate processor
 */
async function processTenantContent(sourceDir, distDir, tenantId) {
  // Detect content structure type
  const contentRoot = await findContentRoot(sourceDir);

  // Check for explicit manifest.json (legacy or hybrid mode)
  const manifestPath = path.join(sourceDir, TENANT_MANIFEST);
  const hasManifest = await pathExists(manifestPath);

  if (contentRoot.type === 'none' && !hasManifest) {
    console.warn(`  ↳ ${tenantId}: no content found`);
    return;
  }

  // If nested structure detected, use new processing
  if (contentRoot.type === 'nested' || contentRoot.type === 'root') {
    // Check if manifest exists and has explicit file mappings (hybrid mode)
    if (hasManifest) {
      try {
        const raw = await fsp.readFile(manifestPath, 'utf8');
        const manifestData = JSON.parse(raw);
        const entries = Array.isArray(manifestData) ? manifestData : manifestData.sections;

        // Check if any entry uses type: "directory" or lacks explicit file mappings
        const hasDirectoryType = entries?.some(e => e.type === 'directory');
        const hasExplicitFiles = entries?.every(e => e.file || e.sections);

        if (hasDirectoryType || !hasExplicitFiles) {
          // Use nested content processing
          await processNestedContent(sourceDir, distDir, tenantId, contentRoot);
          return;
        }
      } catch {
        // Fall through to nested processing if manifest is invalid
      }
    }

    // No manifest or manifest doesn't fully define structure - use nested scanning
    await processNestedContent(sourceDir, distDir, tenantId, contentRoot);
    return;
  }

  // Flat content/ structure with manifest - use legacy processing
  if (hasManifest && contentRoot.type === 'flat') {
    await processTenantManifestLegacy(sourceDir, distDir, tenantId);
    return;
  }

  // Fallback: try legacy processing
  if (hasManifest) {
    await processTenantManifestLegacy(sourceDir, distDir, tenantId);
  }
}

/**
 * Legacy manifest processing for flat content/ structure
 * Preserved for backward compatibility with existing tenants
 */
async function processTenantManifestLegacy(sourceDir, distDir, tenantId) {
  const manifestPath = path.join(sourceDir, TENANT_MANIFEST);
  if (!(await pathExists(manifestPath))) return;
  const contentDir = path.join(sourceDir, DEFAULT_CONTENT_DIR);
  if (!(await pathExists(contentDir))) {
    console.warn(`  ↳ ${tenantId}: manifest found but no content directory`);
    return;
  }

  let manifestData;
  try {
    const raw = await fsp.readFile(manifestPath, 'utf8');
    manifestData = JSON.parse(raw);
  } catch (err) {
    console.warn(`  ↳ ${tenantId}: unable to parse manifest.json (${err.message})`);
    return;
  }

  const entries = Array.isArray(manifestData) ? manifestData : manifestData.sections;
  if (!Array.isArray(entries) || entries.length === 0) {
    console.warn(`  ↳ ${tenantId}: manifest has no sections`);
    return;
  }

  const sectionsDir = path.join(distDir, 'sections');
  const keepFiles = new Set(['section-templates.js']);
  await pruneSectionsDirectory(sectionsDir, keepFiles);

  const context = {
    contentDir,
    sectionsDir,
    tenantId,
    keepFiles,
    leafOrder: []
  };

  const processedManifest = await processManifestEntries(entries, context);
  if (!processedManifest.length) {
    console.warn(`  ↳ ${tenantId}: manifest did not produce any sections`);
    return;
  }

  const defaultSection = manifestData.default || manifestData.defaultSection || context.leafOrder[0];
  const manifestModule = buildManifestModuleSource(processedManifest, defaultSection);
  await fsp.writeFile(path.join(distDir, 'manifest.js'), manifestModule, 'utf8');
  console.log(`  ↳ applied manifest-driven content for ${tenantId}`);
}

/**
 * Print change summary for diff-only mode
 */
function printChangeSummary(tenantId, changes) {
  if (!changes) {
    console.log(`  ${tenantId}: local source (no change tracking)`);
    return;
  }

  const { type, oldCommit, newCommit, files } = changes;

  if (type === 'none') {
    console.log(`  ${tenantId}: no changes (${newCommit?.slice(0, 7) || 'unknown'})`);
    return;
  }

  if (type === 'full') {
    console.log(`  ${tenantId}: full rebuild required`);
    if (newCommit) {
      console.log(`    commit: ${newCommit.slice(0, 7)}`);
    }
    return;
  }

  // Incremental changes
  console.log(`  ${tenantId}: ${oldCommit?.slice(0, 7)} → ${newCommit?.slice(0, 7)}`);

  if (files.added.length > 0) {
    console.log(`    added (${files.added.length}):`);
    files.added.forEach(f => console.log(`      + ${f}`));
  }
  if (files.modified.length > 0) {
    console.log(`    modified (${files.modified.length}):`);
    files.modified.forEach(f => console.log(`      ~ ${f}`));
  }
  if (files.deleted.length > 0) {
    console.log(`    deleted (${files.deleted.length}):`);
    files.deleted.forEach(f => console.log(`      - ${f}`));
  }
}

/**
 * Build a single tenant using registry entry
 * Returns { success, changes } where changes contains git diff info if applicable
 */
async function buildTenant(tenant, targetOverride, cacheDir, buildOptions) {
  const tenantId = tenant.id;
  const targetDir = targetOverride
    ? path.join(resolvePath(targetOverride), tenantId)
    : tenant.target.resolvedPath;

  // Resolve source (handles git cloning with change tracking)
  let sourceResult;
  try {
    sourceResult = await resolveSource(tenant.source, cacheDir, buildOptions);
  } catch (err) {
    console.error(`  ↳ Failed to resolve source: ${err.message}`);
    return { success: false, changes: null };
  }

  const { sourcePath: sourceDir, changes } = sourceResult;

  // Handle diff-only mode - just return the changes
  if (buildOptions.diffOnly) {
    printChangeSummary(tenantId, changes);
    return { success: true, changes };
  }

  // Check for explicit file targeting (--files option)
  const hasExplicitFiles = buildOptions.files && buildOptions.files.length > 0;

  // Handle incremental mode with no changes (only if not explicitly targeting files)
  if (!hasExplicitFiles && buildOptions.incremental && changes?.type === 'none') {
    console.log(`Skipping ${tenantId}: no changes detected`);
    return { success: true, changes };
  }

  // Validate source exists
  if (!(await pathExists(sourceDir))) {
    console.warn(`Skipping ${tenantId}: source directory not found at ${sourceDir}`);
    return { success: false, changes };
  }

  // Load config from registry or source directory
  let config = { ...tenant.config };
  const configPath = path.join(sourceDir, 'config.json');
  if (await pathExists(configPath)) {
    try {
      const raw = await fsp.readFile(configPath, 'utf8');
      const fileConfig = JSON.parse(raw);
      // Registry config takes precedence over file config
      config = { ...fileConfig, ...config };
    } catch (err) {
      console.warn(`  ↳ ${tenantId}: unable to parse config.json (${err.message})`);
    }
  }

  // Build to a temporary location in dist/ first, then copy to target
  const buildOutput = path.join('dist', tenantId);
  const distDir = path.join(root, 'dist', tenantId);

  console.log(`Building tenant ${tenantId}`);
  console.log(`  source: ${sourceDir}`);
  console.log(`  target: ${targetDir}`);

  // Determine build mode
  // Priority: explicit files > git incremental > full build
  const isExplicitFileBuild = hasExplicitFiles;
  const isGitIncrementalBuild = !hasExplicitFiles && buildOptions.incremental && changes?.type === 'incremental';
  const isIncrementalBuild = isExplicitFileBuild || isGitIncrementalBuild;

  if (isExplicitFileBuild) {
    // Explicit file targeting - create synthetic change set
    const explicitFiles = {
      added: [],
      modified: buildOptions.files.map(f => f.startsWith('content/') ? f : `content/${f}`),
      deleted: []
    };
    console.log(`  mode: targeted (${explicitFiles.modified.length} file(s) specified)`);

    // For targeted builds, we need the base build to exist
    if (!(await pathExists(distDir))) {
      console.log(`  ↳ no existing build found, performing full build first`);
      await runBuild(buildOutput);
      await processTenantContent(sourceDir, distDir, tenantId);
    }

    // Process only the specified files
    await processIncrementalManifest(sourceDir, distDir, tenantId, explicitFiles);
  } else if (isGitIncrementalBuild) {
    console.log(`  mode: incremental (${changes.files.added.length + changes.files.modified.length} files to process)`);

    // For incremental builds, we need the base build to exist
    if (!(await pathExists(distDir))) {
      console.log(`  ↳ no existing build found, performing full build`);
      await runBuild(buildOutput);
    }

    // Process only changed content files
    await processIncrementalManifest(sourceDir, distDir, tenantId, changes.files);
  } else {
    console.log(`  mode: full`);
    await runBuild(buildOutput);

    // Process full manifest from source directory
    await processTenantContent(sourceDir, distDir, tenantId);
  }

  // Apply branding and config
  if (Object.keys(config).length > 0) {
    await applyBranding(distDir, config, tenantId);
    await applyAccent(distDir, config, tenantId);
    await applyWelcome(distDir, config, tenantId);
  }

  // Apply file overrides from source
  const overridesDir = path.join(sourceDir, 'overrides');
  if (await pathExists(overridesDir)) {
    await copyDirectory(overridesDir, distDir);
    console.log(`  ↳ applied file overrides for ${tenantId}`);
  }

  // Copy to final target if different from dist
  if (targetDir !== distDir) {
    // Ensure target parent exists
    await fsp.mkdir(path.dirname(targetDir), { recursive: true });

    // For incremental builds, sync changes rather than full copy
    if (isIncrementalBuild && (await pathExists(targetDir))) {
      await syncChangesToTarget(distDir, targetDir, changes.files);
      console.log(`  ↳ synced changes to ${targetDir}`);
    } else {
      // Remove existing target if it exists
      if (await pathExists(targetDir)) {
        await fsp.rm(targetDir, { recursive: true, force: true });
      }
      await copyDirectory(distDir, targetDir);
      console.log(`  ↳ deployed to ${targetDir}`);
    }
  }

  console.log(`Tenant ${tenantId} ready`);
  return { success: true, changes };
}

/**
 * Sync only changed files to target directory
 */
async function syncChangesToTarget(srcDir, targetDir, files) {
  // Handle added and modified files
  const toCopy = [...files.added, ...files.modified];
  for (const relPath of toCopy) {
    // Map content file to section JS module
    const sectionId = path.basename(relPath, path.extname(relPath));
    const srcFile = path.join(srcDir, 'sections', `${sectionId}.js`);
    const destFile = path.join(targetDir, 'sections', `${sectionId}.js`);

    if (await pathExists(srcFile)) {
      await fsp.mkdir(path.dirname(destFile), { recursive: true });
      await fsp.copyFile(srcFile, destFile);
    }
  }

  // Handle deleted files
  for (const relPath of files.deleted) {
    const sectionId = path.basename(relPath, path.extname(relPath));
    const destFile = path.join(targetDir, 'sections', `${sectionId}.js`);

    if (await pathExists(destFile)) {
      await fsp.rm(destFile, { force: true });
    }
  }

  // Always sync manifest.js as it may have changed
  const manifestSrc = path.join(srcDir, 'manifest.js');
  const manifestDest = path.join(targetDir, 'manifest.js');
  if (await pathExists(manifestSrc)) {
    await fsp.copyFile(manifestSrc, manifestDest);
  }
}

/**
 * Process only changed content files for incremental builds
 */
async function processIncrementalManifest(sourceDir, distDir, tenantId, changedFiles) {
  const contentDir = path.join(sourceDir, DEFAULT_CONTENT_DIR);
  const sectionsDir = path.join(distDir, 'sections');

  // Ensure sections directory exists
  await fsp.mkdir(sectionsDir, { recursive: true });

  // Build file-to-sectionId map from manifest
  const fileToSectionId = await buildFileToSectionMap(sourceDir);

  // Filter to content files only
  const contentFiles = [...changedFiles.added, ...changedFiles.modified]
    .filter(f => f.startsWith('content/') || f.startsWith(DEFAULT_CONTENT_DIR + '/'))
    .map(f => f.replace(/^content\//, ''));

  console.log(`  ↳ processing ${contentFiles.length} changed content file(s)`);

  for (const relPath of contentFiles) {
    const sourcePath = path.join(contentDir, relPath);

    if (!(await pathExists(sourcePath))) {
      console.warn(`  ↳ ${tenantId}: changed file not found: ${relPath}`);
      continue;
    }

    const ext = path.extname(sourcePath).toLowerCase();
    // Use manifest section ID if available, otherwise fall back to filename
    const sectionId = fileToSectionId.get(relPath) || path.basename(relPath, ext);
    const targetPath = path.join(sectionsDir, `${sectionId}.js`);

    try {
      if (ext === '.md' || ext === '.markdown') {
        await ensureMarkdownModule(sourcePath, targetPath);
        console.log(`  ↳ updated: ${sectionId} (markdown)`);
      } else if (ext === '.html' || ext === '.htm') {
        await ensureHtmlModule(sourcePath, targetPath);
        console.log(`  ↳ updated: ${sectionId} (html)`);
      } else if (ext === '.js' || ext === '.mjs') {
        await ensureJavascriptModule(sourcePath, targetPath);
        console.log(`  ↳ updated: ${sectionId} (js)`);
      }
    } catch (err) {
      console.error(`  ↳ ${tenantId}: failed to update ${relPath}: ${err.message}`);
    }
  }

  // Handle deleted content files
  const deletedContent = changedFiles.deleted
    .filter(f => f.startsWith('content/') || f.startsWith(DEFAULT_CONTENT_DIR + '/'))
    .map(f => f.replace(/^content\//, ''));

  for (const relPath of deletedContent) {
    const ext = path.extname(relPath);
    // Use manifest section ID if available, otherwise fall back to filename
    const sectionId = fileToSectionId.get(relPath) || path.basename(relPath, ext);
    const targetPath = path.join(sectionsDir, `${sectionId}.js`);

    if (await pathExists(targetPath)) {
      await fsp.rm(targetPath, { force: true });
      console.log(`  ↳ removed: ${sectionId}`);
    }
  }

  // Check if manifest.json was modified
  const manifestChanged = changedFiles.added.includes('manifest.json') ||
                          changedFiles.modified.includes('manifest.json');

  if (manifestChanged) {
    console.log(`  ↳ manifest.json changed, regenerating manifest.js`);
    await processTenantContent(sourceDir, distDir, tenantId);
  }
}

/**
 * Build a map from content file paths to manifest section IDs
 * This allows incremental builds to use the correct output filename
 */
async function buildFileToSectionMap(sourceDir) {
  const fileToId = new Map();
  const manifestPath = path.join(sourceDir, TENANT_MANIFEST);

  if (!(await pathExists(manifestPath))) {
    return fileToId;
  }

  try {
    const raw = await fsp.readFile(manifestPath, 'utf8');
    const manifestData = JSON.parse(raw);
    const entries = Array.isArray(manifestData) ? manifestData : manifestData.sections;

    if (Array.isArray(entries)) {
      collectFileToIdMappings(entries, fileToId);
    }
  } catch {
    // If manifest can't be read, return empty map (will fall back to filename)
  }

  return fileToId;
}

/**
 * Recursively collect file → section ID mappings from manifest entries
 */
function collectFileToIdMappings(entries, map) {
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;

    if (Array.isArray(entry.sections) && entry.sections.length) {
      collectFileToIdMappings(entry.sections, map);
    } else if (entry.id && entry.file) {
      // Map the file path to the section ID
      map.set(entry.file, entry.id);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);

  // Handle --help
  if (args.help) {
    printHelp();
    return;
  }

  // Load registry
  const registry = await loadRegistry(args.registry);

  // Check for git sources and validate git availability
  const hasGitSources = registry.tenants.some(t => t.source.type === 'git');
  if (hasGitSources && !isGitAvailable()) {
    console.error('Error: Git sources configured but git is not available. Please install git.');
    process.exit(1);
  }

  // Handle --list
  if (args.list) {
    if (registry.tenants.length === 0) {
      console.log('No tenants found.');
    } else {
      console.log('Available tenants:');
      registry.tenants.forEach((t) => {
        const status = t.enabled ? '' : ' (disabled)';
        console.log(`  - ${t.id}${status}`);
        if (t.source.type === 'git') {
          const safeUrl = t.source.url.replace(/\/\/[^@]+@/, '//***@');
          console.log(`      source: git ${safeUrl}`);
          console.log(`              ref: ${t.source.ref}, path: ${t.source.path || '(root)'}`);
        } else {
          console.log(`      source: ${t.source.resolvedPath}`);
        }
        console.log(`      target: ${t.target.resolvedPath}`);
        if (t.domains.length > 0) {
          console.log(`      domains: ${t.domains.join(', ')}`);
        }
      });
    }
    return;
  }

  if (registry.tenants.length === 0) {
    console.log('No tenant configurations detected.');
    return;
  }

  // Determine which tenants to build
  let tenantsToBuild = registry.tenants.filter(t => t.enabled);
  if (args.tenants.length > 0) {
    const allIds = registry.tenants.map(t => t.id);
    const invalid = args.tenants.filter(t => !allIds.includes(t));
    if (invalid.length > 0) {
      console.error(`Error: Unknown tenant(s): ${invalid.join(', ')}`);
      console.error(`Available tenants: ${allIds.join(', ')}`);
      process.exit(1);
    }
    tenantsToBuild = registry.tenants.filter(t => args.tenants.includes(t.id));
  }

  if (tenantsToBuild.length === 0) {
    console.log('No tenants to build (all may be disabled).');
    return;
  }

  // Validate target override if specified
  if (args.target) {
    const targetPath = resolvePath(args.target);
    const targetParent = path.dirname(targetPath);
    if (!(await pathExists(targetParent))) {
      console.error(`Error: Target parent directory does not exist: ${targetParent}`);
      process.exit(1);
    }
    if (!(await pathExists(targetPath))) {
      await fsp.mkdir(targetPath, { recursive: true });
      console.log(`Created target directory: ${targetPath}`);
    }
  }

  // Set up cache directory
  const cacheDir = args.cacheDir || DEFAULT_CACHE_DIR;

  // Clean cache if requested
  if (args.cleanCache && await pathExists(cacheDir)) {
    console.log(`Cleaning git cache at ${cacheDir}...`);
    await fsp.rm(cacheDir, { recursive: true, force: true });
  }

  // Build options for all tenants
  const buildOptions = {
    cleanCache: args.cleanCache,
    noSparse: args.noSparse,
    gitDepth: args.gitDepth,
    incremental: args.incremental,
    diffOnly: args.diffOnly,
    files: args.files
  };

  // Handle diff-only mode header
  if (args.diffOnly) {
    console.log(`Checking ${tenantsToBuild.length} tenant(s) for changes...`);
    console.log('');
  } else {
    // Build tenants header
    let mode = 'full';
    if (args.files.length > 0) {
      mode = `files: ${args.files.join(', ')}`;
    } else if (args.incremental) {
      mode = 'incremental';
    }
    console.log(`Building ${tenantsToBuild.length} tenant(s) [${mode}]: ${tenantsToBuild.map(t => t.id).join(', ')}`);
    console.log('');
  }

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const results = [];

  for (const tenant of tenantsToBuild) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await buildTenant(tenant, args.target, cacheDir, buildOptions);

      if (result.success) {
        successCount++;
        // Track skipped (no changes) vs actually built
        if (args.incremental && result.changes?.type === 'none') {
          skippedCount++;
        }
      } else {
        failCount++;
      }

      results.push({ tenantId: tenant.id, ...result });
    } catch (err) {
      console.error(`Error building ${tenant.id}: ${err.message}`);
      failCount++;
      results.push({ tenantId: tenant.id, success: false, changes: null, error: err.message });
    }
    console.log('');
  }

  // Clean up cache (keep if incremental or diffOnly to preserve state)
  const shouldKeepCache = args.keepCache || args.incremental || args.diffOnly;
  await cleanupCache(cacheDir, shouldKeepCache);

  // Summary
  if (args.diffOnly) {
    console.log('Change detection complete.');
  } else {
    const builtCount = successCount - skippedCount;
    let summary = `Build complete. Built: ${builtCount}`;
    if (skippedCount > 0) summary += `, Skipped (no changes): ${skippedCount}`;
    if (failCount > 0) summary += `, Failed: ${failCount}`;
    console.log(summary);

    if (args.target) {
      console.log(`Tenant files deployed to: ${resolvePath(args.target)}`);
    }
  }

  // Return results for programmatic use (if this script is imported)
  return results;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
