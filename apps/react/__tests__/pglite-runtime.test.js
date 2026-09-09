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

test('missing and cyclic collection parents reject projection creation without canonical mutation', async () => {
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

test('source refresh rebuilds real PGlite from canonical records, including retries', async () => {
  const runtime = await createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: 'refresh-test' });
  try {
    const plan = await runtime.refresh.prepare({ items: [{ id: 'guide', title: 'Guide', text: 'Refreshed content' }] });
    await runtime.refresh.preview(plan);
    const result = await runtime.refresh.execute(plan, { approval: plan.planDigest });
    const id = result.receipts[0].items[0].note_id;
    const projected = await runtime.db.query('SELECT content FROM note_revised_current WHERE note_id = $1', [id]);
    assert.equal(projected.rows[0].content, 'Refreshed content');
    const head = await runtime.records.store.headSeq();
    await runtime.refresh.execute(plan, { approval: plan.planDigest });
    assert.equal(await runtime.records.store.headSeq(), head);
    assert.equal((await runtime.db.query('SELECT count(*)::int AS count FROM note')).rows[0].count, 1);
  } finally {
    await runtime.close();
  }
});

test('a failed projection rebuild recovers from canonical receipts without reimporting', async () => {
  const runtime = await createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: 'refresh-recovery' });
  const query = runtime.db.query.bind(runtime.db);
  try {
    const plan = await runtime.refresh.prepare({ items: [{ id: 'guide', text: 'Committed canonical content' }] });
    await runtime.refresh.preview(plan);
    runtime.db.query = async (sql, ...args) => {
      if (sql.includes('INSERT INTO note (')) throw new Error('Injected projection failure');
      return query(sql, ...args);
    };
    await assert.rejects(runtime.refresh.execute(plan, { approval: plan.planDigest }), /Injected projection failure/);
    assert.equal((await runtime.records.store.list('note')).length, 1);
    const head = await runtime.records.store.headSeq();
    runtime.db.query = query;
    await runtime.refresh.execute(plan, { approval: plan.planDigest });
    assert.equal(await runtime.records.store.headSeq(), head);
    assert.equal((await query('SELECT count(*)::int AS count FROM note')).rows[0].count, 1);
    const reconciliation = await runtime.refresh.prepareReconciliation({ items: [] }, {
      completeCorpus: true, operationKey: 'retire-guide'
    });
    await runtime.refresh.reconcile(reconciliation, { approval: reconciliation.planDigest });
    assert.equal((await query('SELECT count(*)::int AS count FROM note WHERE deleted_at IS NULL')).rows[0].count, 0);
    await runtime.rebuild();
    assert.equal((await query('SELECT count(*)::int AS count FROM note WHERE deleted_at IS NULL')).rows[0].count, 0);
  } finally {
    runtime.db.query = query;
    await runtime.close();
  }
});
