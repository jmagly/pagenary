# ADR-018: Fortémi Record and PGlite Runtime Tiers

**Status:** Accepted

**Date:** 2026-07-21

**Issues:** #137, #149; related #136

**2026-07-30 conformance addendum (#164):** Fortémi `2026.7.15` preserves the
tier boundary below and adds exact Knowledge Shard `2.0.0/full-v1` conversion.
Pagenary retains `1.2.0/core-v1` as a reversible compatibility artifact.
Full-v1 publication uses the report-bearing converter and requires
`success: true`, `lossless: true`, an archive, no typed losses, and a valid
receipt. This is narrow contract evidence, not a claim of complete backup,
universal portability, Windows support, or suite-wide conformance.

## Context

Pagenary already has a dependency-free static publisher (Tier 0) and an
optional React graph runtime (Tier 1). Fortémi 2026.7.11 offers two materially
different writable paths: a canonical DB-free RecordStore backend and a PGlite
projection. Treating both as one “Fortémi runtime” would ship database cost and
semantics to tenants that only need local records or shard exchange.

## Decision

Pagenary exposes them as explicit, monotonic tenant tiers:

- **Tier 0 — static:** vendored static index, generated search/graph artifacts,
  no npm runtime.
- **Tier 1 — React graph:** graph-only Fortémi subpaths; no core, PGlite, WASM,
  worker, or database data.
- **Tier 2 — record:** opt-in `@fortemi/core` canonical RecordStore via
  `createRecordBackend`; writable notes and record-v1 shard import/export;
  semantic capability is honestly `none`.
- **Tier 3 — projection:** opt-in PGlite projection for FTS, hybrid/semantic
  retrieval, embeddings, and PGlite-compatible APIs. Canonical records and
  Bytecask bytes remain authoritative; PGlite is derived and rebuildable.

No tier silently escalates. Tenant schema must declare the tier and its seed
artifact. Existing tenants remain Tier 0/1.

## Seed and lifecycle

Tier 2 may seed from the build-time `core-v1` artifact planned by #136, then
write canonical records locally. Runtime writes never mutate the deployed
static artifact. Export produces `record-v1` and reports every omitted/lossy
component.

An exact `2.0.0/full-v1` artifact is an additional build-time interchange
option, not a replacement for Tier 2's canonical-record lifecycle. Observed
`operational_state` is provenance and never implies deletion;
`state_transfer.deleted_at` is the explicit portable tombstone signal.

Tier 3 starts from canonical records (or an imported shard), validates the
archive completely, then projects parent-first into PGlite. Projection is
idempotent and disposable: drop/rebuild must preserve canonical records and
blob bytes. Schema migrations run only for a tenant that explicitly selects
Tier 3.

## Hierarchy and failure guarantees

- Collection `parent_id` must round-trip through memory/IndexedDB records,
  record-v1 shards, and PGlite projection.
- Imports/projectors validate missing and cyclic parents before any mutation.
- Clean PGlite projection orders collections parent-first.
- Unscored links project with canonical asserted score `1`; absent source
  confidence remains represented in metadata for lossless re-import.
- Malformed schema, checksum, signature, profile, hierarchy, or conflict-policy
  input fails before partial persistence.

## Tenant configuration direction

```json
{
  "runtime": {
    "fortemi": {
      "tier": "record",
      "seed": {
        "type": "knowledge-shard",
        "path": "fortemi/tenant.shard"
      }
    }
  }
}
```

Tier 3 uses `"tier": "pglite"` and must additionally declare semantic/model
features rather than receiving them by default.

## Verification gates

| Gate | Tier 2 | Tier 3 |
|---|---:|---:|
| PGlite/WASM/worker/data absent | required | not applicable |
| Record/shard exact round-trip | required | required before projection |
| Nested hierarchy round-trip | required | required |
| Missing/cyclic parent preflight | required | required |
| Drop/rebuild projection parity | not applicable | required |
| Semantic capability | absent | explicit opt-in |
| Static fallback artifacts | preserved | preserved |

## Consequences

This adds more explicit configuration and testing, but keeps static tenants
small, makes runtime cost legible, and preserves a single canonical data
authority. PGlite can be upgraded or rebuilt without redefining Pagenary's
published content contract.
