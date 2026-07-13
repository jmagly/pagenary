# Fortémi 2026.7.4 Integration Plan — Pagenary

**Date**: 2026-07-13
**Upstream**: fortemi-react v2026.7.0 → v2026.7.4 (released 2026-07-12)
**Consumers audited**: `apps/react` (`@pagenary/react`, untracked), `apps/publisher` (docs-map, vendored aiwg-index), hybrid-react publishing plan (#128–#131)

---

## 1. What changed upstream (audit summary)

### `@fortemi/graph` + `@fortemi/react` — purely additive, safe under `^2026.7.0`

| Capability | Upstream | Pagenary relevance |
|---|---|---|
| PGlite-free `@fortemi/react/graph` subpath (#261) | `GraphView` only, zero core/PGlite in module graph | **Retires** `fortemi-core-stub.js` + Vite alias workaround |
| JS-only SVG renderer `renderCommunityGraph` (#259) | Non-React, DOM+SVG, deterministic, jsdom-safe; matches GraphView visually | **Retires** the hand-rolled `GraphCanvas` in `docs-map/index.jsx`; candidate for the Tier-0 publisher map if `@fortemi/graph` is ever vendored |
| Render-prep pipeline (#264): `RenderGraph`, `mapCommunityGraph`, `loadRenderSnapshot`, `bakeRenderGraph`, `stringifyRenderGraph` | Pure CommunityGraph→render mapping; build-time position baking; deterministic sorted JSON; loader never throws (null → live-build fallback) | Enables **baked docs-map snapshots** as a build artifact |
| Sigma 2D explorer `@fortemi/react/graph-2d` (#263) | Live FA2 settling, hover dimming, camera focus, ⌘-click re-anchor; `sigma`+`graphology` optional peers, lazy-loaded | New opt-in interactive docs-map tier |
| 3D view `@fortemi/react/graph-3d` (#262) | `react-force-graph-3d`+`three` optional peers, lazy-loaded; ignores baked 2D positions | New opt-in tier for large corpora |
| Opt-in dragging + pins (#245) | `draggableNodes` on GraphView; `layoutCommunityGraph` gains `pinned`/`initialPositions` (`PositionMap`); unpinned output bit-identical | Author-time layout curation → committed snapshots |
| Renderer control contract (#260) | `GraphControlFilters` (adds `minDegree`), `applyControlFilters`, `communityLegend`; shared across all tiers | One filter model across Tier-0 SVG and React tiers |
| Palettes | `'community'` \| `'greyscale'` (`GREYSCALE_COMMUNITY_RAMP`) \| custom array | Per-tenant brand palettes for the docs map |

Only soft caveat: `GraphViewFilters` is now an alias of `GraphControlFilters` — a filter object carrying `minDegree` is now honored (previously ignored). No renames/removals.

### `@fortemi/core` — additive API, several behavior changes

- **Knowledge Shard blob sidecar (#271)**: `exportShard({ includeBlobs: true, blobStore })` writes content-addressed `blobs/<blake3-hex>` tar entries; `importShard({ blobStore })` verifies + rehydrates post-commit. `BlobStore` interface (`write/read/remove/exists`) with OPFS/IDB/Memory impls. ADR-012 bytecask substrate is **design-only** (migrations stop at 0016).
- **Attachment hashing switched SHA-256 → BLAKE3** (`computeBlobHash` → `blake3:<hex>`, server-parity).
- **PGlite optional (#261)**: moved to `optionalDependencies`, dynamic `import()` on first open; `sideEffects: false`. Consumers booting a DB must now depend on `@electric-sql/pglite` explicitly. Pluggable `StorageBackendFactory` seam documented (custom backends must speak PG-dialect SQL).
- **aiwg-index hardening + v2**: validators total (`{valid:false}` instead of throw; `title`/`text` no longer hard-required); match cache keys on `searchProfile` (#290); privacy **fails closed** (SEC6); prototype-pollution fixes (SEC1); fetch-loader scheme allowlist http/https/blob/data + same-origin (SEC2); duplicate-scan DoS cap (SEC5); chunked v2 exports with `source.graph` load correctly (#284); `'aiwg-discovery'` searchProfile (stopwords, Damerau-Levenshtein ≤1, weighted scoring, relaxed-overlap retry) aligned with server.
- **New hard dep: `ajv`** — schema-authority validation against a pinned JSON schema (provenance receipt, #293). *This is the one change that complicates pagenary's single-file vendoring* (see §3.2).
- Attachment `extracted_text` now feeds FTS/embeddings; attach/detach re-embeds; migrations 0010–0016 auto-run on open.

### Pagenary current state (gaps this release closes)

| Pagenary workaround today | Upstream answer in 2026.7.4 |
|---|---|
| `fortemi-core-stub.js` + Vite alias to keep PGlite out | `@fortemi/react/graph` subpath (PGlite-free by construction) |
| Hand-rolled `GraphCanvas` SVG renderer in `docs-map/index.jsx` | `GraphView` (via `/graph`) or `renderCommunityGraph` (#259 — the very issue pagenary filed) |
| Layout recomputed on every page load | `bakeRenderGraph` at build time + `loadRenderSnapshot` warm start |
| Vendored aiwg-index at **2026.6.8** (two releases behind; pre-dates all SEC1–SEC7 fixes and v2 schema) | Re-vendor from 2026.7.4 (with the Ajv caveat, §3.2) |
| `@fortemi/react` installed in `@pagenary/react` but **never imported** | Either use `/graph` subpath or drop the dep |
| Tier-2 (full PGlite runtime) "blocked on fortemi-react #261" | #261 shipped — Tier-2 is unblocked |

---

## 2. Integration plan

### Phase A — dependency bump + workaround retirement (`apps/react`)

1. **Bump `@fortemi/graph` / `@fortemi/react` to `^2026.7.4`** and refresh the lockfile (currently resolved at 2026.7.0).
   ⚠️ **Release-age gate**: `.npmrc min-release-age=7` — v2026.7.4 published 2026-07-12, so the public-registry path is gated until ~2026-07-19. Options: wait, or use the documented first-party Gitea one-time lock-only override (SUPPLY-CHAIN.md allows this for `Fortemi/fortemi-react`).
2. **Replace the core stub** — delete `fortemi-core-stub.js` and the `resolve.alias` in `apps/react/src/index.js`; import `GraphView` from `@fortemi/react/graph`. Keep the WASM-absence check (`find dist/<tenant>/assets/react -iname '*.wasm'`) in CI as the regression guard.
3. **Replace `GraphCanvas` with `GraphView`** in `src/docs-map/index.jsx`. Direct mappings: filters → `GraphControlFilters` (gains `minDegree` for free), hash navigation → `onNavigate(id)` + existing `routeFromNode`, labels → `labelFor`, selection → `selectedNodeId`/`onSelectNode`. Keep `neighborhoodSubgraph`/`filterCommunityGraph` usage as-is.
4. Confirm optional-peer behavior under npm (peers for sigma/three are `optional: true`; npm won't install or warn — nothing to do unless a tenant opts into 2D/3D tiers).

### Phase B — data changes

1. **Baked docs-map snapshots** (new build artifact):
   - In `build-tenants.js`'s docs-map step: after producing the CommunityGraph, run `bakeRenderGraph(graph, { layout, labelFor, palette })` + `stringifyRenderGraph` and emit `dist/<tenant>/docs-map/render-graph.json` alongside `docs-map-data.js`.
   - Deterministic sorted output → stable diffs, cacheable, CI-verifiable.
   - React docs-map passes it as `snapshot` (Sigma warm-start) or as `positions` to `mapCommunityGraph`; `loadRenderSnapshot` returns `null` on any problem so live layout remains the fallback. Tier-0 SVG map can also read baked positions later to skip its own layout pass.
2. **Re-vendor the aiwg-index from 2026.7.4** (security-motivated regardless of features):
   - Gains: SEC1 prototype-pollution completion, SEC2 SSRF scheme allowlist, SEC5 DoS cap, privacy-fails-closed, total validators, v2 exports (`source.graph`, `compatibility`), `searchProfile: 'aiwg-discovery'`, searchProfile-keyed match cache.
   - **Decision needed**: upstream validation now routes through Ajv + a pinned JSON schema; a single-file vendored dist can't carry that layer. Either (a) accept the published dist as-is if it inlines/omits the schema layer — verify what `dist/aiwg-index.js` actually ships before committing, or (b) vendor the schema JSON alongside and keep hand-written checks as the fallback path. Follow `docs/VENDORING.md` (SHA-256, banner, tests, CHANGELOG) either way.
   - Update the exact devDep pin `@fortemi/core` `2026.6.8` → `2026.7.4`; refresh the `.d.ts`.
   - Validator contract change to absorb: `validate*` no longer throws on hostile input, and `title`/`text` are no longer hard-required record fields (fallback to `search.title/name`, `search.body/summary`) — check `search-index-generator.js` assertions still align.
3. **Search-index schema**: consider emitting v2 chunk manifests (`source_export_schema_version`) so the docs-map graph can eventually come straight from the search index (`source.graph`), collapsing two data paths into one.

### Phase C — publishing-plan updates (tenants.schema.json + docs)

1. Extend `docsMap` tenant config:
   - `renderer` enum: add `fortemi-react-2d` (Sigma) and `fortemi-react-3d` alongside `svg | cytoscape | fortemi-react` (`auto` resolves as today).
   - `docsMap.palette`: `community | greyscale | [custom hexes]` → passed to `mapCommunityGraph`.
   - `docsMap.snapshot`: boolean (default true when docs-map enabled) → emit/consume `render-graph.json`.
   - `docsMap.draggable`: boolean (default false) → `draggableNodes` pass-through.
2. Tenants opting into 2D/3D must install the optional peers (`sigma graphology graphology-layout-forceatlas2` / `react-force-graph-3d three`); document in TENANT-CONFIG.md; build fails with an actionable message if the subpath import fails.
3. **Tier-2 roadmap unblock**: DEPENDENCY-POSTURE.md's "Tier 2 adds `@fortemi/core` + PGlite (blocked on #261)" can flip to "unblocked": PGlite is now an explicit opt-in dep (`@electric-sql/pglite ^0.4.1` in the tenant/adapter), lazy-loaded, and `ArchiveManager` accepts a custom `StorageBackendFactory`.

---

## 3. Proposed new features (enabled by 2026.7.4)

Ranked by value/effort:

1. **Instant docs map (baked snapshots)** — Phase B.1. Zero layout cost at page load, deterministic artifact, works across all renderer tiers. *Low effort, high polish payoff.*
2. **Upstream renderer adoption** — Phase A.2/A.3. Deletes ~2 workaround files and a bespoke SVG renderer; picks up zoom/pan/keyboard/a11y and the shared filter contract for free. *Low effort, removes standing maintenance risk.*
3. **Interactive docs-map tiers** — opt-in Sigma 2D explorer for medium/large doc sets (hover neighborhood dimming, camera focus, re-anchor) and 3D for showcase tenants. Lazy-loaded; static tenants pay nothing. *Medium effort; strong demo/differentiator for the hybrid mode.*
4. **Curated layouts (author-pinned maps)** — dev-mode `draggableNodes:true`; author drags/pins key pages; pins feed `bakeRenderGraph({ layout: { pinned, initialPositions } })`; the curated snapshot is committed. Turns the docs map into an editorial artifact. *Medium effort.*
5. **Vendored index refresh + discovery search** — Phase B.2; switch the command palette / search to `searchProfile: 'aiwg-discovery'` for typo-tolerant, weighted ranking. *Low-medium effort; includes security fixes so it should be scheduled regardless.*
6. **Brand palettes for the map** — `docsMap.palette: greyscale` for monochrome brands, custom arrays for tenant brand systems. *Trivial once A.3 lands.*
7. **Knowledge Shard export of a docsite (exploration)** — publish each tenant additionally as a Fortémi Knowledge Shard (`.tar.gz`): pages as notes, docs-map graph as `graph_edges`/`communities`, images/downloads as BLAKE3 blob sidecars. Any Fortémi app could then import a published docsite as a knowledge base. Feasible at build time via `ArchiveManager` with the memory backend + `MemoryBlobStore` in the Node ≥20 adapter context. *Higher effort; distinctive "docs as portable knowledge" product story — spike first.*
8. **Tier-2 living-docs tenant (roadmap)** — in-browser Fortémi database (PGlite opt-in dep) for tenants wanting local semantic search/embeddings over their docs. Now technically unblocked; sequence after 1–5.

---

## 4. Risks / sequencing notes

- **Release-age gate**: 7-day `.npmrc` gate blocks the 2026.7.4 bump from the public registry until ~2026-07-19; first-party Gitea override is the documented escape hatch.
- **Vendoring vs Ajv**: inspect the published `dist/aiwg-index.js` before re-vendoring — if it hard-imports `ajv`, the no-bundler vendor path needs a strategy (bundle, stub, or stay on hand-written validators).
- **Version skew until B.2 lands**: `@pagenary/react` at 2026.7.4 while the vendored index stays 2026.6.8 is tolerable (different surfaces) but the v1-only vendored validators will reject v2 exports.
- **Core behavior changes only bite Tier-2** (BLAKE3 attachment hashes, auto-migrations 0010–0016, explicit PGlite dep) — none affect today's Tier-0/Tier-1 paths.
- **`apps/react` is still untracked** — commit the workspace before layering these changes so diffs stay reviewable.

## References

- fortemi-react CHANGELOG v2026.7.4; PRs #245, #259–#264, #271, #282/ADR-012, #284–#302, #310
- Pagenary: `docs/REACT-SPA-PUBLISHING.md` (#128–#131), `docs/VENDORING.md`, `docs/SUPPLY-CHAIN.md`, `docs/DEPENDENCY-POSTURE.md`, `apps/react/src/*`, `apps/publisher/src/lib/docs-map.js`, `apps/publisher/src/vendor/fortemi-aiwg-index.js`
