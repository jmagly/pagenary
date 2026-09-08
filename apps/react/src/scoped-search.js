import { SearchRepository, REGISTERED_METADATA_PATHS, computeHash } from '@fortemi/core';

const hash = (value) => computeHash(new TextEncoder().encode(JSON.stringify(value)));
const keys = new Set(REGISTERED_METADATA_PATHS);
const scalar = (value) => value === null || typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 256);
export class ScopedSearchError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function invalid() { throw new ScopedSearchError('INVALID_SEARCH_INPUT'); }

export function validateScopedSearch(query, input = {}) {
  if (typeof query !== 'string' || query.length > 4096 || !input || typeof input !== 'object' || Array.isArray(input)) invalid();
  const allowed = ['limit', 'offset', 'include_facets', 'metadataPredicates', 'mode', 'sourceHandle'];
  if (Object.keys(input).some((key) => !allowed.includes(key))) invalid();
  const { limit = 20, offset = 0, mode = 'text', include_facets = false, metadataPredicates = [] } = input;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000 ||
      !['text', 'auto', 'semantic', 'hybrid'].includes(mode) || typeof include_facets !== 'boolean' ||
      !Array.isArray(metadataPredicates) || metadataPredicates.length > 8) invalid();
  for (const p of metadataPredicates) {
    if (!p || !keys.has(p.path) || !['eq', 'in', 'exists', 'range'].includes(p.op)) invalid();
    const fields = p.op === 'range' ? ['path', 'op', 'gte', 'lte'] : ['path', 'op', 'value'];
    if (Object.keys(p).some((key) => !fields.includes(key))) invalid();
    if (p.op === 'eq' && !scalar(p.value)) invalid();
    if (p.op === 'in' && (!Array.isArray(p.value) || !p.value.length || p.value.length > 32 || !p.value.every(scalar))) invalid();
    if (p.op === 'exists' && p.value !== undefined && typeof p.value !== 'boolean') invalid();
    // Upstream compares registered metadata as text. Reject numeric ranges
    // rather than silently applying lexicographic ordering to numbers.
    if (p.op === 'range' && ((p.gte === undefined && p.lte === undefined) ||
        [p.gte, p.lte].some((value) => value !== undefined && (typeof value !== 'string' || value.length > 256)))) invalid();
  }
  if (input.sourceHandle !== undefined && (typeof input.sourceHandle !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(input.sourceHandle))) invalid();
  return { limit, offset, mode, include_facets, metadataPredicates: structuredClone(metadataPredicates) };
}

/** SQL views constrain candidates before Fortemi ranking, pagination and facets. */
export function createScopedSearch({ db, records, ensureProjection, semanticReady = () => false, runExclusive = (work) => work() }) {
  const scope = Object.freeze({ ...records.scope });
  if (!scope.tenantId || !scope.namespace) throw new ScopedSearchError('RUNTIME_SCOPE_REQUIRED');
  async function sources() {
    const rows = (await records.store.list('source_identity')).filter((row) =>
      row.tenant_id === scope.tenantId && row.archive_id === scope.namespace);
    return new Map(rows.map((row) => [hash([scope, row.namespace]), row.namespace]));
  }
  return Object.freeze({
    listSources: async () => [...(await sources()).keys()].map((sourceHandle) => ({ sourceHandle })),
    async search(query, input = {}, queryEmbedding) {
      const options = validateScopedSearch(query, input);
      if (queryEmbedding !== undefined && (!Array.isArray(queryEmbedding) || !queryEmbedding.length ||
          queryEmbedding.length > 4096 || !queryEmbedding.every((n) => typeof n === 'number' && Number.isFinite(n)))) invalid();
      if ((['semantic', 'hybrid'].includes(options.mode) || queryEmbedding) && !semanticReady()) {
        throw new ScopedSearchError('SEMANTIC_UNAVAILABLE');
      }
      return runExclusive(async () => {
        const sourceMap = await sources();
        if (input.sourceHandle && !sourceMap.has(input.sourceHandle)) throw new ScopedSearchError('SOURCE_SCOPE_UNAVAILABLE');
        await ensureProjection();
        return db.transaction(async (tx) => {
          await tx.query("SELECT set_config('pagenary.tenant', $1, true), set_config('pagenary.archive', $2, true), set_config('pagenary.source', $3, true)",
            [scope.tenantId, scope.namespace, input.sourceHandle ? sourceMap.get(input.sourceHandle) : '']);
          // Transaction-local views shadow only repository reads. Parameters live
          // in transaction-local settings; no UI value becomes SQL syntax.
          await tx.query(`CREATE TEMP VIEW source_identity AS SELECT * FROM public.source_identity
            WHERE tenant_id = current_setting('pagenary.tenant') AND archive_id = current_setting('pagenary.archive')
            AND (current_setting('pagenary.source') = '' OR namespace = current_setting('pagenary.source'))`);
          await tx.query(`CREATE TEMP VIEW note AS SELECT n.* FROM public.note n WHERE EXISTS
            (SELECT 1 FROM pg_temp.source_identity si WHERE si.note_id = n.id)`);
          const result = await new SearchRepository(tx, semanticReady()).search(query, {
            ...options, tenant_id: scope.tenantId, archive_id: scope.namespace
          }, queryEmbedding);
          await tx.query('DROP VIEW pg_temp.note');
          await tx.query('DROP VIEW pg_temp.source_identity');
          for (const row of result.results) for (const locator of row.locators || []) {
            if (locator.source) locator.source = { ...locator.source,
              namespace: hash([scope, locator.source.namespace]),
              import_run_id: hash(locator.source.import_run_id) };
          }
          return result;
        });
      }).catch((error) => {
        if (error instanceof ScopedSearchError) throw error;
        throw new ScopedSearchError('SCOPED_SEARCH_FAILED');
      });
    }
  });
}

export const LOCAL_REMOVAL_COVERAGE = Object.freeze({
  terminalPurge: 'unsupported',
  reason: 'CANONICAL_PURGE_COVERAGE_INCOMPLETE',
  retainedState: Object.freeze(['journal-content-snapshots', 'note-revisions']),
  softDeletion: 'retains-content',
  sourceReconciliation: 'explicit-published-corpus-approval',
  projectionDeletion: 'rebuildable'
});

export function unsupportedLocalRemoval() {
  const reject = async () => { throw new ScopedSearchError('TERMINAL_PURGE_UNSUPPORTED'); };
  return Object.freeze({ coverage: LOCAL_REMOVAL_COVERAGE, preview: reject, execute: reject });
}
