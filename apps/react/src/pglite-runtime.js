import {
  ArchiveManager,
  createPGliteBackend,
  dropAttachmentProjection,
  dropNoteProjection,
  projectRecords
} from '@fortemi/core';
import { createPagenaryRecordRuntime } from './record-runtime.js';

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

  async function rebuild() {
    await dropAttachmentProjection(db);
    await dropNoteProjection(db);
    return projectRecords(db, records.store);
  }

  let projection;
  try {
    projection = await projectRecords(db, records.store);
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
    semantic: semanticAvailable ? { enabled: true, model: config.features.semantic.model } : { enabled: false },
    rebuild,
    close: async () => {
      await archives.close();
      await records.close();
    }
  };
}
