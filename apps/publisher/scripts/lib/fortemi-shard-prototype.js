import {
  aiwgFortemiIndexFromKnowledgeShard,
  aiwgFortemiIndexToKnowledgeShard,
} from '@fortemi/core/aiwg-index-shard';
import { validateAiwgFortemiIndexExport } from '@fortemi/core/aiwg-index';
import { isDeepStrictEqual } from 'node:util';

export function promotePagenaryIndexToV2(index) {
  return {
    ...JSON.parse(JSON.stringify(index)),
    schema_version: 'aiwg.fortemi.index.export.v2',
    items: (index.items || []).map((item) => ({
      ...item,
      schema_version: 'aiwg.fortemi.index.record.v2',
    })),
    compatibility: {
      previous_schema_version: 'aiwg.fortemi.index.export.v1',
      strategy: 'supported',
    },
  };
}

export async function prototypeKnowledgeShard(index) {
  const promoted = promotePagenaryIndexToV2(index);
  const validation = validateAiwgFortemiIndexExport(promoted);
  if (!validation.valid) {
    throw new Error(`Invalid promoted Fortemi index:\n${validation.errors.join('\n')}`);
  }
  const first = await aiwgFortemiIndexToKnowledgeShard(promoted);
  const second = await aiwgFortemiIndexToKnowledgeShard(promoted);
  if (Buffer.compare(Buffer.from(first), Buffer.from(second)) !== 0) {
    throw new Error('Knowledge Shard conversion is not byte-reproducible');
  }
  const restored = aiwgFortemiIndexFromKnowledgeShard(first);
  const canonicalRestored = JSON.parse(JSON.stringify(restored));
  const canonicalPromoted = JSON.parse(JSON.stringify(promoted));
  return {
    bytes: first,
    restored,
    report: {
      schemaVersion: promoted.schema_version,
      recordCount: promoted.items.length,
      byteLength: first.byteLength,
      reproducible: true,
      roundTripExact: isDeepStrictEqual(canonicalRestored, canonicalPromoted),
    },
  };
}
