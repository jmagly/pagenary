# Fortemi Record-Tier Tenant Posture Spike

**Date:** 2026-07-17
**Issue:** #149
**Related:** #136, #137, `.aiwg/planning/fortemi-2026.7.4-integration-plan.md`,
`apps/publisher/docs/DEPENDENCY-POSTURE.md`
**Status:** Proposed design for construction breakdown

## Decision

Pagenary should add a distinct **Tier 2 Fortemi record tier** before any
PGlite-backed runtime tier. Tier 2 is a static-host-compatible, browser-local
record posture for tenants that need writable canonical records, review notes,
or Knowledge Shard import/export without semantic search, full-text search,
embeddings, or PGlite-compatible APIs.

Tier 2 depends on `@fortemi/core` record and shard APIs only:

- `createRecordBackend`
- `exportShardFromRecords`
- `importShardToRecords`
- `projectNotes`
- `projectRecords`

Tier 2 must not depend on or bundle `@electric-sql/pglite`, PGlite WASM, PGlite
data files, embedding models, or WebLLM assets. PGlite remains the planned
**Tier 3 projection** for tenants that explicitly need FTS, semantic search,
embeddings, or PGlite-compatible query APIs.

## Tier Responsibilities

| Responsibility | Tier 2 record tier | Tier 3 PGlite projection |
|---|---|---|
| Canonical tenant data | Fortemi records in browser-local storage | Consumes canonical records as projection input |
| Static-host compatibility | Required | Required, with larger self-hosted assets |
| Runtime database | None | PGlite |
| Writable local notes | Yes | Yes, through projected or synced records |
| Knowledge Shard import/export | Yes | Yes, but not required for first Tier 2 implementation |
| Static docs-map and search reuse | Yes, through existing static artifacts | Yes, plus optional projected search |
| FTS and SQL-like queries | No | Yes |
| Semantic search and embeddings | No | Optional, reader opt-in |
| Bundle invariant | No PGlite WASM/data | PGlite WASM/data present only for opted-in tenants |

Tier 2 is not a weaker Tier 3. It is the correct target when the product need is
local curation, review, or shard exchange over canonical records and the tenant
does not need a browser database.

## Use Cases That Justify Tier 2

Use Tier 2 for:

- Living docs annotations where readers or authors keep local notes alongside a
  static docsite.
- Local review notes for brochureware or documentation content review before
  those notes become source content.
- Imported Knowledge Shards from other Fortemi or Pagenary exports when the
  tenant only needs to inspect, merge, annotate, or re-export records.
- Author-side curation workflows for docs-map labels, relationships, and
  lightweight metadata before committing generated artifacts.
- Docs-map annotations such as pinned review decisions, page-group notes, or
  relationship review without semantic ranking.

Do not use Tier 2 for:

- In-browser FTS over large corpora.
- Semantic search, embedding generation, or LLM workflows.
- APIs or integrations that require PGlite/Postgres behavior.
- Tenants whose only need is static search or static docs-map rendering. Those
  stay Tier 0 or Tier 1.

## Runtime Config Sketch

Tier 2 should be tenant opt-in and route-scoped like the existing React posture.
A future schema extension can use this shape:

```json
{
  "runtime": {
    "mode": "hybrid",
    "fortemi": {
      "tier": "records",
      "records": {
        "enabled": true,
        "storage": "idb",
        "seed": {
          "from": ["search-index", "docs-map", "knowledge-shard"],
          "knowledgeShardPath": "fortemi/tenant.knowledge-shard.tar.gz"
        },
        "features": {
          "localNotes": true,
          "reviewDecisions": true,
          "shardImport": true,
          "shardExport": true,
          "docsMapAnnotations": true
        }
      }
    }
  }
}
```

Dependency declaration:

- `@pagenary/react` remains the runtime adapter boundary for bundled tenant
  surfaces.
- Tier 2 tenants must explicitly depend on `@fortemi/core` at the adapter level
  or through a future `@pagenary/react/records` entrypoint.
- Tier 2 tenants must not install or import `@electric-sql/pglite`.
- The implementation should import Fortemi through record/shard-specific
  subpaths if upstream exposes them; otherwise the adapter must verify that the
  used `@fortemi/core` entrypoint keeps PGlite behind dynamic optional imports.

Static-host compatibility requirements:

- All seed data ships as generated static files under the tenant output.
- Runtime writes stay browser-local by default, initially IndexedDB if Fortemi's
  record backend supports it, with an in-memory fallback for unsupported
  browsers or private modes.
- Exported shards are user-initiated downloads or blobs; no server write path is
  required.
- Import accepts user-provided shard files or same-origin static shard URLs.

## Generated Artifacts And Seed Flow

Pagenary should support two seed sources rather than choosing one prematurely:

1. Existing static artifacts:
   - `search-index/manifest.json` and parts remain the authoritative Tier 0
     static Fortemi index.
   - `docs-map/docs-map-data.js` and `docs-map/render-graph.json` remain graph
     artifacts.
   - Tier 2 can project these artifacts into canonical records with
     `projectRecords` or a Pagenary adapter.
2. Knowledge Shards from #136:
   - `aiwgFortemiIndexToKnowledgeShard` may emit
     `fortemi/<tenant>.knowledge-shard.tar.gz` directly from the static AIWG
     index.
   - Tier 2 can import that shard with `importShardToRecords` when the tenant
     wants a canonical record backend seeded from the same package a Fortemi app
     would consume.

The first construction path should prefer the static AIWG-index bridge from
#136 if it preserves pages, docs-map metadata, and attachments well enough. If
that is insufficient, construct records directly from Pagenary's existing corpus
builder and emit a shard through `exportShardFromRecords`.

Seed flow:

```text
Pagenary content
  -> Fortemi AIWG static index
  -> optional Knowledge Shard artifact (#136)
  -> Tier 2 import/project into createRecordBackend
  -> local notes/review/annotations
  -> exportShardFromRecords for user-controlled shard export
```

## Graceful Feature Detection

Tier 2 must detect optional Fortemi capabilities instead of assuming the full
Tier 3 surface exists:

- If semantic APIs are absent, hide semantic controls and keep static search.
- If provenance or SKOS projection helpers are absent, preserve raw record
  metadata and show a non-blocking capability status.
- If shard import/export helpers are absent, disable only shard actions; local
  notes can still work when `createRecordBackend` is available.
- If persistent storage is unavailable, fall back to in-memory records and mark
  changes as export-only.

Feature detection should be capability-based, not package-version string based,
so first-party Fortemi patch releases can add helpers without Pagenary schema
changes.

## Bundle Verification Plan

Tier 2 construction must add CI or smoke checks that prove all of the following
for a representative Tier 2 tenant build:

```bash
# No PGlite package files or database payloads in Tier 2 output.
find dist/<tenant>/assets/react \
  \( -iname '*pglite*' -o -iname '*.wasm' -o -iname '*.data' \) -print

# No static asset references to PGlite in generated JS.
rg -n "@electric-sql/pglite|pglite|PGlite" dist/<tenant>/assets/react

# Shard import/export round-trip.
node scripts/smoke-record-tier-shard-roundtrip.mjs dist/<tenant>
```

Expected results:

- The `find` and `rg` commands produce no output for Tier 2.
- The round-trip smoke creates a record backend, imports the generated seed
  shard or projected records, exports a shard, imports that export into a fresh
  backend, and compares stable record identifiers, record counts, note counts,
  and selected metadata fields.
- A separate Tier 3 smoke may assert PGlite presence for an opted-in PGlite
  tenant, but Tier 2 checks must never rely on Tier 3 behavior.

## Integration Points

#136, Knowledge Shard export:

- #136 should decide whether the AIWG-index-to-shard bridge is sufficient for
  Pagenary's static docsite package.
- Tier 2 can consume the #136 shard artifact directly, but must also allow
  direct record projection from existing static artifacts so #149 is not blocked
  if shard export is deferred.

#137, PGlite projection:

- #137 should consume this design as the boundary for Tier 3.
- Tier 3 should project over Tier 2 canonical records where possible instead of
  treating PGlite as the canonical source.
- Tier 3 verification should invert the Tier 2 bundle check: PGlite assets are
  expected only for explicit Tier 3 tenants and absent everywhere else.

Existing dependency posture:

- `apps/publisher/docs/DEPENDENCY-POSTURE.md` remains the user-facing summary.
- This spike is the implementation design behind that summary and should be
  linked from the Tier 2 section until an ADR replaces it.

## Construction Breakdown

Recommended follow-up issues:

1. `feat(runtime): add Tier 2 record-tier tenant schema`
   - Extend tenant schema/docs with `runtime.fortemi.tier: "records"`.
   - Add validation errors for incompatible Tier 2 + Tier 3 settings.
2. `feat(runtime): add @pagenary/react record-tier entrypoint`
   - Add a record/shard runtime entrypoint that imports Fortemi record APIs
     without PGlite.
   - Add graceful capability detection and no-PGlite bundle guards.
3. `feat(export): generate record-tier seed artifacts`
   - Reuse the Fortemi AIWG static index and #136 shard artifact when available.
   - Provide a direct records projection fallback from Pagenary corpus entries.
4. `test(runtime): add record-tier shard round-trip smoke`
   - Import seed records, export a shard, import into a fresh backend, and
     compare stable identifiers and metadata.
5. `docs(runtime): document Tier 2 author and tenant workflows`
   - Cover living docs notes, review decisions, docs-map annotations, import,
     export, and the no-PGlite posture.

These can be filed as separate construction issues after design approval, or
kept as the construction checklist on #149 if the project wants fewer tracker
items during planning.

