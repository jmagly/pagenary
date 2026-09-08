import assert from 'node:assert/strict';
import test from 'node:test';
import { EmbeddingSetsRepository, MemoryRecordStore } from '@fortemi/core';
import { createPagenaryRecordRuntime } from '../src/record-runtime.js';
import { createPagenaryPgliteRuntime } from '../src/pglite-runtime.js';
import { createSourceRefresh } from '../src/source-refresh.js';
import { createScopedSearch, validateScopedSearch } from '../src/scoped-search.js';
import { createPagenaryDatasetRuntime } from '../src/dataset-runtime.js';

test('scoped search rejects unrestricted selectors and malformed predicates before SQL', () => {
  for (const input of [{ tenant_id: 'elsewhere' }, { archive_id: 'elsewhere' }, { source: 'raw' },
    { limit: 101 }, { offset: 10001 }, { metadataPredicates: [{ path: 'title', op: 'eq', value: 'x' }] },
    { metadataPredicates: [{ path: 'role', op: 'sql', value: 'x' }] },
    { metadataPredicates: [{ path: 'role', op: 'eq', value: {} }] },
    { metadataPredicates: [{ path: 'role', op: 'range', gte: 10 }] },
    { metadataPredicates: [{ path: 'role', op: 'in', value: Array(33).fill('x') }] },
    { metadataPredicates: [{ path: 'role', op: 'eq', value: 'x'.repeat(257) }] },
    { metadataPredicates: Array(9).fill({ path: 'role', op: 'exists' }) }]) {
    assert.throws(() => validateScopedSearch('query', input), { code: 'INVALID_SEARCH_INPUT' });
  }
  assert.throws(() => validateScopedSearch('x'.repeat(4097)), { code: 'INVALID_SEARCH_INPUT' });
});

test('real PGlite filters tenants, archives, sources and facets before ranking; rebuild invalidates consumers', async () => {
  const store = new MemoryRecordStore();
  const records = await createPagenaryRecordRuntime({ tier: 'record', storage: 'memory', namespace: 'workspace-a' },
    { tenantId: 'tenant-a', store });
  for (const scope of [records.scope, { tenantId: 'tenant-b', namespace: 'workspace-a' },
    { tenantId: 'tenant-a', namespace: 'workspace-b' }]) {
    const refresh = createSourceRefresh(store, scope);
    const plan = await refresh.prepare({ items: [{ id: 'private-external-key', title: scope.tenantId, text: 'identical secret query' }] });
    await refresh.preview(plan);
    const result = await refresh.execute(plan, { approval: plan.planDigest });
    await records.notes.addTag(result.receipts[0].items[0].note_id, `${scope.tenantId}-${scope.namespace}`);
  }
  const local = await records.notes.create({ title: 'User-owned', content: 'identical secret query' });
  const datasets = createPagenaryDatasetRuntime(records);
  const plan = await datasets.prepare({ items: [{ id: 'dataset-key', title: 'Dataset', text: 'identical secret query' }] });
  await datasets.preview(plan);
  await datasets.execute(plan, { approval: plan.planDigest });
  const runtime = await createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: 'workspace-a' }, { records });
  try {
    const result = await runtime.scopedSearch.search('identical', { include_facets: true });
    assert.equal(result.total, 2);
    assert.deepEqual(result.results.map((row) => row.title).sort(), ['Dataset', 'tenant-a']);
    assert.deepEqual(result.facets.tags.map((row) => row.tag), ['tenant-a-workspace-a']);
    assert.ok(!JSON.stringify(result).includes('private-external-key'));
    const sources = await runtime.scopedSearch.listSources();
    assert.equal(sources.length, 2);
    for (const source of sources) {
      const scoped = await runtime.scopedSearch.search('identical', { ...source, include_facets: true });
      assert.equal(scoped.total, 1);
    }
    // Inject deterministic vectors to exercise SQL ranking independently of
    // inference readiness. Production runtime remains lexical-only.
    const vector = Array.from({ length: 384 }, (_, i) => i === 0 ? 1 : 0);
    const embeddingSet = await new EmbeddingSetsRepository(runtime.db).create({ name: 'Fixture', dimensions: 384 });
    for (const note of await store.list('note')) {
      await runtime.db.query('INSERT INTO embedding (id, note_id, embedding_set_id, vector) VALUES ($1,$2,$3,$4::vector)',
        [`embedding-${note.id}`, note.id, embeddingSet.id, JSON.stringify(vector)]);
    }
    const readySearch = createScopedSearch({ db: runtime.db, records, ensureProjection: async () => {}, semanticReady: () => true });
    for (const mode of ['semantic', 'hybrid']) {
      const ranked = await readySearch.search('identical', { mode, include_facets: true }, vector);
      assert.equal(ranked.total, 2);
      assert.deepEqual(ranked.results.map((row) => row.title).sort(), ['Dataset', 'tenant-a']);
      assert.deepEqual(ranked.facets.tags.map((row) => row.tag), ['tenant-a-workspace-a']);
      for (const source of sources) assert.equal((await readySearch.search('identical', { ...source, mode }, vector)).total, 1);
    }
    assert.equal((await runtime.scopedSearch.search('', { metadataPredicates: [{ path: 'role', op: 'exists' }] })).total, 0);
    const transact = runtime.db.transaction.bind(runtime.db);
    runtime.db.transaction = (work) => transact((tx) => work({ ...tx, query: async (sql, ...args) => {
      if (sql.includes('SELECT COUNT(*)')) throw new Error('Sensitive SQL diagnostic');
      return tx.query(sql, ...args);
    } }));
    await assert.rejects(runtime.scopedSearch.search('identical'), { code: 'SCOPED_SEARCH_FAILED', message: 'SCOPED_SEARCH_FAILED' });
    runtime.db.transaction = transact;
    assert.equal((await runtime.scopedSearch.search('identical')).total, 2, 'Failed search must roll back its temporary views');
    await assert.rejects(runtime.scopedSearch.search('query', { sourceHandle: `sha256:${'f'.repeat(64)}` }), { code: 'SOURCE_SCOPE_UNAVAILABLE' });
    for (const mode of ['semantic', 'hybrid']) {
      await assert.rejects(runtime.scopedSearch.search('query', { mode }, [1, 0]), { code: 'SEMANTIC_UNAVAILABLE' });
    }
    const before = await store.headSeq();
    await assert.rejects(runtime.removal.preview({ operationKey: 'remove' }), { code: 'TERMINAL_PURGE_UNSUPPORTED' });
    await assert.rejects(runtime.removal.execute({}, { approval: 'any' }), { code: 'TERMINAL_PURGE_UNSUPPORTED' });
    assert.equal(await store.headSeq(), before);
    assert.equal((await store.list('deletion_receipt')).length, 0);
    assert.equal((await runtime.db.query('SELECT count(*)::int AS count FROM note')).rows[0].count, 5);
    let invalidations = 0;
    const unsubscribe = runtime.subscribeInvalidation(() => invalidations++);
    const refreshPlan = await records.refresh.prepareReconciliation({ items: [] }, { completeCorpus: true, operationKey: 'retire' });
    await runtime.refresh.reconcile(refreshPlan, { approval: refreshPlan.planDigest });
    assert.equal((await runtime.scopedSearch.search('identical')).total, 1);
    assert.equal(invalidations, 1);
    assert.equal((await records.notes.get(local.note.id)).note.deleted_at, null);
    await runtime.rebuild();
    assert.equal((await runtime.scopedSearch.search('identical')).total, 1);
    unsubscribe();
  } finally { await runtime.close(); }
  const reopened = await createPagenaryPgliteRuntime({ tier: 'pglite', storage: 'memory', namespace: 'workspace-a' }, { records });
  try {
    assert.equal((await reopened.scopedSearch.search('identical')).total, 1, 'Reopen must preserve canonical soft deletion');
    assert.equal((await reopened.records.store.list('note')).length, 5, 'Soft deletion must retain canonical content');
  } finally { await reopened.close(); }
});
