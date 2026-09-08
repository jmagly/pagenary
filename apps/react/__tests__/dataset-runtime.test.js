import assert from 'node:assert/strict';
import test from 'node:test';
import { DATASET_EXECUTION_CONTRACT } from '@fortemi/core';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';
import { createPagenaryPgliteRuntime } from '../src/pglite-runtime.js';
import { createPagenaryDatasetRuntime, pagenaryDatasetDescriptor } from '../src/dataset-runtime.js';

const corpus = { items: [{ id: 'a', title: 'First', text: 'First page' }, { id: 'b', title: 'Second', text: 'Second page' }] };
const open = () => createPagenaryRecordRuntime({ tier: 'record', storage: 'memory', namespace: 'dataset-test' }, { tenantId: 'test' });

test('negotiation reports only wired operations and rejects required gaps before mutation', async () => {
  const runtime = await open();
  const datasets = createPagenaryDatasetRuntime(runtime);
  assert.equal(pagenaryDatasetDescriptor({}).capabilities.length, 0);
  assert.equal(datasets.descriptor.capabilities.some((item) => item.id === 'index.vector'), false);
  await assert.rejects(datasets.prepare(corpus, { capabilities: { required: [{ id: 'index.vector' }] } }), /capabilities/);
  assert.equal(await runtime.store.headSeq(), 0);
  const plan = await datasets.prepare(corpus, { capabilities: { contract: DATASET_EXECUTION_CONTRACT,
    required: [{ id: 'transaction.atomic-batch' }], optional: [{ id: 'index.vector', fallback: ['schema.inspect'] }] } });
  assert.equal(plan.negotiation.degradations[0].requested, 'index.vector');
  assert.equal(plan.negotiation.degradations[0].selected, 'schema.inspect');
  await runtime.close();
});

test('bounded previews, stale approvals and pre-cancelled work never mutate destination', async () => {
  const runtime = await open();
  const datasets = createPagenaryDatasetRuntime(runtime);
  const plan = await datasets.prepare(corpus);
  const preview = await datasets.preview(plan, { limit: 1 });
  assert.equal(preview.samples.length, 1);
  assert.doesNotMatch(JSON.stringify(preview), /First page|Second page/);
  await assert.rejects(datasets.execute({ ...plan }, { approval: plan.planDigest }), /current import plan/);
  await assert.rejects(datasets.execute(plan, { approval: 'stale' }), /approve/);
  const signal = AbortSignal.abort();
  assert.equal((await datasets.execute(plan, { approval: plan.planDigest, signal })).state, 'cancelled');
  assert.equal(await runtime.store.headSeq(), 0);
  await runtime.close();
});

test('ingest receipts/checkpoints and notes commit atomically, then replay after reopening', async () => {
  const runtime = await open();
  let datasets = createPagenaryDatasetRuntime(runtime);
  const plan = await datasets.prepare(corpus, { batchSize: 1 });
  await datasets.preview(plan);
  const controller = new AbortController();
  const result = await datasets.execute(plan, { approval: plan.planDigest, signal: controller.signal,
    onProgress: () => controller.abort() });
  assert.equal(result.state, 'cancelled');
  assert.equal((await runtime.store.list('note')).length, 1);
  datasets = createPagenaryDatasetRuntime(runtime);
  const resumed = await datasets.prepare(corpus, { batchSize: 1 });
  assert.equal(resumed.planDigest, plan.planDigest);
  await datasets.preview(resumed);
  const done = await datasets.execute(resumed, { approval: resumed.planDigest });
  assert.equal(done.state, 'committed');
  assert.equal((await runtime.store.list('note')).length, 2);
  assert.equal(done.receipts[0].sourceRevision, resumed.sourceDigest);
  const lineage = await datasets.lineage(resumed);
  assert.equal(lineage.configurationDigest, resumed.configurationDigest);
  assert.equal(lineage.receipts.length, 2);
  assert.equal(lineage.receipts[0].sourceRevision, resumed.sourceDigest);
  const head = await runtime.store.headSeq();
  assert.deepEqual((await datasets.execute(resumed, { approval: resumed.planDigest })).receipts, done.receipts);
  assert.equal(await runtime.store.headSeq(), head);
  await runtime.close();
});

test('failed canonical batch rolls back notes, upstream receipts and checkpoints together', async () => {
  const runtime = await open();
  const datasets = createPagenaryDatasetRuntime(runtime);
  const plan = await datasets.prepare(corpus);
  await datasets.preview(plan);
  const apply = runtime.store.applyBatch.bind(runtime.store);
  runtime.store.applyBatch = async () => { throw new Error('Injected failure'); };
  await assert.rejects(datasets.execute(plan, { approval: plan.planDigest }), /Injected failure/);
  assert.equal(await runtime.store.headSeq(), 0);
  runtime.store.applyBatch = apply;
  await datasets.execute(plan, { approval: plan.planDigest });
  assert.equal((await runtime.store.list('note')).length, 2);
  await runtime.close();
});

test('new source revisions update existing notes only under the approved policy', async () => {
  const runtime = await open();
  const datasets = createPagenaryDatasetRuntime(runtime);
  const first = await datasets.prepare(corpus);
  await datasets.preview(first);
  await datasets.execute(first, { approval: first.planDigest });
  const changed = structuredClone(corpus);
  changed.items[0].title = 'Changed title';
  const conflict = await datasets.prepare(changed);
  await datasets.preview(conflict);
  const head = await runtime.store.headSeq();
  await assert.rejects(datasets.execute(conflict, { approval: conflict.planDigest }), /conflicts/);
  assert.equal(await runtime.store.headSeq(), head);
  const approved = await datasets.prepare(changed, { policy: 'version' });
  await datasets.preview(approved);
  await datasets.execute(approved, { approval: approved.planDigest });
  assert.equal((await runtime.store.list('note')).length, 2);
  assert.ok((await runtime.store.list('note')).some((note) => note.title === 'Changed title'));
  await runtime.close();
});

test('schema errors are bounded and redact source text and external identifiers', async () => {
  const runtime = await open();
  const datasets = createPagenaryDatasetRuntime(runtime);
  await assert.rejects(datasets.prepare({ items: Array.from({ length: 100 }, () => ({ id: 'private-key', text: '' })) }),
    (error) => error.code === 'SCHEMA' && error.details.length === 20 && !JSON.stringify(error).includes('private-key'));
  assert.equal(await runtime.store.headSeq(), 0);
  await runtime.close();
});

test('approved imports project into real PGlite and recover after a projection failure', async () => {
  const runtime = await createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: 'dataset-projection' });
  try {
    const datasets = createPagenaryDatasetRuntime(runtime);
    const plan = await datasets.prepare(corpus);
    await datasets.preview(plan);
    const rebuild = runtime.rebuild;
    runtime.rebuild = async () => { throw new Error('Injected projection failure'); };
    await assert.rejects(datasets.execute(plan, { approval: plan.planDigest }), /projection failure/);
    assert.equal((await runtime.records.store.list('note')).length, 2);
    const head = await runtime.records.store.headSeq();
    runtime.rebuild = rebuild;
    await datasets.execute(plan, { approval: plan.planDigest });
    assert.equal(await runtime.records.store.headSeq(), head);
    assert.equal((await runtime.db.query('SELECT count(*)::int AS count FROM note')).rows[0].count, 2);
  } finally { await runtime.close(); }
});
