import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';
import { createPagenaryDatasetRuntime } from '../src/dataset-runtime.js';

const runtime = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory' });
try {
  const datasets = createPagenaryDatasetRuntime(runtime);
  const corpus = { items: Array.from({ length: 5000 }, (_, index) => ({
    id: `page-${index}`, title: `Page ${index}`, text: `Documentation page ${index}. ${'Reference text. '.repeat(70)}`
  })) };
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  const started = performance.now();
  const plan = await datasets.prepare(corpus);
  global.gc?.();
  const afterPlan = process.memoryUsage().heapUsed;
  const preview = await datasets.preview(plan);
  const afterPreviewBeforeGC = process.memoryUsage().heapUsed;
  global.gc?.();
  const afterPreview = process.memoryUsage().heapUsed;
  assert.equal(preview.samples.length, 20);
  assert.equal(await runtime.store.headSeq(), 0);
  console.log(JSON.stringify({ environment: `Node ${process.version}`, records: plan.records,
    inputBytes: plan.inputBytes, previewSamples: preview.samples.length,
    heapDeltaPlanBytes: afterPlan - before, heapDeltaPreviewBytes: afterPreview - afterPlan,
    heapDeltaPreviewBeforeGCBytes: afterPreviewBeforeGC - afterPlan,
    elapsedMs: Math.round(performance.now() - started), explicitGC: Boolean(global.gc), destinationMutations: 0 }, null, 2));
} finally { await runtime.close(); }
