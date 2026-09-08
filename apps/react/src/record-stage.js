/** Read-through staging for one atomic canonical batch; never a second authority. */
export function stageRecords(store) {
  const changes = new Map();
  const table = (collection) => {
    if (!changes.has(collection)) changes.set(collection, new Map());
    return changes.get(collection);
  };
  return {
    capabilities: store.capabilities,
    get: async (collection, id) => table(collection).has(id)
      ? structuredClone(table(collection).get(id)) : store.get(collection, id),
    list: async (collection, options) => {
      const rows = new Map((await store.list(collection)).map((row) => [row.id, row]));
      for (const [id, row] of table(collection)) {
        if (row === null) rows.delete(id);
        else rows.set(id, structuredClone(row));
      }
      return [...rows.values()].slice(0, options?.limit);
    },
    put: async (collection, record) => { table(collection).set(record.id, structuredClone(record)); },
    remove: async (collection, id) => { table(collection).set(id, null); },
    applyBatch: async (mutations) => {
      for (const mutation of mutations) {
        table(mutation.collection).set(mutation.op === 'put' ? mutation.record.id : mutation.id,
          mutation.op === 'put' ? structuredClone(mutation.record) : null);
      }
      return [];
    },
    mutations: () => [...changes].flatMap(([collection, rows]) => [...rows].map(([id, record]) => record === null
      ? { op: 'delete', collection, id } : { op: 'put', collection, record })),
    headSeq: () => store.headSeq()
  };
}
