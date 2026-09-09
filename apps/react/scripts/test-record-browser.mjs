import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// The browser harness is supplied by the operator/CI, keeping browser binaries
// outside the package dependency tree (same policy as publisher smoke tests).
const { chromium } = await import(process.env.PAGENARY_PLAYWRIGHT_MODULE || 'playwright');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'pagenary-record-browser-'));
const runtimePath = fileURLToPath(new URL('../src/record-runtime.js', import.meta.url));
let server;
let browser;
try {
  const entry = path.join(temporary, 'entry.js');
  await writeFile(entry, `export { createPagenaryRecordRuntime } from ${JSON.stringify(runtimePath)};`);
  await build({
    configFile: false, logLevel: 'error',
    build: { outDir: path.join(temporary, 'dist'), minify: true,
      lib: { entry, formats: ['es'], fileName: () => 'runtime.js' } }
  });
  const files = await readdir(path.join(temporary, 'dist'));
  assert.ok(files.every((file) => file.endsWith('.js')), `Unexpected database artifact: ${files.join(', ')}`);
  const bundle = await readFile(path.join(temporary, 'dist/runtime.js'));
  server = http.createServer((request, response) => {
    if (request.url === '/runtime.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(bundle);
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Canonical record browser checks</title>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true,
    ...(process.env.PAGENARY_BROWSER_BIN ? { executablePath: process.env.PAGENARY_BROWSER_BIN } : {}) });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const evidence = await page.evaluate(async () => {
    const { createPagenaryRecordRuntime } = await import('/runtime.js');
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const config = { tier: 'record', namespace: `browser-${crypto.randomUUID()}` };
    const options = { tenantId: 'browser-tenant' };
    let runtime = await createPagenaryRecordRuntime(config, options);
    const corpus = { items: [{ id: 'one', title: 'One', text: 'First' }, { id: 'two', text: 'Second' }] };
    const plan = await runtime.refresh.prepare(corpus, { batchSize: 1 });
    await runtime.refresh.preview(plan);
    check(await runtime.store.headSeq() === 0, 'Preview mutated IndexedDB');
    const abort = new AbortController();
    const interrupted = await runtime.refresh.execute(plan, { approval: plan.planDigest,
      signal: abort.signal, onProgress: () => abort.abort() });
    check(interrupted.status === 'cancelled', 'Cancellation not reported');
    check((await runtime.store.list('note')).length === 1, 'Batch cancellation boundary failed');
    await runtime.close();
    runtime = await createPagenaryRecordRuntime(config, options);
    const resumedPlan = await runtime.refresh.prepare(corpus, { batchSize: 1 });
    await runtime.refresh.preview(resumedPlan);
    await runtime.refresh.execute(resumedPlan, { approval: resumedPlan.planDigest, checkpoint: interrupted.checkpoint });
    check((await runtime.store.list('note')).length === 2, 'Reopen/resume lost or duplicated notes');
    const head = await runtime.store.headSeq();
    await runtime.refresh.execute(resumedPlan, { approval: resumedPlan.planDigest });
    check(await runtime.store.headSeq() === head, 'Replay appended to IndexedDB journal');
    const changed = await runtime.refresh.prepare({ items: [{ id: 'one', text: 'Changed' }] });
    await runtime.refresh.preview(changed);
    let rejected = false;
    try { await runtime.refresh.execute(changed, { approval: changed.planDigest, checkpoint: interrupted.checkpoint }); }
    catch { rejected = true; }
    check(rejected && await runtime.store.headSeq() === head, 'Stale checkpoint mutated IndexedDB');
    const scoped = await createPagenaryRecordRuntime(config, { tenantId: 'other-tenant' });
    const scopedPlan = await scoped.refresh.prepare(corpus);
    await scoped.refresh.preview(scopedPlan);
    await scoped.refresh.execute(scopedPlan, { approval: scopedPlan.planDigest });
    check((await scoped.store.list('note')).length === 4, 'Tenant identities collided in shared IndexedDB');
    await scoped.close();
    const exported = await runtime.exportShardWithReport();
    check(exported.success && exported.capability_report.losses.some((loss) => loss.code === 'source-identity-outside-profile'),
      'Export did not surface identity loss');
    const reconciliation = await runtime.refresh.prepareReconciliation({ items: [corpus.items[0]] }, {
      completeCorpus: true, operationKey: 'browser-reconciliation'
    });
    await runtime.refresh.reconcile(reconciliation, { approval: reconciliation.planDigest });
    await runtime.close();
    runtime = await createPagenaryRecordRuntime(config, options);
    check((await runtime.listExportReceipts()).length === 1, 'Export loss receipt was not retained');
    check((await runtime.notes.listRecent()).length === 3, 'Reopening resurrected reconciled content or removed another tenant');
    const result = { backend: 'real IndexedDB', notes: (await runtime.store.list('note')).length,
      checks: ['preview', 'cancel', 'close/reopen', 'resume', 'exact replay', 'stale checkpoint', 'tenant isolation',
        'export loss', 'durable export receipt', 'reconciliation/reopen'] };
    await runtime.close();
    await new Promise((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(`fortemi-${config.namespace}-records`);
      deletion.onsuccess = resolve;
      deletion.onerror = () => reject(deletion.error);
    });
    return result;
  });
  console.log(JSON.stringify({ ...evidence, emittedBytes: bundle.length, artifacts: files }, null, 2));
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
