# ADR-017: Brochureware Content Boundary for UX-Owned React Tenants

Status: Proposed
Date: 2026-07-16
Related: #139, #140, #128, ADR-002, ADR-003, ADR-015, ADR-016

## Context

Pagenary currently owns the full published experience for ordinary tenants:
content ingestion, section rendering, navigation shell, search, SEO snapshots,
feeds, and static deployment artifacts all come from the publisher runtime. The
React/SPA track added an optional adapter posture, but the first real
brochureware tenant, `magly.net`, has a different shape: the tenant already owns
its React 19 app, visual system, route transitions, and presentation components.
Its content is already structured data under `src/data/*` rather than authored
pages.

The brochureware track in #139 should therefore invert the default ownership
model:

- The tenant owns UX and presentation.
- Pagenary owns content validation, derived delivery artifacts, prerendered
  semantic output, machine-readable corpus surfaces, search data, feeds, route
  coverage, and drift guards.

This ADR answers the #140 boundary question and gates construction issue
breakdown for #139.

## Decision

Add a brochureware content pipeline posture on top of `runtime.mode:
"react-spa"` rather than a new runtime mode.

The tenant will export a typed content module contract and a route manifest.
Pagenary will validate those inputs and emit static delivery artifacts. Pagenary
will not import, render, or constrain tenant UX components except through an
optional build/prerender hook that the tenant explicitly provides.

### Tenant-owned surface

The tenant owns:

- React app source, router, components, CSS, animation, analytics, and design
  system.
- Mapping from validated content entities to on-screen presentation.
- Presentation policy fields such as `showPrice`, `featured`, `audience`,
  `sortOrder`, and call-to-action variants. Pagenary validates and republishes
  these fields but does not interpret them as UI instructions.
- Hydration behavior. Tenant zero (`magly.net`) may replace or hydrate over
  static markup, but zero UX regression is required.

### Pagenary-owned surface

Pagenary owns:

- Content-module schema validation and helpful build errors.
- Canonical route manifest validation and route-coverage drift checks.
- Static semantic HTML snapshots for every declared public route.
- `llms.txt`, size-gated `llms-full.txt`, `content-index.json`,
  `documents.jsonl`, per-route text/JSON extracts, sitemap, robots, JSON-LD, and
  feed/index artifacts where enabled.
- Fortemi-compatible static search index output, using the existing
  `@fortemi/core` static index contract from ADR-015.
- Artifact manifest emitted back to the tenant/app build so tenant code can
  consume Pagenary outputs without depending on publisher internals.

## Content Module Contract

Brochureware tenants provide a `pagenary.content.ts` module, or equivalent path
declared in tenant config, with this conceptual shape:

```ts
export const pagenaryContent = {
  schemaVersion: 'pagenary.brochure.content.v1',
  site: { title, description, canonicalUrl, language },
  entities: {
    profile,
    offers,
    projects,
    experience,
    updates,
    testimonials,
    links
  },
  routeManifest: [
    {
      id: 'services',
      path: '/services',
      title: 'Services',
      summary: '...',
      entityRefs: ['offers.fractional-product-lead'],
      extractPolicy: 'public',
      prerender: { kind: 'semantic-template' }
    }
  ]
};
```

The contract is intentionally data-first and UI-neutral:

- Use TypeScript modules for tenant zero because `magly.net` already has typed
  `src/data/*` inputs and React/Vite tooling.
- Allow JSON as a later serialized interchange format for non-TypeScript
  tenants.
- Continue to use Markdown/frontmatter for long-form updates or posts when that
  is the natural authoring format.
- Keep entity schemas closed enough to validate required fields and route
  coverage, but preserve tenant extension fields under namespaced or
  pass-through objects so site-specific policy does not force publisher changes.

Validation policy:

- Hard-fail: invalid `schemaVersion`, duplicate route ids/paths, missing public
  route metadata, dangling entity refs, invalid canonical URLs, unsafe output
  paths, or routes declared public without an extract/prerender policy.
- Warn: unused entities, missing optional summary/keywords, absent social image,
  or fields unknown to the current schema but under an allowed extension area.

## Publisher Emissions

Core emissions for brochureware `react-spa` tenants:

- Semantic HTML snapshot per declared route.
- `llms.txt`; optional size-gated `llms-full.txt`.
- `content-index.json`, `documents.jsonl`, and per-route JSON/text extracts.
- `sitemap.xml`, `robots.txt`, canonical metadata, and route-level JSON-LD.
- Fortemi static search index and compact page metadata.
- Route coverage report consumed by the drift guard.

Template-class emissions for the portfolio/brochure template:

- Offers/services catalog JSON, including presentation policy fields such as
  `showPrice`.
- Projects/work index.
- Experience/profile JSON.
- Updates/blog feed compatible with `@pagenary/blog-client`.

Opt-in plugin emissions:

- Knowledge Shard export.
- PGlite-backed local semantic storage.
- Richer graph/relationship exports beyond static search and simple related
  links.

## Runtime Posture

Keep `runtime.mode: "react-spa"` and add brochureware capability through
contract fields, adapter options, and validation. A third mode such as
`content-pipeline` is not needed yet because it would mostly duplicate
`react-spa` while hiding the important property: the tenant still ships a React
SPA, and Pagenary still emits static artifacts.

The existing `static` and `hybrid` modes remain unchanged. Existing docs tenants
keep the static-output/no-runtime-dependency posture from ADR-002 and ADR-003.

Node compatibility follows the current split:

- `@pagenary/publisher` keeps Node `>=16` for static tenants.
- React/brochureware adapter work may require the newer Vite-compatible Node
  floor already documented for `@pagenary/react`.

## Prerender And Hydration Boundary

Pagenary should not learn the tenant's React component tree as the primary
content source. For v1, snapshots come from deterministic semantic templates
derived from validated content entities and route metadata. This ensures no-JS,
LLM, search, and drift outputs exist even if the tenant SPA changes.

A later adapter can support tenant-provided prerender functions for higher
fidelity snapshots:

```ts
export async function renderPagenaryRoute(route, content) {
  return { html, text, jsonLd };
}
```

That hook is optional and must be deterministic, side-effect-free, and validated
against the same route manifest. It is a rendering aid, not the source of route
truth.

## README Stance On "Not A Headless CMS"

The current README says Pagenary is not a headless CMS because content lives as
files in the repository rather than in a database behind an API. This ADR
defends that stance with a narrower phrasing:

- Pagenary is still not a hosted headless CMS and does not become the live
  editorial API for tenant UX.
- The brochureware track does add a headless-like publishing boundary:
  repository content modules in, static delivery artifacts out.
- The product language should eventually say "not a hosted/runtime headless CMS"
  rather than implying Pagenary can never provide UX-agnostic content delivery.

## Fortemi Storage Recommendation

Use Fortemi now for static search/index contracts only. Defer Fortemi-backed
content storage, PGlite tenant storage, and Knowledge Shard export from the
brochureware v1 construction path.

Rationale:

- Tenant zero needs route coverage, semantic snapshots, corpus artifacts, and
  zero UX regression before it needs browser-persisted semantic storage.
- ADR-015 already gives Pagenary a Fortemi-compatible static index that fits the
  static publisher model.
- PGlite and Knowledge Shards are valuable follow-ups, but they add runtime and
  storage decisions that are orthogonal to the content/UX boundary.

## Consequences

Positive:

- Pagenary can serve UX-owned marketing/portfolio tenants without becoming their
  design system.
- The tenant route manifest becomes the stable bridge for sitemap, search,
  corpus, feeds, and drift checks.
- `magly.net` can consume the pipeline while preserving its existing React UX.
- A second brochureware tenant can start from content modules and the
  portfolio/brochure contract rather than copying site-local scripts.

Negative:

- Pagenary must define and maintain typed brochureware schemas, not just
  Markdown/frontmatter ingestion.
- Semantic snapshots may be less visually faithful than tenant-rendered
  prerendering until an optional prerender hook exists.
- Presentation policy fields require careful documentation so Pagenary validates
  them without accidentally becoming a UI rule engine.

Neutral:

- This does not remove or supersede the current docs-focused template catalog.
- It does not require hosted editing, a database, or a server process.

## Rejected Alternatives

### Add a third `content-pipeline` runtime mode

Rejected for v1. The distinction is a capability contract inside the React SPA
posture, not a separate browser runtime. A new mode can be reconsidered only if
multiple non-React tenant app frameworks consume Pagenary as a pure build-time
content compiler.

### Let the tenant router be the only route source

Rejected. Pagenary cannot reliably emit sitemap, search, `llms.txt`, static
snapshots, or drift reports from opaque client-side route code. The route
manifest must be a build input.

### Make Pagenary a hosted headless CMS

Rejected. That contradicts the repository-owned, static-output posture and is
not needed for the magly.net wedge.

### Store brochureware content in Fortemi/PGlite now

Deferred. Static search contracts are enough for v1. Storage can be revisited
after tenant zero proves the content contract and artifact set.

## Construction Breakdown

Filed as #141-#148 after the #140 spike landed:

1. #141 Define `pagenary.brochure.content.v1` schemas and a fixture based on
   `magly.net` data shapes.
2. #142 Add brochureware content-module loading and validation behind
   `runtime.mode: "react-spa"` adapter options.
3. #143 Add route manifest validation and drift report output.
4. #144 Emit semantic route snapshots and corpus artifacts from brochureware content.
5. #145 Emit portfolio/brochure template-class JSON surfaces for offers, projects,
   profile, experience, and updates.
6. #146 Wire Fortemi static search index generation for brochureware entities.
7. #147 Add tenant-zero integration path for `magly.net` with zero UX regression
   verification.
8. #148 Add a second fixture/demo brochureware tenant to prove under-one-day content
   setup.

## References

- #139: brochureware/marketing-site delivery track.
- #140: content/UX boundary contract spike.
- #128 and `apps/publisher/docs/REACT-SPA-PUBLISHING.md`: React/SPA publishing
  assessment.
- ADR-002, ADR-003: zero-dependency static publisher posture.
- ADR-015: Fortemi static search adapter.
- ADR-016: section-scoped layouts and template schemas.
- Astro content collections: https://docs.astro.build/en/guides/content-collections/
- Next.js CMS/static data fetching and draft mode:
  https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-props
  and https://nextjs.org/docs/app/guides/draft-mode
- Contentlayer document schemas:
  https://www.contentlayer.dev/docs/reference/source-files/define-document-type-eb9db60e
- Chrome Lighthouse `llms.txt` overview:
  https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt
