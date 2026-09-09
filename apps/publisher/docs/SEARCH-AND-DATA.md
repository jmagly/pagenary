# Search & Data

Pagenary doesn't bolt a toy search box onto your docs. Every Pagenary site ships
with a real knowledge layer — ranked full-text search, faceted metadata, and a
content-derived knowledge graph — built on the **[Fortémi](https://docs.fortemi.com)**
data engine. This page explains what that gets you and where to dig deeper.

## What powers it: Fortémi

[Fortémi](https://docs.fortemi.com) is a knowledge-management platform with two
deployment shapes with portable, versioned interchange contracts:

- **Self-hosted server** — Rust + PostgreSQL, hybrid search, MCP server,
  multi-provider LLM inference, multimodal ingestion. → [docs.fortemi.com/server](https://docs.fortemi.com/server/)
- **Browser-native** — the `fortemi-react` packages, which is what Pagenary
  uses. → [docs.fortemi.com/react](https://docs.fortemi.com/react/)

The browser side is three composable packages:

| Package | What it does | Dig in |
|---------|--------------|--------|
| **`@fortemi/core`** | Browser-only data layer: PGlite (PostgreSQL compiled to WASM), a single-writer worker, MCP tools, a job queue, and **hybrid lexical + semantic search**. | [packages/core](https://docs.fortemi.com/react/#packages/core) |
| **`@fortemi/graph`** | Framework-agnostic community-graph tooling: layout, filtering, neighborhood expansion, and snapshot serialization. | [packages/graph](https://docs.fortemi.com/react/#packages/graph) |
| **`@fortemi/react`** | React 19 hooks and `FortemiProvider` (30 hooks) over `@fortemi/core`. | [packages/react](https://docs.fortemi.com/react/#packages/react) |

Pagenary vendors the **static index/query subset** of `@fortemi/core` (see
[Architecture](ARCHITECTURE.md) and [Vendoring](VENDORING.md)). The default
publisher does not start PGlite or download an embedding model.

## What you get

**Ranked static search.** The command palette (`⌘K` / `Ctrl+K`) searches
titles, summaries, and rendered content with ranked results, snippets, and
infinite scroll. This default path uses the vendored static-index query engine;
it does not perform semantic inference.

**A knowledge graph from your content.** The opt-in **Docs Map** projects your
corpus into a Fortémi community graph — pages become nodes, shared concepts
become edges — rendered as a framework-free SVG. Turn it on with one config key
(see [Theming Recipes](THEMING-RECIPES.md)).

**Faceted, page-addressable metadata.** The build emits compact per-page Fortémi
metadata (the `pagenary.fortemi.metadata.v1` contract) so page tools, the graph,
and facets resolve without re-shipping full document text.

**Deterministic, CDN-safe output.** The search index is generated at build time
(`manifest.json` + `part-NNNN.json`) and is reproducible for unchanged
content. The chunk envelopes remain v1; records and the reconstructed export
use v2 with an explicit v1 compatibility declaration. If the static index is
unavailable, the browser builds a fallback from local section modules. HTML
text extraction uses an inert template so indexing does not fetch embedded
images. No application server is required.

**Portable build artifact.** Set `knowledgeShard.enabled: true` to publish the
validated static corpus as a deterministic Fortémi `1.2.0/core-v1` Knowledge
Shard. Pagenary emits the archive, a SHA-256 manifest, and a provenance receipt,
and verifies byte reproducibility plus exact source-index round-trip during the
build. The converter stays entirely in the Node build toolchain.

## The flexibility

The capability you see in Pagenary is the floor, not the ceiling. Because
Pagenary builds on the standard Fortémi packages, the same data is portable to a
far richer interactive experience:

- **Drop into React.** `@fortemi/react`'s `FortemiProvider` + 30 hooks give you
  notes, hybrid search, tags, collections, and SKOS concepts as first-class React
  state. → [Getting Started](https://docs.fortemi.com/react/#getting-started) ·
  [Integration guide](https://docs.fortemi.com/react/#integration)
- **W3C SKOS tagging.** Organize content with a real concept scheme, not flat
  tags.
- **Bring your own graph.** `@fortemi/graph` exposes layout, filtering, and
  neighborhood expansion you can drive directly.
- **Server parity.** Import the optional build-time Knowledge Shard into the
  self-hosted [Fortémi Rust server](https://docs.fortemi.com/server/) for
  round-trip parity. Runtime authoring/import belongs to the opt-in record tier;
  the default static tenant remains read-only and dependency-light.

For the full surface — hooks, providers, and core APIs — see the Fortémi
[API Reference](https://docs.fortemi.com/react/#api-reference).

## Where it lives in Pagenary

- **`src/lib/search.js`** — the Fortémi-backed search adapter (ranking, paging,
  runtime fallback). See the [API Reference](API.md).
- **`src/lib/fortemi-corpus.js`** — the deterministic corpus builder, shared by
  the build step and the runtime fallback.
- **`src/vendor/fortemi-aiwg-index.js`** — the vendored `@fortemi/core` engine.
- **`createAiwgIndexController`** — a framework-free controller, so Pagenary's
  own shell uses the engine with zero React dependency. The data is React-ready;
  Pagenary just doesn't require it.

See [Architecture](ARCHITECTURE.md) for the build pipeline and versioned
index contracts.

## Optional writable data workflows

`@pagenary/react/record-runtime` adds canonical records, shard exchange, and
explicitly reviewed source refresh. `@pagenary/react/dataset-runtime` adds
bounded import planning, previews, approval, and transactional receipts;
`@pagenary/react/dataset` provides the optional import UI. Tier 3 projects those
records into PGlite and exposes scoped lexical search. Automatic deletion,
semantic scoped search, and comprehensive local-data removal are not supported
by these APIs. See the [runtime API and limitations](https://git.integrolabs.net/roctinam/pagenary/src/branch/main/apps/react/README.md) and
[dependency tiers](DEPENDENCY-POSTURE.md).
