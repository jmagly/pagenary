# REQ: Fortemi Core Search Integration

Status: Accepted (static `aiwg-index` tier)
Date: 2026-06-14
Updated: 2026-06-15
Owner: Pagenary maintainers

## Update 2026-06-15

Tier locked to the static `@fortemi/core` `./aiwg-index` path (see
[[ADR-015-fortemi-core-search-adapter]] and the migration plan). The real package
is **vendored** rather than imported as a bundler dependency, because the
publisher build is a no-bundler copy-`src`-to-`dist` pipeline. Ranking, snippets,
chunked precache, offset-paged infinite scroll, and community graph are in scope
(upstream shipped them). The PGlite-specific NFRs below (persisted rows,
cross-tenant persistence, storage-denied/private-mode) are **not applicable** to
the static tier — it keeps no browser-persisted storage — and are retained only
as forward markers for a future PGlite tier.

## Context

Pagenary currently provides search through a bespoke browser-side module at
`apps/publisher/src/lib/search.js`. The first query flattens `MANIFEST`,
dynamically imports every section module, extracts rendered HTML text, and does
case-insensitive substring matching.

The desired evolution is to replace that bespoke search/lookup/indexing path
with Fortemi-backed capabilities, using the published npm package
`@fortemi/core` rather than `@fortemi/react`.

The initial integration should target `@fortemi/core`'s static
`aiwg.fortemi.index.export.v1` helpers (`validateAiwgFortemiIndexExport`,
`assertAiwgFortemiIndexExport`, `queryAiwgFortemiIndex`) rather than PGlite.
The PGlite/SearchRepository path remains future work for richer local knowledge
storage, semantic search, and hybrid retrieval.

## Functional Requirements

- Search must continue to work in generated static tenant bundles with no
  server component.
- Search results must preserve Pagenary navigation semantics: each returned
  item must map back to a stable section ID usable by `navigate(section.id)`.
- The command palette must continue to support keyboard navigation, no-result
  state, current-section preference, and quick open via `Ctrl/Cmd+K` and `/`.
- The first integration phase must use Fortemi's static index query helper only.
- Semantic and hybrid search must remain separate opt-in work after indexing,
  model download, and embedding lifecycle UX are proven.
- A legacy Pagenary search fallback must remain available until Fortemi-backed
  search passes parity and performance gates.

## Non-Functional Requirements

- Generated bundles must remain deployable on ordinary static hosts.
- Search must degrade cleanly when the Fortemi index artifact is missing,
  invalid, or fails to load.
- Multi-tenant bundles must not leak persisted search rows across tenants.
- Persisted search state must be invalidated when the tenant manifest/build
  hash changes.
- The integration must not require adopting React for the Pagenary shell.
- Performance gates must cover cold load, first query, warmed query, index
  build/rebuild time, storage footprint, and added JS/WASM weight.

## Acceptance Criteria

- A Fortemi-backed static-index adapter returns Pagenary-compatible result
  objects for all existing command-palette workflows.
- Golden query fixtures compare legacy and Fortemi-backed results across nested
  sections, groups with own content, collection posts, missing modules, and
  no-match cases.
- Browser tests cover Chromium and Firefox, including static serving, storage
  denied/private mode, and deploy upgrade with a stale persisted index.
- Documentation is updated in `apps/publisher/docs/API.md`,
  `apps/publisher/docs/ARCHITECTURE.md`, and README search descriptions.
