import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryRecordStore } from '@fortemi/core';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';

const corpus = (text = 'Published text') => ({ items: [{ id: 'guide', title: 'Guide', text }] });
const open = (store = new MemoryRecordStore(), tenantId = 'test', namespace = 'docs') =>
  createPagenaryRecordRuntime({ tier: 'record', storage: 'memory', namespace }, { store, tenantId });
async function approve(runtime, index, options) {
  const plan = await runtime.refresh.prepare(index, options);
  await runtime.refresh.preview(plan);
  return { plan, execute: (options = {}) => runtime.refresh.execute(plan, { approval: plan.planDigest, ...options }) };
}

test('preview, rejected approval, and cancellation do not mutate canonical storage', async () => {
  const runtime = await open();
  const { plan, execute } = await approve(runtime, corpus());
  assert.equal(await runtime.store.headSeq(), 0);
  await assert.rejects(runtime.refresh.execute(plan), /approval/);
  const controller = new AbortController();
  controller.abort();
  assert.equal((await execute({ signal: controller.signal })).status, 'cancelled');
  assert.equal(await runtime.store.headSeq(), 0);
  await runtime.close();
});

test('exact replay produces no records or journal entries and defaults preserve conflicts', async () => {
  const runtime = await open();
  const first = await approve(runtime, corpus());
  const result = await first.execute();
  const id = result.receipts[0].items[0].note_id;
  const head = await runtime.store.headSeq();
  await first.execute();
  assert.equal(await runtime.store.headSeq(), head);
  await runtime.notes.addTag(id, 'local-annotation');
  const changed = await approve(runtime, corpus('Changed text'));
  const conflicts = await changed.execute();
  assert.equal(conflicts.receipts[0].counts.conflict, 1);
  assert.equal((await runtime.notes.get(id)).revised_content, 'Published text');
  const versioned = await approve(runtime, corpus('Changed text'), { policy: 'version' });
  await versioned.execute();
  assert.equal((await runtime.notes.get(id)).revised_content, 'Changed text');
  assert.equal((await runtime.store.list('note_tag')).length, 1);
  await runtime.close();
});

test('source identity is isolated by tenant and runtime namespace', async () => {
  const store = new MemoryRecordStore();
  for (const [tenant, namespace] of [['one', 'docs'], ['two', 'docs'], ['one', 'review']]) {
    const runtime = await open(store, tenant, namespace);
    await (await approve(runtime, corpus())).execute();
  }
  assert.equal((await store.list('note')).length, 3);
  assert.equal((await store.list('source_identity')).length, 3);
  await store.close();
});

test('interrupted batches resume from durable receipts and reject stale checkpoints', async () => {
  const store = new MemoryRecordStore();
  const runtime = await open(store);
  const index = { items: [...corpus().items, { id: 'second', text: 'Second page' }] };
  const initial = await approve(runtime, index, { batchSize: 1 });
  const controller = new AbortController();
  const interrupted = await initial.execute({ signal: controller.signal, onProgress: () => controller.abort() });
  assert.equal(interrupted.checkpoint.nextBatch, 1);
  assert.equal((await store.list('note')).length, 1);
  const reopened = await open(store);
  const retry = await approve(reopened, index, { batchSize: 1 });
  const complete = await retry.execute({ checkpoint: interrupted.checkpoint });
  assert.equal(complete.status, 'complete');
  assert.equal((await store.list('note')).length, 2);
  assert.equal((await store.list('source_import_batch')).length, 2);
  const changed = await approve(reopened, corpus('New corpus'));
  const before = await store.headSeq();
  await assert.rejects(changed.execute({ checkpoint: interrupted.checkpoint }), /checkpoint/);
  assert.equal(await store.headSeq(), before);
  await store.close();
});

test('invalid plans and destination edits require a fresh preview', async () => {
  const runtime = await open();
  await assert.rejects(runtime.refresh.prepare({ items: [...corpus().items, ...corpus().items] }), /duplicate/);
  await assert.rejects(runtime.refresh.prepare(corpus(), { batchSize: 501 }), /batch size/);
  const { plan, execute } = await approve(runtime, corpus());
  await assert.rejects(runtime.refresh.execute({ ...plan }, { approval: plan.planDigest }), /Unknown/);
  await runtime.notes.create({ content: 'User note' });
  const before = await runtime.store.headSeq();
  await assert.rejects(execute(), /Destination changed/);
  assert.equal(await runtime.store.headSeq(), before);
  await runtime.close();
});

test('explicit legacy adoption preserves local edits and updates the same note after policy selection', async () => {
  const runtime = await open();
  const legacy = await runtime.notes.create({ id: 'old-guide', title: 'Guide', content: 'Old published text' });
  await runtime.notes.update(legacy.note.id, { content: 'Locally annotated text' });
  await runtime.notes.addTag(legacy.note.id, 'reviewed');
  const before = await runtime.store.headSeq();
  const pending = await approve(runtime, corpus('New published text'), { legacyNotes: { guide: 'old-guide' } });
  assert.equal(await runtime.store.headSeq(), before);
  const result = await pending.execute();
  assert.equal(result.receipts[0].pagenary.adopted, 1);
  assert.equal(result.receipts[0].counts.conflict, 1);
  assert.equal((await runtime.store.list('note')).length, 1);
  assert.equal((await runtime.notes.get('old-guide')).revised_content, 'Locally annotated text');
  const next = await approve(runtime, corpus('New published text'), { policy: 'version' });
  await next.execute();
  assert.equal((await runtime.notes.get('old-guide')).revised_content, 'New published text');
  assert.deepEqual((await runtime.notes.get('old-guide')).tags, ['reviewed']);
  assert.ok((await runtime.store.list('note_revision')).some((row) => row.content === 'Locally annotated text'));
  await runtime.close();
});

test('adoption cannot claim another scope and a failed atomic commit leaves no partial adoption', async () => {
  const store = new MemoryRecordStore();
  const first = await open(store, 'first');
  const imported = await (await approve(first, corpus())).execute();
  const id = imported.receipts[0].items[0].note_id;
  const second = await open(store, 'second');
  await assert.rejects(approve(second, corpus(), { legacyNotes: { guide: id } }), /another source/);
  await first.notes.create({ id: 'legacy', content: 'Legacy text' });
  await assert.rejects(approve(first, corpus('Update'), { legacyNotes: { guide: 'legacy' } }), /conflicts/);
  const input = { items: [{ id: 'legacy-page', text: 'Updated legacy' }] };
  const plan = await approve(first, input, { legacyNotes: { 'legacy-page': 'legacy' } });
  const head = await store.headSeq();
  const applyBatch = store.applyBatch.bind(store);
  store.applyBatch = async () => { throw new Error('Injected atomic failure'); };
  await assert.rejects(plan.execute(), /Injected atomic failure/);
  assert.equal(await store.headSeq(), head);
  assert.equal((await store.list('source_identity')).length, 1);
  store.applyBatch = applyBatch;
  await plan.execute();
  assert.equal((await store.list('source_identity')).length, 2);
  await store.close();
});

test('title-only updates respect conflict/version policies and exact replay is inert', async () => {
  const runtime = await open();
  const first = await (await approve(runtime, corpus())).execute();
  const id = first.receipts[0].items[0].note_id;
  const renamed = corpus();
  renamed.items[0].title = 'Renamed guide';
  const conflict = await (await approve(runtime, renamed)).execute();
  assert.equal(conflict.receipts[0].pagenary.titlesConflicting, 1);
  assert.equal((await runtime.notes.get(id)).note.title, 'Guide');
  const accepted = await approve(runtime, renamed, { policy: 'version' });
  assert.equal((await accepted.execute()).receipts[0].pagenary.titlesChanged, 1);
  assert.equal((await runtime.notes.get(id)).note.title, 'Renamed guide');
  const head = await runtime.store.headSeq();
  await accepted.execute();
  assert.equal(await runtime.store.headSeq(), head);
  await runtime.close();
});

test('typed portable export reports live source identity loss', async () => {
  const runtime = await open();
  await (await approve(runtime, corpus())).execute();
  const exported = await runtime.exportShardWithReport();
  assert.equal(exported.success, true);
  assert.ok(exported.capability_report.losses.some((loss) => loss.code === 'source-identity-outside-profile'));
  assert.deepEqual(await runtime.listExportReceipts(), [exported.receipt]);
  const reopened = await open(runtime.store);
  assert.deepEqual(await reopened.listExportReceipts(), [exported.receipt]);
  const target = await open();
  assert.equal((await target.importShard(exported.archive)).success, true);
  assert.equal((await target.store.list('source_identity')).length, 0);
  await target.close();
  await runtime.close();
});

test('conflicting durable batch identity is rejected without mutation', async () => {
  const runtime = await open();
  const imported = await approve(runtime, corpus());
  await imported.execute();
  const [batch] = await runtime.store.list('source_import_batch');
  await runtime.store.put('source_import_batch', { ...batch, request_digest: 'different-request' });
  const head = await runtime.store.headSeq();
  await assert.rejects(runtime.refresh.preview(imported.plan), /batch rejected/);
  assert.equal(await runtime.store.headSeq(), head);
  await runtime.close();
});

test('absent pages never imply deletion and inherited object keys are valid external identities', async () => {
  const runtime = await open();
  await (await approve(runtime, { items: [{ id: 'toString', text: 'Kept' }, ...corpus().items] })).execute();
  await (await approve(runtime, corpus('Changed'), { policy: 'version' })).execute();
  assert.equal((await runtime.store.list('note')).length, 2);
  assert.ok((await runtime.store.list('note_revised_current')).some((row) => row.content === 'Kept'));
  await runtime.close();
});

test('complete-corpus reconciliation needs separate approval, preserves local notes, and retains a content-free receipt', async () => {
  const runtime = await open();
  const input = { items: [...corpus().items, { id: 'removed', text: 'Removed published text' }, { id: 'edited', text: 'Original text' }] };
  const imported = await (await approve(runtime, input)).execute();
  const identities = await runtime.store.list('source_identity');
  const editedId = identities.find((identity) => identity.external_id === 'edited').note_id;
  await runtime.notes.update(editedId, { content: 'Private user annotation' });
  const userNote = await runtime.notes.create({ content: 'User-owned note' });
  const head = await runtime.store.headSeq();
  await assert.rejects(runtime.refresh.prepareReconciliation(corpus(), { operationKey: 'remove-old' }), /complete corpus/);
  const plan = await runtime.refresh.prepareReconciliation(corpus(), { completeCorpus: true, operationKey: 'remove-old' });
  assert.equal(plan.counts.removed, 1);
  assert.equal(plan.counts.locallyEditedPreserved, 1);
  assert.equal(await runtime.store.headSeq(), head);
  await assert.rejects(runtime.refresh.reconcile(plan), /approval/);
  const aborted = new AbortController();
  aborted.abort();
  await runtime.refresh.reconcile(plan, { approval: plan.planDigest, signal: aborted.signal });
  assert.equal(await runtime.store.headSeq(), head);
  const receipt = await runtime.refresh.reconcile(plan, { approval: plan.planDigest });
  assert.equal(receipt.policy.terminal_purge, false);
  assert.doesNotMatch(JSON.stringify(receipt), /Private user|Removed published|remove-old/);
  assert.equal((await runtime.notes.get(editedId)).note.deleted_at, null);
  assert.equal((await runtime.notes.get(userNote.note.id)).note.deleted_at, null);
  const committedHead = await runtime.store.headSeq();
  const repeated = await runtime.refresh.prepareReconciliation(corpus(), { completeCorpus: true, operationKey: 'remove-old' });
  assert.deepEqual(await runtime.refresh.reconcile(repeated, { approval: repeated.planDigest }), receipt);
  assert.equal(await runtime.store.headSeq(), committedHead);
  await assert.rejects(runtime.refresh.prepareReconciliation(input, { completeCorpus: true, operationKey: 'remove-old' }), /reused/);
  const reappeared = await approve(runtime, input, { policy: 'version' });
  await reappeared.execute();
  const removedId = identities.find((identity) => identity.external_id === 'removed').note_id;
  assert.equal((await runtime.notes.get(removedId)).note.deleted_at, null);
  await runtime.close();
});
