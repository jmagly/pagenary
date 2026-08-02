import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  prototypeCoreV1KnowledgeShard,
  prototypeFullV1KnowledgeShard,
} from './fortemi-shard-prototype.js';

const DEFAULT_OUTPUT = 'fortemi/tenant.knowledge-shard.tar.gz';

function safeRelativeOutput(value = DEFAULT_OUTPUT) {
  const normalized = String(value).replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..' || part === '')) {
    throw new Error('knowledgeShard.output must be a safe relative file path');
  }
  return normalized;
}

export function resolveKnowledgeShardConfig(config = {}) {
  const value = config.knowledgeShard;
  if (!value || value.enabled !== true) return { enabled: false };
  return {
    enabled: true,
    profile: value.profile || 'core-v1',
    output: safeRelativeOutput(value.output),
  };
}

export async function loadSearchIndexExport(distDir) {
  const indexDir = path.join(distDir, 'search-index');
  const manifest = JSON.parse(await fsp.readFile(path.join(indexDir, 'manifest.json'), 'utf8'));
  const items = [];
  for (const part of manifest.parts || []) {
    const payload = JSON.parse(await fsp.readFile(path.join(indexDir, part.href), 'utf8'));
    items.push(...(payload.items || []));
  }
  if (items.length !== manifest.total) {
    throw new Error(`Knowledge Shard source index expected ${manifest.total} records, found ${items.length}`);
  }
  return {
    schema_version: manifest.source_export_schema_version,
    generated_at: manifest.generated_at,
    source: manifest.source,
    compatibility: manifest.source_export_schema_version === 'aiwg.fortemi.index.export.v2'
      ? {
          previous_schema_version: 'aiwg.fortemi.index.export.v1',
          strategy: 'supported',
        }
      : undefined,
    items,
  };
}

export async function emitKnowledgeShardArtifacts(distDir, index, config = {}) {
  const resolved = resolveKnowledgeShardConfig(config);
  if (!resolved.enabled) return { enabled: false };
  if (!['core-v1', 'full-v1'].includes(resolved.profile)) {
    throw new Error(`Unsupported knowledgeShard.profile: ${resolved.profile}`);
  }

  const started = process.hrtime.bigint();
  let bytes;
  let conversion;
  if (resolved.profile === 'full-v1') {
    const result = await prototypeFullV1KnowledgeShard(index);
    if (!result.success || !result.lossless || !result.archive) {
      const losses = (result.losses || []).map((loss) => loss.code).join(', ') || 'unknown loss';
      throw new Error(`Knowledge Shard full-v1 conversion is not lossless: ${losses}`);
    }
    bytes = result.archive;
    conversion = {
      profile: result.profile,
      schema_version: result.schema_version,
      lossless: result.lossless,
      receipt: result.receipt,
    };
  } else {
    const result = await prototypeCoreV1KnowledgeShard(index);
    if (!result.report.roundTripExact || !result.report.reproducible) {
      throw new Error('Knowledge Shard core-v1 conversion failed reproducibility or round-trip verification');
    }
    bytes = result.bytes;
    conversion = result.report;
  }

  const buffer = Buffer.from(bytes);
  const digest = crypto.createHash('sha256').update(buffer).digest('hex');
  const outputPath = path.join(distDir, resolved.output);
  const digestPath = `${outputPath}.sha256`;
  const receiptPath = `${outputPath}.provenance.json`;
  const relativeName = path.basename(resolved.output);
  const provenance = {
    schema_version: 'pagenary.knowledge-shard.provenance.v1',
    generated_at: index.generated_at,
    source_schema_version: index.schema_version,
    source_build_hash: index.source?.build_hash || null,
    profile: resolved.profile,
    record_count: index.items.length,
    byte_length: buffer.byteLength,
    sha256: digest,
    reproducible: true,
    round_trip_exact: resolved.profile === 'core-v1' ? conversion.roundTripExact : conversion.lossless,
    conversion_receipt: resolved.profile === 'full-v1' ? conversion.receipt : null,
  };

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, buffer);
  await fsp.writeFile(digestPath, `${digest}  ${relativeName}\n`, 'utf8');
  await fsp.writeFile(receiptPath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
  const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
  return {
    enabled: true,
    output: resolved.output,
    digest,
    recordCount: index.items.length,
    byteLength: buffer.byteLength,
    durationMs,
    provenance,
  };
}

export async function generateKnowledgeShardArtifacts(distDir, config = {}) {
  const resolved = resolveKnowledgeShardConfig(config);
  if (!resolved.enabled) return { enabled: false };
  const index = await loadSearchIndexExport(distDir);
  const result = await emitKnowledgeShardArtifacts(distDir, index, config);
  console.log(
    `  ↳ Knowledge Shard: ${result.recordCount} record(s), ${result.byteLength} bytes, ` +
    `${result.durationMs.toFixed(1)} ms, sha256 ${result.digest.slice(0, 12)}`
  );
  return result;
}
