import { buildFortemiIndexExport } from '../../src/lib/fortemi-corpus.js';
import {
  promotePagenaryIndexToV2,
  projectPagenaryIndexForFullV1,
  prototypeCoreV1KnowledgeShard,
  prototypeFullV1KnowledgeShard,
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
      profile: 'core-v1',
      shardSchemaVersion: '1.2.0',
      authorityProjection: 'pagenary-static-extensions-removed',
    });
    expect(result.report.byteLength).toBeGreaterThan(0);
    expect(result.restored).toEqual(projectPagenaryIndexForFullV1(fixture()));
  });

  test('keeps the explicit core-v1 entry point byte-compatible', async () => {
    const legacy = await prototypeKnowledgeShard(fixture());
    const explicit = await prototypeCoreV1KnowledgeShard(fixture());
    expect(Buffer.from(explicit.bytes)).toEqual(Buffer.from(legacy.bytes));
  });

  test('projects Pagenary extensions without mutating the source index', () => {
    const source = fixture();
    const projected = projectPagenaryIndexForFullV1(source);
    expect(source.source.build_hash).toBeDefined();
    expect(source.items[0].delivery_assets).toBeDefined();
    expect(projected.source.build_hash).toBeUndefined();
    expect(projected.items[0].delivery_assets).toBeUndefined();
  });

  test('reports typed losses and no archive for a non-representable docsite', async () => {
    const result = await prototypeFullV1KnowledgeShard(fixture());
    expect(result).toMatchObject({
      profile: 'full-v1',
      schema_version: '2.0.0',
      success: false,
      lossless: false,
      archive: null,
    });
    expect(result.losses.length).toBeGreaterThan(0);
    expect(result.losses.every((loss) => (
      typeof loss.code === 'string' &&
      typeof loss.action === 'string' &&
      typeof loss.component === 'string'
    ))).toBe(true);
  });

  test('emits exact full-v1 for a fully representable empty authority index', async () => {
    const source = {
      schema_version: 'aiwg.fortemi.index.export.v1',
      generated_at: '2026-01-01T00:00:00.000Z',
      source: { repo: 'pagenary', privacy: 'public' },
      items: [],
    };
    const result = await prototypeFullV1KnowledgeShard(source);
    expect(result).toMatchObject({
      profile: 'full-v1',
      schema_version: '2.0.0',
      success: true,
      lossless: true,
      losses: [],
    });
    expect(result.archive).toBeInstanceOf(Uint8Array);
    expect(result.archive.byteLength).toBeGreaterThan(0);
    expect(result.receipt.contract_valid).toBe(true);
  });

  test('preserves operational state separately from explicit deletion transfer', () => {
    const source = fixture();
    source.items[0].operational_state = {
      classification: 'historical',
      observed_state: 'deleted',
      current_action_selector: false,
    };
    source.items[0].state_transfer = { deleted_at: null };
    const projected = projectPagenaryIndexForFullV1(source);
    expect(projected.items[0].operational_state.observed_state).toBe('deleted');
    expect(projected.items[0].state_transfer.deleted_at).toBeNull();
  });
});
