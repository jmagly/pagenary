import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildFortemiIndexExport } from '../../src/lib/fortemi-corpus.js';
import {
  emitKnowledgeShardArtifacts,
  loadSearchIndexExport,
  resolveKnowledgeShardConfig,
} from '../../scripts/lib/knowledge-shard.js';

function fixture() {
  return buildFortemiIndexExport([
    { section: { id: 'overview', title: 'Overview', file: 'overview.md' }, text: 'Overview text' },
    { section: { id: 'guide', title: 'Guide', file: 'guide.md', related: ['overview'] }, text: 'Guide text' },
  ]).index;
}

describe('tenant Knowledge Shard emission (#155)', () => {
  test('is disabled by default and rejects unsafe output paths', () => {
    expect(resolveKnowledgeShardConfig({})).toEqual({ enabled: false });
    expect(() => resolveKnowledgeShardConfig({ knowledgeShard: { enabled: true, output: '../outside.shard' } }))
      .toThrow(/safe relative/);
  });

  test('emits deterministic bytes, digest, and provenance without browser artifacts', async () => {
    const firstDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-shard-a-'));
    const secondDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-shard-b-'));
    const config = { knowledgeShard: { enabled: true } };
    const first = await emitKnowledgeShardArtifacts(firstDir, fixture(), config);
    const second = await emitKnowledgeShardArtifacts(secondDir, fixture(), config);
    expect(first.digest).toBe(second.digest);
    expect(first.provenance).toEqual(second.provenance);
    expect(first.provenance).toMatchObject({
      schema_version: 'pagenary.knowledge-shard.provenance.v1',
      profile: 'core-v1',
      record_count: 2,
      reproducible: true,
      round_trip_exact: true,
    });
    const relative = 'fortemi/tenant.knowledge-shard.tar.gz';
    expect(await fsp.readFile(path.join(firstDir, relative)))
      .toEqual(await fsp.readFile(path.join(secondDir, relative)));
    expect(await fsp.readFile(path.join(firstDir, `${relative}.sha256`), 'utf8'))
      .toBe(`${first.digest}  tenant.knowledge-shard.tar.gz\n`);
    const files = await fsp.readdir(path.join(firstDir, 'fortemi'));
    expect(files.some((name) => /pglite|\.wasm|worker|database/i.test(name))).toBe(false);
  });

  test('fails closed when full-v1 cannot represent ordinary page records losslessly', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-shard-full-'));
    await expect(emitKnowledgeShardArtifacts(dir, fixture(), {
      knowledgeShard: { enabled: true, profile: 'full-v1' }
    })).rejects.toThrow(/not lossless/);
  });

  test('restores the v2 compatibility declaration from chunk artifacts', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-shard-index-'));
    await fsp.mkdir(path.join(dir, 'search-index'));
    const index = fixture();
    await fsp.writeFile(path.join(dir, 'search-index/manifest.json'), JSON.stringify({
      schema_version: 'aiwg.fortemi.index.chunk-manifest.v1',
      generated_at: index.generated_at,
      source: index.source,
      source_export_schema_version: index.schema_version,
      total: index.items.length,
      parts: [{ href: 'part-0000.json' }]
    }));
    await fsp.writeFile(path.join(dir, 'search-index/part-0000.json'), JSON.stringify({ items: index.items }));
    await expect(loadSearchIndexExport(dir)).resolves.toMatchObject({
      schema_version: 'aiwg.fortemi.index.export.v2',
      compatibility: {
        previous_schema_version: 'aiwg.fortemi.index.export.v1',
        strategy: 'supported'
      }
    });
  });
});
