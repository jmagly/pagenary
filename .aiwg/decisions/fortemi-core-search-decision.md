# Decision Matrix: Fortemi Core Search Integration

Decision ID: DEC-2026-06-14-fortemi-core-search
Date: 2026-06-14
Status: Proposed

## Context

Pagenary needs to replace its bespoke substring search with Fortemi search,
lookup, and indexing capabilities while preserving the static-site deployment
model and vanilla browser shell.

The relevant Fortemi package is the published npm package `@fortemi/core`.
`@fortemi/react` is useful as a reference implementation, but should not be a
Pagenary dependency in the first integration phase.

## Options

### Option A: Keep Bespoke Search

Retain `apps/publisher/src/lib/search.js` as-is.

Pros: no runtime or bundle risk, proven behavior, zero dependency impact.
Cons: no ranking, stemming, snippets, facets, semantic search path, or shared
Fortemi capability reuse.

### Option B: Adopt `@fortemi/react`

Introduce React 19 and `FortemiProvider` into the Pagenary shell.

Pros: quickest path to Fortemi hooks and existing UI patterns.
Cons: conflicts with Pagenary's vanilla static SPA, introduces React and a
larger bundling/runtime shift, and changes more than search.

### Option C: Use Published `@fortemi/core` Static Index Helpers Behind a Pagenary Adapter

Generate an `aiwg.fortemi.index.export.v1` artifact at build time, query it via
`queryAiwgFortemiIndex`, and translate Fortemi records back into Pagenary
section results.

Pros: uses Fortemi search engine without React, preserves Pagenary UI and
static shell, creates a clean boundary for staged rollout, avoids PGlite/WASM
in phase one, and keeps a future PGlite/semantic path open.
Cons: requires adapting Pagenary pages to the current `aiwg.artifact` record
shape and accepts the static helper's current substring semantics.

### Option D: PGlite SearchRepository Integration

Seed Fortemi notes into PGlite and query via `SearchRepository`.

Pros: richer ranking, snippets, filters/facets, phrase search, and a direct
path to semantic/hybrid search.
Cons: adds PGlite/WASM, browser storage, migration, stale cache, and static
hosting header risks before the static index value is proven.

## Evaluation Matrix

| Criterion | Weight | A: Keep Bespoke | B: React | C: Static Core Adapter | D: PGlite |
|---|---:|---:|---:|---:|---:|
| Fortemi capability adoption | 25% | 1 (0.25) | 5 (1.25) | 4 (1.00) | 5 (1.25) |
| Static Pagenary fit | 20% | 5 (1.00) | 1 (0.20) | 5 (1.00) | 2 (0.40) |
| Migration risk | 20% | 5 (1.00) | 1 (0.20) | 4 (0.80) | 2 (0.40) |
| User-visible search quality | 15% | 2 (0.30) | 5 (0.75) | 3 (0.45) | 5 (0.75) |
| Time to prove | 10% | 5 (0.50) | 2 (0.20) | 4 (0.40) | 2 (0.20) |
| Future semantic/hybrid path | 10% | 1 (0.10) | 5 (0.50) | 3 (0.30) | 5 (0.50) |
| Total | 100% | 3.15 | 3.10 | 3.95 | 3.50 |

## Recommendation

Choose Option C: use published `@fortemi/core` static index helpers behind a
Pagenary search adapter.

This is the best balance of Fortemi adoption and Pagenary architectural fit. It
lets Pagenary replace bespoke indexing incrementally without making React,
PGlite, Vite, or semantic embeddings part of the first cut.

## Decision Guardrails

- Do not depend on `@fortemi/react` in the first phase.
- Do not use PGlite/SearchRepository in the first phase.
- Do not remove the legacy search module until fallback, parity, and performance
  gates pass.
- Do not enable semantic/hybrid search by default in the first phase.
- Treat persisted Fortemi state as derived cache, not source of truth.
