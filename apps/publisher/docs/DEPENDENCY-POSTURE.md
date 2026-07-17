# Dependency Posture & Operational Tiers

Pagenary's headline property is that a published site can run with **zero
external runtime dependencies** — no framework, no CDN, no bundler output, no
npm packages shipped to the browser. That posture is the default, and it is
worth protecting. React and the Fortémi tooling are real, useful capabilities,
but they are strictly **opt-in tiers layered on top** of the static core. Adding
them changes your dependency and supply-chain footprint, so this guide states
exactly what each tier costs and how to choose the minimum that meets your need.

If minimizing supply-chain exposure is your priority, read this alongside
[Minimizing Supply-Chain Exposure](SUPPLY-CHAIN.md).

## The tiers

| | **Tier 0 — Static** | **Tier 1 — Hybrid React** | **Tier 2 — Fortémi record tier** | **Tier 3 — Fortémi PGlite projection** |
|---|---|---|---|---|
| Status | Default, shipping | Opt-in, shipping | Planned | Planned |
| Runtime framework in output | None | React + React DOM | React + React DOM | React + React DOM |
| npm runtime deps shipped | **None** (vendored artifacts only) | `react`, `react-dom`, `@fortemi/graph` | + `@fortemi/core` record/shard APIs | + `@fortemi/core` PGlite projection and `@electric-sql/pglite` |
| Build toolchain | No bundler (`scripts/build.js` copies `src/`) | Vite (`@pagenary/react` adapter) | Vite | Vite |
| Node floor | `>=16` | `>=20.19 \|\| >=22.12` | `>=20.19 \|\| >=22.12` | `>=20.19 \|\| >=22.12` |
| Approx. added bundle | 0 KB | ~200 KB JS | TBD; no PGlite WASM/data | ~16 MB WASM/data (PGlite) + optional model downloads |
| Optional model downloads | None | None | None | Embeddings (~30 MB) and/or WebLLM (GB-scale) — **reader-opt-in only** |
| Docs Map renderer | JS-only SVG (`src/lib/docs-map.js`) | Fortémi-engine graph control (`@fortemi/graph`) | Fortémi-engine + writable records/shards | Fortémi-engine + semantic graph opt-in |
| No-JS fallback | Full (static snapshots) | Preserved (authored fallbacks) | Preserved (authored fallbacks) | Preserved (authored fallbacks) |
| External network at runtime | None required | None required (self-hosted assets) | None required by default | None required by default; opt-in model fetch |
| Static-host compatible | Yes | Yes | Yes | Yes |

Tiers are selected **per tenant** (and, for React, effectively per route via
`runtime.react.routes`). One repo can publish a dependency-free Tier-0 site for
most tenants and a Tier-1 tenant only where an interactive surface is needed.

## Tier 0 — Static (the dependency-free default)

This is the reason Pagenary exists: `npm run build` / `build:tenants` produces
plain HTML, CSS, and ES modules loaded by relative path. There is **no bundler**
and **no runtime framework**. Hash-based routing, search, the command palette,
and the Docs Map all run as hand-written ES modules the browser loads directly.

Where the publisher genuinely needs a third-party library at runtime (today:
the Fortémi search/index engine), it **vendors** it — a specific built artifact
is committed to the repo under a provenance banner and loaded by relative path,
never as a bare `@fortemi/core` specifier. See [Vendoring](VENDORING.md). The
consequence: **no `node_modules` package ever reaches the browser**, and the
output has no npm runtime dependency to audit, pin, or trust.

What runs in a Tier-0 site:

- Content: Markdown/HTML/JS section modules → static HTML.
- Docs Map: the **JS-only SVG renderer** in `src/lib/docs-map.js` — a
  dependency-free DOM/SVG graph (force layout, zoom/pan, search, hover
  neighborhoods) with no React and no canvas libraries.
- SEO/artifacts: sitemap, `robots.txt`, `llms.txt`, static page snapshots,
  search index, collection feeds — all framework-neutral, all generated at
  build time.

Keep everything here unless a specific interactive requirement forces you up a
tier.

## Tier 1 — Hybrid React (opt-in)

Set `runtime.mode: "hybrid"` (or `"react-spa"`) on a tenant and Pagenary builds
tenant-local React through the optional **`@pagenary/react`** adapter (Vite),
emitting content-addressed bundles into `dist/<tenant>/assets/react/`. The
publisher package itself gains no framework dependency — the adapter is a
separate opt-in package with a newer Node floor. See
[React/SPA Publishing](REACT-SPA-PUBLISHING.md).

What changes:

- The tenant output now includes bundled npm code: `react`, `react-dom`, and
  `@fortemi/graph` (the graph engine). This is real supply-chain surface —
  three registry packages plus their transitive deps, resolved through your
  lockfile and the release-age gate.
- The **Docs Map** upgrades to the Fortémi-engine graph control (community
  layout algorithms, community legend/filter, focus/neighborhood, selection).
- **PGlite is intentionally excluded.** The adapter imports the docs-map
  `GraphView` from the PGlite-free `@fortemi/react/graph` subpath and
  externalizes `@electric-sql/pglite` as a Tier-1 guard. Upstream #261 shipped
  the lazy optional PGlite path; the build-time WASM/data check below confirms
  that no database bytes leaked into a docs-map-only tenant.
  Verify with: `find dist/<tenant>/assets/react -iname '*.wasm' -o -iname '*.data'`
  (should be empty).
- All artifacts from Tier 0 (snapshots, sitemap, `llms.txt`, search, feeds)
  still generate. Each React app route must have an authored fallback, so no-JS
  readers and crawlers still get content.

Cost: a Vite build step, the newer Node floor, and ~200 KB of self-hosted JS on
the routes that mount React. No external network is required at runtime — assets
are hashed and served from your own host.

## Tier 2 — Fortémi Record Tier (planned)

Fortémi `2026.7.8` adds a writable canonical record tier that does not boot
PGlite: `createRecordBackend`, `exportShardFromRecords`,
`importShardToRecords`, and `projectRecords`. This is the next runtime posture
to evaluate for Pagenary tenants that want writable notes, DB-free shard
import/export, or local review workflows without semantic search.

This tier is still planned for Pagenary. It should be designed before any
PGlite-heavy tenant mode so Pagenary can keep the dependency and byte footprint
proportional to the feature being enabled.

## Tier 3 — Full Fortémi PGlite Projection (planned)

The heaviest tier turns a tenant into a **browser-only Fortémi instance**:
`<FortemiProvider persistence="idb">` boots PGlite (Postgres-in-WASM) in the
browser, the docs corpus is seeded as notes, and search + graph run
**compute-based by default** (full-text + citation/link graph — no inference).
Two capabilities are **reader-opt-in and off by default**, mirroring the
magly.net deployment:

- **Semantic** — a transformers.js embedding model (~30 MB) downloaded only
  when the reader enables semantic search.
- **LLM** — WebLLM/WebGPU (GB-scale model) downloaded only on explicit opt-in.

This tier is no longer blocked on upstream optional-PGlite work, but it should
remain a deliberate choice for tenants that need full-text/semantic projection,
embeddings, or PGlite-compatible APIs. Pagenary docs-map stays at Tier 1
(compute-based, PGlite-free), and record/shard workflows should start at Tier 2.

## Choosing a tier

1. **Default to Tier 0.** It is the strongest posture and covers documentation,
   blogs, reference sites, and the Docs Map with zero runtime dependencies.
2. **Escalate to Tier 1 only for a specific interactive surface** (a dashboard,
   calculator, editor, or the richer graph control) — and scope React to just
   the routes that need it, keeping the rest of the site Tier 0.
3. **Use Tier 2** for sites that need writable local records or DB-free shard
   import/export.
4. **Reserve Tier 3** for sites that genuinely need a PGlite-backed in-browser
   knowledge engine (client-side FTS/semantic search over a seeded corpus,
   opt-in semantic/LLM).

Each step up adds packages to trust, bytes to ship, and a heavier Node
toolchain. None of it is required to publish an excellent, fast, fully static
site — that remains the default and the recommendation.

## Verifying your posture

```bash
# Tier 0 proof: no npm runtime deps in the output, no bundler artifacts.
ls dist/<tenant>/assets/react 2>/dev/null || echo "Tier 0 — no React bundle"

# Tier 1 check: what actually shipped, and confirm PGlite is absent.
find dist/<tenant>/assets/react -type f -printf '%s\t%p\n' | sort -rn
find dist/<tenant>/assets/react -iname '*.wasm' -o -iname '*.data'   # must be empty

# What runtime deps does the React adapter carry at all?
npm ls --package-lock-only --omit=dev -w @pagenary/react
```

## Related

- [Vendoring third-party code](VENDORING.md) — how Tier 0 stays dependency-free
- [React/SPA Publishing](REACT-SPA-PUBLISHING.md) — the Tier-1 adapter and modes
- [Minimizing Supply-Chain Exposure](SUPPLY-CHAIN.md) — hardening at every tier
- [Architecture](ARCHITECTURE.md) · [Deployment](DEPLOYMENT.md)
