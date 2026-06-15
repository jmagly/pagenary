# Fortemi Core Search Migration Plan

Status: Accepted (static `aiwg-index` tier)
Date: 2026-06-14
Updated: 2026-06-15

## Goal

Replace Pagenary's bespoke search/lookup/indexing path with Fortemi-backed
search using the published npm package `@fortemi/core` (`./aiwg-index` subpath),
while preserving static hosting, tenant isolation, and the existing
command-palette UX.

## Update 2026-06-15 — tier locked, shipped capabilities pulled into scope

See [[ADR-015-fortemi-core-search-adapter]]. The static `aiwg-index` tier is the
chosen target. Because upstream `@fortemi/core@2026.6.2` now ships ranking,
snippets, a chunked static-index format, a fetch chunk loader with bounded part
cache, an index controller with offset-paged `queryChunked`, and community-graph
projection, the following move from "Deferred" into **Phase 1–2 scope**:

- Real `@fortemi/core/aiwg-index`, **vendored** to `src/vendor/fortemi-aiwg-index.js`
  (replaces the hand-rolled reimplementation in `src/lib/search.js`).
- Build-time emission of a **chunked** index per tenant: `search-index/manifest.json`
  + `search-index/part-NNNN.json`, deterministic and sorted by record `id`.
- Runtime adapter on `createAiwgIndexController` + `createAiwgFetchChunkLoader`:
  lazy part fetch (**precache** via the loader cache), **offset-paged results for
  infinite scroll**, ranking + snippets, and `toCommunityGraph()` (**graph**).

Still deferred: PGlite/`SearchRepository`, WASM, semantic/hybrid search,
embeddings, `@fortemi/react`. The PGlite-era persistence NFRs do not apply to the
static tier (no browser-persisted storage).

## Phase 0: Spike

- Add a prototype adapter outside the production path.
- Use `@fortemi/core` static index helpers only:
  `validateAiwgFortemiIndexExport`, `assertAiwgFortemiIndexExport`, and
  `queryAiwgFortemiIndex`.
- Generate a small `aiwg.fortemi.index.export.v1` fixture from Pagenary section
  documents.
- Translate Fortemi results into `{ id, title, summary, group, module }`.

Exit criteria:

- Search returns navigable Pagenary section IDs.
- No React dependency is introduced.
- No PGlite/WASM/browser storage dependency is introduced.
- A failed Fortemi initialization can fall back to legacy search.

## Phase 1: Build-Time Corpus

- Generate a tenant search corpus from `processedManifest` and materialized
  section content in `aiwg.fortemi.index.export.v1` format.
- Map each page/section to type `aiwg.artifact`.
- Include section ID in `source.locator` and a Pagenary-specific facet, plus
  `tenantId`, `title`, `summary`, `group`, `text`, `route/module`, and metadata
  such as collection/date/tags where available.
- Emit the corpus as a static artifact next to `manifest.js`.
- Cover both nested-content and legacy-manifest build paths.

Exit criteria:

- Corpus generation is deterministic.
- Incremental builds refresh/remove stale corpus entries.
- Unit tests cover nested sections, groups, collection posts, and missing
  modules.

## Phase 2: Runtime Static Index Adapter

- Load and validate the tenant static index artifact.
- Query it with `queryAiwgFortemiIndex`.
- Map returned records back to Pagenary command entries.
- Preserve legacy fallback for missing/invalid artifact or helper failures.

Exit criteria:

- Command palette behavior remains stable.
- No cross-tenant result leakage.
- Missing/invalid index artifact degrades cleanly.

## Phase 3: Shadow and Parity

- Run legacy and Fortemi search side by side in dev/preview builds.
- Record query/result differences for golden query fixtures.
- Tune adapter fields and ranking presentation.

Exit criteria:

- Golden query parity is acceptable for current tenants.
- No P0/P1 regressions in navigation, no-result state, or keyboard workflows.
- Performance budgets are met.

## Phase 4: Tenant-Level Beta

- Add a tenant/build config flag for Fortemi search.
- Keep legacy fallback enabled.
- Update docs for search behavior, browser requirements, and fallback.

Exit criteria:

- Selected tenants pass browser smoke tests in Chromium and Firefox.
- Static deployment remains unchanged.

## Phase 5: Default Text Search

- Make Fortemi text search the default after beta success.
- Keep legacy fallback for one release cycle.
- Remove or simplify legacy code only after telemetry/test confidence.

## Deferred Work

- PGlite/SearchRepository integration.
- Semantic and hybrid search.
- Embedding model download and lifecycle UX.
- Embedding-based similarity graph (the static **community graph** from record
  relationships/facets is now in scope; embedding similarity is not).
- Faceted search UI (the chunked manifest exposes facet counts; surfacing a facet
  UI is deferred).
- Search history/autocomplete from Fortemi.
- `@fortemi/react`, service-worker precache (`registerServiceWorker`).

## Upstream Fortemi Core Follow-Ups

- Fortemi/fortemi-react#153: add static documentation/page record support for
  Fortemi index exports.
- Fortemi/fortemi-react#154: add optional ranking/snippet support to
  `queryAiwgFortemiIndex`.

## Risk Controls

- `@fortemi/core` is the only Fortemi dependency in phase one.
- The Fortemi index artifact is derived cache and may be regenerated safely.
- All runtime failures route to legacy search.
- Performance and browser-compatibility gates block default enablement.

## Test Plan

- Adapter unit tests with a generated Fortemi static index fixture.
- Golden query parity tests against the current legacy search.
- Build tests for corpus emission in nested and legacy tenant modes.
- Browser tests for command palette search/navigation in Chromium and Firefox.
- Failure-mode tests for missing index, invalid schema, helper failure, and
  empty corpus.
