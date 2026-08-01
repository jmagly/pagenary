import {
  aiwgFortemiIndexFromKnowledgeShard,
  aiwgFortemiIndexToKnowledgeShard,
  aiwgFortemiIndexToKnowledgeShardWithReport,
} from '@fortemi/core/aiwg-index-shard';
import { validateAiwgFortemiIndexExport } from '@fortemi/core/aiwg-index';
import { isDeepStrictEqual } from 'node:util';
import { migrateFortemiIndexExport } from '../../src/lib/fortemi-corpus.js';

export function promotePagenaryIndexToV2(index) {
  return migrateFortemiIndexExport(index);
}

/**
 * The full-v1 authority schema is closed. Pagenary's build hash and delivery
 * asset projection are useful static-publisher extensions, but they are not
 * AIWG v2 authority fields. Keep the source index intact and remove only those
 * extensions from the value submitted to the report-bearing converter.
 */
export function projectPagenaryIndexForFullV1(index) {
  const projected = JSON.parse(JSON.stringify(promotePagenaryIndexToV2(index)));
  projected.source.graph ||= 'pagenary:docs-map';
  if (projected.source) delete projected.source.build_hash;
  for (const item of projected.items || []) delete item.delivery_assets;
  return projected;
}

export async function prototypeCoreV1KnowledgeShard(index) {
  const projected = projectPagenaryIndexForFullV1(index);
  const validation = validateAiwgFortemiIndexExport(projected);
  if (!validation.valid) {
    throw new Error(`Invalid promoted Fortemi index:\n${validation.errors.join('\n')}`);
  }
  const first = await aiwgFortemiIndexToKnowledgeShard(projected);
  const second = await aiwgFortemiIndexToKnowledgeShard(projected);
  if (Buffer.compare(Buffer.from(first), Buffer.from(second)) !== 0) {
    throw new Error('Knowledge Shard conversion is not byte-reproducible');
  }
  const restored = aiwgFortemiIndexFromKnowledgeShard(first);
  const canonicalRestored = JSON.parse(JSON.stringify(restored));
  const canonicalProjected = JSON.parse(JSON.stringify(projected));
  return {
    bytes: first,
    restored,
    report: {
      schemaVersion: projected.schema_version,
      recordCount: projected.items.length,
      byteLength: first.byteLength,
      reproducible: true,
      roundTripExact: isDeepStrictEqual(canonicalRestored, canonicalProjected),
      profile: 'core-v1',
      shardSchemaVersion: '1.2.0',
      authorityProjection: 'pagenary-static-extensions-removed',
    },
  };
}

export async function prototypeFullV1KnowledgeShard(index) {
  const projected = projectPagenaryIndexForFullV1(index);
  const result = await aiwgFortemiIndexToKnowledgeShardWithReport(projected);
  return {
    ...result,
    projected,
  };
}

// Backward-compatible name for the original #136 prototype.
export const prototypeKnowledgeShard = prototypeCoreV1KnowledgeShard;
