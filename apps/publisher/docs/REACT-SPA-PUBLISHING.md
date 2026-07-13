# React/SPA Publishing Assessment

Issue: [#128](https://git.integrolabs.net/roctinam/pagenary/issues/128)

> **Choosing a tier?** React is one of three operational tiers. See
> [Dependency Posture & Operational Tiers](DEPENDENCY-POSTURE.md) for what each
> adds, and [Minimizing Supply-Chain Exposure](SUPPLY-CHAIN.md) if you want to
> keep the dependency-free static posture or harden a React deployment. The
> static default ships **zero external runtime dependencies** — only escalate
> when a specific interactive surface requires it.

Pagenary should support richer React-backed application sites as an opt-in
publishing mode, not as a replacement for the current static documentation
runtime. The current runtime is still the right default for fast documentation,
static hosting, SEO snapshots, `llms.txt`, corpus artifacts, Docs Map, search,
feeds, and no-JS fallbacks.

The recommended path is a hybrid adapter: Pagenary remains the content,
metadata, and artifact generator, while an optional React build consumes those
artifacts for tenants that need more complex application behavior.

## Current Architecture Baseline

The current publisher builds each tenant in `scripts/build-tenants.js`:

1. Resolve a local or git tenant source.
2. Run the base vanilla ES module build.
3. Convert Markdown, HTML, and JavaScript content into section modules.
4. Apply tenant overrides, branding, theme, navigation, blog layout, page
   effects, Docs Map, forms, and welcome content.
5. Inject the tenant base path.
6. Generate root HTML fallback, static snapshots, sitemap, robots, `llms.txt`,
   search index artifacts, Docs Map data, collection manifests, and feeds.
7. Content-address the runtime bundle and copy it to the final target.

That pipeline is valuable because it keeps tenant output hostable as plain
static files. React support should extend the pipeline after artifact generation
or at a clearly bounded runtime-build seam; it should not move metadata,
snapshots, or collection generation into React itself.

## Recommended Output Modes

Add explicit tenant output modes:

- `static`: the existing vanilla runtime. This remains the default and preserves
  current behavior.
- `react-spa`: a React application shell generated for the tenant, backed by
  Pagenary-generated content and metadata artifacts.
- `hybrid`: the existing static documentation runtime plus selected React app
  routes or islands mounted into configured sections.

The implementation should start with `hybrid`, then graduate to full
`react-spa`. Hybrid gives us the most value with the least risk: documentation
routes, snapshots, search, feeds, and static fallback behavior keep working,
while tenants can add dashboards, editors, calculators, demos, or other rich
application surfaces where React is actually needed.

## Proposed Tenant Configuration

Draft schema shape:

```json
{
  "runtime": {
    "mode": "static",
    "react": {
      "enabled": false,
      "entry": "app/main.jsx",
      "mount": "#app",
      "routes": [
        {
          "id": "dashboard",
          "title": "Dashboard",
          "path": "/dashboard",
          "fallback": "content/dashboard.md"
        }
      ],
      "ssg": {
        "staticFallbacks": true,
        "snapshotRoutes": true
      }
    }
  }
}
```

Rules:

- Missing `runtime` means the current static runtime.
- `runtime.mode: "static"` ignores `runtime.react`.
- React entries are tenant-local and must resolve inside the tenant source.
- React output must respect the existing `basePath`.
- React routes should map back to manifest entries so search, sitemap, Docs Map,
  and static snapshots can still reason about the site.
- Each React app route should have an authored fallback or generated summary so
  no-JS readers, crawlers, and LLM consumers do not get an empty shell.

## Package And Build Strategy

Create a separate optional package, tentatively `@pagenary/react`, instead of
adding React and Vite to `@pagenary/publisher` directly.

Rationale:

- The publisher currently has no runtime framework dependency and supports
  Node `>=16`.
- React's official docs recommend using a build tool such as Vite, Parcel, or
  Rsbuild when building React apps from scratch:
  https://react.dev/learn/build-a-react-app-from-scratch
- Vite's current guide documents React templates and a Node compatibility floor
  of Node `20.19+` or `22.12+`:
  https://vite.dev/guide/
- Vite build output is configurable with `build.outDir`, `build.assetsDir`, and
  related options:
  https://vite.dev/config/build-options
- Keeping the adapter separate lets the existing publisher package keep its
  small static-first install and Node compatibility while React tenants opt into
  newer tooling.

The adapter should expose a build API that `buildTenant()` can call when
`runtime.mode` is `react-spa` or `hybrid`:

```js
await buildReactTenant({
  tenantId,
  sourceDir,
  distDir,
  basePath,
  manifest,
  config,
  artifacts
});
```

The adapter should write React bundles into a namespaced output such as
`dist/<tenant>/app/` or `dist/<tenant>/assets/react/`, then return the files it
emitted so Pagenary can include them in content-addressing, deploy sync, and
asset reports.

## Artifact Preservation

React support must preserve Pagenary's current generated contracts:

- `manifest.js` or a future JSON equivalent remains the navigation and metadata
  source of truth.
- `search-index/` remains generated from content and can be consumed by either
  runtime.
- `sitemap.xml`, `robots.txt`, `llms.txt`, static snapshots in `pages/`, and
  JSON-LD metadata still come from the publisher.
- Collection `index.json` and `feed.xml` remain framework-neutral and can be
  consumed by React components.
- Docs Map data remains generated by Pagenary; React may render an alternate
  graph UI, but should not own relationship extraction.

For React-only app routes, the tenant must provide one of:

- an authored Markdown/HTML fallback;
- a generated static summary configured in tenant metadata;
- a build-time prerendered snapshot from the React app, if the adapter supports
  deterministic prerendering later.

The first implementation should require authored fallbacks. Prerendering can be
planned after the build integration is stable.

## Authoring Model

Markdown and HTML remain first-class content. React app surfaces should be
declared as manifest entries rather than discovered implicitly from a React
router.

Recommended conventions:

- `content/` continues to hold Markdown, HTML, and simple JavaScript section
  modules.
- `app/` or `_app/` holds React entry points, components, and app-specific
  assets.
- `manifest.json` declares which routes are content routes and which are app
  routes.
- React app routes can read generated artifacts from stable URLs such as
  `manifest.js`, `search-index/manifest.json`, `docs-map-data.js`, and
  collection `index.json` files.

This keeps Pagenary's publishing model inspectable from the tenant repo and
avoids treating a React router as the only source of site structure.

## CSP, Assets, And Deployment

React output should follow the existing static-host assumptions:

- no required server process;
- hashed asset filenames;
- no inline script requirement beyond the existing shell policy;
- tenant `basePath` support;
- compatibility with Gitea/GitHub Pages, Caddy, and generic static hosts;
- optional CSP documentation for React app routes and external APIs;
- no credentials in tenant bundles.

The adapter should avoid emptying the tenant output directory directly. Pagenary
should own the final `dist/<tenant>/` directory and call the React build with an
isolated `outDir` so it cannot delete already-generated SEO or content assets.

## Rejected Alternatives

### Replace the runtime with React

Rejected. It risks regressing static publishing, no-JS fallback behavior,
package size, Node compatibility, SEO artifacts, and current tenant behavior.
Most documentation tenants do not need React.

### Make React a hard dependency of `@pagenary/publisher`

Rejected. React/Vite should not increase the install and compatibility burden
for users who only want static documentation publishing.

### Let React own routing and derive Pagenary metadata afterward

Rejected for the first implementation. It would make sitemap generation, static
snapshots, Docs Map, search, and collection feeds depend on app runtime
semantics. Pagenary should continue to own the published site graph.

## Phased Plan

### Phase 1: Design contract

- Add `runtime.mode` and `runtime.react` schema documentation.
- Define the generated artifact manifest passed to adapters.
- Decide whether `manifest.js` should gain a JSON twin for easier React import.
- Add validation errors for React routes without fallbacks.

### Phase 2: Optional adapter prototype

- Create `@pagenary/react` as an optional package.
- Use Vite for tenant-local React builds behind the adapter boundary.
- Build into an isolated output directory.
- Copy or register emitted assets through Pagenary's existing finalization path.
- Support a single React app route with an authored fallback.

### Phase 3: Hybrid routes and UAT

- Add a Pagenary dogfood example tenant that mixes docs pages with one React app
  route.
- Verify base path, static hosts, sitemap, `llms.txt`, static snapshots, search,
  Docs Map, collections, and browser smoke behavior.
- Add docs for CSP, external API calls, and deployment.

### Phase 4: Full React SPA mode

- Allow a tenant to render the whole interactive shell through React while
  still consuming Pagenary's generated artifacts.
- Consider optional prerendering after the hybrid mode is stable.

## Hybrid Example And UAT Matrix

The construction prototype includes a dogfoodable tenant at
`apps/publisher/examples/hybrid-react` and registers it in
`examples/recipes.tenants.json` as `hybrid-react`.

The example has:

- `overview`: an ordinary Pagenary docs route.
- `diagnostics`: a React app route with `content/diagnostics.md` as the
  authored fallback and `#react-diagnostics-root` as the mount point.
- `updates/react-hybrid-uat`: a collection post so collection JSON/feed
  artifacts are exercised in the same build.
- `app/main.jsx`: tenant-local React code built by the optional
  `@pagenary/react` adapter into `assets/react/`.

UAT expectations for the example:

| Artifact or behavior | Expected evidence |
|----------------------|-------------------|
| Static host output | `node scripts/build-tenants.js hybrid-react --registry examples/recipes.tenants.json` completes with only files under `dist/hybrid-react/`. |
| Docs route | `#/overview` renders ordinary Pagenary content in browser smoke. |
| React route | `#/diagnostics` renders the fallback first and the React diagnostics panel after the adapter bundle loads. |
| Static snapshot | `dist/hybrid-react/pages/diagnostics.html` contains the authored fallback. |
| Sitemap | `dist/hybrid-react/sitemap.xml` includes `pages/overview.html` and `pages/diagnostics.html`. |
| `llms.txt` | `dist/hybrid-react/llms.txt` includes Overview and Diagnostics links. |
| Search index | `dist/hybrid-react/search-index/manifest.json` and its parts include both routes. |
| Docs Map | `dist/hybrid-react/docs-map-data.js` emits graph data when `docsMap.enabled` is true. |
| Collections | `dist/hybrid-react/updates/index.json` and `dist/hybrid-react/updates/feed.xml` emit from the collection post. |
| Base paths | A build with `basePath` or `--base` still injects the configured base into the shell before the React bundle is loaded. |
| Content-addressing | The React adapter entry in `index.html` points at `assets/react/index.<vite-hash>.<content-hash>.js`; generated React assets are hashed during finalization. |

## Test Matrix

Minimum construction test coverage:

- Existing static Pagenary tenant builds unchanged.
- React-disabled tenant ignores `runtime.react`.
- React-enabled tenant fails with a clear error when the adapter is missing.
- React route with no fallback fails validation.
- React route with fallback emits a static snapshot and sitemap entry.
- Generated React assets are content-addressed and base-path safe.
- Search index, Docs Map data, collections, `llms.txt`, and robots still emit.
- Browser smoke can open a React route and a regular docs route in the same
  tenant.
- Package tests prove `@pagenary/publisher` can install without React/Vite.

## Recommended Follow-Up Issues

- [#129](https://git.integrolabs.net/roctinam/pagenary/issues/129): implement tenant schema and validation for `runtime.mode` and `runtime.react`.
- [#130](https://git.integrolabs.net/roctinam/pagenary/issues/130): prototype `@pagenary/react` with a Vite-backed build adapter.
- [#131](https://git.integrolabs.net/roctinam/pagenary/issues/131): add a hybrid React app-route example and UAT matrix for generated artifacts.

## Recommendation

Proceed with a hybrid React adapter first. Keep the current static runtime as
the default. Introduce React as an optional adapter package with a newer Node
engine requirement, preserve all existing Pagenary-generated artifacts, and make
fallback content mandatory for app routes until deterministic prerendering is
designed.
