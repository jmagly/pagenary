import {
  DATASET_EXECUTION_CONTRACT, DATASET_INGEST_CONTRACT, DatasetIngestError,
  DatasetIngestExecutor, computeHash, datasetDestinationScopeKey, generateId,
  negotiateDatasetExecutionCapabilities, upsertRecordStoreSources, validateDatasetExecutionDescriptor
} from '@fortemi/core';
import { stageRecords } from './record-stage.js';

const hash = (value) => computeHash(new TextEncoder().encode(JSON.stringify(value)));
const LIMITS = Object.freeze({ maxInputBytes: 20 * 1024 * 1024, maxRecordBytes: 256 * 1024,
  maxBatchRecords: 100, maxConcurrency: 1, maxPageSize: 20 });
const queues = new WeakMap();
function serial(store, work) {
  const result = (queues.get(store) || Promise.resolve()).then(work);
  queues.set(store, result.catch(() => {}));
  return result;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export class DatasetImportError extends Error {
  constructor(code, message, details = []) { super(message); this.code = code; this.details = details.slice(0, 20); }
}

/** Describes only the import operations implemented below, never core's full surface. */
export function pagenaryDatasetDescriptor(records) {
  const writable = Boolean(records?.store?.applyBatch && records.store.capabilities?.atomicBatch);
  const supported = writable ? ['ingest.full', 'schema.inspect', 'identity.record', 'identity.stable-revision',
    'mutation.upsert', 'checkpoint.read', 'checkpoint.write', 'execution.cancel',
    'transaction.atomic-batch', 'ordering.deterministic', 'lineage.dataset'] : [];
  const descriptor = {
    contract: DATASET_EXECUTION_CONTRACT, schemaVersion: '1.0.0',
    runtime: { id: 'pagenary-canonical-import', version: '1.0.0', maturity: 'experimental',
      plane: writable ? 'browser-local-archive' : 'static-cache', dataClass: writable ? 'canonical' : 'static-cache' },
    guarantees: { availability: 'local-process', durability: records?.storage === 'idb' ? 'wal' : records?.storage === 'memory' ? 'memory' : 'process',
      isolation: 'none', ordering: 'stable-identity', transaction: writable ? 'atomic-batch' : 'none' },
    capabilities: supported.map((id) => ({ id, version: '1.0.0', status: 'supported', limits: LIMITS, evidence: ['import-tests'] })),
    evidence: [{ id: 'import-tests', kind: 'fixture', uri: 'https://git.integrolabs.net/roctinam/pagenary/src/branch/main/apps/react/__tests__/dataset-runtime.test.js' }]
  };
  const errors = validateDatasetExecutionDescriptor(descriptor);
  if (errors.length) throw new DatasetImportError('DESCRIPTOR_INVALID', 'Import capability descriptor is invalid');
  return freeze(descriptor);
}

function canonicalAdapter(store, destination, planState, policy) {
  const scopeKey = datasetDestinationScopeKey(destination);
  const scopeDigest = hash(destination);
  const metadataId = (kind, key = '') => `pagenary-dataset:${scopeDigest}:${kind}:${key}`;
  const read = async (kind, key) => (await store.get('shard_manifest', metadataId(kind, key)))?.manifest.value;
  const put = (stage, kind, key, value) => stage.put('shard_manifest', {
    id: metadataId(kind, key), manifest: { kind: `pagenary-dataset-${kind}/1`, scopeDigest, value }
  });
  const getRecords = async () => {
    const current = new Map((await store.list('note_revised_current')).map((row) => [row.id, row]));
    return (await store.list('note')).filter((note) => note.__pagenary_dataset?.scopeDigest === scopeDigest)
      .map((note) => ({ ...note.__pagenary_dataset.record, tombstoned: Boolean(note.deleted_at),
        value: { title: note.title, text: current.get(note.id)?.content || '' } }));
  };
  return {
    scopeKey,
    readPlan: (key) => read('plan', key),
    getReceipt: async (key, id) => { if (key !== scopeKey) throw new Error('Dataset scope mismatch'); return read('receipt', id); },
    getCheckpoint: async (key) => { if (key !== scopeKey) throw new Error('Dataset scope mismatch'); return read('checkpoint', ''); },
    getRecords: async (key) => { if (key !== scopeKey) throw new Error('Dataset scope mismatch'); return getRecords(); },
    transact: (key, operation) => serial(store, async () => {
      if (key !== scopeKey) throw new Error('Dataset scope mismatch');
      const head = await store.headSeq();
      const initialRecords = await getRecords();
      const rows = new Map(initialRecords.map((row) => [row.logicalId, row]));
      const receipts = new Map((await store.list('shard_manifest'))
        .filter((row) => row.manifest.kind === 'pagenary-dataset-receipt/1' && row.manifest.scopeDigest === scopeDigest)
        .map((row) => [row.manifest.value.idempotencyKey, row.manifest.value]));
      let checkpoint = await read('checkpoint', '');
      const changes = [];
      const newReceipts = [];
      let changedCheckpoint = false;
      const result = await operation({
        getRecord: (id) => structuredClone(rows.get(id)),
        setRecord: (record) => { changes.push(structuredClone(record)); rows.set(record.logicalId, record); },
        getReceipt: (id) => structuredClone(receipts.get(id)),
        setReceipt: (receipt) => { newReceipts.push(structuredClone(receipt)); receipts.set(receipt.idempotencyKey, receipt); },
        getCheckpoint: () => structuredClone(checkpoint),
        setCheckpoint: (value) => { checkpoint = structuredClone(value); changedCheckpoint = true; }
      });
      if (!changes.length && !newReceipts.length && !changedCheckpoint) return result;
      const stage = stageRecords(store);
      for (const record of changes) {
        if (record.tombstoned) throw new DatasetImportError('UNSUPPORTED', 'Dataset tombstones require a separate removal workflow');
        const old = initialRecords.find((row) => row.logicalId === record.logicalId);
        if (old && hash(old.value) !== hash(record.value) && policy === 'conflict') {
          throw new DatasetIngestError('RECORD_REJECTED', 'Existing content conflicts with the approved import policy');
        }
        const source = { tenant_id: destination.tenant, archive_id: destination.dataset,
          namespace: `pagenary:dataset:${hash(destination.sourceBinding)}`, external_id: record.logicalId,
          source_schema_version: 'pagenary-dataset-page/1', import_run_id: planState.plan.planDigest };
        const imported = await upsertRecordStoreSources(stage, [{ source, title: record.value.title,
          content: record.value.text, policy }], { policy, batchId: hash({ plan: planState.plan.planDigest,
          record: record.logicalId, digest: record.digest }) });
        if (imported.outcome === 'rejected' || imported.counts.conflict) {
          throw new DatasetIngestError('RECORD_REJECTED', 'Existing content conflicts with the approved import policy');
        }
        const id = imported.items[0].note_id;
        const note = await stage.get('note', id);
        const current = await stage.get('note_revised_current', id);
        if (old && old.value.text !== record.value.text) {
          const revisions = (await stage.list('note_revision')).filter((row) => row.note_id === id);
          await stage.put('note_revision', { id: generateId(), note_id: id, revision_number: revisions.length + 1,
            type: 'before-dataset-import', content: old.value.text, ai_metadata: { previous_title: old.value.title },
            model: null, created_at: new Date().toISOString() });
        }
        if (current.content !== record.value.text) await stage.put('note_revised_current', {
          ...current, content: record.value.text, is_user_edited: false, updated_at: new Date().toISOString()
        });
        const { value, ...metadata } = record;
        await stage.put('note', { ...note, title: value.title, __pagenary_dataset: { scopeDigest, record: metadata } });
      }
      for (const receipt of newReceipts) await put(stage, 'receipt', receipt.idempotencyKey, receipt);
      if (changedCheckpoint) await put(stage, 'checkpoint', '', checkpoint);
      await put(stage, 'plan', planState.key, { plan: planState.plan, baseCheckpoint: planState.baseCheckpoint });
      if (planState.signal?.aborted) throw new DatasetIngestError('INGEST_CANCELLED', 'Import cancelled before commit');
      if (await store.headSeq() !== head) throw new DatasetImportError('DESTINATION_CHANGED', 'Destination changed; preview and approve again');
      await store.applyBatch(stage.mutations());
      return result;
    })
  };
}

/** Opt-in JSON page imports. The active runtime/host owns destination scope. */
export function createPagenaryDatasetRuntime(runtime, { sourceBinding = 'author-import' } = {}) {
  const records = runtime.records || runtime;
  const descriptor = pagenaryDatasetDescriptor(records);
  if (!records.scope || !records.store?.applyBatch) throw new DatasetImportError('UNSUPPORTED', 'A writable canonical runtime is required');
  if (typeof sourceBinding !== 'string' || !sourceBinding || sourceBinding.length > 200) throw new DatasetImportError('CONFIGURATION', 'Invalid source binding');
  const destination = freeze({ tenant: records.scope.tenantId, dataset: records.scope.namespace, sourceBinding: hash(sourceBinding), stream: 'pages' });
  const states = new WeakMap();
  let projectionDirty = false;
  const negotiate = (request = {}) => negotiateDatasetExecutionCapabilities(descriptor,
    { contract: DATASET_EXECUTION_CONTRACT, required: [], ...request });
  async function prepare(index, { policy = 'conflict', batchSize = 100, capabilities = {} } = {}) {
    const negotiation = negotiate(capabilities);
    if (!negotiation.accepted) throw new DatasetImportError('CAPABILITY_GAP', 'Required import capabilities are unavailable', negotiation.diagnostics);
    if (!['conflict', 'version', 'replace'].includes(policy) || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
      throw new DatasetImportError('CONFIGURATION', 'Invalid import policy or batch size');
    }
    if (!Array.isArray(index?.items)) throw new DatasetImportError('SCHEMA', 'Expected an object with an items array');
    const encoded = new TextEncoder().encode(JSON.stringify(index));
    if (encoded.length > LIMITS.maxInputBytes) throw new DatasetImportError('INPUT_LIMIT', 'Import exceeds the 20 MiB input limit');
    const seen = new Set();
    const failures = [];
    const pages = index.items.map((page, offset) => {
      const valid = page && typeof page.id === 'string' && page.id.length > 0 && page.id.length <= 1000 &&
        !seen.has(page.id) && typeof page.text === 'string' && page.text.length > 0 &&
        (page.title === undefined || typeof page.title === 'string' && page.title.length <= 2000) &&
        new TextEncoder().encode(JSON.stringify(page)).length <= LIMITS.maxRecordBytes;
      if (!valid) { if (failures.length < 20) failures.push({ index: offset, code: 'INVALID_PAGE' }); return null; }
      seen.add(page.id);
      return { logicalId: hash(page.id), title: page.title || page.id, text: page.text };
    });
    if (failures.length) throw new DatasetImportError('SCHEMA', 'Import contains invalid, duplicate, or oversized pages', failures);
    pages.sort((a, b) => a.logicalId < b.logicalId ? -1 : a.logicalId > b.logicalId ? 1 : 0);
    const sourceDigest = hash(pages);
    const configurationDigest = hash({ destination, policy, batchSize, capabilities });
    const key = hash({ sourceDigest, configurationDigest });
    const planState = { key };
    const adapter = canonicalAdapter(records.store, destination, planState, policy);
    const prior = await adapter.readPlan(key);
    planState.baseCheckpoint = prior?.baseCheckpoint ?? (prior ? undefined : await adapter.getCheckpoint(adapter.scopeKey));
    planState.plan = prior?.plan || { contract: DATASET_INGEST_CONTRACT, schemaVersion: '1.0.0', planId: key,
      planDigest: hash({ key, checkpoint: planState.baseCheckpoint || null }), sourceRevision: sourceDigest,
      configurationDigest, transformationDigest: hash('pagenary-dataset-page/1'), destination, mode: 'full',
      rejectionPolicy: { maxRejectedRecords: 0, mode: 'fail-fast' }, reconciliation: { enabled: false, maxTombstones: 0 } };
    const batches = [];
    let checkpointBefore = planState.baseCheckpoint;
    for (let offset = 0; offset < pages.length; offset += batchSize) {
      const sequence = (checkpointBefore?.sequence || 0) + 1;
      const checkpointAfter = { contract: DATASET_INGEST_CONTRACT, schemaVersion: '1.0.0', scope: destination, sequence,
        opaque: hash({ plan: planState.plan.planDigest, sourceDigest, configurationDigest, offset: offset + batchSize }) };
      batches.push({ contract: DATASET_INGEST_CONTRACT, schemaVersion: '1.0.0', sequence,
        ...(checkpointBefore ? { checkpointBefore } : {}), checkpointAfter,
        mutations: pages.slice(offset, offset + batchSize).map(({ logicalId, ...value }) => ({ operation: 'upsert',
          logicalId, revision: sourceDigest, digest: hash(value), value })) });
      checkpointBefore = checkpointAfter;
    }
    const plan = freeze({ ...planState.plan, sourceDigest, batchSize, records: pages.length, inputBytes: encoded.length,
      batches: batches.length, negotiation });
    states.set(plan, { adapter, planState, executor: new DatasetIngestExecutor(adapter), batches, head: null });
    return plan;
  }
  function stateFor(plan) {
    const state = states.get(plan);
    if (!state) throw new DatasetImportError('STALE_PLAN', 'Prepare and preview the current import plan');
    return state;
  }
  async function preview(plan, { limit = 20 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > LIMITS.maxPageSize) throw new DatasetImportError('PREVIEW_LIMIT', 'Preview limit must be 1–20');
    const state = stateFor(plan);
    for (const batch of state.batches) state.executor.connectionCheck(plan, batch);
    state.head = await records.store.headSeq();
    // Samples contain only digests and lengths: no source text or raw keys.
    const samples = [];
    for (const batch of state.batches) {
      for (const item of batch.mutations) {
        samples.push({ logicalIdDigest: item.logicalId, characters: item.value.text.length });
        if (samples.length === limit) break;
      }
      if (samples.length === limit) break;
    }
    return freeze({ bounded: true, sideEffectFree: true, limit, total: plan.records,
      samples, negotiation: plan.negotiation });
  }
  async function execute(plan, { approval, signal, onProgress } = {}) {
    const state = stateFor(plan);
    if (approval !== plan.planDigest || state.head === null) throw new DatasetImportError('APPROVAL_REQUIRED', 'Preview and approve the immutable import plan');
    if (await records.store.headSeq() !== state.head) throw new DatasetImportError('DESTINATION_CHANGED', 'Destination changed; preview and approve again');
    const receipts = [];
    state.planState.signal = signal;
    try {
      for (const batch of state.batches) {
        if (signal?.aborted) return { state: 'cancelled', receipts };
        if (await records.store.headSeq() !== state.head) throw new DatasetImportError('DESTINATION_CHANGED', 'Destination changed; preview and approve again');
        const receipt = await state.executor.executeBatch(plan, batch, { signal });
        const head = await records.store.headSeq();
        projectionDirty ||= head !== state.head;
        state.head = head;
        receipts.push(receipt);
        await onProgress?.({ completedBatches: receipts.length, totalBatches: state.batches.length, receipt });
      }
      return { state: 'committed', receipts };
    } catch (error) {
      if (error.code === 'INGEST_CANCELLED') return { state: 'cancelled', receipts };
      throw error;
    } finally {
      if (projectionDirty && runtime.rebuild) { await runtime.rebuild(); projectionDirty = false; }
    }
  }
  async function lineage(plan, { offset = 0, limit = 20 } = {}) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new DatasetImportError('LIMIT', 'Invalid lineage page');
    }
    const state = stateFor(plan);
    const receipts = [];
    for (const batch of state.batches.slice(offset, offset + limit)) {
      const receipt = await state.executor.resolveAmbiguousCommit(plan, batch);
      if (receipt) receipts.push({ runId: receipt.runId, outputDigest: receipt.outputDigest,
        planDigest: receipt.planDigest, sourceRevision: receipt.sourceRevision, checkpoint: receipt.checkpointAfter });
    }
    return { sourceDigest: plan.sourceDigest, configurationDigest: plan.configurationDigest,
      transformationDigest: plan.transformationDigest, planDigest: plan.planDigest, receipts,
      ...(offset + limit < state.batches.length ? { nextOffset: offset + limit } : {}) };
  }
  return { descriptor, destination, limits: LIMITS, negotiate, prepare, preview, execute, lineage };
}
