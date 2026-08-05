import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SECRET_NAME_PATTERN = /(token|secret|password|passwd|pwd|credential|cookie|session|private|bearer|api[_-]?key|auth)/i;
const ABSOLUTE_PATH_PATTERN = /(^|[\s(])((?:\/|[A-Za-z]:[\\/])(?:[^<>\s)"']+))/g;
const SENSITIVE_QUERY_PATTERN = /([?&](?:token|secret|password|sig|signature|key|auth)=)([^&\s]+)/gi;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function normalizePathString(value) {
  return String(value).replace(/\\/g, '/');
}

function realpathSyncSafe(targetPath) {
  const realpath = fs.realpathSync.native ?? fs.realpathSync;
  return realpath(targetPath);
}

function assertNonEmptyString(value, message, code) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RendererSecurityError(message, { code });
  }
}

function assertSafeToken(value, message, code) {
  assertNonEmptyString(value, message, code);
  if (value.includes('\0')) {
    throw new RendererSecurityError(message, { code });
  }
}

function containsPath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function ensureWithinRoot(rootPath, candidatePath, requestedPath) {
  if (!containsPath(rootPath, candidatePath)) {
    throw new RendererSecurityError(`Renderer path escapes tenant root: ${requestedPath}`, {
      code: 'ERR_RENDERER_PATH_ESCAPE'
    });
  }
}

function collectSecretValues(secretEnv = {}) {
  const values = [];
  for (const [key, value] of Object.entries(secretEnv)) {
    if (SECRET_NAME_PATTERN.test(key) && typeof value === 'string' && value.length > 0) {
      values.push(value);
    }
  }
  return values;
}

function redactString(input, { rootPaths = [], secretValues = [], secretEnv = {} } = {}) {
  let redacted = String(input);
  const labels = rootPaths
    .map((rootPath, index) => ({
      source: normalizePathString(path.resolve(rootPath)),
      label: index === 0 ? '<tenant-root>' : `<root-${index + 1}>`
    }))
    .sort((a, b) => b.source.length - a.source.length);

  for (const { source, label } of labels) {
    redacted = redacted.split(source).join(label);
  }

  redacted = redacted.replace(
    /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|KEY|COOKIE|CREDENTIAL|AUTH)[A-Z0-9_]*)=([^\s"'`]+)/gi,
    '$1=<redacted>'
  );
  redacted = redacted.replace(SENSITIVE_QUERY_PATTERN, '$1<redacted>');

  const allSecrets = [...secretValues, ...collectSecretValues(secretEnv)]
    .filter((value) => typeof value === 'string' && value.length >= 3)
    .sort((a, b) => b.length - a.length);
  for (const secret of allSecrets) {
    redacted = redacted.split(secret).join('<redacted>');
  }

  redacted = redacted.replace(ABSOLUTE_PATH_PATTERN, (match, prefix, candidate) => {
    if (candidate.startsWith('<tenant-root>') || candidate.startsWith('<root-')) {
      return `${prefix}${candidate}`;
    }
    if (/^[a-z]+:\/\//i.test(candidate)) return `${prefix}${candidate}`;
    return `${prefix}<abs-path>`;
  });

  return redacted;
}

function redactValue(value, options) {
  if (typeof value === 'string') return redactString(value, options);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, options));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactValue(entry, options)])
    );
  }
  return value;
}

function mergeMutable(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (isPlainObject(value) && isPlainObject(target[key])) {
      mergeMutable(target[key], value);
      continue;
    }
    target[key] = cloneValue(value);
  }
}

function shouldBlockPath(candidatePath, immutablePaths) {
  return immutablePaths.some((immutablePath) => (
    immutablePath === candidatePath
      || immutablePath.startsWith(`${candidatePath}.`)
      || candidatePath.startsWith(`${immutablePath}.`)
  ));
}

function applyAuthoredOverrides(target, source, immutablePaths, rejectedPaths, currentPath = '') {
  for (const [key, value] of Object.entries(source ?? {})) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (isPlainObject(value) && isPlainObject(target[key]) && !immutablePaths.includes(nextPath)) {
      applyAuthoredOverrides(target[key], value, immutablePaths, rejectedPaths, nextPath);
      continue;
    }
    if (shouldBlockPath(nextPath, immutablePaths)) {
      rejectedPaths.push(nextPath);
      continue;
    }
    target[key] = cloneValue(value);
  }
}

function normalizeRequestedSegments(requestedPath) {
  const normalized = normalizePathString(requestedPath).trim();
  if (
    normalized === ''
    || normalized.startsWith('//')
    || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
    || path.isAbsolute(normalized)
  ) {
    throw new RendererSecurityError(`Renderer path must be tenant-relative: ${requestedPath}`, {
      code: 'ERR_RENDERER_PATH_FORMAT'
    });
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new RendererSecurityError(`Renderer path must stay within tenant root: ${requestedPath}`, {
      code: 'ERR_RENDERER_PATH_TRAVERSAL'
    });
  }
  return segments;
}

function normalizeTrustedCommands(trustedCommands) {
  if (!Array.isArray(trustedCommands) || trustedCommands.length === 0) {
    throw new RendererSecurityError('Renderer subprocesses require an explicit trusted command allowlist.', {
      code: 'ERR_RENDERER_TRUSTED_COMMANDS'
    });
  }

  return new Set(trustedCommands.map((entry) => {
    assertNonEmptyString(entry, 'Trusted command allowlist entries must be absolute paths.', 'ERR_RENDERER_TRUSTED_COMMAND');
    if (!path.isAbsolute(entry)) {
      throw new RendererSecurityError(`Trusted command must be absolute: ${entry}`, {
        code: 'ERR_RENDERER_TRUSTED_COMMAND'
      });
    }
    try {
      return realpathSyncSafe(entry);
    } catch (error) {
      throw new RendererSecurityError(`Trusted command is missing or unreadable: ${entry}`, {
        code: 'ERR_RENDERER_TRUSTED_COMMAND',
        details: { cause: error.message }
      });
    }
  }));
}

export class RendererSecurityError extends Error {
  constructor(message, { code = 'ERR_RENDERER_SECURITY', details } = {}) {
    super(message);
    this.name = 'RendererSecurityError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }
  return Object.freeze(value);
}

export const DEFAULT_RENDERER_ENV_ALLOWLIST = deepFreeze([
  'HOME',
  'LANG',
  'LC_ALL',
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'TZ',
  'WINDIR'
]);

export const RENDERER_SECURITY_BASELINES = deepFreeze({
  mermaid: {
    version: '11.16.0',
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    maxTextSize: 50000,
    maxEdges: 500,
    secure: [
      'securityLevel',
      'startOnLoad',
      'maxTextSize',
      'maxEdges',
      'suppressErrorRendering',
      'secure'
    ]
  },
  latexPage: {
    allowShellEscape: false,
    allowNetwork: false,
    allowPackageInstall: false,
    allowAbsolutePaths: false,
    allowParentTraversal: false
  },
  plantuml: {
    securityProfile: 'SANDBOX',
    allowNetwork: false,
    allowUrlIncludes: false,
    allowExternalIncludes: false
  },
  subprocess: {
    timeoutMs: 15000,
    killGraceMs: 250,
    maxOutputBytes: 262144,
    maxErrorBytes: 65536
  }
});

export const IMMUTABLE_RENDERER_PATHS = deepFreeze([
  'mermaid.version',
  'mermaid.startOnLoad',
  'mermaid.securityLevel',
  'mermaid.suppressErrorRendering',
  'mermaid.maxTextSize',
  'mermaid.maxEdges',
  'mermaid.secure',
  'latexPage.allowShellEscape',
  'latexPage.allowNetwork',
  'latexPage.allowPackageInstall',
  'latexPage.allowAbsolutePaths',
  'latexPage.allowParentTraversal',
  'plantuml.securityProfile',
  'plantuml.allowNetwork',
  'plantuml.allowUrlIncludes',
  'plantuml.allowExternalIncludes',
  'subprocess.timeoutMs',
  'subprocess.killGraceMs',
  'subprocess.maxOutputBytes',
  'subprocess.maxErrorBytes'
]);

export function mergeRendererSecurityProfile({
  baseProfile = RENDERER_SECURITY_BASELINES,
  operatorOverrides = {},
  authoredOverrides = {},
  immutablePaths = IMMUTABLE_RENDERER_PATHS
} = {}) {
  const merged = cloneValue(baseProfile);
  mergeMutable(merged, operatorOverrides);

  const rejectedAuthoredPaths = [];
  applyAuthoredOverrides(merged, authoredOverrides, immutablePaths, rejectedAuthoredPaths);

  return {
    profile: deepFreeze(merged),
    rejectedAuthoredPaths
  };
}

export function buildScrubbedRendererEnv({
  baseEnv = process.env,
  allowEnv = DEFAULT_RENDERER_ENV_ALLOWLIST,
  overrides = {}
} = {}) {
  const scrubbed = {};
  for (const key of allowEnv) {
    if (SECRET_NAME_PATTERN.test(key)) continue;
    const value = baseEnv[key];
    if (typeof value === 'string' && value.length > 0) {
      scrubbed[key] = value;
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    assertSafeToken(key, 'Renderer env override names must be non-empty strings.', 'ERR_RENDERER_ENV_KEY');
    if (SECRET_NAME_PATTERN.test(key)) {
      throw new RendererSecurityError(`Renderer env override cannot set secret-bearing key: ${key}`, {
        code: 'ERR_RENDERER_ENV_SECRET'
      });
    }
    if (value === undefined || value === null) continue;
    scrubbed[key] = String(value);
  }

  return scrubbed;
}

export function resolveContainedRendererPath(rootDir, requestedPath, { allowMissingLeaf = false } = {}) {
  assertSafeToken(rootDir, 'Renderer tenant root must be a non-empty path.', 'ERR_RENDERER_ROOT');
  assertSafeToken(requestedPath, 'Renderer requested path must be a non-empty string.', 'ERR_RENDERER_PATH');

  const rootRealpath = realpathSyncSafe(rootDir);
  const segments = normalizeRequestedSegments(requestedPath);

  let currentPath = rootRealpath;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const candidatePath = path.join(currentPath, segment);
    const isLeaf = index === segments.length - 1;

    if (!fs.existsSync(candidatePath)) {
      if (allowMissingLeaf && isLeaf) {
        return path.join(currentPath, segment);
      }
      throw new RendererSecurityError(`Renderer path does not exist: ${requestedPath}`, {
        code: 'ERR_RENDERER_PATH_MISSING'
      });
    }

    const stat = fs.lstatSync(candidatePath);
    if (stat.isSymbolicLink()) {
      const targetPath = realpathSyncSafe(candidatePath);
      ensureWithinRoot(rootRealpath, targetPath, requestedPath);
      currentPath = targetPath;
      continue;
    }

    const resolvedPath = realpathSyncSafe(candidatePath);
    ensureWithinRoot(rootRealpath, resolvedPath, requestedPath);
    currentPath = resolvedPath;
  }

  return currentPath;
}

export async function runRendererSubprocess({
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  timeoutMs = RENDERER_SECURITY_BASELINES.subprocess.timeoutMs,
  killGraceMs = RENDERER_SECURITY_BASELINES.subprocess.killGraceMs,
  maxOutputBytes = RENDERER_SECURITY_BASELINES.subprocess.maxOutputBytes,
  maxErrorBytes = RENDERER_SECURITY_BASELINES.subprocess.maxErrorBytes,
  trustedCommands
} = {}) {
  assertNonEmptyString(command, 'Renderer subprocess command must be a non-empty string.', 'ERR_RENDERER_COMMAND');
  if (!path.isAbsolute(command)) {
    throw new RendererSecurityError(`Renderer subprocess command must be absolute: ${command}`, {
      code: 'ERR_RENDERER_COMMAND'
    });
  }
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string' || arg.includes('\0'))) {
    throw new RendererSecurityError('Renderer subprocess args must be an array of NUL-free strings.', {
      code: 'ERR_RENDERER_ARGS'
    });
  }

  const allowedCommands = normalizeTrustedCommands(trustedCommands);
  const resolvedCommand = realpathSyncSafe(command);
  if (!allowedCommands.has(resolvedCommand)) {
    throw new RendererSecurityError(`Renderer subprocess command is not allowlisted: ${command}`, {
      code: 'ERR_RENDERER_UNTRUSTED_COMMAND'
    });
  }

  return await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let finished = false;
    let finishReason = null;
    let killTimer = null;

    const child = spawn(resolvedCommand, args, {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const clearTimers = () => {
      clearTimeout(timeoutHandle);
      clearTimeout(killTimer);
    };

    const fail = (error) => {
      if (finished) return;
      finished = true;
      clearTimers();
      reject(error);
    };

    const terminate = (reason) => {
      if (finished || finishReason) return;
      finishReason = reason;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (!finished) child.kill('SIGKILL');
      }, killGraceMs);
      killTimer.unref?.();
    };

    const timeoutHandle = setTimeout(() => {
      terminate('timeout');
    }, timeoutMs);
    timeoutHandle.unref?.();

    child.stdout.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      stdoutBytes += buffer.length;
      if (stdoutBytes > maxOutputBytes) {
        terminate('stdout-limit');
        return;
      }
      stdout += buffer.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      stderrBytes += buffer.length;
      if (stderrBytes > maxErrorBytes) {
        terminate('stderr-limit');
        return;
      }
      stderr += buffer.toString('utf8');
    });

    child.on('error', (error) => {
      fail(new RendererSecurityError(`Renderer subprocess failed to start: ${error.message}`, {
        code: 'ERR_RENDERER_SUBPROCESS_START'
      }));
    });

    child.on('close', (code, signal) => {
      if (finished) return;
      clearTimers();

      if (finishReason === 'timeout') {
        fail(new RendererSecurityError('Renderer subprocess exceeded timeout budget.', {
          code: 'ERR_RENDERER_TIMEOUT',
          details: { timeoutMs }
        }));
        return;
      }
      if (finishReason === 'stdout-limit' || finishReason === 'stderr-limit') {
        fail(new RendererSecurityError('Renderer subprocess exceeded output budget.', {
          code: 'ERR_RENDERER_OUTPUT_LIMIT',
          details: {
            maxOutputBytes,
            maxErrorBytes,
            stdoutBytes,
            stderrBytes
          }
        }));
        return;
      }

      finished = true;
      resolve({
        code: code ?? 0,
        signal: signal ?? null,
        stdout,
        stderr
      });
    });
  });
}

export function redactRendererDiagnostic(value, options = {}) {
  return redactValue(value, options);
}
