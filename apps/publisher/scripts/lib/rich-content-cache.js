import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const CACHE_SCHEMA_VERSION = 'pagenary.rich-render-cache.v1';

export function buildRendererCacheIdentity(input = {}) {
  const material = normalizeIdentityMaterial(input);
  const digest = sha256(stableStringify(material));
  return {
    key: `sha256-${digest}`,
    material,
    materialHash: `sha256:${digest}`
  };
}

export class RendererCache {
  constructor({ rootDir }) {
    if (!rootDir) throw new Error('RendererCache requires rootDir');
    this.rootDir = rootDir;
  }

  entryPath(identity) {
    const key = assertIdentity(identity).key;
    return path.join(this.rootDir, `${key}.json`);
  }

  async read(identity) {
    const clean = assertIdentity(identity);
    const entryPath = this.entryPath(clean);
    let parsed;
    try {
      parsed = JSON.parse(await fs.readFile(entryPath, 'utf8'));
    } catch (error) {
      if (error && error.code === 'ENOENT') return { status: 'miss', reason: 'not-found' };
      await removeQuietly(entryPath);
      return { status: 'miss', reason: 'malformed-json' };
    }

    if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION || parsed.key !== clean.key) {
      await removeQuietly(entryPath);
      return { status: 'miss', reason: 'metadata-mismatch' };
    }
    const payloadHash = payloadDigest(parsed.payload);
    if (payloadHash !== parsed.payloadHash) {
      await removeQuietly(entryPath);
      return { status: 'miss', reason: 'content-hash-mismatch' };
    }
    return {
      status: 'hit',
      payload: parsed.payload,
      metadata: {
        schemaVersion: parsed.schemaVersion,
        key: parsed.key,
        materialHash: parsed.materialHash,
        payloadHash: parsed.payloadHash,
        writtenAt: parsed.writtenAt || null
      }
    };
  }

  async write(identity, payload) {
    const clean = assertIdentity(identity);
    await fs.mkdir(this.rootDir, { recursive: true });
    const entryPath = this.entryPath(clean);
    const tmpPath = path.join(this.rootDir, `.${clean.key}.${process.pid}.${Date.now()}.tmp`);
    const entry = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      key: clean.key,
      materialHash: clean.materialHash,
      payloadHash: payloadDigest(payload),
      writtenAt: new Date(0).toISOString(),
      payload
    };
    await fs.writeFile(tmpPath, `${stableStringify(entry)}\n`, 'utf8');
    await fs.rename(tmpPath, entryPath);
    return { status: 'written', path: entryPath };
  }
}

export function stableStringify(value) {
  return JSON.stringify(normalizeStable(value));
}

function normalizeIdentityMaterial(input) {
  return normalizeStable({
    tenantId: input.tenantId || null,
    pageId: input.pageId || null,
    nodeId: input.nodeId || input.node?.id || null,
    renderer: normalizeRenderer(input.renderer || input.adapter || {}),
    profile: input.profile || null,
    source: input.source != null ? String(input.source) : String(input.node?.source || input.node?.body || ''),
    config: input.config || {},
    theme: input.theme || {},
    fonts: input.fonts || [],
    outputFormat: input.outputFormat || 'html',
    securityProfile: input.securityProfile || null,
    dependencies: normalizeDependencies(input.dependencies || [])
  });
}

function normalizeRenderer(renderer) {
  return {
    id: renderer.id || null,
    version: renderer.version || null,
    cacheSalt: renderer.cacheSalt || null
  };
}

function normalizeDependencies(dependencies) {
  return [...dependencies]
    .map((dependency) => normalizeStable(dependency))
    .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

function normalizeStable(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeStable(item));
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizeStable(value[key]);
      return acc;
    }, {});
}

function assertIdentity(identity) {
  if (!identity || !/^sha256-[a-f0-9]{64}$/.test(identity.key || '')) {
    throw new Error('Invalid renderer cache identity');
  }
  return identity;
}

function payloadDigest(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function removeQuietly(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    // Best effort cleanup; caller already receives a cache miss.
  }
}
