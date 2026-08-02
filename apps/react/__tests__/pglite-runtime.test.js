import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryRecordStore } from '@fortemi/core';
import { createPagenaryPgliteRuntime } from '../src/pglite-runtime.js';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';

test('PGlite projection is explicit and semantic support requires a model', async () => {
  await assert.rejects(() => createPagenaryPgliteRuntime({ tier: 'record' }), /tier "pglite"/);
  await assert.rejects(
    () => createPagenaryPgliteRuntime({ tier: 'pglite', features: { semantic: { enabled: true } } }),
    /explicit model/
  );
});

test('canonical records project parent-first and rebuild row-for-row', async () => {
  const records = await createPagenaryRecordRuntime(
    { tier: 'record', storage: 'memory' },
    { store: new MemoryRecordStore(), tenantId: 'projection-test' }
  );
  const note = await records.notes.create({ title: 'Canonical', content: 'Authority stays here' });
  const parent = await records.notes.createCollection('Parent');
  const child = await records.notes.createCollection('Child', 'Nested', parent.id);
  await records.notes.addNoteToCollection(child.id, note.note.id);

  const runtime = await createPagenaryPgliteRuntime(
    { tier: 'pglite', storage: 'memory', namespace: 'projection-test' },
    { records }
  );
  const before = await runtime.db.query('SELECT id, parent_id FROM collection ORDER BY id');
  assert.deepEqual(before.rows, [
    { id: child.id, parent_id: parent.id },
    { id: parent.id, parent_id: null }
  ].sort((a, b) => a.id.localeCompare(b.id)));
  const canonicalHead = await records.store.headSeq();
  await runtime.rebuild();
  const after = await runtime.db.query('SELECT id, parent_id FROM collection ORDER BY id');
  assert.deepEqual(after.rows, before.rows);
  assert.equal(await records.store.headSeq(), canonicalHead);
  assert.equal(runtime.semantic.enabled, false);
  await runtime.close();
});

test('missing and cyclic collection parents fail before projection mutation', async () => {
  for (const [name, collections] of [
    ['missing', [{ id: 'child', name: 'Child', parent_id: 'absent' }]],
    ['cyclic', [
      { id: 'a', name: 'A', parent_id: 'b' },
      { id: 'b', name: 'B', parent_id: 'a' }
    ]]
  ]) {
    const store = new MemoryRecordStore();
    const now = new Date(0).toISOString();
    for (const collection of collections) {
      await store.put('collection', {
        ...collection,
        description: null,
        created_at: now,
        updated_at: now,
        deleted_at: null
      });
    }
    const records = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' }, { store });
    const head = await store.headSeq();
    await assert.rejects(
      () => createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: `invalid-${name}` }, { records }),
      /parent|cycle|collection/i
    );
    assert.equal(await store.headSeq(), head);
  }
});
