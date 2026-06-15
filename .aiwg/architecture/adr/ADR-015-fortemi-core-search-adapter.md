# ADR-015: Replace Bespoke Search Through a Fortemi Core Adapter

Status: Accepted
Date: 2026-06-14
Updated: 2026-06-15

## Update 2026-06-15 — decision confirmed, scope widened to shipped capabilities

The static `@fortemi/core` `./aiwg-index` tier is **confirmed** as the integration
target (over the PGlite/`SearchRepository` and `@fortemi/react` tiers). Two things
changed since the original proposal:

1. `apps/publisher/src/lib/search.js` was a *hand-rolled reimplementation* of the
   Fortemi static-index contract, not a real dependency. We replace it with the
   **real `@fortemi/core@2026.6.2` `./aiwg-index`** module, **vendored** into
   `src/vendor/fortemi-aiwg-index.js` (22 KB, self-contained ESM, no bare imports)
   so the no-bundler static build can import it by relative path in both Node
   (build) and the browser (runtime).
2. Upstream `@fortemi/core/aiwg-index` has since shipped exactly the capabilities
   the original ADR listed as "future work / deferred." These now move **into
   scope** for this migration:
   - **Ranking + snippets**: `queryAiwgFortemiIndex({ rank, snippets })`.
   - **Chunked static index + precache**: `AiwgFortemiChunkManifest` + part files,
     `createAiwgFetchChunkLoader`, in-memory part cache (`maxCachedParts`),
     `createAiwgIndexController().queryChunked({ offset, limit, onProgress })`.
     This is the "indexing + performance" path: lazy part fetch, bounded memory,
     and **offset-paged results that drive infinite scroll** in the command palette.
   - **Community graph**: `aiwgFortemiIndexToCommunityGraph` /
     `controller.toCommunityGraph()` (the "graph" capability).

   Still deferred (unchanged): PGlite/`SearchRepository`, WASM, browser-persisted
   storage, semantic/hybrid retrieval, embeddings, and `@fortemi/react`.

The PGlite-era multi-tenant **persistence** concerns from REQ-fortemi-core-search
(cross-tenant row leakage, persisted-index invalidation) do **not** apply to this
tier: the static index keeps no browser-persisted storage. Each tenant bundle
ships its own `search-index/` directory; the only runtime cache is the loader's
in-memory part cache, scoped to the page. A content-derived `build_hash` /
deterministic `generated_at` is still emitted on the manifest for HTTP-cache and
future invalidation.

## Context

Pagenary currently searches tenant content through `apps/publisher/src/lib/search.js`.
That module builds a lazy in-memory index by importing every section module,
extracting rendered HTML text, and running lowercase substring matching.

Fortemi provides search and index helpers through the npm package
`@fortemi/core`. The most appropriate first fit for Pagenary is the static
`aiwg.fortemi.index.export.v1` API: validation, assertion, facet calculation,
and `queryAiwgFortemiIndex`.

Fortemi also provides a richer PGlite-backed `SearchRepository`, but that path
adds WASM, browser storage, migrations, and cache invalidation concerns that are
not required to prove the command-palette replacement.

Pagenary's shell is intentionally a vanilla static SPA. Pulling in
`@fortemi/react` would force a larger UI/runtime architecture change than this
search migration requires.

## Decision

Pagenary will pursue a core-only Fortemi integration:

- Add `@fortemi/core` as the Fortemi integration dependency.
- Generate a Pagenary search artifact in the `aiwg.fortemi.index.export.v1`
  shape, using `aiwg.artifact` records for pages/sections.
- Introduce a Pagenary-owned adapter that calls `queryAiwgFortemiIndex` and maps
  returned records back to Pagenary section objects.
- Start with static index substring search only.
- Keep the legacy search path as fallback until Fortemi-backed search passes
  parity, performance, and browser resilience gates.

## Architecture Shape

Build time:

- Emit a deterministic Fortemi-compatible static index for each tenant from the
  processed manifest and section content.
- Encode the section ID in a stable field such as `source.locator` and/or a
  Pagenary facet so results can navigate back to `navigate(section.id)`.

Runtime:

- Load and validate the static index artifact.
- Query the index with `queryAiwgFortemiIndex`.
- Translate results into the shape currently consumed by `renderCommandList()`.
- Fall back to legacy `searchContent()` if the artifact or helper path fails.

## Consequences

### Positive

- Search moves onto a Fortemi-owned index contract and gains facets/filter
  structure while preserving a future path to richer Fortemi retrieval.
- Pagenary adopts Fortemi without adopting React.
- The adapter boundary keeps Pagenary navigation and static deployment semantics
  explicit.

### Negative

- The current static index helper still performs substring matching, so ranking,
  phrase search, and snippets remain future work unless Fortemi core evolves.
- Pagenary must adapt its page/section concept to the current `aiwg.artifact`
  record type.

### Neutral

- The static Fortemi index is a derived artifact. Pagenary content remains the
  source of truth in generated static files.

## Alternatives Considered

- Keep bespoke search: rejected because it does not meet the Fortemi adoption
  goal and leaves search quality limited.
- Adopt `@fortemi/react`: rejected for phase one because it introduces React
  and a larger UI/runtime migration.
- PGlite SearchRepository: deferred because it is higher value later but too
  much runtime surface for the first command-palette replacement.

## Upstream Follow-Ups

- Fortemi/fortemi-react#153 tracks first-class static docs/page record support.
- Fortemi/fortemi-react#154 tracks optional static-index ranking/snippets.
