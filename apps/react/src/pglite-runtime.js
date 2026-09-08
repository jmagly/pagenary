import {
  ArchiveManager,
  createPGliteBackend,
  dropAttachmentProjection,
  projectRecords
} from '@fortemi/core';
import { createPagenaryRecordRuntime } from './record-runtime.js';
import { createScopedSearch, unsupportedLocalRemoval } from './scoped-search.js';

function assertPgliteConfig(config) {
  if (!config || config.tier !== 'pglite') {
    throw new Error('Fortémi PGlite runtime requires runtime.fortemi.tier "pglite"');
  }
  if (config.features?.semantic?.enabled && !config.features.semantic.model) {
    throw new Error('Semantic projection requires an explicit model');
  }
}

/** Open a disposable PGlite projection over the canonical Tier-2 authority. */
export async function createPagenaryPgliteRuntime(config, options = {}) {
  assertPgliteConfig(config);
  const namespace = config.namespace || options.tenantId || 'pagenary';
  const ownsRecords = !options.records;
  const records = options.records || await createPagenaryRecordRuntime(
    { ...config, tier: 'record' }, options
  );
  const archives = options.archives || new ArchiveManager(config.storage || 'idb');
  const db = options.db || await archives.open(`${namespace}-projection`);
  const semanticAvailable = config.features?.semantic?.enabled === true;
  let projectionDirty = false;
  let projectedHead = -1;
  let generation = 0;
  const listeners = new Set();
  let pending = Promise.resolve();
  const serial = (work) => {
    const result = pending.then(work);
    pending = result.catch(() => {});
    return result;
  };

  async function projectCanonicalRecords() {
    // RecordStore has no archive table; materialize referenced archive parents
    // before the SQL projection enforces note.archive_id foreign keys.
    const archiveIds = new Set((await records.store.list('note')).map((note) => note.archive_id).filter(Boolean));
    for (const id of archiveIds) {
      await db.query('INSERT INTO archive (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [id, id]);
    }
    const result = await projectRecords(db, records.store);
    // SearchRepository's tenant/archive predicates use source_identity, which
    // Fortemi's note projection does not materialize.
    await db.query('DELETE FROM source_identity');
    for (const row of await records.store.list('source_identity')) {
      await db.query(`INSERT INTO source_identity
        (id, tenant_id, archive_id, namespace, external_id, external_id_hash, source_schema_version,
         content_digest, import_run_id, note_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [row.id, row.tenant_id, row.archive_id, row.namespace, row.external_id_hash, row.external_id_hash,
        row.source_schema_version, row.content_digest, row.import_run_id, row.note_id, row.created_at, row.updated_at]);
    }
    return result;
  }

  async function rebuildProjection() {
    projectionDirty = true;
    const head = await records.store.headSeq();
    // All SQL state is disposable. CASCADE also clears derived embeddings,
    // graph/provenance rows and jobs that the upstream note-only drop omits.
    await db.query('TRUNCATE TABLE public.note, public.collection CASCADE');
    await dropAttachmentProjection(db);
    const result = await projectCanonicalRecords();
    projectionDirty = false;
    projectedHead = head;
    generation += 1;
    for (const listener of listeners) { try { listener(generation); } catch { /* Observer failures do not roll back projection. */ } }
    return result;
  }
  const rebuild = () => serial(rebuildProjection);

  async function projectMutation(work) {
    const before = await records.store.headSeq();
    let finished = false;
    try {
      const result = await work();
      finished = true;
      return result;
    } finally {
      const changed = await records.store.headSeq() !== before;
      if (changed) projectionDirty = true;
      // Rejected approvals do not mutate the projection. A successful receipt
      // replay can recover a previously failed rebuild without reimporting.
      if (projectionDirty && (changed || finished)) await rebuild();
    }
  }

  let projection;
  try {
    projection = await rebuild();
  } catch (error) {
    await archives.close();
    if (ownsRecords) await records.close();
    throw error;
  }
  return {
    tier: 'pglite',
    records,
    db,
    backend: createPGliteBackend(db, { id: `pagenary-pglite:${namespace}`, semanticAvailable }),
    projection,
    scopedSearch: createScopedSearch({ db, records, runExclusive: serial, ensureProjection: async () => {
      if (projectionDirty || projectedHead !== await records.store.headSeq()) await rebuildProjection();
    } }),
    removal: unsupportedLocalRemoval(),
    subscribeInvalidation: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getGeneration: () => generation,
    semantic: semanticAvailable ? { enabled: true, model: config.features.semantic.model } : { enabled: false },
    refresh: {
      prepare: records.refresh.prepare,
      prepareSeed: records.refresh.prepareSeed,
      preview: records.refresh.preview,
      prepareReconciliation: records.refresh.prepareReconciliation,
      reconcile: (plan, reconciliationOptions) => projectMutation(() => records.refresh.reconcile(plan, reconciliationOptions)),
      execute: (plan, refreshOptions) => projectMutation(() => records.refresh.execute(plan, refreshOptions))
    },
    rebuild,
    close: async () => {
      await archives.close();
      await records.close();
    }
  };
}
