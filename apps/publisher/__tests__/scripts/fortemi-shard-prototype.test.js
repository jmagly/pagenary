import { buildFortemiIndexExport } from '../../src/lib/fortemi-corpus.js';
import {
  promotePagenaryIndexToV2,
  prototypeKnowledgeShard,
} from '../../scripts/lib/fortemi-shard-prototype.js';

describe('Fortemi Knowledge Shard export prototype (#136)', () => {
  function fixture() {
    return buildFortemiIndexExport([
      {
        section: { id: 'overview', title: 'Overview', file: 'overview.md' },
        text: 'Pagenary overview',
      },
      {
        section: { id: 'guide', title: 'Guide', file: 'guide.md', related: ['overview'] },
        text: 'Pagenary guide',
      },
    ]).index;
  }

  test('keeps the deterministic corpus in a compatibility-declared v2 envelope', () => {
    const promoted = promotePagenaryIndexToV2(fixture());
    expect(promoted.schema_version).toBe('aiwg.fortemi.index.export.v2');
    expect(promoted.items.every((item) => item.schema_version === 'aiwg.fortemi.index.record.v2')).toBe(true);
    expect(promoted.compatibility).toEqual({
      previous_schema_version: 'aiwg.fortemi.index.export.v1',
      strategy: 'supported',
    });
  });

  test('emits byte-identical archives and restores the complete promoted index', async () => {
    const result = await prototypeKnowledgeShard(fixture());
    expect(result.report).toMatchObject({
      schemaVersion: 'aiwg.fortemi.index.export.v2',
      recordCount: 2,
      reproducible: true,
      roundTripExact: true,
    });
    expect(result.report.byteLength).toBeGreaterThan(0);
    expect(result.restored).toEqual(promotePagenaryIndexToV2(fixture()));
  });
});
