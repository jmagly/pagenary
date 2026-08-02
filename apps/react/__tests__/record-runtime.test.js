import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryRecordStore } from '@fortemi/core';
import { aiwgFortemiIndexToKnowledgeShard } from '@fortemi/core/aiwg-index-shard';
import { buildFortemiIndexExport } from '../../publisher/src/lib/fortemi-corpus.js';
import { projectPagenaryIndexForFullV1 } from '../../publisher/scripts/lib/fortemi-shard-prototype.js';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';

test('record runtime is explicit and reports the non-PGlite capability boundary', async () => {
  await assert.rejects(() => createPagenaryRecordRuntime({ tier: 'pglite' }), /tier "record"/);
  const runtime = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store: new MemoryRecordStore(), tenantId: 'test' });
  assert.equal(runtime.tier, 'record');
  assert.equal(runtime.capabilities.semantic, 'none');
  assert.equal(runtime.capabilities.pglite, false);
  assert.equal(runtime.backend.capabilities.semantic, 'none');
  await runtime.close();
});

test('notes and nested collections round-trip through a record-v1 shard', async () => {
  const source = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store: new MemoryRecordStore() });
  const note = await source.notes.create({ title: 'Review', content: 'Approved locally' });
  const parent = await source.notes.createCollection('Parent');
  const child = await source.notes.createCollection('Child', 'Nested', parent.id);
  await source.notes.addNoteToCollection(child.id, note.note.id);
  const archive = await source.exportShard();

  const target = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store: new MemoryRecordStore() });
  await target.importShard(archive);
  assert.equal((await target.notes.get(note.note.id)).revised_content, 'Approved locally');
  assert.equal((await target.store.get('collection', child.id)).parent_id, parent.id);
  assert.deepEqual((await target.notes.notesInCollection(child.id)).map(({ id }) => id), [note.note.id]);
  await source.close();
  await target.close();
});

test('conflicting shard imports fail before mutating existing records', async () => {
  const source = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store: new MemoryRecordStore() });
  const note = await source.notes.create({ id: 'shared-note', content: 'seed' });
  const archive = await source.exportShard();
  const target = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store: new MemoryRecordStore() });
  await target.notes.create({ id: note.note.id, content: 'local' });
  const before = await target.store.headSeq();
  await assert.rejects(() => target.importShard(archive), /conflict/i);
  assert.equal(await target.store.headSeq(), before);
  assert.equal((await target.notes.get(note.note.id)).revised_content, 'local');
  await source.close();
  await target.close();
});

test('build-time core-v1 Knowledge Shards seed canonical notes without PGlite', async () => {
  const index = buildFortemiIndexExport([{
    section: { id: 'guide', title: 'Guide', file: 'guide.md' },
    text: 'Portable content'
  }]).index;
  const archive = await aiwgFortemiIndexToKnowledgeShard(projectPagenaryIndexForFullV1(index), { profile: 'core-v1' });
  const runtime = await createPagenaryRecordRuntime(
    { tier: 'record', storage: 'memory', seed: { type: 'knowledge-shard', path: 'seed.shard' } },
    { store: new MemoryRecordStore(), seedBytes: archive }
  );
  const seeded = await runtime.notes.get(index.items[0].id);
  assert.equal(seeded.note.title, 'Guide');
  assert.match(seeded.revised_content, /Portable content/);
  assert.equal(runtime.capabilities.pglite, false);
  await runtime.close();
});
