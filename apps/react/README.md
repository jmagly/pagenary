# @pagenary/react

Optional React/Vite adapter for Pagenary hybrid tenant routes.

`@pagenary/publisher` does not depend on this package. Tenants opt in with
`runtime.mode: "hybrid"` or `runtime.mode: "react-spa"` and install the adapter
beside the publisher. The adapter builds a tenant-local React entry with Vite
into `dist/<tenant>/assets/react/` without emptying the Pagenary tenant output.

Node requirements follow Vite: Node `20.19+` or `22.12+`. The publisher package
keeps its Node `>=16` static runtime floor.

## Fortemi Docs Map

Hybrid tenants can enhance the generated Docs Map fallback with the Fortemi
React graph control:

```jsx
import { mountFortemiDocsMap } from '@pagenary/react/docs-map';

mountFortemiDocsMap();
```

Set `docsMap.renderer` to `fortemi-react` in the tenant config. The publisher
still emits the static SVG Docs Map first; the React helper mounts into
`#docsMapRoot` when the bundle is present and loads `docs-map-data.js`.

The docs map inherits the tenant's `--surface`, `--ink`, `--muted`, and
`--accent` design tokens. The adapter maps them to Fortemi's GraphView CSS
variables and concrete Sigma/3D themes, preserves community/greyscale/custom
node palettes, and responds to `class`, `style`, or `data-theme` changes on the
page root. Theme switchers that replace styles without changing those
attributes can dispatch `pagenary:themechange` on `window` to request a refresh.

## Published-source refresh

The explicit record and PGlite runtime entry points expose a `refresh` adapter:

```js
const plan = await runtime.refresh.prepare(deployedIndex, { policy: 'conflict' });
const preview = await runtime.refresh.preview(plan);
// Present preview.receipts and obtain the user's approval before executing.
const result = await runtime.refresh.execute(plan, {
  approval: plan.planDigest,
  signal: abortController.signal,
  onProgress: ({ checkpoint }) => saveCheckpoint(checkpoint)
});
```

`deployedIndex.items` uses stable page `id`, `title`, and `text` fields. Identity
includes tenant, runtime namespace, and the fixed `pagenary:published-pages`
source namespace. Title and corpus digest are not external page identities.
Plans bind the content, scope, policy, and batch size; modifying the destination
requires another preview and approval. Default `conflict` preserves existing
content on source changes. Explicit `version` or `replace` selects Fortemi's
corresponding content policy. Local tags remain attached, and user-edited text
is retained in revision history before an approved overwrite. Title-only
updates follow the same approval policy; their outcomes appear in each batch
receipt's `pagenary` section.

`runtime.refresh.prepareSeed(options)` fetches the current configured seed and
prepares a plan from its verified corpus. New seed imports register live source
identities atomically. For an older store, supply an explicit reviewed mapping
with `prepare(index, { legacyNotes: { 'page-id': 'existing-note-id' } })` (or the
same option to `prepareSeed`). Preview reports adoption counts; approval adopts
the existing note using its original content as the source baseline. Existing
identities cannot be reassigned across sources, tenants, or namespaces.

Persist `result.checkpoint` or the progress checkpoint for interrupted work.
After reopening, prepare and preview the same corpus/configuration, then pass
that checkpoint with a new approval. The adapter replays durable batch receipts
before continuing; an offset alone never authorizes skipping data. Cancellation
stops between atomic batches and retains already committed work. PGlite rebuilds
from canonical records after committed updates, including interrupted updates.

Refresh updates page titles and body text. Local tags and links remain attached;
this API does not synchronize source-owned tag/link changes. Missing pages never
imply deletion during refresh. For a verified complete corpus, preview a separate
operation with `prepareReconciliation(index, { completeCorpus: true,
operationKey: 'host-operation-id' })`, then explicitly approve it with
`reconcile(plan, { approval: plan.planDigest })`. This soft-deletes missing
publisher-owned notes while preserving locally edited notes by default.
`includeLocalEdits: true` requires a new preview and approval. Receipts contain
hashed operation/source selectors and distinguish soft deletion from terminal
purge. Repeating the same operation returns the retained receipt.

Use `exportShardWithReport()` for portable `record-v1` output. Its
`capability_report` explicitly reports lost live source identities and other
unsupported state. The runtime retains that report with the archive digest;
`listExportReceipts()` retrieves those receipts after reopening. Portable shards
do not preserve the live identities or refresh checkpoints required to continue
source refresh, and are not complete backups.

Run `npm test --workspace @pagenary/react` for memory and real-PGlite tests.
`node apps/react/scripts/test-record-browser.mjs` tests real IndexedDB using an
operator-installed Playwright module; `PAGENARY_PLAYWRIGHT_MODULE` can select an
external module path and `PAGENARY_BROWSER_BIN` an existing browser executable.
`node apps/react/scripts/audit-runtime-bundles.mjs` builds and audits the actual
graph route. Both scripts print emitted bytes and remove their temporary output.

## Local dataset authoring

The optional `@pagenary/react/dataset` entry provides `DatasetImportPanel` and
`mountDatasetImport(element, { runtime })`. It uses Fortemi's headless dataset
workflow for checks, bounded previews, plan review and explicit approval. The
host supplies a record or PGlite runtime; the panel never opens storage itself.
The `dataset-authoring` recipe loads this entry and IndexedDB only on its import
route. Build it from `apps/publisher` with
`node scripts/build-tenants.js -r examples/recipes.tenants.json dataset-authoring`.

For headless integration, use `createPagenaryDatasetRuntime` from
`@pagenary/react/dataset-runtime`, then `prepare(index)`, `preview(plan)` and
`execute(plan, { approval: plan.planDigest, signal, onProgress })`. The input is
the same `{ items: [{ id, title, text }] }` page collection as source refresh.
The runtime binds tenant/namespace and the host's `sourceBinding`; UI inputs
cannot select another destination. Imported sources are separate from published
seed identities. `lineage(plan, { offset, limit })` returns bounded digest-bound
batch receipts without source text or raw external identifiers.

This adapter advertises only its implemented full-ingest, schema inspection,
stable identity/revision, upsert, checkpoint, cancellation, atomic batch,
deterministic ordering and dataset lineage operations. Required capability gaps
block before input processing; optional gaps are reported explicitly. Static
readers advertise no ingest. Vectorization, hybrid retrieval, terminal purge,
record/field lineage and automatic missing-record deletion are unavailable.
Memory stores have memory durability; IndexedDB persists records, checkpoints
and receipts together. PGlite is a rebuildable projection of that authority.

Input is limited to 20 MiB, each record to 256 KiB, each batch to 100 records,
preview samples and diagnostics to 20, and execution to one batch at a time.
The JSON file and normalized plan remain in memory while reviewed. Preview
samples contain hashes and lengths. Source/configuration changes require fresh
approval. Cancellation preserves committed batches; retry uses durable receipts
and checkpoints, including after reopening. Default conflict policy preserves
existing content; approved version/replace updates retain prior edited content.
Portable shards do not retain the live ingest checkpoints needed for retry.

`node apps/react/scripts/test-dataset-browser.mjs` exercises production route
assets with the same external browser settings above: keyboard/focus, live
progress, cancellation/retry, mobile width, theme and reduced motion. The
record-tier bundle audit rejects database artifacts; an asset cleanup plugin
removes only unused PGlite-owned assets with no retained module or reference.
`node --expose-gc apps/react/scripts/benchmark-dataset-preview.mjs` reports
reproducible resource measurements. A Node 24.12 run with 5,000 pages (5,966,681
input bytes) took 637 ms, retained about 10 MB for preparation after GC, and
used about 23 MB more heap at the preview endpoint before GC. These are Node
heap snapshots, not browser or peak-memory guarantees; preview made zero writes.

## Scoped local search and removal coverage

Tier 3 exposes `runtime.scopedSearch.search(query, options)` and
`listSources()`. Tenant and archive come from the canonical runtime's active
tenant/namespace. Optional `sourceHandle` values come from `listSources()` and
are hashed; raw tenant, archive and source selectors are rejected. Only notes
with a source identity in that active scope participate. Unbound user notes
remain available through the host's existing canonical APIs.

SQL views restrict candidates before Fortemi ranking, pagination and facet
counting. They exist only during the serialized search transaction. The adapter
projects canonical source identities alongside notes and rebuilds on startup or
when canonical storage changes. `subscribeInvalidation(listener)` and
`getGeneration()` let result and graph consumers discard cached views after a
rebuild, including refresh reconciliation. The default publisher static-search
API is unchanged. The scoped runtime currently exposes lexical search;
semantic/hybrid requests fail with `SEMANTIC_UNAVAILABLE` until readiness is wired.

Options allow a query up to 4,096 characters, limit 1–100, offset 0–10,000,
`include_facets`, and up to eight `metadataPredicates`. Registered paths are
`provider`, `model`, `role`, `event_kind`, `sensitivity`, and `import_run_id`.
Operators are `eq`, `in` (1–32 values), `exists`, and `range`. Scalar strings are
limited to 256 characters; objects, nonfinite numbers, extra keys and unknown
operators fail before SQL. Range bounds must be strings and use upstream text
ordering; numeric ranges are rejected. Returned source locators contain hashes.

`runtime.removal.coverage.terminalPurge` is `unsupported`; both `preview()` and
`execute()` fail without mutation or a success receipt. Fortemi 2026.9.2's
canonical purge skips `note_revision`, reports zero revisions, and considers
unreferenced blobs across the entire store. More fundamentally, canonical
journals retain full record snapshots with no supported scoped erasure API.
PGlite lifecycle purge covers SQL state but cannot erase that authority;
rebuilding could restore deleted SQL content. A complete removal workflow must
first close those upstream coverage gaps, then bind a scoped preview, explicit
confirmation and operation key to an atomic, content-free durable receipt.

Soft deletion hides a note while retaining content. Published-source
reconciliation performs that soft deletion with separate approval and a durable
receipt; ordinary refresh never deletes absent pages. Deleting a projection is
temporary. None of these operations is represented as terminal purge.
