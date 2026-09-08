import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { DatasetCheckView, DatasetDiagnosticView, DatasetRunView, useDatasetWorkflow } from '@fortemi/react/dataset';
import { createDatasetWorkflowApi, datasetImportSchema } from '../dataset-workflow-api.js';
import { createPagenaryDatasetRuntime } from '../dataset-runtime.js';
import './style.css';

export function DatasetImportPanel({ runtime, capabilities, sourceBinding = 'author-import' }) {
  const source = useRef(null);
  const heading = useRef(null);
  const [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [actionDiagnostic, setActionDiagnostic] = useState(null);
  const datasets = useMemo(() => createPagenaryDatasetRuntime(runtime, { sourceBinding }), [runtime, sourceBinding]);
  const api = useMemo(() => createDatasetWorkflowApi(datasets, { capabilities,
    loadSource: async () => { if (!source.current) throw new Error('Choose a source file'); return source.current; }
  }), [datasets, capabilities]);
  const workflow = useDatasetWorkflow(datasetImportSchema, api);
  const progress = useSyncExternalStore(api.subscribe, api.getProgress, () => undefined);
  const busy = reading || ['queued', 'running', 'cancelling'].includes(progress?.lifecycle) ||
    ['checking', 'previewing', 'planning', 'approving'].includes(workflow.phase);
  useEffect(() => () => api.dispose(), [api]);
  useEffect(() => {
    if (['checked', 'previewed', 'review', 'failed'].includes(workflow.phase)) heading.current?.focus();
  }, [workflow.phase]);
  async function chooseFile(event) {
    setFileError('');
    source.current = null;
    const file = event.target.files?.[0];
    setFileName(file?.name || '');
    workflow.machine.setField('policy', workflow.configuration.policy);
    if (!file) return;
    if (file.size > datasets.limits.maxInputBytes) { setFileError('Choose a JSON file smaller than 20 MiB.'); return; }
    setReading(true);
    try { source.current = JSON.parse(await file.text()); }
    catch { setFileError('The file could not be read as JSON. Check the file and choose it again.'); }
    finally { setReading(false); }
  }
  return <section className="pagenary-dataset" aria-labelledby="dataset-author-heading">
    <h2 id="dataset-author-heading" ref={heading} tabIndex={-1}>Import local pages</h2>
    <p>Review a JSON page collection before adding it to this browser’s library. The source file stays on your device.</p>
    <fieldset disabled={busy}>
      <legend>Source and options</legend>
      <label htmlFor="dataset-source">Page collection (JSON, up to 20 MiB)</label>
      <input id="dataset-source" type="file" accept="application/json,.json" onChange={chooseFile} aria-describedby="dataset-source-help" />
      <p id="dataset-source-help">Use an <code>items</code> array with stable <code>id</code>, <code>title</code>, and <code>text</code> fields.</p>
      {fileName && <p>Selected: {fileName}</p>}
      {fileError && <p role="alert">{fileError}</p>}
      <label htmlFor="dataset-policy">Existing content</label>
      <select id="dataset-policy" value={workflow.configuration.policy}
        onChange={(event) => workflow.machine.setField('policy', event.target.value)}>
        <option value="conflict">Preserve and report conflicts</option>
        <option value="version">Update and retain a revision</option>
        <option value="replace">Replace approved source content</option>
      </select>
      <label htmlFor="dataset-batch-size">Records per batch</label>
      <input id="dataset-batch-size" type="number" min="1" max="100" value={workflow.configuration.batchSize}
        aria-invalid={Boolean(workflow.validation.batchSize)} onChange={(event) => workflow.machine.setField('batchSize', Number(event.target.value))} />
      {workflow.validation.batchSize && <p role="alert">{workflow.validation.batchSize}</p>}
    </fieldset>
    <div className="dataset-actions">
      <button disabled={busy || !fileName || Boolean(fileError)} onClick={() => workflow.machine.check()}>Check source</button>
      <button disabled={busy || !workflow.checkResults || workflow.checkResults.some((item) => item.status === 'failed')}
        onClick={() => workflow.machine.preview(20)}>Preview import</button>
      <button disabled={busy || !workflow.preview} onClick={() => workflow.machine.buildPlan()}>Review plan</button>
    </div>
    <p role="status" aria-live="polite" aria-atomic="true">{progress ? `${progress.stage}: ${progress.accepted} of ${progress.total} records` : `Step: ${workflow.phase}`}</p>
    {workflow.diagnostic && <DatasetDiagnosticView diagnostic={workflow.diagnostic} />}
    {workflow.checkResults && <DatasetCheckView results={workflow.checkResults} />}
    {workflow.preview && <section aria-labelledby="dataset-preview-heading">
      <h3 id="dataset-preview-heading">Preview</h3>
      <p>{workflow.preview.estimate.records} records, {workflow.preview.estimate.bytes.toLocaleString()} source bytes. No pages have been written by this preview.</p>
      <p>The preview shows at most {workflow.preview.limit} record digests and lengths; source text is hidden.</p>
      {workflow.preview.unsupportedCapabilities.length > 0 && <p role="status">Unavailable optional capabilities: {workflow.preview.unsupportedCapabilities.join(', ')}</p>}
      <ul>{workflow.preview.datasets[0].redactedSamples.map((sample) => <li key={sample.logicalIdDigest}>
        <code>{sample.logicalIdDigest.slice(0, 23)}…</code>: {sample.characters} characters
      </li>)}</ul>
    </section>}
    {workflow.plan && <section aria-labelledby="dataset-plan-heading">
      <h3 id="dataset-plan-heading">Approve this import</h3>
      <p>Add or update {workflow.plan.estimatedWrites} records using the selected “{workflow.configuration.policy}” policy. Missing source records are not deleted.</p>
      <p>{workflow.plan.fallbackBehavior}</p>
      <details><summary>Plan identifiers</summary><p>Source: <code>{workflow.plan.sourceDigest}</code></p><p>Plan: <code>{workflow.plan.digest}</code></p></details>
      <button disabled={busy} onClick={() => workflow.machine.approve()}>Approve import</button>
    </section>}
    {progress && <DatasetRunView run={progress} onCancel={() => workflow.machine.cancel()} onRetry={async () => {
      setActionDiagnostic(null);
      try { await api.retryRun(progress.runId, new AbortController().signal); }
      catch (error) { setActionDiagnostic(error.diagnostic || { code: 'RETRY_FAILED', severity: 'error',
        summary: 'Preview and approve the current source before retrying.', retryClass: 'after-change' }); }
    }} />}
    {actionDiagnostic && <DatasetDiagnosticView diagnostic={actionDiagnostic} />}
  </section>;
}

export function mountDatasetImport(element, options) {
  const root = createRoot(element);
  root.render(<DatasetImportPanel {...options} />);
  return () => root.unmount();
}

export { createDatasetWorkflowApi, datasetImportSchema };
