# Fortémi Knowledge Shard Export Spike

**Issue:** #136

**Date:** 2026-07-21

**Baseline:** `@fortemi/core@2026.7.11`, Knowledge Shard contract revision 19,
schema 1.2.0 `core-v1`

**2026-07-30 addendum (#164):** The historical measurements and decision below
remain evidence for the `1.2.0/core-v1` compatibility adapter. The current
implementation is aligned to `@fortemi/core@2026.7.15` and also exposes the
report-bearing exact `2.0.0/full-v1` converter. The two profiles are not
interchangeable.

## Decision

Proceed with an optional build-time Knowledge Shard artifact. The first
construction path should use `aiwgFortemiIndexToKnowledgeShard`; Pagenary does
not need to boot PGlite or instantiate the record tier to publish a docsite.
The package and its Ajv/fflate/uuid dependencies stay in the Node build
toolchain and do not enter Tier-0 browser assets.

## Reproducible proof

`scripts/prototype-fortemi-shard.mjs --profile=core-v1` accepts Pagenary's deterministic v1
index export, promotes the envelope and records to v2 with an explicit v1
compatibility declaration, validates it, converts it twice, requires the two
archives to be byte-identical, restores the index, and requires an exact
structural round-trip.

```bash
npm run prototype:fortemi-shard --workspace @pagenary/publisher -- \
  /path/to/index-export.json /tmp/pagenary.shard
```

The automated proof is
`__tests__/scripts/fortemi-shard-prototype.test.js`.

The `--profile=full-v1` path projects away Pagenary-only closed-schema fields
before calling `aiwgFortemiIndexToKnowledgeShardWithReport()`. It writes an
archive only when conversion is successful and lossless with a valid receipt.
Ordinary Pagenary page records currently produce typed losses for authority
data that cannot be derived without defaulting or omission; those results have
`archive: null` and are reported rather than mislabeled as full-v1.

## Findings

- The bridge requires an `aiwg.fortemi.index.export.v2` envelope. Since
  `2026.7.15` the authority schema is closed, so Pagenary deterministically
  removes `source.build_hash` and record `delivery_assets` from the submitted
  projection while retaining them in the source static index.
- Complete source records, SKOS metadata, provenance, privacy, delivery assets,
  and relationships survive because the converter preserves each source record
  in note metadata.
- Relationships without confidence are emitted as asserted links with score
  `1`, while the original relationship object remains losslessly preserved.
- Release 2026.7.11 canonicalizes tar-entry and gzip mtimes. Repeating the
  conversion over the same input produces byte-identical output.
- The bridge emits `core-v1` notes/tags/links. It does not synthesize Knowledge
  Shard collections, native graph/community components, or blob sidecars.
  Docs-map relationships remain available in the preserved source records and
  link component, but community layout is not a native core-v1 component.
- Nested `parent_id` behavior is therefore outside this bridge path. It belongs
  to the future record-tier import/export path; that path must test hierarchy
  preservation and reject missing/cyclic parents before mutation.
- Images/downloads are references in Pagenary records today. Native BLAKE3 blob
  sidecars require an explicit attachment projection and are construction work,
  not something the static AIWG bridge infers safely.
- `operational_state` is observed-state provenance and must never be treated as
  a persistence tombstone. Only `state_transfer.deleted_at` transfers deletion
  semantics into a portable shard.

## Build-cost posture

The prototype is a build-only import. It must remain opt-in until construction
records representative tenant timing and size metrics. CI should report input
record count, archive bytes, conversion duration, and reproducibility. The
published browser site must not gain Ajv, fflate, uuid, PGlite, WASM, workers,
or database data files from enabling shard output.

Measured against the real `pagenary` tenant on 2026-07-21:

| Measurement | Result |
|---|---:|
| Search/index records | 27 |
| Promoted index JSON | 318,030 bytes |
| Knowledge Shard | 156,646 bytes |
| Shard SHA-256 | `c2f306fcfb8db7edd9ee4fe7af5a15327e77fbcde29ac8813dd8fd55248d7750` |
| Conversion wall time | 0.42 s |
| Conversion max RSS | 105,040 KB |
| Full tenant build wall time (context) | 2.04 s |
| Reproducible / exact round-trip | yes / yes |

These are local single-run measurements, not performance budgets. Construction
should capture them in CI across representative small and large tenants.

## Construction recommendation

1. Add a tenant export option and emit a content-addressed `.shard` plus digest
   and metadata receipt.
2. Gate on v2 validation, deterministic double-build comparison in CI, and
   exact source-index round-trip.
3. Add optional attachment/blob projection separately, with missing-byte and
   privacy policy defined explicitly.
4. Keep DB-free runtime import/annotation and PGlite projection as separate
   tiers under the runtime ADR.
