# Research Spike: React Integration Surface for Pagenary Publisher Output

**Date:** 2026-06-28
**Status:** Prepared, revised after product direction clarification
**Scope:** Research + SDLC planning for React developer integration with Pagenary output
**Primary Decision:** Determine how Pagenary should expose its static publisher output so React applications can embed, extend, and integrate it seamlessly, including use of upgraded Fortemi React and graph components.

## Executive Summary

The goal is not a parallel React-rendered Pagenary site. The better product direction is to keep Pagenary's static publisher output as the canonical artifact, then expose stable integration contracts that let React developers consume Pagenary content, metadata, search, and graph data inside their own React apps.

That aligns better with the current architecture. ADR-002 keeps the publisher runtime dependency-light, ADR-003 keeps output deployable as static files, and ADR-015 already positions Fortemi static-index data as the shared search/graph contract. A React integration layer can build on those contracts without making every Pagenary site ship React.

Recommended initial decision: run a standard PoC for a React integration kit that consumes an existing Pagenary build. The PoC should prove embeddable components and hooks over Pagenary's manifest, page metadata, static Fortemi index, and docs-map graph. It should not replace `apps/publisher/src/app.js` or create a second `dist` output mode.

## AIWG Routing

This spike uses the AIWG research and SDLC patterns:

- Research workflow: capture current-state evidence, package evidence, open questions, and decision-ready synthesis.
- SDLC build-PoC pattern: define the technical question, minimal scope, success/failure criteria, and findings artifact.
- Architecture evolution pattern: classify this as a component addition / integration contract, not a publisher runtime migration.
- Test strategy pattern: define contract, unit, integration, and browser validation before implementation starts.

## Technical Question

Can Pagenary expose a stable React integration surface that lets developers embed Pagenary docs, navigation, search, metadata, and Fortemi graph experiences in React applications while preserving the existing static publisher output as the source of truth?

## Product Interpretation

Developers should be able to:

1. Build or host a normal Pagenary output.
2. Import a React package, hook set, or integration adapter in their own React app.
3. Point that adapter at Pagenary static artifacts such as `manifest.js`, `search-index/manifest.json`, `search-index/part-NNNN.json`, `search-index/metadata.json`, and docs-map graph modules/artifacts.
4. Render Pagenary navigation, current page metadata, search results, related content, and graph views using React components.
5. Use upgraded Fortemi React / graph components where those components can consume the same static Fortemi contracts.

This makes React an integration surface for consuming Pagenary output, not an alternate publisher runtime.

## Decision Drivers

1. Keep Pagenary output deploy-anywhere: static files remain the canonical product artifact.
2. Avoid maintaining two full site runtimes.
3. Make integration easy for React developers who already have an app shell.
4. Preserve Fortemi contract compatibility across vanilla Pagenary, React apps, and graph tooling.
5. Minimize supply-chain expansion in the publisher package; React dependencies should live in an optional package or example app, not the default publisher runtime.
6. Provide explicit data contracts rather than relying on scraping Pagenary DOM.

## Current-State Evidence

| Area | Evidence | Implication for React integration |
| --- | --- | --- |
| Publisher runtime | `apps/publisher/src/index.html` and `apps/publisher/src/app.js` implement a static ES-module site. | Do not replace this path for the integration spike. |
| Static artifacts | `apps/publisher/scripts/build-tenants.js` emits tenant bundles, search indexes, SEO artifacts, collections, and docs-map graph modules. | React should consume these outputs through documented URLs/contracts. |
| Fortemi search | `apps/publisher/src/lib/search.js`, `scripts/lib/search-index-generator.js`, and `src/lib/fortemi-corpus.js` use the vendored Fortemi static-index contract. | React adapters should consume the same `aiwg.fortemi.index.*.v1` data. |
| Docs map graph | `apps/publisher/src/lib/docs-map.js` renders framework-free SVG graphs; `build-tenants.js` builds richer graph artifacts from tenant content. | Graph data should be exported in a framework-neutral form that React graph components can consume. |
| Existing architecture | ADR-002 rejects React as default runtime; ADR-003 requires static deployment; ADR-015 confirms static `@fortemi/core` over `@fortemi/react` for publisher search. | A React integration package avoids contradicting those ADRs. |
| Developer docs | `apps/publisher/docs/API.md` already points readers toward Fortemi React docs for hooks, graph tooling, and APIs. | The spike can formalize this into supported Pagenary integration examples. |
| Existing package shape | `@pagenary/publisher` has no React dependency and ships `src/`, `scripts/`, `site/`, examples, config, schema, README, and LICENSE. | React integration should likely be optional: separate package, example, or documented adapter layer. |

## External / Package Evidence

Package metadata checked on 2026-06-28:

| Package | Version | Description Signal | Relevance |
| --- | --- | --- | --- |
| `@fortemi/core` | `2026.6.9` | Browser-only knowledge management core with JSON parity to the Fortemi server. | Pagenary already vendors the static adapter shape; the integration should remain contract-compatible. |
| `@fortemi/graph` | `2026.6.9` | Framework-agnostic graph tooling for layout, filtering, color assignment, degree sizing, bounds/fit, neighborhood expansion, and static snapshots. | Best fit for shared graph data and non-React graph logic. |
| `@fortemi/react` | `2026.6.9` | React 19 hooks and FortemiProvider for Fortemi core, including hooks for hybrid search, concepts, jobs, embeddings, shards, and backends. | Useful optional layer for React consumers, not something the static publisher should force on every site. |
| `react` / `react-dom` | `19.2.7` | Current React line available from npm. | Any React example or optional package should pin/test against React 19.2.x. |

## Architecture Options

### Option A: Optional Pagenary React Integration Package

Create a separate package, for example `@pagenary/react`, that provides hooks and components over Pagenary static artifacts.

**Examples**

- `usePagenaryManifest(baseUrl)`
- `usePagenarySearch(baseUrl, query, options)`
- `usePagenaryPageMetadata(baseUrl, sectionId)`
- `usePagenaryGraph(baseUrl)`
- `<PagenaryNav />`
- `<PagenarySearchBox />`
- `<PagenaryRelatedPages />`
- `<PagenaryGraph />`

**Pros**

- Clean dependency boundary: React does not enter `@pagenary/publisher`.
- React developers get idiomatic hooks/components.
- Versioning can track Pagenary artifact contracts.
- Supports Fortemi React / graph components without changing static output.

**Cons**

- Adds a package maintenance surface.
- Requires clear compatibility guarantees across publisher output versions.

**Spike recommendation:** Preferred target.

### Option B: Framework-Neutral Client SDK First

Create a small framework-neutral `@pagenary/client` or exported module that fetches and normalizes Pagenary static artifacts; React examples wrap it.

**Pros**

- Useful for React, Vue, Svelte, vanilla, and server-side tools.
- Keeps core integration logic testable without React.
- Matches ADR-006's pure-module preference.

**Cons**

- React developers still need wrapper code unless also paired with `@pagenary/react`.
- Slightly more upfront design.

**Spike recommendation:** Strong complement to Option A. The PoC should separate core adapters from React wrappers even if both live in a working directory initially.

### Option C: Embedded Web Components

Expose Pagenary docs/search/graph widgets as custom elements that React apps can embed.

**Pros**

- Framework-agnostic embedding.
- React developers can drop in tags with minimal code.

**Cons**

- Web component + React event/property interop is still awkward in many apps.
- Less idiomatic for developers wanting hooks and Fortemi React components.
- May duplicate component patterns already available in Fortemi React.

**Spike recommendation:** Defer. Consider later for CMS/no-code embedding.

### Option D: Parallel React Publisher Output

Generate a separate React-rendered version of the whole Pagenary site.

**Pros**

- Could provide full React component ownership.

**Cons**

- Maintains two site runtimes.
- Does not match the clarified product need.
- Creates build/dependency complexity without directly improving React app embedding.

**Spike recommendation:** Reject for this initiative.

## Proposed Integration Contract

The React integration should consume explicit static artifacts. Some already exist; others may need small contract improvements.

| Contract | Existing / Proposed | Consumer Use |
| --- | --- | --- |
| `manifest.js` / manifest JSON projection | Existing JS module; proposed JSON export if needed. | Navigation tree, route lookup, titles, summaries, modules. |
| `search-index/manifest.json` | Existing Fortemi chunk manifest. | Lazy chunk loading and query setup. |
| `search-index/part-NNNN.json` | Existing Fortemi chunk parts. | Search result retrieval. |
| `search-index/metadata.json` | Existing compact Pagenary/Fortemi metadata export. | Related pages, concepts, tags, provenance, page metadata panels. |
| Docs-map graph artifact | Existing generated module; proposed JSON artifact such as `graph.json`. | Fortemi graph components and custom React graph views. |
| Static page snapshots under `pages/` | Existing SEO output. | Preview, embedding fallback, crawlers, external app deep links. |
| `sitemap.xml`, `robots.txt`, `llms.txt`, JSON-LD | Existing SEO artifacts. | Discovery and external indexing. |

Key contract improvement to research: emit framework-neutral JSON artifacts for manifest and graph data, so React consumers do not need dynamic `import()` of Pagenary-generated JS modules across origins.

## PoC Scope

**Scope Level:** Standard

**Timebox:** 1-2 engineering days after this revised spike is accepted.

**In Scope**

- Build a small React example app or working package that consumes an existing Pagenary tenant output.
- Implement framework-neutral artifact loaders:
  - `loadPagenaryManifest(baseUrl)`
  - `loadPagenarySearchController(baseUrl)`
  - `loadPagenaryMetadata(baseUrl)`
  - `loadPagenaryGraph(baseUrl)`
- Implement React hooks over those loaders.
- Render at least:
  - navigation tree
  - search box/results
  - current page metadata / related pages
  - Fortemi graph view using `@fortemi/graph` and/or `@fortemi/react` where practical
- Identify missing artifact contracts needed for clean embedding.
- Keep `@pagenary/publisher` default runtime unchanged.

**Out of Scope**

- Replacing Pagenary's vanilla site runtime.
- Building a second React `dist` output for every tenant.
- SSR, RSC, Next.js, Remix, Astro, or React Router.
- Rewriting content ingestion, SEO, Fortemi index generation, or docs-map generation.
- Forcing React dependencies into the default publisher package.

## Proposed PoC File Layout

```text
.aiwg/working/react-integration-spike/
├── README.md
├── findings.md
└── contract-notes.md

apps/publisher/examples/react-integration/
├── package.json
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── pagenary-client.js
│   ├── hooks.js
│   └── components/
│       ├── PagenaryNav.jsx
│       ├── PagenarySearch.jsx
│       ├── PagenaryMetadata.jsx
│       └── PagenaryGraph.jsx
└── tests/
    ├── pagenary-client.test.js
    └── hooks.test.jsx
```

This layout keeps the spike disposable while making the future package shape visible.

## Technical Approach

1. Generate or use an existing tenant output with Fortemi search and docs-map artifacts.
2. Audit whether manifest and graph data are cleanly fetchable as JSON. If not, document the minimal publisher change required.
3. Build a pure client adapter over static URLs. The adapter should not know React exists.
4. Wrap the adapter with React hooks and simple components.
5. Use `@fortemi/graph` for graph layout/data operations when it accepts the Pagenary graph shape directly or through a small mapper.
6. Use `@fortemi/react` only where it adds clear value over Pagenary's static index controller; avoid bringing in persistence/backends for this spike.
7. Document whether upgraded Fortemi React graph components expect:
   - Fortemi core controller
   - community graph JSON
   - metadata export
   - live backend/provider state
8. If a mismatch exists, define the adapter boundary rather than changing Pagenary output prematurely.

## Success Criteria

The PoC is successful only if all of the following are true:

- A React app can consume a built Pagenary tenant from static URLs.
- Navigation renders from Pagenary artifacts without scraping DOM.
- Search returns ranked Fortemi-backed results from the static chunked index.
- Metadata/related-content UI renders from `metadata.json` or a documented equivalent.
- A graph component renders from Pagenary/Fortemi graph data.
- Missing publisher artifacts, if any, are documented as narrow contract additions.
- React and Fortemi React dependencies stay out of the default publisher runtime.
- Unit tests cover the framework-neutral client adapter.
- React component/hook tests or browser smoke checks prove the integration path.
- The spike produces a clear GO / NO-GO / ALTERNATIVE decision for `@pagenary/react` and/or `@pagenary/client`.

## Failure Criteria

The PoC should be stopped or marked failed if any of these occur:

- React integration requires modifying generated Pagenary HTML by hand.
- Search or graph integration requires a live Fortemi backend for baseline static docs.
- The adapter must duplicate Pagenary content ingestion or search-index generation.
- Fortemi React components cannot consume static artifacts without a large compatibility layer.
- CORS/base-path constraints make static artifact consumption impractical without documented hosting guidance.
- The integration cannot be tested independently of the full Pagenary runtime.

## Test and Validation Plan

| Level | Command / Evidence | Acceptance |
| --- | --- | --- |
| Contract audit | Inspect generated tenant output for manifest, search, metadata, and graph artifacts. | Required artifacts are fetchable or missing artifacts are precisely specified. |
| Unit | Tests for pure loaders and artifact mappers. | All pass; no React dependency in pure adapter tests. |
| React | Hook/component tests for loading, pending, success, and error states. | Components render expected nav/search/metadata/graph states. |
| Static integration | Serve a Pagenary `dist/<tenant>` and React example app locally. | React app consumes static artifacts through configured base URL. |
| Browser smoke | Navigate, search, select result, inspect related metadata, render graph. | Critical integration flow works in browser. |
| Package boundary | Inspect package manifests. | `@pagenary/publisher` does not gain React dependency during spike. |

## Architecture Impact

| Component | Impact | Migration Required | Notes |
| --- | --- | --- | --- |
| `apps/publisher/scripts/build-tenants.js` | Low/Medium | Possibly emit extra JSON artifacts | Manifest/graph JSON may be needed for clean cross-origin consumption. |
| `apps/publisher/src/lib/search.js` | Low | Reuse concepts | Existing search adapter informs the external client adapter. |
| `apps/publisher/src/lib/fortemi-corpus.js` | Low | Reuse contract | Static index and metadata contracts remain central. |
| `apps/publisher/src/lib/docs-map.js` | Medium | Extract/share graph contract | Existing renderer is vanilla; React should consume graph data, not renderer internals. |
| `apps/publisher/package.json` | Low | No React dependency | Publisher package should remain unchanged unless adding artifact emission. |
| New optional package/example | High | New component | Candidate future packages: `@pagenary/client`, `@pagenary/react`. |
| ADR-002 | Low | No supersession needed | Optional integration package does not violate zero-runtime publisher posture. |
| ADR-015 | Medium | Clarify extension | Add note if Fortemi React/graph becomes an officially supported consumer tier. |

## Risk Register Additions

| ID | Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- | --- |
| R6 | Artifact contracts are implicit and hard for external React apps to consume. | Medium | Medium | Add explicit JSON projections for manifest and graph if needed. |
| R7 | Fortemi React expects live/provider-backed state while Pagenary has static artifacts. | Medium | Medium | Build adapter boundary; use `@fortemi/graph` for static graph operations where more appropriate. |
| R8 | Optional React package creates version skew with publisher output contracts. | Medium | Medium | Version artifact schemas; add compatibility tests against fixture outputs. |
| R9 | CORS/base-path issues block embedding from separate React app origins. | Medium | Medium | Document hosting requirements; test same-origin and cross-origin static serving. |
| R10 | React examples imply the publisher itself now requires React. | Low | Medium | Keep docs explicit: React integration is optional and consumer-side. |
| R11 | Graph rendering accessibility regresses when moving from vanilla docs-map to React/Fortemi components. | Medium | Medium | Include keyboard, reduced-motion, labels, and focus checks in browser smoke. |

## Traceability

| Requirement / NFR | Existing Source | Spike Evidence Needed |
| --- | --- | --- |
| UC-001 View Documentation Section | `.aiwg/requirements/traceability-matrix.md` | React app can link to or embed current Pagenary page data. |
| UC-002 Navigate Documentation | `.aiwg/requirements/traceability-matrix.md` | React nav renders from Pagenary manifest/JSON artifact. |
| UC-003 Search Documentation | `.aiwg/requirements/traceability-matrix.md` | React search uses static Fortemi index artifacts. |
| UC-004 Export Documentation | `.aiwg/requirements/traceability-matrix.md` | Integration documents whether export is linked, embedded, or out of scope for consumer app. |
| NFR-P1 Page Load <2s on 3G | `.aiwg/requirements/traceability-matrix.md` | Optional React package does not bloat default publisher output. |
| NFR-P3 Search <100ms | `.aiwg/requirements/traceability-matrix.md` | React search path uses lazy chunks and records query latency in the example. |
| NFR-R1 Availability | `.aiwg/requirements/traceability-matrix.md` | Integration consumes static artifacts only. |
| NFR-R2 Tenant Isolation | `.aiwg/requirements/traceability-matrix.md` | Base URL selection isolates tenant artifacts. |

## Deliverables

1. `.aiwg/working/react-integration-spike/README.md` with question, scope, setup, findings, and recommendation.
2. React integration example or prototype package under `apps/publisher/examples/react-integration/`.
3. Pure Pagenary artifact client adapter with tests.
4. React hooks/components over the adapter.
5. Fortemi React / graph compatibility notes.
6. Artifact contract gap list for publisher changes, if needed.
7. Decision: GO / NO-GO / ALTERNATIVE for `@pagenary/client`, `@pagenary/react`, or docs-only examples.

## Decision Matrix for PoC Result

| Outcome | Decision | Next Step |
| --- | --- | --- |
| React app consumes Pagenary static artifacts cleanly and Fortemi graph integration works with a small adapter. | GO for optional integration package. | Draft package plan and artifact schema compatibility tests. |
| Pure client adapter works, React wrappers are thin, Fortemi React is not needed. | ALTERNATIVE. | Ship `@pagenary/client` first; keep React docs/examples separate. |
| Fortemi graph works but Fortemi React hooks expect backend/provider features outside static docs. | ALTERNATIVE. | Use `@fortemi/graph` for static graph UI; document limits for `@fortemi/react`. |
| Static artifacts are not cleanly consumable without publisher changes. | PARTIAL. | Add minimal manifest/graph JSON artifact tasks before React package work. |
| Integration requires replacing publisher runtime or generating a second site. | NO-GO for this direction. | Reassess product requirement before any React runtime migration. |

## Recommended Next Actions

1. Open a PoC issue for “React integration over Pagenary static artifacts,” not “React publisher output.”
2. Audit a built tenant output for fetchable manifest, search, metadata, and graph JSON.
3. Add or specify missing JSON artifacts for manifest and docs-map graph.
4. Prototype a pure artifact client first.
5. Wrap the client in React hooks/components.
6. Validate upgraded Fortemi React / graph component compatibility with static Pagenary graph and metadata.
7. Decide whether the durable artifact should be `@pagenary/client`, `@pagenary/react`, docs/examples, or a combination.

