import assert from 'node:assert/strict';
import test from 'node:test';
import { DatasetWorkflowMachine } from '@fortemi/react/dataset';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';
import { createPagenaryDatasetRuntime } from '../src/dataset-runtime.js';
import { createDatasetWorkflowApi, datasetImportSchema } from '../src/dataset-workflow-api.js';

async function setup() {
  const runtime = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory', namespace: 'workflow-test' });
  let source = { items: [{ id: 'private-source-key', title: 'Page', text: 'Private source text' }] };
  const datasets = createPagenaryDatasetRuntime(runtime);
  const api = createDatasetWorkflowApi(datasets, { loadSource: async () => source });
  const machine = new DatasetWorkflowMachine(datasetImportSchema, api);
  return { runtime, api, machine, setSource: (value) => { source = value; } };
}
async function review(machine) {
  await machine.check();
  assert.equal(machine.getSnapshot().phase, 'checked');
  await machine.preview(20);
  assert.equal(machine.getSnapshot().phase, 'previewed');
  await machine.buildPlan();
  assert.equal(machine.getSnapshot().phase, 'review');
}

test('headless machine stages validation, preview, immutable approval, and observable progress', async () => {
  const { runtime, api, machine } = await setup();
  const updates = [];
  const unsubscribe = api.subscribe(() => updates.push(api.getProgress()));
  await review(machine);
  assert.equal(await runtime.store.headSeq(), 0);
  assert.doesNotMatch(JSON.stringify(machine.getSnapshot()), /Private source text|private-source-key/);
  await machine.approve();
  const final = await api.waitForRun();
  assert.equal(final.lifecycle, 'committed');
  assert.equal(final.accepted, 1);
  assert.equal(final.observed, 1);
  assert.ok(updates.some((run) => run?.lifecycle === 'running'));
  assert.equal((await runtime.store.list('note')).length, 1);
  unsubscribe(); api.dispose(); await runtime.close();
});

test('source changes after review reject stale approval without exposing raw errors', async () => {
  const { runtime, api, machine, setSource } = await setup();
  await review(machine);
  setSource({ items: [{ id: 'changed', text: 'Changed private source' }] });
  await machine.approve();
  assert.equal(machine.getSnapshot().phase, 'failed');
  assert.equal(await runtime.store.headSeq(), 0);
  assert.doesNotMatch(JSON.stringify(machine.getSnapshot()), /Changed private source/);
  api.dispose(); await runtime.close();
});

test('configuration changes invalidate approval and require a fresh preview', async () => {
  const { runtime, api, machine } = await setup();
  await review(machine);
  machine.setField('policy', 'version');
  assert.equal(machine.getSnapshot().plan, undefined);
  await machine.approve();
  assert.equal(await runtime.store.headSeq(), 0);
  api.dispose(); await runtime.close();
});

test('queued cancellation makes no writes and retry retains the reviewed source', async () => {
  const { runtime, api, machine } = await setup();
  await review(machine);
  await machine.approve();
  await machine.cancel();
  assert.equal(api.getProgress().lifecycle, 'cancelled');
  assert.equal(await runtime.store.headSeq(), 0);
  await machine.retry();
  assert.equal((await api.waitForRun()).lifecycle, 'committed');
  assert.equal((await runtime.store.list('note')).length, 1);
  api.dispose(); await runtime.close();
});
