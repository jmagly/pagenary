# Fortémi 2026.7.11 Integration Plan — Pagenary

**Date**: 2026-07-13
**Updated**: 2026-07-21
**Upstream**: fortemi-react v2026.7.0 → v2026.7.11 (reviewed npm/Gitea baseline)
**Consumers audited**: `apps/react` (`@pagenary/react`, untracked), `apps/publisher` (docs-map, vendored aiwg-index), hybrid-react publishing plan (#128–#131)

## 2026-07-21 update — v2026.7.11 baseline and verified package boundary

- `@fortemi/graph` and `@fortemi/react` are locked at 2026.7.11. The graph
  root no longer imports core; `GraphController` is isolated at
  `@fortemi/graph/controller`, so Pagenary can remove its PGlite external.
- Renderer callbacks must be referentially stable because Sigma/3D map their
  RenderGraph with `labelFor` as a memo dependency. Direct package tests pin
  that host contract.
- The published `@fortemi/core@2026.7.11/dist/aiwg-index.js` is **not** a
  self-contained browser artifact: it imports Ajv, fflate, and uuid. The exact
  devDependency can support Node build-time shard work, but #134 cannot replace
  the Tier-0 vendored browser file until upstream restores a dependency-free
  static-index build or Pagenary explicitly changes its payload architecture.
- The v2 AIWG bridge is viable as a Node build step and produces deterministic
  schema 1.2.0 core-v1 archives. See the #136 spike report and ADR-018.

## 2026-07-17 update — v2026.7.8 superseded the v2026.7.4 target

The graph/React work from v2026.7.4 has already landed in Pagenary through
#132, #133, and #135. The remaining open Fortémi work should now target
`@fortemi/core@2026.7.8`, not `2026.7.4`.

New upstream deltas since this plan was first written:

- `@fortemi/core@2026.7.6` added `aiwgFortemiIndexToKnowledgeShard` and
  `aiwgFortemiIndexFromKnowledgeShard` on `@fortemi/core/aiwg-index`, allowing
  an AIWG v2 export to round-trip through the standard Knowledge Shard format.
- `@fortemi/core@2026.7.7` restored legacy Knowledge Shard compatibility and
  moved `@bytecask/core` resolution to public npmjs.
- `@fortemi/core@2026.7.8` added a writable canonical record tier without
  PGlite: `createRecordBackend`, `exportShardFromRecords`,
  `importShardToRecords`, `projectNotes`, and `projectRecords`.

Pagenary implications:

- #134 remains the Tier-0 re-vendor tracker. The 2026.7.11 package inspection
  above supersedes this section's earlier self-containment assumption.
- #136 should evaluate the new AIWG-index-to-shard helpers before building a
  PGlite-backed export prototype. They may make a static docs-site Knowledge
  Shard export much smaller and simpler.
- #137 should no longer frame the next runtime tier as only "PGlite tenant".
  Fortémi now offers a lighter writable record tier with DB-free shard
  import/export, while PGlite becomes an optional semantic/FTS projection.
- #149 tracks the new DB-free record-tier posture.

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

### Pagenary current state

| Earlier Pagenary gap | Current state |
|---|---|
| `fortemi-core-stub.js` + Vite alias to keep PGlite out | Closed by #132: `@pagenary/react` imports `GraphView` from `@fortemi/react/graph`. |
| Hand-rolled `GraphCanvas` SVG renderer in `docs-map/index.jsx` | Closed by #132: React docs-map uses upstream `GraphView`; Tier-0 SVG remains publisher-owned. |
| Layout recomputed on every page load | Closed by #133: Pagenary emits baked render snapshots. |
| Interactive 2D/3D docs-map tiers missing | Closed by #135: tenant config supports `fortemi-react-2d`, `fortemi-react-3d`, palettes, and dragging. |
| Vendored aiwg-index at **2026.6.8** | Still open in #134; 2026.7.11 Node devDependency is aligned, but the browser file is blocked on a self-contained upstream build. |
| Tier-2 framed only as "PGlite tenant" | Superseded by v2026.7.8 canonical record tier; file/design a DB-free record-tier posture before PGlite projection. |

---

## 2. Integration plan

### Phase A — dependency bump + workaround retirement (`apps/react`)

1. **Lock `@fortemi/graph` / `@fortemi/react` to `2026.7.11`** and refresh the lockfile under the documented first-party one-time age override; never weaken `.npmrc`.
2. **Replace the core stub** — delete `fortemi-core-stub.js` and the `resolve.alias` in `apps/react/src/index.js`; import `GraphView` from `@fortemi/react/graph`. Keep the WASM-absence check (`find dist/<tenant>/assets/react -iname '*.wasm'`) in CI as the regression guard.
3. **Replace `GraphCanvas` with `GraphView`** in `src/docs-map/index.jsx`. Direct mappings: filters → `GraphControlFilters` (gains `minDegree` for free), hash navigation → `onNavigate(id)` + existing `routeFromNode`, labels → `labelFor`, selection → `selectedNodeId`/`onSelectNode`. Keep `neighborhoodSubgraph`/`filterCommunityGraph` usage as-is.
4. Confirm optional-peer behavior under npm (peers for sigma/three are `optional: true`; npm won't install or warn — nothing to do unless a tenant opts into 2D/3D tiers).

### Phase B — data changes

1. **Baked docs-map snapshots** (new build artifact):
   - In `build-tenants.js`'s docs-map step: after producing the CommunityGraph, run `bakeRenderGraph(graph, { layout, labelFor, palette })` + `stringifyRenderGraph` and emit `dist/<tenant>/docs-map/render-graph.json` alongside `docs-map-data.js`.
   - Deterministic sorted output → stable diffs, cacheable, CI-verifiable.
   - React docs-map passes it as `snapshot` (Sigma warm-start) or as `positions` to `mapCommunityGraph`; `loadRenderSnapshot` returns `null` on any problem so live layout remains the fallback. Tier-0 SVG map can also read baked positions later to skip its own layout pass.
2. **Re-vendor the aiwg-index after a self-contained post-2026.7.11 build exists** (security-motivated regardless of features):
   - Gains: SEC1 prototype-pollution completion, SEC2 SSRF scheme allowlist, SEC5 DoS cap, privacy-fails-closed, total validators, v2 exports (`source.graph`, `compatibility`), `searchProfile: 'aiwg-discovery'`, searchProfile-keyed match cache.
   - **Decision needed**: upstream validation now routes through Ajv + a pinned JSON schema on the separate `./aiwg-index-schema` subpath. Keep the publisher runtime vendoring to the self-contained `dist/aiwg-index.js` unless Pagenary explicitly decides to vendor the schema subpath and its dependencies.
   - The exact Node build-time devDep is now `@fortemi/core@2026.7.11`; refresh the vendored `.d.ts` only when the browser JS can move atomically.
   - Validator contract change to absorb: `validate*` no longer throws on hostile input, and `title`/`text` are no longer hard-required record fields (fallback to `search.title/name`, `search.body/summary`) — check `search-index-generator.js` assertions still align.
3. **Search-index schema**: consider emitting v2 chunk manifests (`source_export_schema_version`) so the docs-map graph can eventually come straight from the search index (`source.graph`), collapsing two data paths into one.

### Phase C — publishing-plan updates (tenants.schema.json + docs)

1. Extend `docsMap` tenant config:
   - `renderer` enum: add `fortemi-react-2d` (Sigma) and `fortemi-react-3d` alongside `svg | cytoscape | fortemi-react` (`auto` resolves as today).
   - `docsMap.palette`: `community | greyscale | [custom hexes]` → passed to `mapCommunityGraph`.
   - `docsMap.snapshot`: boolean (default true when docs-map enabled) → emit/consume `render-graph.json`.
   - `docsMap.draggable`: boolean (default false) → `draggableNodes` pass-through.
2. Tenants opting into 2D/3D must install the optional peers (`sigma graphology graphology-layout-forceatlas2` / `react-force-graph-3d three`); document in TENANT-CONFIG.md; build fails with an actionable message if the subpath import fails.
3. **Runtime roadmap refresh**: DEPENDENCY-POSTURE.md should treat the new
   canonical record tier as the next runtime step, with PGlite as a later
   projection tier for FTS/semantic work.

---

## 3. Proposed new features (enabled by 2026.7.x)

Ranked by value/effort:

1. **Vendored index refresh + discovery search** — #134; switch the command
   palette/search to `searchProfile: 'aiwg-discovery'` for typo-tolerant,
   weighted ranking. Includes security fixes, v2 index compatibility, and the
   AIWG-index-to-shard helper.
2. **Knowledge Shard export of a docsite (exploration)** — #136; publish each
   tenant additionally as a Fortémi Knowledge Shard (`.tar.gz`). Start by
   testing `aiwgFortemiIndexToKnowledgeShard` from `@fortemi/core/aiwg-index`;
   only fall back to `ArchiveManager`/record construction if the static-index
   route cannot carry Pagenary's docsite needs.
3. **Record-tier living-docs tenant (roadmap)** — #149; in-browser
   Fortémi canonical records without PGlite for tenants wanting writable
   notes/shard import-export but not semantic search. PGlite becomes an optional
   projection for FTS/semantic/embedding workloads, rather than the first
   runtime escalation after React.
4. **Curated layouts (author-pinned maps)** — future polish; dev-mode
   `draggableNodes:true`; author drags/pins key pages; pins feed
   `bakeRenderGraph({ layout: { pinned, initialPositions } })`; the curated
   snapshot is committed.

---

## 4. Risks / sequencing notes

- **Release-age gate**: 7-day `.npmrc` gate blocks the 2026.7.8 bump from the public registry until ~2026-07-24; first-party Gitea override is the documented escape hatch if #134 needs to land earlier.
- **Vendoring vs Ajv**: the published 2026.7.11 `dist/aiwg-index.js` imports Ajv,
  fflate, and uuid. Do not copy it into Tier 0 under the old verbatim policy.
- **Version skew until B.2 lands**: React/graph and the build-time core package
  are 2026.7.11 while the browser-vendored index stays 2026.6.8. The surfaces
  are isolated, but Tier-0 validators remain v1-only until #134 unblocks.
- **Runtime-tier framing changed**: PGlite is now optional even for writable Fortémi flows. Pagenary should decide between static shard, canonical record tier, and PGlite projection explicitly instead of treating Tier 2 as synonymous with PGlite.
- **`apps/react` is still untracked** — commit the workspace before layering these changes so diffs stay reviewable.

## References

- fortemi-react CHANGELOG v2026.7.4 through v2026.7.8; PRs #245, #259–#264, #271, #282/ADR-012, #284–#302, #310, #323, #322, #344, #345
- Pagenary: `docs/REACT-SPA-PUBLISHING.md` (#128–#131), `docs/VENDORING.md`, `docs/SUPPLY-CHAIN.md`, `docs/DEPENDENCY-POSTURE.md`, `apps/react/src/*`, `apps/publisher/src/lib/docs-map.js`, `apps/publisher/src/vendor/fortemi-aiwg-index.js`
