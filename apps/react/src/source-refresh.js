import { MemoryRecordStore, SOURCE_UPSERT_MAX_ITEMS, computeHash, generateId, sha256Hex, upsertRecordStoreSources } from '@fortemi/core';
import { stageRecords } from './record-stage.js';

const SOURCE_NAMESPACE = 'pagenary:published-pages';
const digest = (value) => sha256Hex(new TextEncoder().encode(JSON.stringify(value)));

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Plans belong to one runtime. Only content-free checkpoints cross sessions. */
export function createSourceRefresh(store, scope) {
  if (![scope?.tenantId, scope?.namespace].every((value) => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
    throw new Error('Refresh requires a bounded tenant and runtime namespace');
  }
  scope = Object.freeze({ tenantId: scope.tenantId, namespace: scope.namespace });
  const plans = new WeakMap();
  const reconciliations = new WeakMap();
  let pending = Promise.resolve();
  const serial = (work) => {
    const result = pending.then(work);
    pending = result.catch(() => {});
    return result;
  };

  async function prepare(index, { policy = 'conflict', batchSize = SOURCE_UPSERT_MAX_ITEMS, legacyNotes = {} } = {}) {
    if (!['conflict', 'replace', 'version'].includes(policy)) throw new Error('Invalid refresh policy');
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > SOURCE_UPSERT_MAX_ITEMS) {
      throw new Error('Invalid refresh batch size');
    }
    if (!Array.isArray(index?.items)) throw new Error('Refresh requires a deployed corpus index');
    if (!legacyNotes || typeof legacyNotes !== 'object' || Array.isArray(legacyNotes) ||
        Object.values(legacyNotes).some((id) => typeof id !== 'string' || !id) ||
        new Set(Object.values(legacyNotes)).size !== Object.values(legacyNotes).length) {
      throw new Error('Invalid legacy note mapping');
    }
    legacyNotes = structuredClone(legacyNotes);
    const ids = new Set();
    const pages = index.items.map((page) => {
      if (typeof page.id !== 'string' || !page.id || ids.has(page.id) ||
          typeof page.text !== 'string' || !page.text ||
          (page.title != null && typeof page.title !== 'string')) {
        throw new Error('Invalid or duplicate refresh page');
      }
      ids.add(page.id);
      return { id: page.id, title: page.title || page.id, content: page.text };
    }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (Object.keys(legacyNotes).some((id) => !ids.has(id))) throw new Error('Unknown legacy page');
    const sourceDigest = await digest(pages);
    const planDigest = await digest({ scope, sourceDigest, policy, batchSize, legacyNotes: Object.entries(legacyNotes).sort() });
    const batches = [];
    for (let offset = 0; offset < pages.length; offset += batchSize) {
      batches.push(pages.slice(offset, offset + batchSize).map((page) => ({
        source: {
          tenant_id: scope.tenantId,
          archive_id: scope.namespace,
          namespace: SOURCE_NAMESPACE,
          external_id: page.id,
          source_schema_version: 'pagenary-page/1',
          import_run_id: planDigest
        },
        title: page.title,
        content: page.content,
        policy
      })));
    }
    const plan = freeze({ sourceDigest, planDigest, policy, batchSize, pages: pages.length, batches: batches.length,
      legacyAdoptions: Object.keys(legacyNotes).length });
    plans.set(plan, { batches, legacyNotes, approvedHead: null });
    return plan;
  }

  function stateFor(plan) {
    const state = plans.get(plan);
    if (!state) throw new Error('Unknown or changed refresh plan; prepare and preview again');
    return state;
  }

  function batchOptions(plan, offset) {
    return {
      dryRun: false,
      policy: plan.policy,
      batchId: `${plan.planDigest}:${offset}`,
      checkpoint: { sourceDigest: plan.sourceDigest, planDigest: plan.planDigest, nextBatch: offset + 1 }
    };
  }

  const matches = (identity, source) => identity.tenant_id === source.tenant_id &&
    identity.archive_id === source.archive_id && identity.namespace === source.namespace &&
    identity.external_id === source.external_id;

  async function stageBatch(plan, state, batch, offset) {
    const staged = stageRecords(store);
    const options = batchOptions(plan, offset);
    const previous = (await store.list('source_import_batch')).find((row) => row.batch_id === options.batchId &&
      row.tenant_id === scope.tenantId && row.archive_id === scope.namespace && row.namespace === SOURCE_NAMESPACE);
    if (previous) {
      const receipt = await upsertRecordStoreSources(staged, batch, options);
      if (receipt.outcome === 'rejected') throw new Error('Refresh batch rejected');
      return { staged, receipt: { ...receipt, pagenary: previous.receipt.pagenary } };
    }
    let adopted = 0;
    for (const item of batch) {
      const id = Object.hasOwn(state.legacyNotes, item.source.external_id) ? state.legacyNotes[item.source.external_id] : null;
      if (!id) continue;
      const identities = await staged.list('source_identity');
      const existing = identities.find((identity) => matches(identity, item.source));
      if (existing) {
        if (existing.note_id !== id) throw new Error('Legacy mapping conflicts with source identity');
        continue;
      }
      if (identities.some((identity) => identity.note_id === id)) throw new Error('Legacy note belongs to another source');
      const note = await staged.get('note', id);
      const original = (await staged.list('note_original')).find((row) => row.note_id === id);
      if (!note || note.deleted_at || !original?.content || !(await staged.get('note_revised_current', id))) {
        throw new Error('Legacy note is missing or incomplete');
      }
      // Use Fortemi to construct its own identity/hash contract from the old
      // original content. Adoption preserves the existing edited current row.
      const temporary = new MemoryRecordStore();
      try {
        const baseline = await upsertRecordStoreSources(temporary, [{ ...item,
          source: { ...item.source, caller_stable_id: id }, title: note.title, content: original.content
        }]);
        if (baseline.outcome === 'rejected') throw new Error('Legacy identity rejected');
        const identity = (await temporary.list('source_identity'))[0];
        await staged.put('source_identity', { ...identity, __pagenary_title: note.title });
        await staged.put('note', { ...note, archive_id: item.source.archive_id });
        adopted++;
      } finally { await temporary.close(); }
    }
    const before = await staged.list('source_identity');
    // Fortemi's version policy records the incoming source revision. Retain the
    // current user-edited content separately before an approved overwrite.
    for (const item of batch) {
      const identity = before.find((row) => matches(row, item.source));
      const current = identity && await staged.get('note_revised_current', identity.note_id);
      if (plan.policy !== 'conflict' && current?.is_user_edited &&
          identity.content_digest !== computeHash(new TextEncoder().encode(item.content))) {
        const revisions = (await staged.list('note_revision')).filter((row) => row.note_id === identity.note_id);
        await staged.put('note_revision', {
          id: generateId(), note_id: identity.note_id, revision_number: revisions.length + 1,
          type: 'user-edit-before-source-refresh', content: current.content,
          ai_metadata: current.ai_metadata, model: current.model, created_at: new Date().toISOString()
        });
      }
    }
    const receipt = await upsertRecordStoreSources(staged, batch, options);
    if (receipt.outcome === 'rejected') throw new Error('Refresh batch rejected');
    if (receipt.outcome === 'duplicate') return { staged, receipt };
    let titlesChanged = 0;
    let titlesConflicting = 0;
    let restored = 0;
    for (const [index, item] of batch.entries()) {
      const result = receipt.items[index];
      const identity = (await staged.list('source_identity')).find((row) => matches(row, item.source));
      const prior = before.find((row) => matches(row, item.source));
      const note = await staged.get('note', result.note_id);
      if (!identity || !note) continue;
      if (note.deleted_at && plan.policy !== 'conflict') {
        note.deleted_at = null;
        note.updated_at = new Date().toISOString();
        await staged.put('note', note);
        restored++;
      }
      const oldTitle = prior?.__pagenary_title ?? note.title;
      const titleChanged = prior && oldTitle !== item.title;
      if (titleChanged && plan.policy === 'conflict') titlesConflicting++;
      else if (titleChanged && result.outcome !== 'conflict') {
        await staged.put('note', { ...note, title: item.title });
        titlesChanged++;
      }
      if (result.outcome !== 'conflict' && !(titleChanged && plan.policy === 'conflict')) {
        await staged.put('source_identity', { ...identity, __pagenary_title: item.title });
      }
    }
    receipt.pagenary = { adopted, titlesChanged, titlesConflicting, restored };
    // Keep supplemental metadata outcomes with the atomic upstream receipt.
    for (const collection of ['source_import_run', 'source_import_batch']) {
      for (const row of await staged.list(collection)) {
        if (row.receipt?.batch_id === receipt.batch_id && row.tenant_id === scope.tenantId &&
            row.archive_id === scope.namespace && row.namespace === SOURCE_NAMESPACE) {
          await staged.put(collection, { ...row, receipt: { ...row.receipt, pagenary: receipt.pagenary } });
        }
      }
    }
    return { staged, receipt };
  }

  const preview = (plan) => serial(async () => {
    const state = stateFor(plan);
    const head = await store.headSeq();
    const receipts = [];
    for (const [offset, batch] of state.batches.entries()) {
      const { receipt } = await stageBatch(plan, state, batch, offset);
      receipts.push({ ...receipt, dry_run: true, outcome: receipt.outcome === 'duplicate' ? 'duplicate' : 'preview' });
    }
    if (await store.headSeq() !== head) throw new Error('Destination changed during preview');
    state.approvedHead = head;
    return freeze({ plan, receipts });
  });

  const execute = (plan, { approval, checkpoint, signal, onProgress } = {}) => serial(async () => {
    const state = stateFor(plan);
    if (approval !== plan.planDigest || state.approvedHead === null) {
      throw new Error('Refresh requires explicit approval after preview');
    }
    if (checkpoint && (checkpoint.sourceDigest !== plan.sourceDigest || checkpoint.planDigest !== plan.planDigest ||
        !Number.isInteger(checkpoint.nextBatch) || checkpoint.nextBatch < 0 || checkpoint.nextBatch > state.batches.length)) {
      throw new Error('Stale or invalid refresh checkpoint');
    }
    if (await store.headSeq() !== state.approvedHead) throw new Error('Destination changed; preview and approve again');
    // Replaying from the start verifies durable upstream receipts. Never trust
    // an externally supplied offset to skip uncommitted work.
    const receipts = [];
    let next = { sourceDigest: plan.sourceDigest, planDigest: plan.planDigest, nextBatch: 0 };
    for (const [offset, batch] of state.batches.entries()) {
      if (signal?.aborted) return { status: 'cancelled', checkpoint: next, receipts };
      if (await store.headSeq() !== state.approvedHead) throw new Error('Destination changed; preview and approve again');
      const { staged, receipt } = await stageBatch(plan, state, batch, offset);
      if (await store.headSeq() !== state.approvedHead) throw new Error('Destination changed; preview and approve again');
      const mutations = staged.mutations();
      if (mutations.length) await store.applyBatch(mutations);
      state.approvedHead = await store.headSeq();
      receipts.push(receipt);
      next = receipt.checkpoint;
      await onProgress?.({ completedBatches: offset + 1, totalBatches: state.batches.length, checkpoint: next });
    }
    return { status: 'complete', checkpoint: next, receipts };
  });

  const prepareReconciliation = (index, { completeCorpus = false, operationKey, includeLocalEdits = false } = {}) => serial(async () => {
    if (completeCorpus !== true) throw new Error('Reconciliation requires an explicitly complete corpus');
    if (typeof operationKey !== 'string' || !operationKey || operationKey.length > 200) {
      throw new Error('Reconciliation requires a bounded operation key');
    }
    if (typeof includeLocalEdits !== 'boolean') throw new Error('Invalid local-edit reconciliation policy');
    const sourcePlan = await prepare(index);
    const present = new Set(plans.get(sourcePlan).batches.flatMap((batch) => batch.map((item) => item.source.external_id)));
    const head = await store.headSeq();
    const candidates = (await store.list('source_identity')).filter((identity) =>
      identity.tenant_id === scope.tenantId && identity.archive_id === scope.namespace &&
      identity.namespace === SOURCE_NAMESPACE && !present.has(identity.external_id));
    const removed = [];
    let conflicts = 0;
    for (const identity of candidates) {
      const note = await store.get('note', identity.note_id);
      if (!note || note.deleted_at) continue;
      const current = await store.get('note_revised_current', note.id);
      if (current?.is_user_edited && !includeLocalEdits) { conflicts++; continue; }
      removed.push({ id: note.id, locator: identity.external_id_hash });
    }
    removed.sort((a, b) => a.locator < b.locator ? -1 : a.locator > b.locator ? 1 : 0);
    const operation = await digest({ scope, operationKey });
    const selectionDigest = await digest({ sourceDigest: sourcePlan.sourceDigest, includeLocalEdits });
    const prior = (await store.list('deletion_receipt')).find((receipt) => receipt.operation_key === operation);
    if (prior && (prior.selector_hash !== selectionDigest || prior.policy?.mode !== 'source-refresh-reconciliation')) {
      throw new Error('Reconciliation operation key reused with a different request');
    }
    if (await store.headSeq() !== head) throw new Error('Destination changed during reconciliation preview');
    const planDigest = await digest({ operation, selectionDigest, removed, head });
    const plan = freeze({ planDigest, sourceDigest: sourcePlan.sourceDigest, mode: 'soft-delete',
      counts: { removed: prior ? prior.counts.notes : removed.length, locallyEditedPreserved: conflicts },
      locators: removed.map((item) => item.locator), replay: Boolean(prior) });
    reconciliations.set(plan, { head, removed, operation, selectionDigest, prior });
    return plan;
  });

  const reconcile = (plan, { approval, signal } = {}) => serial(async () => {
    const state = reconciliations.get(plan);
    if (!state || approval !== plan.planDigest) throw new Error('Reconciliation requires explicit preview approval');
    if (signal?.aborted) return { status: 'cancelled' };
    if (state.prior) return structuredClone(state.prior);
    if (await store.headSeq() !== state.head) throw new Error('Destination changed; preview reconciliation again');
    const timestamp = new Date().toISOString();
    const mutations = [];
    for (const { id } of state.removed) {
      const note = await store.get('note', id);
      mutations.push({ op: 'put', collection: 'note', record: { ...note, deleted_at: timestamp, updated_at: timestamp } });
    }
    const receipt = { id: generateId(), operation_key: state.operation, tenant_id: scope.tenantId,
      archive_id: scope.namespace, selector_hash: state.selectionDigest, outcome: 'soft-deleted',
      counts: { notes: state.removed.length }, completed_at: timestamp,
      policy: { mode: 'source-refresh-reconciliation', terminal_purge: false, receipt_contains_content: false } };
    mutations.push({ op: 'put', collection: 'deletion_receipt', record: receipt });
    if (await store.headSeq() !== state.head) throw new Error('Destination changed; preview reconciliation again');
    await store.applyBatch(mutations);
    state.prior = receipt;
    return structuredClone(receipt);
  });

  return { prepare, preview, execute, prepareReconciliation, reconcile };
}
