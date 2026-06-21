#!/usr/bin/env node
/* Build tenant-specific bundles with optional branding overrides */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { createHash } from 'crypto';
import os from 'os';
import { generateSeoArtifacts, resolveBaseUrl, resolveOgImage } from './lib/seo-generator.js';
import { generateCollections } from './lib/collections-generator.js';
import { parseFrontmatter } from './lib/frontmatter.js';
import { generateSearchIndex } from './lib/search-index-generator.js';
import { buildFortemiIndexExport, stripHtml } from '../src/lib/fortemi-corpus.js';
import { aiwgFortemiIndexToCommunityGraph } from '../src/vendor/fortemi-aiwg-index.js';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = process.cwd();
// The package's own directory (this file lives at <pkg>/scripts/build-tenants.js).
// Bundled scripts/assets (build.js, src/, build.config.json) resolve against this
// so the `pagenary` bin works from any consumer CWD (#11). Tenant source/target/
// registry paths stay relative to `root` (the caller's CWD).
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_TENANTS_DIR = path.join(root, 'tenants');
const DEFAULT_DIST_DIR = path.join(root, 'dist');
const DEFAULT_REGISTRY_PATH = path.join(root, 'tenants.json');
const DEFAULT_CONTENT_DIR = 'content';
const TENANT_MANIFEST = 'manifest.json';
const DIRECTORY_MANIFEST = '_manifest.json';
const MAX_CONTENT_DEPTH = 10;

// Content file extensions for link transformation
const CONTENT_EXTENSIONS = ['.md', '.markdown', '.html', '.htm', '.js', '.mjs'];

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
    config: tenant.config || {},
    strictLinks: tenant.strictLinks,
    followLinks: tenant.followLinks || false
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
    // Resolve build.js and run it from the package dir so it reads the package's
    // own src/ + build.config.json (not the caller's CWD). Pass an ABSOLUTE
    // output path (resolved against the caller's CWD) so the bundle still lands
    // in the right dist/ regardless of build.js's CWD (#11).
    const buildScript = path.join(packageRoot, 'scripts', 'build.js');
    const absOutput = path.resolve(root, buildOutput);
    const proc = spawn(process.execPath, [buildScript], {
      cwd: packageRoot,
      stdio: 'inherit',
      env: { ...process.env, BUILD_OUTPUT: absOutput }
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

/**
 * Copy static assets from .public/ directory to dist
 * Assets are copied to dist/assets/ and favicon files are also copied to dist root
 *
 * @param {string} sourceDir - Tenant source directory
 * @param {string} distDir - Build output directory
 * @param {string} tenantId - Tenant identifier
 */
async function copyPublicAssets(sourceDir, distDir, tenantId) {
  const publicDir = path.join(sourceDir, '.public');

  // Check if .public directory exists
  if (!(await pathExists(publicDir))) {
    return;
  }

  const assetsDir = path.join(distDir, 'assets');
  await fsp.mkdir(assetsDir, { recursive: true });

  let assetCount = 0;
  const faviconFiles = [];

  /**
   * Recursively copy files from source to destination
   */
  async function copyAssets(srcDir, destDir) {
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        await fsp.mkdir(destPath, { recursive: true });
        await copyAssets(srcPath, destPath);
      } else if (entry.isFile()) {
        await fsp.copyFile(srcPath, destPath);
        assetCount++;

        // Track favicon files for root copy
        const lowerName = entry.name.toLowerCase();
        if (lowerName === 'favicon.ico' || lowerName === 'favicon.png' || lowerName === 'favicon.svg') {
          faviconFiles.push({ srcPath, filename: entry.name });
        }
      }
    }
  }

  // Copy all assets to dist/assets/
  await copyAssets(publicDir, assetsDir);

  // Also copy favicon files to dist root for browser auto-detection
  for (const { srcPath, filename } of faviconFiles) {
    const rootDestPath = path.join(distDir, filename);
    await fsp.copyFile(srcPath, rootDestPath);
  }

  if (assetCount > 0) {
    console.log(`  ↳ copied ${assetCount} asset(s) from .public/`);
  }
}

/**
 * Read and base64-encode a logo file from .public directory
 * @param {string} publicDir - Path to .public directory
 * @param {string} [logoPath] - Specific logo filename or auto-detect
 * @returns {Promise<string|null>} Data URI or null if not found
 */
async function embedLogo(publicDir, logoPath = null) {
  const candidates = logoPath
    ? [logoPath]
    : ['logo.png', 'logo.svg', 'logo.jpg', 'favicon.png', 'favicon.svg'];

  for (const filename of candidates) {
    const fullPath = path.join(publicDir, filename);
    if (await pathExists(fullPath)) {
      const buffer = await fsp.readFile(fullPath);
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.gif': 'image/gif'
      };
      const mime = mimeTypes[ext] || 'image/png';
      const sizeKB = Math.round(buffer.length / 1024);
      if (sizeKB > 500) {
        console.warn(`  ⚠ Logo ${filename} is ${sizeKB}KB (recommend < 500KB)`);
      }
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
  }
  return null;
}

/**
 * Build export configuration from tenant config
 * @param {object} config - Tenant config.json contents
 * @param {string} sourceDir - Tenant source directory
 * @returns {Promise<object>} Export configuration for manifest.js
 */
async function buildExportConfig(config, sourceDir) {
  const exportSettings = config.export || {};
  const publicDir = path.join(sourceDir, '.public');

  let logo = null;
  const logoMode = exportSettings.logo !== undefined ? exportSettings.logo : 'embed';

  if (logoMode === 'embed') {
    logo = await embedLogo(publicDir, exportSettings.logoPath);
  } else if (logoMode === 'reference' && exportSettings.logoPath) {
    logo = `./assets/${exportSettings.logoPath}`;
  }

  return {
    title: config.title || 'Documentation',
    brandMark: config.brandMark || 'Docs',
    brandSub: config.brandSub || '',
    tagline: config.tagline || '',
    logo,
    showTagline: exportSettings.showTagline !== false,
    showDate: exportSettings.showDate !== false
  };
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
  if (config.copyright) {
    html = html.replace(
      /Modular Documentation Toolkit/,
      escapeHtml(config.copyright)
    );
    mutated = true;
  }

  if (mutated) {
    await fsp.writeFile(indexPath, html, 'utf8');
    console.log(`  ↳ applied branding to ${tenantId}`);
  }
}

/**
 * Replace the shell's `__PAGENARY_TENANT__` base-resolution placeholder with the
 * real tenant id. Runs for every tenant so the runtime `<base href>` bootstrap
 * can resolve asset/module URLs against the tenant root under subpath mounts
 * (e.g. /tenant/) while domain-root deploys fall back to "/".
 * @param {string} distDir - Tenant output directory
 * @param {string} tenantId - Tenant identifier
 */
async function injectTenantBase(distDir, tenantId) {
  const indexPath = path.join(distDir, 'index.html');
  if (!(await pathExists(indexPath))) return;
  const html = await fsp.readFile(indexPath, 'utf8');
  if (!html.includes('__PAGENARY_TENANT__')) return;
  await fsp.writeFile(indexPath, html.split('__PAGENARY_TENANT__').join(tenantId), 'utf8');
  console.log(`  ↳ wired tenant base for ${tenantId}`);
}

/**
 * Set the shell <title> to the default page's metadata title for SEO (#28).
 * Reads the generated manifest.js for DEFAULT_SECTION and its (metadata-derived)
 * title, producing "<page title> · <brand>" to mirror the runtime seo.js format.
 * Generic brand is used only as a fallback when no default title is available,
 * so the crawler-visible root URL gets a specific, descriptive title.
 * @param {string} distDir - Tenant output directory
 * @param {object} config - Tenant config (for the brand title)
 */
async function applyDefaultPageTitle(distDir, config) {
  const indexPath = path.join(distDir, 'index.html');
  const manifestPath = path.join(distDir, 'manifest.js');
  if (!(await pathExists(indexPath)) || !(await pathExists(manifestPath))) return;

  let defaultTitle = null;
  try {
    // Cache-bust so incremental rebuilds re-read the freshly written manifest.
    const mod = await import(`${pathToFileURL(manifestPath).href}?t=${Date.now()}`);
    const id = mod.DEFAULT_SECTION;
    const entry = id && typeof mod.findSection === 'function' ? mod.findSection(id) : null;
    if (entry && entry.title) defaultTitle = entry.title;
  } catch {
    // Manifest not importable — keep the existing (branded/generic) title.
  }
  if (!defaultTitle) return;

  const brand = config.title || null;
  const shellTitle = brand ? `${defaultTitle} · ${brand}` : defaultTitle;
  let html = await fsp.readFile(indexPath, 'utf8');
  const replaced = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(shellTitle)}</title>`);
  if (replaced !== html) {
    await fsp.writeFile(indexPath, replaced, 'utf8');
    console.log(`  ↳ default page title: ${shellTitle}`);
  }
}

function hexToRgb(hex) {
  const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (short) {
    return short.slice(1).map((value) => parseInt(value + value, 16)).join(', ');
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

/**
 * Theme presets for light and dark modes
 * All CSS variables that need to be set for a complete theme
 */
const THEME_PRESETS = {
  light: {
    colorScheme: 'light',
    surface: '#ffffff',
    ink: '#0b0b0b',
    muted: '#5a5a5a',
    accent: '#111111',
    gridLine: 'rgba(0, 0, 0, 0.08)',
    highlightBg: 'rgba(255, 214, 126, 0.45)',
    highlightBorder: 'rgba(0, 0, 0, 0.35)',
    // Hardcoded values in CSS that need dark mode overrides
    codeBackground: 'rgba(0, 0, 0, 0.04)',
    codeBorder: 'rgba(0, 0, 0, 0.08)',
    hoverBackground: 'rgba(0, 0, 0, 0.03)',
    activeBackground: 'rgba(0, 0, 0, 0.05)',
    inputBackground: 'rgba(0, 0, 0, 0.02)',
    tableHeaderBg: 'rgba(0, 0, 0, 0.04)',
    tableBorder: 'rgba(0, 0, 0, 0.12)',
    blockquoteBorder: 'rgba(0, 0, 0, 0.2)',
    sidebarBg: 'white',
    modalBg: 'white',
    modalBorder: '#000'
  },
  dark: {
    colorScheme: 'dark',
    surface: '#0a0a0e',
    ink: '#e0e0e0',
    muted: '#888888',
    accent: '#22d3ee',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    highlightBg: 'rgba(34, 211, 238, 0.15)',
    highlightBorder: 'rgba(34, 211, 238, 0.4)',
    // Dark mode specific overrides
    codeBackground: 'rgba(255, 255, 255, 0.05)',
    codeBorder: 'rgba(255, 255, 255, 0.1)',
    hoverBackground: 'rgba(255, 255, 255, 0.05)',
    activeBackground: 'rgba(255, 255, 255, 0.08)',
    inputBackground: 'rgba(255, 255, 255, 0.03)',
    tableHeaderBg: 'rgba(255, 255, 255, 0.05)',
    tableBorder: 'rgba(255, 255, 255, 0.12)',
    blockquoteBorder: 'rgba(255, 255, 255, 0.2)',
    sidebarBg: '#151518',
    modalBg: '#1a1a1e',
    modalBorder: '#333'
  },
  matrix: {
    colorScheme: 'dark',
    surface: '#050509',
    ink: '#00ff00',
    muted: '#00cc00',
    accent: '#00ff00',
    gridLine: 'rgba(0, 255, 0, 0.15)',
    highlightBg: 'rgba(0, 255, 0, 0.15)',
    highlightBorder: 'rgba(0, 255, 0, 0.4)',
    // Matrix-specific overrides (green-on-black terminal style)
    codeBackground: 'rgba(0, 255, 0, 0.05)',
    codeBorder: 'rgba(0, 255, 0, 0.15)',
    hoverBackground: 'rgba(0, 255, 0, 0.08)',
    activeBackground: 'rgba(0, 255, 0, 0.12)',
    inputBackground: 'rgba(0, 255, 0, 0.03)',
    tableHeaderBg: 'rgba(0, 255, 0, 0.08)',
    tableBorder: 'rgba(0, 255, 0, 0.2)',
    blockquoteBorder: 'rgba(0, 255, 0, 0.3)',
    sidebarBg: '#0a0f0a',
    modalBg: '#0f150f',
    modalBorder: '#00cc00'
  }
};

/**
 * Resolve a theme spec into a full theme object + dark-mode flag.
 * @param {string|object} themeSpec - "light" | "dark" | "matrix" | custom object
 * @param {object} [overrides] - legacy/individual color + font overrides (config)
 */
function resolveTheme(themeSpec, overrides = {}) {
  const theme = { ...THEME_PRESETS.light };
  if (themeSpec === 'dark') Object.assign(theme, THEME_PRESETS.dark);
  else if (themeSpec === 'matrix') Object.assign(theme, THEME_PRESETS.matrix);
  else if (themeSpec === 'light') Object.assign(theme, THEME_PRESETS.light);
  else if (themeSpec && typeof themeSpec === 'object') Object.assign(theme, themeSpec);

  // Legacy/individual overrides
  if (overrides.accentColor) theme.accent = overrides.accentColor;
  if (overrides.surfaceColor) theme.surface = overrides.surfaceColor;
  if (overrides.inkColor) theme.ink = overrides.inkColor;
  if (overrides.mutedColor) theme.muted = overrides.mutedColor;
  if (overrides.gridLineColor) theme.gridLine = overrides.gridLineColor;
  if (overrides.fontBody) theme.fontBody = overrides.fontBody;
  if (overrides.fontMono) theme.fontMono = overrides.fontMono;

  const isDarkMode = themeSpec === 'dark' || themeSpec === 'matrix' ||
    (themeSpec && typeof themeSpec === 'object' && themeSpec.colorScheme === 'dark');
  return { theme, isDarkMode };
}

/**
 * Apply a resolved theme to a base stylesheet, returning the transformed CSS.
 * Pure — used both for the baked default (applyThemeColors) and for the
 * per-theme stylesheets emitted by the runtime picker (applyThemePicker).
 */
function renderThemedCss(css, theme, isDarkMode) {
  const replacements = [
    { pattern: /(color-scheme:\s*)([^;]+);/, value: theme.colorScheme },
    { pattern: /(--surface:\s*)([^;]+);/, value: theme.surface },
    { pattern: /(--ink:\s*)([^;]+);/, value: theme.ink },
    { pattern: /(--muted:\s*)([^;]+);/, value: theme.muted },
    { pattern: /(--accent:\s*)([^;]+);/, value: theme.accent },
    { pattern: /(--grid-line:\s*)([^;]+);/, value: theme.gridLine },
    { pattern: /(--highlight-bg:\s*)([^;]+);/, value: theme.highlightBg },
    { pattern: /(--highlight-border:\s*)([^;]+);/, value: theme.highlightBorder }
  ];
  if (theme.fontBody) replacements.push({ pattern: /(--font-body:\s*)([^;]+);/, value: theme.fontBody });
  if (theme.fontMono) replacements.push({ pattern: /(--font-mono:\s*)([^;]+);/, value: theme.fontMono });

  for (const { pattern, value } of replacements) {
    if (value) css = css.replace(pattern, `$1${value};`);
  }

  if (theme.surface) {
    const rgb = hexToRgb(theme.surface);
    if (rgb) css = css.replace(/(--surface-rgb:\s*)([^;]+);/, `$1${rgb};`);
  }

  if (theme.ink) {
    const rgb = hexToRgb(theme.ink);
    if (rgb) css = css.replace(/(--ink-rgb:\s*)([^;]+);/, `$1${rgb};`);
  }

  if (isDarkMode) {
    const darkOverrides = [
      { pattern: /background:\s*rgba\(0,\s*0,\s*0,\s*0\.04\)/g, value: `background: ${theme.codeBackground}` },
      { pattern: /border:\s*1px solid rgba\(0,\s*0,\s*0,\s*0\.08\)/g, value: `border: 1px solid ${theme.codeBorder}` },
      { pattern: /background:\s*rgba\(0,\s*0,\s*0,\s*0\.03\)/g, value: `background: ${theme.hoverBackground}` },
      { pattern: /background:\s*rgba\(0,\s*0,\s*0,\s*0\.05\)/g, value: `background: ${theme.activeBackground}` },
      { pattern: /background:\s*rgba\(0,\s*0,\s*0,\s*0\.02\)/g, value: `background: ${theme.inputBackground}` },
      { pattern: /border:\s*1px solid rgba\(0,\s*0,\s*0,\s*0\.12\)/g, value: `border: 1px solid ${theme.tableBorder}` },
      { pattern: /border-left:\s*3px solid rgba\(0,\s*0,\s*0,\s*0\.2\)/g, value: `border-left: 3px solid ${theme.blockquoteBorder}` },
      { pattern: /background:\s*white;/g, value: `background: ${theme.sidebarBg};` },
      { pattern: /background:\s*white;\s*\n\s*border:\s*2px solid #000;/g, value: `background: ${theme.modalBg};\n  border: 2px solid ${theme.modalBorder};` }
    ];
    for (const { pattern, value } of darkOverrides) css = css.replace(pattern, value);
  }
  return css;
}

/**
 * Apply theme configuration to styles.css (the baked default).
 * Supports theme presets, a custom object, legacy color keys, and fonts.
 */
async function applyThemeColors(distDir, config, tenantId) {
  const stylesPath = path.join(distDir, 'styles.css');
  if (!(await pathExists(stylesPath))) return;

  const hasCustomization = config.theme || config.accentColor || config.surfaceColor ||
    config.inkColor || config.mutedColor || config.gridLineColor ||
    config.fontBody || config.fontMono;
  if (!hasCustomization) return;

  const css = await fsp.readFile(stylesPath, 'utf8');
  const { theme, isDarkMode } = resolveTheme(config.theme, config);
  const out = renderThemedCss(css, theme, isDarkMode);

  if (out !== css) {
    await fsp.writeFile(stylesPath, out, 'utf8');
    const themeLabel = config.theme === 'dark' ? 'dark theme' :
      config.theme === 'matrix' ? 'matrix theme' :
      config.theme === 'light' ? 'light theme' :
      typeof config.theme === 'object' ? 'custom theme' : 'theme colors';
    console.log(`  ↳ applied ${themeLabel} for ${tenantId}`);
  }
}

const PICKER_THEME_LABELS = { light: 'Light', dark: 'Dark', matrix: 'Matrix', custom: 'Custom' };

/**
 * Runtime theme/color picker (#35). Opt-in via config.themePicker.enabled.
 * Emits one full themed stylesheet per selectable theme (reusing the exact
 * build-time transform, so switches are pixel-correct) and injects a header
 * <select> + a swappable stylesheet <link>. app.js wires selection +
 * localStorage persistence + prefers-color-scheme. Disabled => zero output.
 *
 * Runs BEFORE applyThemeColors so it reads the pristine base stylesheet.
 */
async function applyThemePicker(distDir, config, tenantId) {
  const picker = config.themePicker;
  if (!picker || !picker.enabled) return;

  const stylesPath = path.join(distDir, 'styles.css');
  const indexPath = path.join(distDir, 'index.html');
  if (!(await pathExists(stylesPath)) || !(await pathExists(indexPath))) return;

  const baseCss = await fsp.readFile(stylesPath, 'utf8');
  const requested = Array.isArray(picker.themes) && picker.themes.length
    ? picker.themes.slice()
    : ['light', 'dark', 'matrix'];
  const defaultName = picker.default ||
    (typeof config.theme === 'string' ? config.theme : 'light');
  if (!requested.includes(defaultName)) requested.unshift(defaultName);

  const emitted = [];
  for (const name of requested) {
    let spec;
    if (name === 'custom') {
      if (!(config.theme && typeof config.theme === 'object')) continue;
      spec = config.theme;
    } else if (['light', 'dark', 'matrix'].includes(name)) {
      spec = name;
    } else {
      console.warn(`  ↳ ${tenantId}: themePicker theme "${name}" is not a preset or "custom" — skipping`);
      continue;
    }
    const { theme, isDarkMode } = resolveTheme(spec, config);
    const file = `theme-${name}.css`;
    await fsp.writeFile(path.join(distDir, file), renderThemedCss(baseCss, theme, isDarkMode), 'utf8');
    emitted.push({ name, file });
  }
  if (emitted.length < 2) return; // nothing meaningful to switch between

  let html = await fsp.readFile(indexPath, 'utf8');
  // Give the base stylesheet link an id so the picker can swap its href.
  if (!/id="themeStylesheet"/.test(html)) {
    html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css" \/>/,
      '<link id="themeStylesheet" rel="stylesheet" href="./styles.css" />');
  }
  const optionsHtml = emitted
    .map((e) => `<option value="${escapeAttr(e.name)}">${escapeHtml(PICKER_THEME_LABELS[e.name] || e.name)}</option>`)
    .join('');
  const themesData = escapeAttr(JSON.stringify(emitted));
  const control = `<label class="theme-picker"><span class="ghost-label">Theme</span>` +
    `<select id="themePicker" class="theme-picker-select" aria-label="Color theme" ` +
    `data-themes="${themesData}" data-default="${escapeAttr(defaultName)}">${optionsHtml}</select></label>`;
  if (html.includes('<div class="top-actions">')) {
    html = html.replace('<div class="top-actions">', `<div class="top-actions">\n        ${control}`);
  }
  await fsp.writeFile(indexPath, html, 'utf8');
  console.log(`  ↳ wired theme picker (${emitted.map((e) => e.name).join(', ')}) for ${tenantId}`);
}

/**
 * Optional docs-map view (#33). Opt-in via config.docsMap.enabled. Emits a
 * section module that re-exports the framework-free renderer (src/lib/docs-map.js,
 * copied to dist/lib/) and injects a `docs-map` entry into MANIFEST so the
 * standard router/nav/command-palette drive it — no app.js changes. Disabled =>
 * zero output.
 */
async function applyDocsMap(distDir, config, tenantId) {
  const docsMap = config.docsMap;
  if (!docsMap || !docsMap.enabled) return;
  const renderer = normalizeDocsMapRenderer(docsMap.renderer);

  const manifestPath = path.join(distDir, 'manifest.js');
  if (!(await pathExists(manifestPath))) return;

  const sectionsDir = path.join(distDir, 'sections');
  await fsp.mkdir(sectionsDir, { recursive: true });

  // Compute the relationship graph at build time, where full page text is
  // available (the runtime only sees title+summary). Concepts are extracted
  // from each page's body and shared concepts become communities + edges.
  const graphArtifact = await buildDocsMapGraph(distDir, tenantId);
  if (graphArtifact) {
    await fsp.writeFile(
      path.join(distDir, 'docs-map-data.js'),
      `export const DOCS_MAP_GRAPH = ${JSON.stringify(graphArtifact.graph)};\n` +
      `export const DOCS_MAP_LABELS = ${JSON.stringify(graphArtifact.labels)};\n` +
      `export const DOCS_MAP_METADATA = ${JSON.stringify(graphArtifact.metadata)};\n`,
      'utf8'
    );
    await fsp.writeFile(
      path.join(sectionsDir, 'docs-map.js'),
      "import * as DOCS_MAP_DATA from '../docs-map-data.js';\n" +
      "import { loadDocsMap } from '../lib/docs-map.js';\n" +
      `export const load = () => loadDocsMap(DOCS_MAP_DATA.DOCS_MAP_GRAPH, DOCS_MAP_DATA.DOCS_MAP_LABELS, { renderer: ${JSON.stringify(renderer)}, metadata: DOCS_MAP_DATA.DOCS_MAP_METADATA });\n`,
      'utf8'
    );
  } else {
    // No content to analyze — fall back to the runtime (MANIFEST-derived) graph.
    await fsp.writeFile(
      path.join(sectionsDir, 'docs-map.js'),
      "import { loadManifestDocsMap } from '../lib/docs-map.js';\n" +
      `export const load = () => loadManifestDocsMap({ renderer: ${JSON.stringify(renderer)} });\n`,
      'utf8'
    );
  }

  const title = typeof docsMap.title === 'string' ? docsMap.title : 'Docs Map';
  const entry = [
    '  {',
    '    "id": "docs-map",',
    `    "title": ${JSON.stringify(title)},`,
    '    "summary": "How these pages cluster and relate.",',
    '    "module": "./sections/docs-map.js"',
    '  }'
  ].join('\n');

  let js = await fsp.readFile(manifestPath, 'utf8');
  if (/"id":\s*"docs-map"/.test(js)) return; // idempotent
  if (/export const MANIFEST = \[\s*\];/.test(js)) {
    js = js.replace(/export const MANIFEST = \[\s*\];/, `export const MANIFEST = [\n${entry}\n];`);
  } else {
    const updated = js.replace(/(export const MANIFEST = \[[\s\S]*?)\n\];/, `$1,\n${entry}\n];`);
    if (updated === js) return; // couldn't locate the array — leave manifest untouched
    js = updated;
  }
  await fsp.writeFile(manifestPath, js, 'utf8');
  console.log(`  ↳ wired docs-map view for ${tenantId} (${renderer} renderer)`);
}

function normalizeDocsMapRenderer(value) {
  const renderer = String(value || 'svg').trim().toLowerCase();
  return renderer === 'cytoscape' ? 'cytoscape' : 'svg';
}

/**
 * Flatten built MANIFEST entries to navigable leaf pages, carrying the parent
 * group title so the Fortemi record gets a structural group concept.
 */
function flattenDocsMapEntries(entries, parentGroup = '') {
  const out = [];
  for (const entry of entries || []) {
    if (!entry || typeof entry !== 'object') continue;
    const subs = entry.subsections || entry.sections;
    if (entry.module && entry.id) {
      out.push({
        id: entry.id,
        title: entry.title || entry.id,
        summary: entry.summary || '',
        group: parentGroup || entry.title || 'Documentation',
        type: 'docs.page'
      });
    }
    if (Array.isArray(subs) && subs.length) {
      out.push(...flattenDocsMapEntries(subs, entry.title || parentGroup));
    }
  }
  return out;
}

/** Extract the rendered page body from a built section module, as plain text. */
async function readSectionBodyText(sectionsDir, sectionId) {
  const file = path.join(sectionsDir, `${sectionId}.js`);
  if (!(await pathExists(file))) return '';
  const src = await fsp.readFile(file, 'utf8');
  // Built .md modules store HTML as a JSON string: `return { html: "..." }`.
  const json = src.match(/html:\s*("(?:\\.|[^"\\])*")/);
  if (json) {
    try {
      return stripHtml(JSON.parse(json[1]));
    } catch {
      /* fall through */
    }
  }
  return '';
}

/**
 * Build the docs-map community graph from the tenant's actual page content.
 * Concepts are extracted from each page's full text and shared concepts become
 * both communities and `related` edges (see fortemi-corpus). Returns null when
 * there is too little content to map, so the caller can fall back to runtime.
 */
async function buildDocsMapGraph(distDir, tenantId) {
  const entries = await readTenantManifestEntries(distDir);
  const sections = flattenDocsMapEntries(entries).filter((s) => s.id !== 'docs-map');
  if (sections.length < 2) return null;

  const sectionsDir = path.join(distDir, 'sections');
  const corpus = [];
  for (const section of sections) {
    const body = await readSectionBodyText(sectionsDir, section.id);
    const text = body || `${section.title} ${section.summary}`.trim();
    corpus.push({ section, text });
  }

  const { index } = buildFortemiIndexExport(corpus, {
    repo: tenantId,
    extractConcepts: true,
    relateByConcept: true
  });
  // Communities cluster by nav group (a handful of clean clusters); the
  // extracted concepts drive the cross-cutting `related` edges between them.
  const graph = aiwgFortemiIndexToCommunityGraph(index, { communityFacet: 'group' });
  if (!graph.nodes || graph.nodes.length < 2) return null;

  const recordIds = new Set(index.items.map((item) => item.id));
  const nodeMetadata = index.items.map((item) => [item.id, {
    title: item.title,
    section_id: String(item.id).replace(/^docs:page:/, ''),
    concepts: item.concepts || [],
    skos_concepts: item.skos_concepts || [],
    source: item.source || null,
    privacy: item.privacy || null,
    updated_at: item.updated_at || null
  }]);
  const edgeMetadata = [];
  for (const item of index.items) {
    for (const relationship of item.relationships || []) {
      if (!recordIds.has(relationship.target_id)) continue;
      const key = `${item.id}\0${relationship.target_id}\0${relationship.type}`;
      edgeMetadata.push([key, {
        label: relationship.label || relationship.type,
        confidence: relationship.confidence ?? null,
        privacy: relationship.privacy || null,
        shared_concepts: Array.isArray(relationship.metadata?.shared_concepts)
          ? relationship.metadata.shared_concepts
          : [],
        source_path: relationship.source_path || null
      }]);
    }
  }

  const labels = sections.map((s) => [s.id, s.title]);
  const metadata = { nodes: nodeMetadata, edges: edgeMetadata };
  console.log(
    `  ↳ docs-map graph for ${tenantId}: ${graph.nodes.length} nodes, ` +
    `${graph.edges.length} edges, ${graph.communities.length} communities`
  );
  return { graph, labels, metadata };
}

const NAV_POSITIONS = new Set(['left', 'right', 'top', 'bottom', 'hybrid']);

/**
 * Apply nav position configuration.
 *
 * Supports navPosition: "left" (default) | "right" | "top" | "bottom" | "hybrid".
 * Rather than appending generated CSS per build, the layout rules live in the
 * source stylesheet scoped to `body[data-nav-position="…"]`; this only sets that
 * attribute. "left" is the default and needs no attribute. "hybrid" additionally
 * injects a horizontal primary nav strip (built from the tenant's top-level
 * sections) under the header, giving a top bar + left rail.
 */
async function applyNavPosition(distDir, config, tenantId) {
  const pos = typeof config.navPosition === 'string'
    ? config.navPosition.toLowerCase()
    : 'left';

  if (pos === 'left') return; // default layout, nothing to do

  if (!NAV_POSITIONS.has(pos)) {
    console.warn(`  ↳ ${tenantId}: unknown navPosition "${config.navPosition}" ` +
      `(expected left|right|top|bottom|hybrid) — leaving default`);
    return;
  }

  const indexPath = path.join(distDir, 'index.html');
  if (!(await pathExists(indexPath))) return;

  let html = await fsp.readFile(indexPath, 'utf8');

  // Tag <body> so the scoped stylesheet rules activate.
  if (!/<body[^>]*data-nav-position=/.test(html)) {
    html = html.replace(/<body(?=[\s>])/, `<body data-nav-position="${pos}"`);
  }

  // Hybrid layout adds a horizontal primary strip beneath the header.
  if (pos === 'hybrid') {
    html = await injectHybridNavStrip(html, distDir);
  }

  await fsp.writeFile(indexPath, html, 'utf8');
  console.log(`  ↳ applied ${pos}-position nav for ${tenantId}`);
}

/**
 * Parse the built manifest.js back into the MANIFEST array so the hybrid strip
 * can be generated from the tenant's actual top-level sections. The generated
 * module is `export const MANIFEST = [ … ];` of plain JSON, so a narrow match
 * + JSON.parse is sufficient and avoids importing the module.
 */
async function readTenantManifestEntries(distDir) {
  const manifestPath = path.join(distDir, 'manifest.js');
  if (!(await pathExists(manifestPath))) return [];
  const src = await fsp.readFile(manifestPath, 'utf8');
  const match = src.match(/export const MANIFEST\s*=\s*(\[[\s\S]*?\n\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

/**
 * Resolve a manifest entry to the hash route of its first navigable page.
 * A leaf section links to its own id; a group links to its first descendant.
 */
function firstRouteId(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.module) return entry.id;
  const subs = entry.subsections || entry.sections;
  if (Array.isArray(subs) && subs.length > 0) {
    return firstRouteId(subs[0]) || entry.id;
  }
  return entry.id;
}

/**
 * Build and inject the hybrid horizontal nav strip after </header>.
 * Returns the original html unchanged when there is nothing to link or no
 * header to anchor against, so the flag-off path stays inert.
 */
async function injectHybridNavStrip(html, distDir) {
  if (html.includes('class="nav-strip"')) return html; // idempotent
  const entries = await readTenantManifestEntries(distDir);
  const links = entries
    .map((entry) => {
      const target = firstRouteId(entry);
      if (!target) return '';
      const label = escapeHtml(entry.title || entry.id);
      return `        <a class="nav-strip-link" href="#${escapeAttr(target)}">${label}</a>`;
    })
    .filter(Boolean)
    .join('\n');

  if (!links || !html.includes('</header>')) return html;

  const strip = [
    '    <nav class="nav-strip" aria-label="Primary sections">',
    links,
    '    </nav>'
  ].join('\n');

  return html.replace('</header>', `</header>\n${strip}`);
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

/**
 * Parse inline markdown elements (links, bold, italic)
 *
 * @param {string} input - Raw markdown text
 * @param {object} [linkContext] - Optional context for link transformation
 * @param {string} linkContext.currentPath - Current file path relative to content root
 * @param {Map} linkContext.sectionIndex - Section ID map for validation
 * @param {Array} linkContext.linkWarnings - Array to collect warnings
 * @returns {string} HTML string
 */
function parseInlineMarkdown(input, linkContext = null) {
  if (!input) return '';
  let output = input.replace(/\r\n/g, '\n');

  // @-mention links: @docs/path/file.md -> [title](#section-id)
  // Resolved against sectionIndex before regular link processing.
  // @.aiwg/path/file.md references are outside the docsite — rendered as inline code.
  if (linkContext && linkContext.sectionIndex) {
    output = output.replace(/@(docs\/|\.aiwg\/)([^\s,);>\]`'"]+)/g, (match, prefix, ref) => {
      if (prefix === 'docs/') {
        // Strip trailing punctuation that is unlikely part of the path
        const cleanRef = ref.replace(/[.,;:!?]+$/, '');
        const sectionId = pathToSectionId(cleanRef);
        if (!sectionId) return match;
        const sectionIdLower = sectionId.toLowerCase();
        for (const [id, info] of linkContext.sectionIndex) {
          if (!id) continue;
          if (id.toLowerCase() === sectionIdLower) {
            const title = (info && info.title) ? info.title : id;
            // Produce a regular markdown link — picked up by the link regex below
            return `[${title}](#${id})`;
          }
        }
        // Unresolved @docs/ reference — render as inline code
        return `\`${match}\``;
      }
      // @.aiwg/ references — outside docsite, render as inline code
      return `\`@${prefix}${ref}\``;
    });
  }

  // Images: ![alt](src) - must be processed before links
  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}">`;
  });
  // Links: [label](href)
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    // Transform internal links if context is provided
    const resolvedHref = linkContext
      ? transformInternalLink(href, linkContext)
      : href;
    // External links open in new tab by default
    const isExternal = /^https?:\/\//i.test(resolvedHref);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    // Don't escape label here - it will be escaped by the final escapeHtml call
    return `<a href="${escapeAttribute(resolvedHref)}"${attrs}>${label}</a>`;
  });
  // GFM angle-bracket autolinks: <https://…>, <http://…>, <mailto:…>
  // (literal angle brackets in the source — distinct from the [label](href) form)
  output = output.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_, url) => {
    const isExternal = /^https?:\/\//i.test(url);
    const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    const label = url.replace(/^mailto:/i, '');
    return `<a href="${escapeAttribute(url)}"${attrs}>${label}</a>`;
  });
  // GFM bare-URL autolinks: linkify naked http(s):// URLs in prose. Protect the
  // anchors/images already built above so their href/text URLs aren't re-wrapped.
  // (Fenced code blocks never reach this function; inline backticks are literal.)
  const protectedSpans = [];
  output = output.replace(/<a [^>]*>[\s\S]*?<\/a>|<img [^>]*>/g, (m) => {
    protectedSpans.push(m);
    return ` ${protectedSpans.length - 1} `;
  });
  output = output.replace(
    /(^|[\s(])(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g,
    (_, pre, url) => `${pre}<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`
  );
  output = output.replace(/ (\d+) /g, (_, i) => protectedSpans[Number(i)]);
  // Bold: **text**
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (single asterisks, after bold replacement)
  output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // Italic: _text_ (only at word boundaries, not inside HTML attributes like target="_blank")
  output = output.replace(/(?<!["\w])_([^_]+)_(?!["\w])/g, '<em>$1</em>');
  return escapeHtml(output)
    .replace(/&lt;strong&gt;([^]*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
    .replace(/&lt;em&gt;([^]*?)&lt;\/em&gt;/g, '<em>$1</em>')
    .replace(/&lt;img src=&quot;([^&]*)&quot; alt=&quot;([^&]*)&quot;&gt;/g, '<img src="$1" alt="$2">')
    .replace(/&lt;a href=&quot;([^&]*)&quot;(?: target=&quot;_blank&quot; rel=&quot;noopener noreferrer&quot;)?&gt;([^]*?)&lt;\/a&gt;/g, (_, href, text) => {
      const isExternal = /^https?:\/\//i.test(href);
      const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a href="${href}"${attrs}>${text}</a>`;
    })
    // Inline span with title attribute for tooltips: <span title="...">text</span>
    .replace(/&lt;span title=&quot;([^&]*)&quot;&gt;([^]*?)&lt;\/span&gt;/g, '<span title="$1">$2</span>');
}

/**
 * Convert markdown content to HTML
 *
 * @param {string} markdown - Raw markdown content
 * @param {object} [linkContext] - Optional context for link transformation
 * @returns {string} HTML string
 */
function markdownToHtml(markdown, linkContext = null) {
  // Strip YAML frontmatter before rendering so the fence block doesn't leak
  // into the page as <hr>/<p>… text (#19). #18 made frontmatter mandatory on
  // collection posts; this wires the same parser the collections generator
  // already uses into the page render path so every caller benefits.
  const parsed = parseFrontmatter(markdown);
  markdown = parsed.body;
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let inList = false;
  let inBlockquote = false;
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';
  let inTable = false;
  let tableRows = [];
  let paragraphLines = [];
  const headingIds = new Map(); // Track heading IDs for uniqueness

  function closeList() {
    if (inList) {
      chunks.push('</ul>');
      inList = false;
    }
  }

  // Flush buffered paragraph lines as a single <p>. Consecutive non-blank text
  // lines are joined with a space (CommonMark soft-wrap), so a paragraph that
  // was hard-wrapped in the source renders as one paragraph instead of one <p>
  // per line (which the grid gap was spacing out — the "awkward line spacing").
  function closeParagraph() {
    if (paragraphLines.length > 0) {
      const joined = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) chunks.push(`<p>${parseInlineMarkdown(joined, linkContext)}</p>`);
      paragraphLines = [];
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

  function closeTable() {
    if (inTable && tableRows.length > 0) {
      // Parse table rows
      const parseRow = (row) => {
        // Split by | but handle escaped pipes and trim cells
        return row.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      };

      // Check if second row is separator (determines if first row is header)
      const isSeparator = (row) => /^\|?[\s\-:]+\|/.test(row);

      let headerRow = null;
      let bodyRows = [];
      let alignments = [];

      if (tableRows.length > 1 && isSeparator(tableRows[1])) {
        headerRow = parseRow(tableRows[0]);
        // Parse alignments from separator
        const sepCells = parseRow(tableRows[1]);
        alignments = sepCells.map(cell => {
          const left = cell.startsWith(':');
          const right = cell.endsWith(':');
          if (left && right) return 'center';
          if (right) return 'right';
          return 'left';
        });
        bodyRows = tableRows.slice(2).map(parseRow);
      } else {
        bodyRows = tableRows.map(parseRow);
      }

      let tableHtml = '<table>';

      if (headerRow) {
        tableHtml += '<thead><tr>';
        headerRow.forEach((cell, i) => {
          const align = alignments[i] ? ` style="text-align: ${alignments[i]}"` : '';
          tableHtml += `<th${align}>${parseInlineMarkdown(cell, linkContext)}</th>`;
        });
        tableHtml += '</tr></thead>';
      }

      if (bodyRows.length > 0) {
        tableHtml += '<tbody>';
        bodyRows.forEach(row => {
          tableHtml += '<tr>';
          row.forEach((cell, i) => {
            const align = alignments[i] ? ` style="text-align: ${alignments[i]}"` : '';
            tableHtml += `<td${align}>${parseInlineMarkdown(cell, linkContext)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';
      }

      tableHtml += '</table>';
      chunks.push(tableHtml);

      inTable = false;
      tableRows = [];
    }
  }

  /**
   * Generate unique heading ID
   * If slug already exists, append -2, -3, etc.
   */
  function getUniqueHeadingId(text) {
    const baseSlug = generateSlug(text);
    if (!baseSlug) return null;

    let slug = baseSlug;
    let counter = 1;
    while (headingIds.has(slug)) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
    headingIds.set(slug, true);
    return slug;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Handle code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        const escapedCode = escapeHtml(codeBlockContent.join('\n'));

        // Check for special block types
        if (codeBlockLang.startsWith('box')) {
          // Box/panel block: ```box or ```box:Title
          const titleMatch = codeBlockLang.match(/^box(?::(.+))?$/);
          const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';
          const titleHtml = title ? `<div class="box-title">${escapeHtml(title)}</div>` : '';
          chunks.push(`<div class="content-box">${titleHtml}<pre class="box-content">${escapedCode}</pre></div>`);
        } else if (codeBlockLang.startsWith('html')) {
          // Raw HTML block: ```html - renders HTML directly (use with caution)
          // Note: We don't escape here to allow HTML rendering
          chunks.push(`<div class="html-block">${codeBlockContent.join('\n')}</div>`);
        } else {
          // Standard code block
          const langAttr = codeBlockLang ? ` class="language-${escapeAttribute(codeBlockLang)}"` : '';
          chunks.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
        }
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        // Start code block
        closeParagraph();
        closeList();
        closeBlockquote();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine); // Preserve original indentation
      continue;
    }

    if (!line) {
      closeParagraph();
      closeList();
      closeBlockquote();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      closeParagraph();
      closeList();
      closeBlockquote();
      closeTable();
      const level = Math.min(headingMatch[1].length, 6);
      const rawText = headingMatch[2].trim();
      const text = parseInlineMarkdown(rawText, linkContext);
      const headingId = getUniqueHeadingId(rawText);
      if (headingId) {
        chunks.push(`<h${level} id="${headingId}">${text}</h${level}>`);
      } else {
        chunks.push(`<h${level}>${text}</h${level}>`);
      }
      continue;
    }

    const listMatch = /^[-*+]\s+(.*)$/.exec(line);
    if (listMatch) {
      closeParagraph();
      closeBlockquote();
      closeTable();
      if (!inList) {
        chunks.push('<ul>');
        inList = true;
      }
      const item = parseInlineMarkdown(listMatch[1].trim(), linkContext);
      chunks.push(`<li>${item}</li>`);
      continue;
    }

    const quoteMatch = /^>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      closeParagraph();
      closeList();
      closeTable();
      openBlockquote();
      const quoteLine = parseInlineMarkdown(quoteMatch[1], linkContext);
      chunks.push(`<p>${quoteLine}</p>`);
      continue;
    }

    // Table row: starts with |
    if (line.startsWith('|')) {
      closeParagraph();
      closeList();
      closeBlockquote();
      inTable = true;
      tableRows.push(line);
      continue;
    }

    // If we were in a table and hit a non-table line, close it
    if (inTable) {
      closeTable();
    }

    // Horizontal rule: ---, ***, or ___
    if (/^[-*_]{3,}$/.test(line)) {
      closeParagraph();
      closeList();
      closeBlockquote();
      chunks.push('<hr>');
      continue;
    }

    closeList();
    closeBlockquote();
    // Buffer the line; consecutive text lines flush together as one paragraph.
    paragraphLines.push(line);
  }

  // Close any open code block
  if (inCodeBlock) {
    const escapedCode = escapeHtml(codeBlockContent.join('\n'));
    const langAttr = codeBlockLang ? ` class="language-${escapeAttribute(codeBlockLang)}"` : '';
    chunks.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
  }

  closeParagraph();
  closeList();
  closeBlockquote();
  closeTable();

  const body = chunks.join('\n');
  // Note: No indentation added - content goes into JSON anyway, and indentation breaks <pre> blocks
  return `<section class="section doc markdown">
  <div class="doc-content">
${body}
  </div>
</section>`;
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

/**
 * Convert markdown file to JS module
 *
 * @param {string} sourcePath - Absolute path to markdown file
 * @param {string} targetPath - Absolute path to output JS module
 * @param {object} [linkContext] - Optional context for link transformation
 */
async function ensureMarkdownModule(sourcePath, targetPath, linkContext = null) {
  const raw = await fsp.readFile(sourcePath, 'utf8');
  const html = markdownToHtml(raw, linkContext);
  const moduleSource = `export async function load() {\n  return { html: ${JSON.stringify(html)} };\n}\n`;
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, moduleSource, 'utf8');
}

async function ensureJavascriptModule(sourcePath, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.copyFile(sourcePath, targetPath);
}

async function readMarkdownMetadata(sourcePath) {
  const raw = await fsp.readFile(sourcePath, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  return {
    title: data.title || firstHeadingFromMarkdown(body) || null,
    summary: data.summary || data.description || '',
    date: data.date || null,
    reading_time: estimateReadingTime(body)
  };
}

function firstHeadingFromMarkdown(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function estimateReadingTime(body) {
  const words = String(body || '').trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}

async function readContentMetadata(sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    return readMarkdownMetadata(sourcePath);
  }
  return {};
}

// ============================================================================
// Internal Link Transformation (ADR-011)
// ============================================================================

/**
 * Check if a link is external (HTTP, mailto, tel, protocol-relative, etc.)
 * External links are not transformed.
 */
function isExternalLink(href) {
  if (!href) return true;
  // Protocol-based links (http:, https:, mailto:, tel:, data:, javascript:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return true;
  }
  // Protocol-relative URLs (//example.com)
  if (href.startsWith('//')) {
    return true;
  }
  return false;
}

/**
 * Check if a link is fragment-only (#anchor)
 * Fragment-only links are not transformed.
 */
function isFragmentOnly(href) {
  return href && href.startsWith('#');
}

/**
 * Check if a path points to a markdown file (for link transformation)
 * Only .md files get transformed; .html and .js links are preserved.
 */
function isMarkdownLink(href) {
  if (!href) return false;
  // Extract pathname (before any # or ?)
  const pathname = href.split('#')[0].split('?')[0];
  const ext = path.extname(pathname).toLowerCase();
  // Only transform .md and .markdown links
  return ext === '.md' || ext === '.markdown';
}

/**
 * Normalize a relative path for consistent resolution
 * - Converts backslashes to forward slashes (Windows compatibility)
 * - Removes redundant slashes
 * - Handles ./ and ../ prefixes
 */
function normalizeLinkPath(linkPath) {
  if (!linkPath) return '';
  return linkPath
    .replace(/\\/g, '/') // Windows backslashes
    .replace(/\/+/g, '/') // Multiple slashes
    .replace(/\/\.$/, '') // Trailing /.
    .replace(/\/+$/, ''); // Trailing slashes
}

/**
 * Resolve a relative link path to an absolute path within content root
 *
 * @param {string} linkPath - The href path from markdown (e.g., ./file.md, ../other/file.md)
 * @param {string} currentFilePath - Current file path relative to content root (e.g., getting-started/intro.md)
 * @returns {string} Resolved path relative to content root
 */
function resolveLinkPath(linkPath, currentFilePath) {
  // Get directory containing current file
  const currentDir = path.dirname(currentFilePath);

  let resolvedPath;

  if (linkPath.startsWith('/')) {
    // Absolute path from content root
    resolvedPath = linkPath.slice(1);
  } else if (linkPath.startsWith('./')) {
    // Relative to current directory
    resolvedPath = path.join(currentDir, linkPath.slice(2));
  } else if (linkPath.startsWith('../')) {
    // Relative to parent
    resolvedPath = path.join(currentDir, linkPath);
  } else {
    // Implicit relative (no prefix)
    resolvedPath = path.join(currentDir, linkPath);
  }

  // Normalize path separators and remove leading/trailing slashes
  return path.normalize(resolvedPath).replace(/\\/g, '/').replace(/^\/|\/$/g, '');
}

/**
 * Convert a resolved file path to a section ID
 * - Strips content file extensions
 * - Handles index files (getting-started/index -> getting-started)
 *
 * @param {string} resolvedPath - Path relative to content root
 * @returns {string} Section ID for hash-based navigation
 */
function pathToSectionId(resolvedPath) {
  if (!resolvedPath) return '';

  // Strip content file extensions (case-insensitive)
  let withoutExt = resolvedPath;
  for (const ext of CONTENT_EXTENSIONS) {
    if (resolvedPath.toLowerCase().endsWith(ext)) {
      withoutExt = resolvedPath.slice(0, -ext.length);
      break;
    }
  }

  // Handle index files: getting-started/index -> getting-started
  const normalized = withoutExt.replace(/\/index$/i, '');

  // Return empty string if this resolves to root
  return normalized || '';
}

/**
 * Generate a URL-safe slug from text for heading IDs
 * - Lowercase
 * - Replace spaces and special chars with hyphens
 * - Remove consecutive hyphens
 * - Trim leading/trailing hyphens
 */
function generateSlug(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
    .replace(/[\s_]+/g, '-')   // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-')       // Remove consecutive hyphens
    .replace(/^-|-$/g, '');    // Trim leading/trailing hyphens
}

/**
 * Transform an internal markdown link to a hash-based section link
 *
 * @param {string} href - Original href from markdown link
 * @param {object} context - Transformation context
 * @param {string} context.currentPath - Current file path relative to content root
 * @param {string} context.contentRoot - Absolute path to content root
 * @param {Map<string,object>} context.sectionIndex - Map of section IDs to section info (for validation)
 * @param {object} context.linkWarnings - Array to collect link warnings
 * @param {boolean} context.strictLinks - Whether to error on broken links (default: true)
 * @returns {string} Transformed href (hash-based) or original href if not transformable
 */
function transformInternalLink(href, context) {
  // Skip external links
  if (isExternalLink(href)) {
    return href;
  }

  // Skip fragment-only links
  if (isFragmentOnly(href)) {
    return href;
  }

  // Only transform markdown links
  if (!isMarkdownLink(href)) {
    return href;
  }

  // Parse href to extract path and fragment
  const hashIndex = href.indexOf('#');
  const pathname = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const fragment = hashIndex >= 0 ? href.slice(hashIndex) : '';

  // Normalize the link path
  const normalizedPath = normalizeLinkPath(pathname);

  // Resolve relative path to absolute (relative to content root)
  const resolvedPath = resolveLinkPath(normalizedPath, context.currentPath);

  // Convert to section ID
  const sectionId = pathToSectionId(resolvedPath);

  // Validate section exists (if index available)
  if (context.sectionIndex && sectionId) {
    // Case-insensitive lookup
    const sectionIdLower = sectionId.toLowerCase();
    let found = false;
    let actualId = sectionId;

    for (const [id] of context.sectionIndex) {
      // Skip entries with undefined/null IDs
      if (!id) continue;
      if (id.toLowerCase() === sectionIdLower) {
        found = true;
        actualId = id;
        // Warn if case doesn't match exactly
        if (id !== sectionId && context.linkWarnings) {
          context.linkWarnings.push({
            type: 'case-mismatch',
            source: context.currentPath,
            href: href,
            expected: id,
            actual: sectionId
          });
        }
        break;
      }
    }

    if (!found && context.linkWarnings) {
      context.linkWarnings.push({
        type: 'broken',
        source: context.currentPath,
        href: href,
        targetId: sectionId
      });
      // Preserve original link on validation failure (graceful degradation)
      return href;
    }

    // Use the correctly-cased section ID
    if (found && actualId !== sectionId) {
      return fragment ? `#${actualId}${fragment}` : `#${actualId}`;
    }
  }

  // Compose hash-based URL
  // Double hash for section + anchor: #section-id#anchor
  return fragment ? `#${sectionId}${fragment}` : `#${sectionId}`;
}

/**
 * Print link validation warnings
 */
function printLinkWarnings(warnings, tenantId, strictLinks = true) {
  if (!warnings || warnings.length === 0) return;

  const brokenLinks = warnings.filter(w => w.type === 'broken');
  const caseMismatches = warnings.filter(w => w.type === 'case-mismatch');

  if (brokenLinks.length > 0) {
    const level = strictLinks ? 'ERROR' : 'WARN';
    console.log(`  ↳ [${level}] ${brokenLinks.length} broken link(s) found:`);
    for (const w of brokenLinks.slice(0, 10)) { // Show first 10
      console.log(`      ${w.source}: [link](${w.href}) → target "${w.targetId}" not found`);
    }
    if (brokenLinks.length > 10) {
      console.log(`      ... and ${brokenLinks.length - 10} more`);
    }
  }

  if (caseMismatches.length > 0) {
    console.log(`  ↳ [WARN] ${caseMismatches.length} case mismatch(es) found (resolved, but may break on Linux):`);
    for (const w of caseMismatches.slice(0, 5)) { // Show first 5
      console.log(`      ${w.source}: expected "${w.expected}", got "${w.actual}"`);
    }
    if (caseMismatches.length > 5) {
      console.log(`      ... and ${caseMismatches.length - 5} more`);
    }
  }
}

// ============================================================================
// End Internal Link Transformation
// ============================================================================

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

function routePath(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '');
}

function collectionForRelPath(relPath, collections = []) {
  const normalized = relPath.split(path.sep).join('/');
  return collections.find((collection) => {
    const collectionPath = routePath(collection.path);
    return collectionPath && (normalized === collectionPath || normalized.startsWith(`${collectionPath}/`));
  }) || null;
}

function decorateCollectionEntry(entry, metadata, collection) {
  if (!collection || !entry) return entry;
  entry.collection = routePath(collection.path);
  entry.showDate = collection.showDate === true;
  entry.showSummary = collection.showSummary === true;
  entry.showReadingTime = collection.showReadingTime !== false;
  if (metadata.date) entry.date = metadata.date;
  if (metadata.reading_time) entry.reading_time = metadata.reading_time;
  return entry;
}

function sortCollectionEntries(entries, collection) {
  if (!collection || !Array.isArray(entries)) return entries;
  const sortBy = collection.sortBy || 'date';
  const dir = (collection.order || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  entries.sort((a, b) => {
    const av = a?.[sortBy];
    const bv = b?.[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return entries;
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

  // Build exclude set from manifest
  const excludeSet = new Set(manifest?.exclude || []);
  const isManifestExcluded = (name) => {
    const stem = name.replace(/\.[^.]+$/, '');
    return excludeSet.has(name) || excludeSet.has(stem);
  };

  // Read directory contents
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });

  // Separate files and directories, applying both standard and manifest exclusions
  const files = entries.filter(e =>
    e.isFile() && isContentFile(e.name) && !isExcludedName(e.name) && !isManifestExcluded(e.name)
  );
  const subdirs = entries.filter(e =>
    e.isDirectory() && !isExcludedName(e.name) && !isManifestExcluded(e.name)
  );

  // Process index file first (if exists)
  const indexFile = files.find(f => /^index\.(md|markdown|html|htm|js|mjs)$/i.test(f.name));
  if (indexFile) {
    const sectionId = parentId || path.basename(dirPath);
    const relPath = path.relative(context.contentRoot, path.join(dirPath, indexFile.name));
    const metadata = await readContentMetadata(path.join(dirPath, indexFile.name));
    const collection = collectionForRelPath(relPath, context.collections);
    const title = manifest?.title || metadata.title || humanizeTitle(path.basename(dirPath));
    const summary = manifest?.summary || metadata.summary || '';

    const sectionEntry = {
      id: sectionId,
      title,
      summary,
      file: relPath,
      _isIndex: true
    };
    decorateCollectionEntry(sectionEntry, metadata, collection);
    sections.push(sectionEntry);
  }

  // Process other content files
  for (const file of files) {
    if (indexFile && file.name === indexFile.name) continue; // Skip index, already processed

    const sectionId = deriveSectionId(parentId, file.name);
    const manifestEntry = manifest?.sections?.find(s =>
      s.id === sectionId || s.file === file.name || s.id === file.name.replace(/\.[^.]+$/, '')
    );

    const relPath = path.relative(context.contentRoot, path.join(dirPath, file.name));
    const metadata = await readContentMetadata(path.join(dirPath, file.name));
    const collection = collectionForRelPath(relPath, context.collections);
    const title = manifestEntry?.title || metadata.title || humanizeTitle(file.name);
    const summary = manifestEntry?.summary || metadata.summary || '';
    const type = manifestEntry?.type || null;

    const sectionEntry = {
      id: sectionId,
      title,
      summary,
      file: relPath
    };
    decorateCollectionEntry(sectionEntry, metadata, collection);
    if (type) sectionEntry.type = type;
    sections.push(sectionEntry);
  }

  // Process subdirectories
  for (const subdir of subdirs) {
    const subdirPath = path.join(dirPath, subdir.name);
    const subdirId = deriveSectionId(parentId, subdir.name);
    const subdirManifest = await loadDirectoryManifest(subdirPath);

    // Look up metadata from parent manifest's sections array
    const parentEntry = manifest?.sections?.find(s =>
      s.id === subdir.name || s.id === subdirId
    );

    const title = subdirManifest?.title || parentEntry?.title || humanizeTitle(subdir.name);
    const summary = subdirManifest?.summary || parentEntry?.summary || '';
    const collapsed = subdirManifest?.collapsed ?? parentEntry?.collapsed ?? false;

    const subsections = await scanContentDirectory(subdirPath, subdirId, context, depth + 1);

    if (subsections.length > 0) {
      // Check if there's an index page that should be the group's landing
      const indexEntry = subsections.find(s => s._isIndex);

      if (indexEntry) {
        // Remove index from subsections, it becomes the group itself
        const otherSections = subsections.filter(s => !s._isIndex);
        sortCollectionEntries(otherSections, collectionForRelPath(path.relative(context.contentRoot, subdirPath), context.collections));
        const entry = {
          id: subdirId,
          title,
          summary,
          file: indexEntry.file,
          subsections: otherSections.length > 0 ? otherSections : undefined
        };
        if (collapsed) entry.collapsed = true;
        sections.push(entry);
      } else {
        // No index, just a group with subsections
        const entry = {
          id: subdirId,
          title,
          summary,
          subsections: sortCollectionEntries(subsections, collectionForRelPath(path.relative(context.contentRoot, subdirPath), context.collections))
        };
        if (collapsed) entry.collapsed = true;
        sections.push(entry);
      }
    }
  }

  // Add external links from manifest (entries with url property)
  if (manifest?.sections) {
    for (const entry of manifest.sections) {
      if (entry.url) {
        sections.push({
          title: entry.title,
          summary: entry.summary || '',
          url: entry.url
        });
      }
    }
  }

  // Apply ordering from manifest or sort alphabetically
  if (manifest?.order && Array.isArray(manifest.order)) {
    const orderMap = new Map(manifest.order.map((id, idx) => [id, idx]));
    sections.sort((a, b) => {
      const aOrder = a.id ? (orderMap.get(a.id) ?? orderMap.get(a.id.split('/').pop()) ?? 999) : 999;
      const bOrder = b.id ? (orderMap.get(b.id) ?? orderMap.get(b.id.split('/').pop()) ?? 999) : 999;
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

// ============================================================================
// @-Mention Link Following & Manifest Expansion
// ============================================================================

/**
 * Extract @docs/ references from markdown content.
 * Returns an array of file paths relative to the content root.
 *
 * @param {string} content - Raw markdown text
 * @returns {string[]} Array of relative file paths (e.g., 'research/glossary.md')
 */
function extractAtMentionRefs(content) {
  const refs = [];
  const pattern = /@docs\/([^\s,);>\]`'"]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    let ref = match[1].replace(/[.,;:!?]+$/, '');
    // Only include references to content files (skip PDFs, images, etc.)
    const ext = path.extname(ref).toLowerCase();
    if (ext && !CONTENT_EXTENSIONS.includes(ext)) continue;
    // If no extension, try appending .md
    if (!ext) ref += '.md';
    refs.push(ref);
  }
  return refs;
}

/**
 * Build a flat index of all sections by their file paths.
 * Used to check which files are already in the manifest.
 *
 * @param {object[]} sections - Array of section objects (with subsections)
 * @param {Set<string>} [fileSet] - Set to populate
 * @returns {Set<string>} Set of file paths already included
 */
function indexSectionFiles(sections, fileSet = new Set()) {
  for (const s of sections) {
    if (s.file) fileSet.add(s.file);
    if (s.subsections) indexSectionFiles(s.subsections, fileSet);
  }
  return fileSet;
}

/**
 * Expand the section tree by following @docs/ references in content files.
 * Uses BFS to discover referenced documents up to maxDepth levels deep.
 * Only markdown/content files that exist on disk and are NOT already in the
 * section tree get added. Discovered sections are grouped under a collapsed
 * "Referenced" nav group, or merged into their parent directory group if one exists.
 *
 * @param {object[]} sections - Scanned section tree
 * @param {string} contentRoot - Absolute path to content root
 * @param {object} opts - followLinks configuration
 * @param {number} [opts.maxDepth=3] - Maximum recursion depth
 * @returns {Promise<{ sections: object[], discoveredCount: number }>}
 */
async function expandLinkedSections(sections, contentRoot, opts = {}) {
  const maxDepth = (opts && opts.maxDepth) || 3;

  // Index files already in the section tree
  const knownFiles = indexSectionFiles(sections);

  // Flat list of all sections for BFS seeding (including nested)
  function flattenSections(arr) {
    const result = [];
    for (const s of arr) {
      result.push(s);
      if (s.subsections) result.push(...flattenSections(s.subsections));
    }
    return result;
  }

  // BFS queue: { filePath (relative to contentRoot), depth }
  const queue = [];
  const visited = new Set(); // file paths we've already read for refs
  const discovered = []; // newly discovered section objects

  // Seed queue with all existing sections that have files
  for (const s of flattenSections(sections)) {
    if (s.file) {
      queue.push({ filePath: s.file, depth: 0 });
      visited.add(s.file);
    }
  }

  while (queue.length > 0) {
    const { filePath, depth } = queue.shift();
    if (depth >= maxDepth) continue;

    // Read the file and extract @docs/ references
    const absPath = path.join(contentRoot, filePath);
    let content;
    try {
      content = await fsp.readFile(absPath, 'utf8');
    } catch {
      continue; // file unreadable, skip
    }

    const refs = extractAtMentionRefs(content);

    for (const ref of refs) {
      // Normalize path separators
      const normalizedRef = ref.replace(/\\/g, '/');

      // Skip if already known or already visited
      if (knownFiles.has(normalizedRef) || visited.has(normalizedRef)) continue;
      visited.add(normalizedRef);

      // Check the file exists on disk
      const refAbsPath = path.join(contentRoot, normalizedRef);
      try {
        await fsp.access(refAbsPath, fsp.constants?.R_OK ?? 4);
      } catch {
        continue; // file doesn't exist, skip
      }

      // Build a section entry for this discovered file
      const stem = normalizedRef.replace(/\.[^.]+$/, '');
      const sectionId = stem.replace(/\\/g, '/');
      const baseName = path.basename(stem);
      const title = humanizeTitle(baseName);

      const newSection = {
        id: sectionId,
        title,
        summary: '',
        file: normalizedRef,
        _autoDiscovered: true
      };

      knownFiles.add(normalizedRef);
      discovered.push(newSection);

      // Enqueue for further following at next depth
      queue.push({ filePath: normalizedRef, depth: depth + 1 });
    }
  }

  if (discovered.length === 0) {
    return { sections, discoveredCount: 0 };
  }

  // Group discovered sections by directory, merging into existing groups
  // or placing under a collapsed "Referenced" top-level group
  const sectionById = new Map();
  function indexById(arr) {
    for (const s of arr) {
      if (s.id) sectionById.set(s.id, s);
      if (s.subsections) indexById(s.subsections);
    }
  }
  indexById(sections);

  const ungrouped = [];

  for (const ds of discovered) {
    const dirId = path.dirname(ds.id);

    // Try to find an existing parent group to merge into
    if (dirId && dirId !== '.' && sectionById.has(dirId)) {
      const parent = sectionById.get(dirId);
      if (!parent.subsections) parent.subsections = [];
      parent.subsections.push(ds);
    } else {
      ungrouped.push(ds);
    }
  }

  // Any ungrouped sections go into a collapsed "Referenced" group
  if (ungrouped.length > 0) {
    const existingReferenced = sectionById.get('referenced');
    if (existingReferenced) {
      if (!existingReferenced.subsections) existingReferenced.subsections = [];
      existingReferenced.subsections.push(...ungrouped);
    } else {
      sections.push({
        id: 'referenced',
        title: 'Referenced',
        summary: 'Auto-discovered documents referenced from other pages',
        collapsed: true,
        subsections: ungrouped
      });
    }
  }

  return { sections, discoveredCount: discovered.length };
}

/**
 * Build section index from scanned sections for link validation
 * Returns a Map of section ID -> { id, title, file }
 */
function buildSectionIndex(sections, index = new Map()) {
  for (const section of sections) {
    const { id, title, file, subsections } = section;
    // Only index sections with valid IDs
    if (id) {
      index.set(id, { id, title, file });
    }

    if (subsections && subsections.length > 0) {
      buildSectionIndex(subsections, index);
    }
  }
  return index;
}

/**
 * Process scanned sections into built modules
 * Materializes content files and builds manifest entries
 */
async function materializeScannedSections(sections, context) {
  const processed = [];

  for (const section of sections) {
    const { id, title, summary, file, subsections, url, type, collapsed, _isIndex, ...metadata } = section;

    // Pass through external links without processing
    if (url) {
      processed.push({ title, summary, url });
      continue;
    }

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
          // Create link context for this file
          const linkContext = {
            currentPath: file,
            contentRoot: context.contentRoot,
            sectionIndex: context.sectionIndex,
            linkWarnings: context.linkWarnings,
            strictLinks: context.strictLinks
          };
          await ensureMarkdownModule(sourcePath, targetPath, linkContext);
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
        const entry = {
          id,
          title,
          summary,
          ...metadata,
          module: `./sections/${outFile}`,
          subsections: processedSubsections
        };
        if (type) entry.type = type;
        if (collapsed) entry.collapsed = true;
        processed.push(entry);
      } else {
        const entry = { id, title, summary, ...metadata, module: `./sections/${outFile}` };
        if (type) entry.type = type;
        if (collapsed) entry.collapsed = true;
        processed.push(entry);
      }
    } else if (processedSubsections && processedSubsections.length > 0) {
      // Group without its own content
      const entry = { id, title, summary, ...metadata, subsections: processedSubsections };
      if (type) entry.type = type;
      if (collapsed) entry.collapsed = true;
      processed.push(entry);
    }
  }

  return processed;
}

/**
 * Apply manifest-declared hierarchy to scanned sections.
 *
 * When the root _manifest.json has a `sections` array with `parent` fields,
 * the flat filesystem scan is restructured into the declared tree hierarchy.
 * Virtual groups (sections without files) become navigation groups.
 * Only sections listed in the manifest appear in navigation when parent
 * fields are present; unlisted scanned items are appended at the end.
 *
 * @param {Array} scannedSections - Filesystem-based scan result
 * @param {object} rootManifest - Root _manifest.json content
 * @returns {Array} Restructured sections tree
 */
function applyManifestHierarchy(scannedSections, rootManifest) {
  if (!rootManifest?.sections?.length) return scannedSections;

  // Only activate when at least one section uses parent fields
  const hasParentFields = rootManifest.sections.some(s => s.parent);
  if (!hasParentFields) return scannedSections;

  // Build flat index of all scanned sections by ID (recursive)
  const scannedById = new Map();
  function indexScanned(sections) {
    for (const s of sections) {
      if (s.id) scannedById.set(s.id, s);
      if (s.subsections) indexScanned(s.subsections);
    }
  }
  indexScanned(scannedSections);

  // Build parent->children map from manifest sections
  const childrenOf = new Map(); // parentId (or null for root) -> [manifest entries]
  const manifestById = new Map();

  for (const entry of rootManifest.sections) {
    if (!entry.id) continue; // skip external links
    manifestById.set(entry.id, entry);
    const parent = entry.parent || null;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(entry);
  }

  // Recursively build a tree node from a manifest entry
  function buildNode(mEntry) {
    const scanned = scannedById.get(mEntry.id);
    const children = childrenOf.get(mEntry.id) || [];

    const node = {
      id: mEntry.id,
      title: mEntry.title || scanned?.title || mEntry.id,
      summary: mEntry.summary || scanned?.summary || ''
    };
    for (const key of ['collection', 'showDate', 'showSummary', 'showReadingTime', 'date', 'reading_time']) {
      if (scanned?.[key] !== undefined) node[key] = scanned[key];
    }

    if (mEntry.collapsed) node.collapsed = true;
    if (mEntry.type) node.type = mEntry.type;

    // Use file path from manifest declaration or scanned discovery
    if (mEntry.file) {
      node.file = mEntry.file;
    } else if (scanned?.file) {
      node.file = scanned.file;
    }

    // Collect subsections: manifest-declared children first
    const subsections = [];
    for (const child of children) {
      subsections.push(buildNode(child));
    }

    // Keep scanned subsections not remapped by manifest
    if (scanned?.subsections) {
      const childIds = new Set(children.map(c => c.id));
      for (const sub of scanned.subsections) {
        if (!sub.id) continue;
        // Skip if manifest declares a different parent for this item
        const mDef = manifestById.get(sub.id);
        if (mDef && mDef.parent && mDef.parent !== mEntry.id) continue;
        // Skip if already included as a manifest child
        if (childIds.has(sub.id)) continue;
        subsections.push(sub);
      }
    }

    if (subsections.length > 0) node.subsections = subsections;

    return node;
  }

  // Build root-level entries (manifest sections with no parent)
  const rootChildren = childrenOf.get(null) || [];
  const result = [];

  for (const entry of rootChildren) {
    result.push(buildNode(entry));
  }

  // Add external links from manifest
  for (const entry of rootManifest.sections) {
    if (entry.url) {
      result.push({ title: entry.title, summary: entry.summary || '', url: entry.url });
    }
  }

  console.log(`  ↳ applied manifest hierarchy (${manifestById.size} entries, ${rootChildren.length} top-level groups)`);
  return result;
}

/**
 * Process tenant content using nested directory scanning (ADR-010)
 *
 * @param {string} sourceDir - Tenant source directory
 * @param {string} distDir - Build output directory
 * @param {string} tenantId - Tenant identifier
 * @param {object} contentRoot - Content root info from findContentRoot()
 * @param {object} [options] - Build options
 * @param {boolean} [options.strictLinks=true] - Whether to error on broken links
 */
async function processNestedContent(sourceDir, distDir, tenantId, contentRoot, options = {}, config = {}) {
  const sectionsDir = path.join(distDir, 'sections');
  const keepFiles = new Set(['section-templates.js']);
  await pruneSectionsDirectory(sectionsDir, keepFiles);

  // Default to strict links (error on broken links)
  const strictLinks = options.strictLinks !== false;
  const linkWarnings = [];

  // Load root _manifest.json for site configuration
  const rootManifest = await loadDirectoryManifest(contentRoot.basePath);
  const siteConfig = {
    bottomNav: rootManifest?.bottomNav || 'mobile',
    bottomNavSections: rootManifest?.bottomNavSections || [],
    // Pass SEO-relevant config to SPA for dynamic meta tag updates.
    // siteUrl falls back to `domain` (#15); ogImage drives social cards (#16).
    siteTitle: config.title || '',
    siteUrl: resolveBaseUrl(config),
    ogImage: resolveOgImage(config, resolveBaseUrl(config))
  };

  // Build export branding configuration
  const exportConfig = await buildExportConfig(config, sourceDir);

  const context = {
    contentRoot: contentRoot.basePath,
    sectionsDir,
    tenantId,
    keepFiles,
    leafOrder: [],
    siteConfig,
    collections: Array.isArray(config.collections) ? config.collections : [],
    // Link transformation context (populated after scan)
    sectionIndex: null,
    linkWarnings,
    strictLinks
  };

  // Scan content directory tree
  const scannedSections = await scanContentDirectory(contentRoot.basePath, null, context);

  if (scannedSections.length === 0) {
    console.warn(`  ↳ ${tenantId}: no content found in ${contentRoot.basePath}`);
    return { success: false };
  }

  // Apply manifest-declared hierarchy (reparent sections via parent fields)
  const structuredSections = applyManifestHierarchy(scannedSections, rootManifest);

  // Follow @docs/ links to auto-discover referenced documents (opt-in)
  const followLinksConfig = options.followLinks || rootManifest?.followLinks || false;
  if (followLinksConfig) {
    const flOpts = typeof followLinksConfig === 'object' ? followLinksConfig : {};
    const { discoveredCount } = await expandLinkedSections(
      structuredSections, contentRoot.basePath, flOpts
    );
    if (discoveredCount > 0) {
      console.log(`  ↳ link-following: ${discoveredCount} new sections auto-discovered`);
    }
  }

  // Build section index for link validation (pass 1)
  context.sectionIndex = buildSectionIndex(structuredSections);

  // Materialize all sections with link transformation (pass 2)
  const processedManifest = await materializeScannedSections(structuredSections, context);

  if (processedManifest.length === 0) {
    console.warn(`  ↳ ${tenantId}: no sections materialized`);
    return { success: false };
  }

  // Print link warnings
  if (linkWarnings.length > 0) {
    printLinkWarnings(linkWarnings, tenantId, strictLinks);

    // Error on broken links if strict mode
    const brokenLinks = linkWarnings.filter(w => w.type === 'broken');
    if (strictLinks && brokenLinks.length > 0) {
      console.error(`  ↳ [ERROR] ${tenantId}: Build failed due to ${brokenLinks.length} broken link(s). Use strictLinks: false to warn instead.`);
      return { success: false, brokenLinks: brokenLinks.length };
    }
  }

  // Determine default section
  const defaultSection = context.leafOrder[0];

  // Generate manifest.js with site configuration and export branding
  const manifestModule = buildManifestModuleSource(processedManifest, defaultSection, context.siteConfig, exportConfig);
  await fsp.writeFile(path.join(distDir, 'manifest.js'), manifestModule, 'utf8');
  console.log(`  ↳ applied nested content structure for ${tenantId} (${context.leafOrder.length} sections)`);

  // Emit the static Fortemi chunked search index. Failure here never breaks the
  // bundle — the runtime search adapter degrades to its legacy in-browser index.
  try {
    await generateSearchIndex(distDir, processedManifest, { tenantId });
  } catch (err) {
    console.warn(`  ↳ search index generation skipped for ${tenantId}: ${err.message}`);
  }

  return { success: true, sectionsCount: context.leafOrder.length };
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
    const type = entry.type || null; // Support content type (e.g., 'press-release')
    if (Array.isArray(entry.sections) && entry.sections.length) {
      const subsections = await processManifestEntries(entry.sections, context);
      const groupEntry = { id, title, summary, subsections };
      if (type) groupEntry.type = type;
      processed.push(groupEntry);
      continue;
    }

    const modulePath = await materializeSectionModule(entry, context);
    if (modulePath) {
      context.leafOrder.push(id);
      const leafEntry = { id, title, summary, module: modulePath };
      if (type) leafEntry.type = type;
      processed.push(leafEntry);
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
  const outFile = `${encodePathForFilename(id)}.js`;
  const targetPath = path.join(context.sectionsDir, outFile);
  context.keepFiles.add(outFile);

  try {
    if (ext === '.md' || ext === '.markdown') {
      // Create link context for this file
      const linkContext = context.sectionIndex ? {
        currentPath: relPath,
        contentRoot: context.contentDir,
        sectionIndex: context.sectionIndex,
        linkWarnings: context.linkWarnings,
        strictLinks: context.strictLinks
      } : null;
      await ensureMarkdownModule(sourcePath, targetPath, linkContext);
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

function buildManifestModuleSource(manifestEntries, defaultSection, siteConfig = {}, exportConfig = {}) {
  const manifestJson = JSON.stringify(manifestEntries, null, 2);
  const defaultJson = JSON.stringify(defaultSection || null);
  const configJson = JSON.stringify({
    bottomNav: siteConfig.bottomNav || 'mobile', // 'always' | 'mobile' | 'never'
    bottomNavSections: siteConfig.bottomNavSections || [], // Section prefixes to always show nav
    ...siteConfig
  }, null, 2);
  const exportJson = JSON.stringify(exportConfig, null, 2);
  return `export const MANIFEST = ${manifestJson};
export const DEFAULT_SECTION = ${defaultJson};

const SECTION_INDEX = new Map();

function registerEntry(entry, parentId = null) {
  if (parentId) entry.parentId = parentId;
  SECTION_INDEX.set(entry.id, entry);
  if (Array.isArray(entry.subsections)) {
    entry.subsections.forEach((child) => registerEntry(child, entry.id));
  }
}

MANIFEST.forEach((entry) => registerEntry(entry));

export function findSection(id) {
  return SECTION_INDEX.get(id) || null;
}

// Build flat list of navigable sections for prev/next navigation
function buildFlatNav() {
  const flat = [];
  MANIFEST.forEach((entry) => {
    if (entry.subsections && entry.subsections.length) {
      entry.subsections.forEach((sub) => flat.push(sub));
    } else {
      flat.push(entry);
    }
  });
  return flat;
}

const FLAT_NAV = buildFlatNav();

/**
 * Get previous and next sections for bottom navigation
 * @param {string} currentId - Current section ID
 * @returns {{ prev: object|null, next: object|null }}
 */
export function getAdjacentSections(currentId) {
  const index = FLAT_NAV.findIndex((s) => s.id === currentId);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null
  };
}

// Site configuration (from tenant _manifest.json)
export const SITE_CONFIG = ${configJson};

// Export document branding configuration
export const EXPORT_CONFIG = ${exportJson};
`;
}

/**
 * Main entry point for processing tenant content
 * Detects content structure type and delegates to appropriate processor
 *
 * @param {string} sourceDir - Tenant source directory
 * @param {string} distDir - Build output directory
 * @param {string} tenantId - Tenant identifier
 * @param {object} [options] - Build options
 * @param {boolean} [options.strictLinks=true] - Whether to error on broken links
 * @param {object} [config={}] - Tenant configuration from config.json
 */
async function processTenantContent(sourceDir, distDir, tenantId, options = {}, config = {}) {
  // Detect content structure type
  const contentRoot = await findContentRoot(sourceDir);

  // Check for explicit manifest.json (legacy or hybrid mode)
  const manifestPath = path.join(sourceDir, TENANT_MANIFEST);
  const hasManifest = await pathExists(manifestPath);

  if (contentRoot.type === 'none' && !hasManifest) {
    console.warn(`  ↳ ${tenantId}: no content found`);
    return { success: true };
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
          return (await processNestedContent(sourceDir, distDir, tenantId, contentRoot, options, config)) ?? { success: true };
        }
      } catch {
        // Fall through to nested processing if manifest is invalid
      }
    }

    // No manifest or manifest doesn't fully define structure - use nested scanning
    return (await processNestedContent(sourceDir, distDir, tenantId, contentRoot, options, config)) ?? { success: true };
  }

  // Flat content/ structure with manifest - use legacy processing
  if (hasManifest && contentRoot.type === 'flat') {
    return (await processTenantManifestLegacy(sourceDir, distDir, tenantId, options, config)) ?? { success: true };
  }

  // Fallback: try legacy processing
  if (hasManifest) {
    return (await processTenantManifestLegacy(sourceDir, distDir, tenantId, options, config)) ?? { success: true };
  }

  return { success: true };
}

/**
 * Legacy manifest processing for flat content/ structure
 * Preserved for backward compatibility with existing tenants
 *
 * @param {string} sourceDir - Tenant source directory
 * @param {string} distDir - Build output directory
 * @param {string} tenantId - Tenant identifier
 * @param {object} [options] - Build options
 */
async function processTenantManifestLegacy(sourceDir, distDir, tenantId, options = {}, config = {}) {
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

  // Build section index for link validation
  const sectionIndex = new Map();
  function collectSectionIds(sectionEntries) {
    for (const entry of sectionEntries) {
      if (entry.id) {
        sectionIndex.set(entry.id, { id: entry.id, file: entry.file });
      }
      if (Array.isArray(entry.sections)) {
        collectSectionIds(entry.sections);
      }
    }
  }
  collectSectionIds(entries);

  const linkWarnings = [];
  const strictLinks = options.strictLinks !== false;

  // Extract site configuration from manifest
  const siteConfig = {
    bottomNav: manifestData.bottomNav || 'mobile',
    bottomNavSections: manifestData.bottomNavSections || [],
    // SEO-relevant config for runtime meta updates — parity with the nested path
    // so the runtime <title> brand matches config.title, not a generic fallback (#29).
    siteTitle: config.title || manifestData.title || '',
    siteUrl: resolveBaseUrl(config),
    ogImage: resolveOgImage(config, resolveBaseUrl(config))
  };

  const context = {
    contentDir,
    sectionsDir,
    tenantId,
    keepFiles,
    leafOrder: [],
    siteConfig,
    // Link transformation context
    sectionIndex,
    linkWarnings,
    strictLinks
  };

  const processedManifest = await processManifestEntries(entries, context);
  if (!processedManifest.length) {
    console.warn(`  ↳ ${tenantId}: manifest did not produce any sections`);
    return;
  }

  // Print link warnings, and fail the tenant on broken links under strict mode
  if (linkWarnings.length > 0) {
    printLinkWarnings(linkWarnings, tenantId, strictLinks);
    const brokenLinks = linkWarnings.filter(w => w.type === 'broken');
    if (strictLinks && brokenLinks.length > 0) {
      console.error(`  ↳ [ERROR] ${tenantId}: Build failed due to ${brokenLinks.length} broken link(s). Use strictLinks: false to warn instead.`);
      return { success: false, brokenLinks: brokenLinks.length };
    }
  }

  const defaultSection = manifestData.default || manifestData.defaultSection || context.leafOrder[0];
  const manifestModule = buildManifestModuleSource(processedManifest, defaultSection, context.siteConfig);
  await fsp.writeFile(path.join(distDir, 'manifest.js'), manifestModule, 'utf8');
  console.log(`  ↳ applied manifest-driven content for ${tenantId}`);

  // Emit the static Fortemi chunked search index (legacy manifest path).
  try {
    await generateSearchIndex(distDir, processedManifest, { tenantId });
  } catch (err) {
    console.warn(`  ↳ search index generation skipped for ${tenantId}: ${err.message}`);
  }

  return { success: true };
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

  // Content processing options (strictLinks defaults to true unless explicitly set to false)
  // Check both tenant registry and config.json for strictLinks setting
  const strictLinksSetting = tenant.strictLinks !== undefined ? tenant.strictLinks : config.strictLinks;
  const followLinksSetting = tenant.followLinks !== undefined ? tenant.followLinks : config.followLinks;
  const contentOptions = {
    strictLinks: strictLinksSetting !== false,
    followLinks: followLinksSetting || false
  };

  let contentResult = { success: true };
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
      contentResult = await processTenantContent(sourceDir, distDir, tenantId, contentOptions, config);
    }

    // Process only the specified files
    await processIncrementalManifest(sourceDir, distDir, tenantId, explicitFiles, contentOptions, config);
  } else if (isGitIncrementalBuild) {
    console.log(`  mode: incremental (${changes.files.added.length + changes.files.modified.length} files to process)`);

    // For incremental builds, we need the base build to exist
    if (!(await pathExists(distDir))) {
      console.log(`  ↳ no existing build found, performing full build`);
      await runBuild(buildOutput);
    }

    // Process only changed content files
    await processIncrementalManifest(sourceDir, distDir, tenantId, changes.files, contentOptions, config);
  } else {
    console.log(`  mode: full`);
    await runBuild(buildOutput);

    // Process full manifest from source directory
    contentResult = await processTenantContent(sourceDir, distDir, tenantId, contentOptions, config);
  }

  // Fail the tenant before branding/SEO/deploy if content processing failed
  // (e.g. broken links under strictLinks). Continuing would deploy a half-built
  // dist with no tenant manifest.js, yielding a misleading "ready" and the
  // downstream SEO "sectionEntry is not defined" error (#12, #13).
  if (contentResult && contentResult.success === false) {
    console.error(`  ↳ ${tenantId}: aborting build — content processing failed`);
    return { success: false, changes };
  }

  // Apply file overrides from source FIRST (before branding/theme modifications)
  const overridesDir = path.join(sourceDir, 'overrides');
  if (await pathExists(overridesDir)) {
    await copyDirectory(overridesDir, distDir);
    console.log(`  ↳ applied file overrides for ${tenantId}`);
  }

  // Apply branding and config (on top of overrides)
  if (Object.keys(config).length > 0) {
    await applyBranding(distDir, config, tenantId);
    await applyThemePicker(distDir, config, tenantId);
    await applyThemeColors(distDir, config, tenantId);
    await applyNavPosition(distDir, config, tenantId);
    await applyDocsMap(distDir, config, tenantId);
    await applyWelcome(distDir, config, tenantId);
  }

  // Inject the tenant id into the shell's base-resolution bootstrap for EVERY
  // tenant (regardless of branding config) so subpath mounts resolve assets
  // against the tenant root. Domain-root deploys fall back to "/".
  await injectTenantBase(distDir, tenantId);

  // Set the shell <title> from the default page's metadata title (SEO, #28),
  // falling back to the generic brand only when no default title exists.
  await applyDefaultPageTitle(distDir, config);

  // Copy static assets from .public/ directory
  await copyPublicAssets(sourceDir, distDir, tenantId);

  // Generate SEO artifacts (sitemap.xml, robots.txt, static pages)
  await generateSeoArtifacts(distDir, config);

  // Generate collection manifests/feeds (#18) — opt-in via config.collections
  if (Array.isArray(config.collections) && config.collections.length > 0) {
    const collectionRoot = await findContentRoot(sourceDir);
    if (collectionRoot.basePath) {
      await generateCollections(distDir, config, collectionRoot.basePath);
    }
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
 *
 * @param {string} sourceDir - Tenant source directory
 * @param {string} distDir - Build output directory
 * @param {string} tenantId - Tenant identifier
 * @param {object} changedFiles - Changed files { added, modified, deleted }
 * @param {object} [options] - Build options
 * @param {object} [config={}] - Tenant configuration
 */
async function processIncrementalManifest(sourceDir, distDir, tenantId, changedFiles, options = {}, config = {}) {
  const contentDir = path.join(sourceDir, DEFAULT_CONTENT_DIR);
  const sectionsDir = path.join(distDir, 'sections');

  // Ensure sections directory exists
  await fsp.mkdir(sectionsDir, { recursive: true });

  // Build file-to-sectionId map from manifest
  const fileToSectionId = await buildFileToSectionMap(sourceDir);

  // Build section index for link validation (from existing manifest.js if available)
  // Note: For full link validation in incremental mode, we'd need to scan all content
  // For now, we provide a partial context (without full section index)
  const contentRoot = await findContentRoot(sourceDir);
  const linkWarnings = [];
  const sectionIndex = new Map();

  // Add known sections from fileToSectionId map
  for (const [file, id] of fileToSectionId.entries()) {
    sectionIndex.set(id, { id, file });
  }

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
    const targetPath = path.join(sectionsDir, `${encodePathForFilename(sectionId)}.js`);

    try {
      if (ext === '.md' || ext === '.markdown') {
        // Create link context for this file
        const linkContext = {
          currentPath: relPath,
          contentRoot: contentRoot.basePath || contentDir,
          sectionIndex,
          linkWarnings,
          strictLinks: options.strictLinks !== false,
          collections: Array.isArray(config.collections) ? config.collections : []
        };
        await ensureMarkdownModule(sourcePath, targetPath, linkContext);
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

  // Print link warnings
  if (linkWarnings.length > 0) {
    printLinkWarnings(linkWarnings, tenantId, options.strictLinks !== false);
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
    await processTenantContent(sourceDir, distDir, tenantId, options, config);
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

  // Exit non-zero when any tenant failed so CI can gate on it — e.g. the
  // strictLinks broken-link gate (#12). Use exitCode (not exit()) so the
  // return below still works when this script is imported programmatically.
  if (failCount > 0) {
    process.exitCode = 1;
  }

  // Return results for programmatic use (if this script is imported)
  return results;
}

// Only auto-run when this file is the process entrypoint, so unit tests can
// import named exports (e.g. markdownToHtml — #19) without triggering main().
const __isMainModule = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (__isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { markdownToHtml };
