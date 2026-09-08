import { DatasetWorkflowError } from '@fortemi/react/dataset';

export const datasetImportSchema = Object.freeze({
  $id: 'pagenary-dataset-import', version: '1.0.0', type: 'object',
  title: 'Import options', required: ['policy', 'batchSize'], properties: {
    policy: { type: 'string', title: 'Existing content', default: 'conflict', enum: ['conflict', 'version', 'replace'],
      description: 'Conflict preserves existing content. Version or replace requires approval of the import plan.' },
    batchSize: { type: 'integer', title: 'Records per batch', default: 100, minimum: 1, maximum: 100 }
  }
});
const fingerprint = (value) => JSON.stringify(value);
const diagnostic = (error) => ({ code: /^[A-Z_]{1,60}$/.test(error?.code || '') ? error.code : 'IMPORT_FAILED',
  severity: 'error', summary: 'Import could not complete. Review the source and options, then retry.',
  retryClass: 'after-change' });
const abort = (signal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };

/** API consumed by Fortemi's headless machine; source loading is explicitly host-owned. */
export function createDatasetWorkflowApi(datasets, { loadSource, capabilities = {} }) {
  const previews = new Map();
  const plans = new Map();
  const listeners = new Set();
  let progress;
  let active;
  const emit = (value) => { progress = Object.freeze(value); listeners.forEach((listener) => listener()); };
  const prepare = async (configuration, signal) => {
    abort(signal);
    const negotiation = datasets.negotiate(capabilities);
    if (!negotiation.accepted) throw new DatasetWorkflowError({ code: 'CAPABILITY_GAP', severity: 'error',
      summary: 'The requested import capabilities are unavailable.', retryClass: 'after-change' });
    const source = await loadSource(configuration, signal);
    abort(signal);
    return datasets.prepare(source, { ...configuration, capabilities });
  };
  function start(entry) {
    if (active?.running) throw new DatasetWorkflowError({ code: 'RUN_ACTIVE', severity: 'error', summary: 'An import is already running.', retryClass: 'after-change' });
    const controller = new AbortController();
    const runId = entry.plan.planDigest;
    const run = { runId, lifecycle: 'queued', stage: 'Waiting to import', observed: 0, total: entry.plan.records,
      accepted: 0, rejected: 0, retryClass: 'never', verification: 'pending', diagnostics: [] };
    emit(run);
    active = { entry, controller, running: true, receipts: [] };
    const task = active;
    // Yield so the headless machine can expose cancellation before execution.
    task.done = new Promise((resolve) => setTimeout(resolve, 0)).then(async () => {
      emit({ ...progress, lifecycle: 'running', stage: 'Importing' });
      try {
        const result = await datasets.execute(entry.plan, { approval: entry.plan.planDigest, signal: controller.signal,
          onProgress: async ({ completedBatches, receipt }) => {
            task.receipts.push(receipt);
            emit({ ...progress, observed: Math.min(completedBatches * entry.plan.batchSize, entry.plan.records),
              accepted: task.receipts.reduce((sum, item) => sum + item.acceptedRecords, 0),
              lastCheckpoint: receipt.checkpointAfter.opaque });
            await new Promise((resolve) => setTimeout(resolve, 0));
          } });
        task.receipts = result.receipts;
        emit({ ...progress, lifecycle: result.state, stage: result.state === 'committed' ? 'Import complete' : 'Import cancelled',
          observed: result.state === 'committed' ? entry.plan.records : progress.observed,
          verification: result.state === 'committed' ? 'verified' : 'pending',
          retryClass: result.state === 'cancelled' ? 'immediate' : 'never' });
      } catch (error) {
        emit({ ...progress, lifecycle: 'failed', stage: 'Import stopped', verification: 'failed',
          retryClass: 'after-change', diagnostics: [diagnostic(error)] });
      } finally { task.running = false; }
      return progress;
    });
    return run;
  }
  const api = {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getProgress: () => progress,
    async check(configuration, signal) {
      if (!active?.running) emit(undefined);
      try {
        const plan = await prepare(configuration, signal);
        return ['configuration', 'authorization', 'reachability', 'discovery', 'capability', 'policy'].map((stage) => ({
          stage, status: stage === 'capability' && plan.negotiation.degradations.length ? 'warning' : 'passed',
          diagnostics: stage === 'capability' ? plan.negotiation.degradations.map((item) => ({ code: 'OPTIONAL_CAPABILITY_UNAVAILABLE',
            severity: 'warning', summary: `${item.requested}: ${item.selected ? `using ${item.selected}` : 'unavailable'}`, retryClass: 'never' })) : []
        }));
      } catch (error) { abort(signal); throw new DatasetWorkflowError(diagnostic(error)); }
    },
    async preview(configuration, limit, signal) {
      try {
        const plan = await prepare(configuration, signal);
        const inspected = await datasets.preview(plan, { limit: Math.min(20, limit) });
        const preview = { bounded: true, sideEffectFree: true, limit: inspected.limit,
          datasets: [{ id: plan.sourceDigest, streams: [{ id: 'pages', fields: ['id', 'title', 'text'] }],
            inferredSchema: 'validated', redactedSamples: inspected.samples }],
          estimate: { records: plan.records, bytes: plan.inputBytes, networkBytes: 0 },
          unsupportedCapabilities: plan.negotiation.degradations.map((item) => item.requested) };
        previews.clear();
        plans.clear();
        previews.set(fingerprint(preview), { plan, configuration: structuredClone(configuration) });
        return preview;
      } catch (error) { abort(signal); throw new DatasetWorkflowError(diagnostic(error)); }
    },
    async createPlan(configuration, preview, signal) {
      abort(signal);
      const entry = previews.get(fingerprint(preview));
      if (!entry || fingerprint(configuration) !== fingerprint(entry.configuration)) throw new DatasetWorkflowError({
        code: 'STALE_PREVIEW', severity: 'error', summary: 'Preview the current source and options again.', retryClass: 'after-change' });
      const plan = { id: entry.plan.planId, digest: entry.plan.planDigest, sourceRevision: entry.plan.sourceRevision,
        sourceDigest: entry.plan.sourceDigest, configurationDigest: entry.plan.configurationDigest,
        capabilities: entry.plan.negotiation.selected, transforms: ['pagenary-dataset-page/1'],
        locality: 'This browser', outboundHosts: [], privacy: 'Source content stays in the local canonical store',
        rights: 'Import only content you are authorized to store', retention: 'Local storage persists until separately removed',
        estimatedWrites: entry.plan.records, fallbackBehavior: entry.plan.negotiation.degradations.length
          ? entry.plan.negotiation.degradations.map((item) => `${item.requested}: ${item.selected || 'unavailable'}`).join('; ') : 'No fallback required',
        reconciliation: { destructive: false, estimatedDeletes: 0, confirmationThreshold: 1 } };
      plans.set(plan.digest, { ...entry, envelope: fingerprint(plan) });
      return plan;
    },
    async verifyPlanDigest(plan, signal) {
      const entry = plans.get(plan.digest);
      if (!entry || fingerprint(plan) !== entry.envelope) return false;
      const current = await prepare(entry.configuration, signal);
      return current.sourceDigest === entry.plan.sourceDigest && current.configurationDigest === entry.plan.configurationDigest;
    },
    async approvePlan(plan, confirmation, signal) {
      abort(signal);
      if (!await api.verifyPlanDigest(plan, signal)) throw new DatasetWorkflowError({ code: 'STALE_PLAN', severity: 'error',
        summary: 'The source or plan changed. Preview and approve it again.', retryClass: 'after-change' });
      return start(plans.get(plan.digest));
    },
    async cancelRun(runId) {
      if (!active || progress.runId !== runId) throw new Error('Unknown import run');
      active.controller.abort();
      emit({ ...progress, lifecycle: 'cancelling', stage: 'Finishing the current batch' });
      return active.done;
    },
    async retryRun(runId, signal) {
      abort(signal);
      if (!active || progress.runId !== runId) throw new Error('Unknown import run');
      const current = await prepare(active.entry.configuration, signal);
      if (current.sourceDigest !== active.entry.plan.sourceDigest || current.configurationDigest !== active.entry.plan.configurationDigest) {
        throw new DatasetWorkflowError({ code: 'STALE_PLAN', severity: 'error', summary: 'Source changed. Preview and approve a new plan.', retryClass: 'after-change' });
      }
      return start(active.entry);
    },
    async getStatus() {
      const lastSuccessful = active?.receipts.at(-1);
      return { scope: datasets.destination, freshness: lastSuccessful ? progress?.lifecycle === 'committed' ? 'current' : 'stale' : 'never',
        ...(lastSuccessful ? { lastSuccessful } : {}), availability: 'offline-warm', artifactState: 'canonical', capabilityDescriptor: datasets.descriptor };
    },
    async getRejections() { return progress?.diagnostics.map((item) => ({ logicalIdDigest: 'redacted', code: item.code, reason: item.summary })) || []; },
    async traverseLineage() { throw new Error('Graph lineage traversal is not supported by this import profile'); },
    waitForRun: () => active?.done,
    dispose: () => { active?.controller.abort(); listeners.clear(); }
  };
  return api;
}
