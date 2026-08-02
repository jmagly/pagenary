import {
  CanonicalNotesRepository,
  MemoryRecordStore,
  createRecordBackend,
  createRecordStore,
  exportShardFromRecords,
  importShardToRecords
} from '@fortemi/core';
import { aiwgFortemiIndexFromKnowledgeShard } from '@fortemi/core/aiwg-index-shard';

const RECORD_COLLECTIONS = [
  'note', 'note_original', 'note_revised_current', 'note_tag', 'link',
  'collection', 'collection_note', 'attachment', 'attachment_blob', 'shard_manifest'
];

function assertRecordConfig(config) {
  if (!config || config.tier !== 'record') {
    throw new Error('Fortémi record runtime requires runtime.fortemi.tier "record"');
  }
}

async function fetchSeed(seed, fetchImpl) {
  if (!seed) return null;
  if (seed.type !== 'knowledge-shard' || !seed.path) {
    throw new Error('Tier-2 seed must be a knowledge-shard with a bundle-relative path');
  }
  const response = await fetchImpl(seed.path);
  if (!response.ok) throw new Error(`Unable to load Tier-2 seed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

async function seedStore(store, bytes) {
  const imported = await importShardToRecords(store, bytes, { conflictStrategy: 'error' });
  if (imported.success) return imported;
  const isCoreProfile = imported.errors?.some((error) => /profile 'core-v1'.*not supported/i.test(error));
  if (!isCoreProfile) throw new Error(imported.errors?.join('; ') || 'Knowledge Shard import failed');

  // Build-time core-v1 shards contain static AIWG index records rather than
  // record-v1 rows. Promote those pages into canonical notes locally; the
  // deployed shard remains immutable.
  const index = await aiwgFortemiIndexFromKnowledgeShard(bytes);
  const notes = new CanonicalNotesRepository(store);
  const ids = new Set(index.items.map((item) => item.id));
  for (const item of index.items) {
    await notes.create({
      id: item.id,
      title: item.title || item.id,
      content: item.text || '',
      source: item.source?.path || 'pagenary-seed'
    });
    for (const tag of item.tags || []) await notes.addTag(item.id, tag);
  }
  for (const item of index.items) {
    for (const relation of item.relationships || []) {
      if (!ids.has(relation.target_id)) continue;
      const link = await notes.createLink(item.id, relation.target_id, relation.type || 'related');
      await store.put('link', {
        ...link,
        __fortemi_shard_metadata: {
          confidence_present: relation.confidence != null,
          confidence: relation.confidence ?? null,
          asserted_score: relation.confidence ?? 1,
          metadata: relation.metadata || null
        }
      });
    }
  }
  return { success: true, seeded_from: 'core-v1', counts: { notes: index.items.length } };
}

/**
 * Open the explicitly selected, PGlite-free canonical record runtime.
 * Deployed seed bytes are read-only: import writes only to the tenant's local
 * Memory/IndexedDB RecordStore namespace.
 */
export async function createPagenaryRecordRuntime(config, options = {}) {
  assertRecordConfig(config);
  const namespace = config.namespace || options.tenantId || 'pagenary';
  const store = options.store || (config.storage === 'memory'
    ? new MemoryRecordStore()
    : await createRecordStore(namespace, options.recordStoreOptions));

  if (config.seed && (await store.headSeq()) === 0) {
    const bytes = options.seedBytes || await fetchSeed(config.seed, options.fetch || globalThis.fetch);
    if (bytes) await seedStore(store, bytes);
  }

  const backend = createRecordBackend(store, { id: `pagenary-record:${namespace}` });
  const notes = new CanonicalNotesRepository(store);
  async function importShard(bytes, importOptions = {}) {
    const resolved = { conflictStrategy: 'error', ...importOptions };
    if (resolved.conflictStrategy === 'error') {
      // Fortémi's importer validates archive integrity and hierarchy before its
      // atomic batch. A temporary store also lets this adapter pre-scan every
      // incoming id, guaranteeing conflict failure before destination mutation.
      const incoming = new MemoryRecordStore();
      await importShardToRecords(incoming, bytes, { ...resolved, conflictStrategy: 'replace' });
      for (const collection of RECORD_COLLECTIONS) {
        for (const record of await incoming.list(collection)) {
          if (await store.get(collection, record.id)) {
            await incoming.close();
            throw new Error(`Knowledge Shard conflict: ${collection}/${record.id}`);
          }
        }
      }
      await incoming.close();
    }
    return importShardToRecords(store, bytes, resolved);
  }
  return {
    tier: 'record',
    store,
    backend,
    notes,
    capabilities: {
      ...store.capabilities,
      semantic: 'none',
      provenance: false,
      skos: false,
      pglite: false
    },
    importShard,
    exportShard: (exportOptions = {}) => exportShardFromRecords(store, exportOptions),
    close: () => store.close()
  };
}
