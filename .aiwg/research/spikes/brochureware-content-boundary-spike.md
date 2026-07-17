# Spike: UX-Agnostic Brochureware Content Boundary

Issue: #140
Epic: #139
Date: 2026-07-16
Status: Findings complete; ADR draft added in
`.aiwg/architecture/adr/ADR-017-brochureware-content-boundary.md`; construction
issues filed as #141-#148.

## Question

Where does Pagenary's responsibility end and a brochureware tenant's UX begin?

## Recommendation

Use `runtime.mode: "react-spa"` for brochureware tenants and add a typed
content-module plus route-manifest contract. Pagenary validates content and emits
static delivery artifacts; the tenant owns the React UX.

Do not add a third runtime mode for v1. Do not store brochureware content in
Fortemi/PGlite for v1. Use the existing Fortemi static index path for search.

## Boundary Summary

| Area | Pagenary owns | Tenant owns |
|---|---|---|
| Content source | Schema contract, validation, canonical artifact extraction | Repository data modules, long-form Markdown where useful |
| Routes | Route manifest validation, sitemap/search/corpus route coverage | React router implementation and UX navigation |
| Rendering | Semantic snapshots, machine-readable extracts, optional deterministic prerender hook later | Components, layout, animation, hydration/replacement behavior |
| Policy fields | Validate and republish as content data | Interpret `showPrice`, audience, CTA, sort, featured, and other presentation policy |
| Search/corpus | Fortemi static index, `llms.txt`, `content-index.json`, extracts | UI for search or custom use of generated artifacts |
| Storage | Static generated artifacts for v1 | Any tenant app state or runtime persistence |

## Proposed Content Contract

Tenant zero should expose a TypeScript module because `magly.net` already keeps
its offers, profile, experience, projects, and updates as typed data:

```ts
export const pagenaryContent = {
  schemaVersion: 'pagenary.brochure.content.v1',
  site: { title, description, canonicalUrl, language },
  entities: {
    offers,
    projects,
    profile,
    experience,
    updates
  },
  routeManifest: [
    {
      id: 'services',
      path: '/services',
      title: 'Services',
      summary: 'Fractional product and delivery services.',
      entityRefs: ['offers.fractional-product-lead'],
      extractPolicy: 'public',
      prerender: { kind: 'semantic-template' }
    }
  ]
};
```

Design notes:

- TS modules are the reference input for `magly.net`.
- JSON should be accepted later as the serialized interchange form.
- Markdown/frontmatter remains appropriate for updates and articles.
- Presentation policy fields travel with entity data but remain tenant-owned UI
  semantics.
- Schema extensions should be allowed under explicit extension fields so the
  first tenant does not freeze every future brochureware shape.

## Publisher Emission Classification

Core for brochureware `react-spa` tenants:

- Semantic HTML snapshot per public route.
- `llms.txt`, optional size-gated `llms-full.txt`.
- `content-index.json`, `documents.jsonl`, and per-route text/JSON extracts.
- `sitemap.xml`, `robots.txt`, canonical metadata, and route-level JSON-LD.
- Fortemi static search index and page metadata.
- Route coverage/drift report.

Portfolio/brochure template class:

- Offers/services catalog JSON with policy fields such as `showPrice`.
- Projects/work index.
- Profile/experience JSON.
- Updates feed compatible with `@pagenary/blog-client`.

Opt-in or later:

- Knowledge Shard export.
- PGlite-backed local semantic store.
- Tenant-provided high-fidelity prerender hook.
- Richer relationship graph beyond the static search metadata path.

## Prior-Art Notes

Astro content collections are the closest fit for the input side: collections
use a loader plus optional schema, giving type-safe content queries without
requiring a hosted CMS. Pagenary should steal the build-time validation and
content API idea, but keep route coverage explicit because Pagenary must emit
machine-readable artifacts for every public route.

Next.js headless-CMS patterns draw a different boundary: pages fetch CMS data at
build time, request time, or draft-preview time, and the framework owns routing
and render strategy. Pagenary should not copy the server/draft-mode assumption;
its static publisher remains the source of delivery artifacts and its tenant
route manifest replaces implicit framework route discovery.

Contentlayer's useful idea is the document-type schema: content models are
declared near the app and become typed data. Pagenary should borrow the explicit
modeling and generated-data ergonomics, but avoid making Markdown documents the
only primitive because `magly.net`'s reference input is structured TS data.

`llms.txt` tooling treats the file as an emerging machine-readable summary for
agents. Pagenary already emits agentic SEO artifacts; brochureware tenants should
get those from the publisher rather than site-local scripts so the behavior is
repeatable across a second tenant.

## README Stance

The README's "Not a headless CMS" statement should be defended, but narrowed in
future copy:

- Still true: Pagenary is not hosted, not database-backed, and not a runtime
  editorial API.
- New nuance: Pagenary can provide a headless-like static content delivery
  boundary for UX-owned tenants.
- Suggested future phrasing: "Not a hosted/runtime headless CMS."

## Fortemi Recommendation

Use Fortemi now only through ADR-015's static index path.

Defer Fortemi-backed content storage, PGlite, and Knowledge Shard export until
after tenant zero proves:

- route manifest contract;
- semantic snapshots;
- corpus artifacts;
- zero UX regression;
- a second tenant setup path.

This keeps #139 focused on the content/UX boundary instead of mixing it with a
storage architecture decision.

## Gap List For Tenant Zero

| Gap | Size | Notes |
|---|---|---|
| Brochureware schema package/module | Medium | Define `pagenary.brochure.content.v1`, validation errors, and extension policy. |
| Content-module loader | Medium | Resolve tenant-local TS/JS module without contaminating static tenant Node floor. |
| Route manifest/drift guard | Medium | Hard-fail missing route artifacts and dangling entity refs. |
| Semantic snapshot renderer | Large | Produce no-JS HTML from entities without owning tenant visual UX. |
| Corpus emissions reuse | Medium | Reuse existing SEO/corpus generator where possible; adapt entity-to-page records. |
| Template-class JSON surfaces | Medium | Offers, projects, experience, profile, updates. |
| Fortemi static index mapping | Small | Map route/entity records to existing static index contract. |
| `magly.net` adapter/migration | Large | Consume existing `src/data/*`, preserve UI, replace site-local HTML/LLM scripts. |
| Second tenant fixture | Medium | Proves the under-one-day content setup criterion. |

## Construction Issue Breakdown

Filed after this spike landed:

1. #141 `schema(brochure): define pagenary.brochure.content.v1 contract`
   - Deliver schemas, validator, fixture content based on `magly.net` shapes.
2. #142 `build(brochure): load tenant content modules for react-spa tenants`
   - Resolve configured content module, validate, and expose normalized records
     to publisher artifact generation.
3. #143 `build(brochure): add route manifest coverage and drift guard`
   - Validate public routes, entity refs, safe paths, and missing emissions.
4. #144 `seo(brochure): emit semantic snapshots and machine-readable corpus`
   - Generate static HTML, `llms.txt`, `content-index.json`, `documents.jsonl`,
     per-route extracts, sitemap, robots, and JSON-LD from brochureware routes.
5. #145 `template(brochure): emit portfolio-brochure JSON surfaces`
   - Offers/services, projects, experience/profile, and updates/feed outputs.
6. #146 `search(brochure): map brochureware routes into Fortemi static index`
   - Reuse ADR-015 static search artifacts with route/entity metadata.
7. #147 `tenant(magly): migrate magly.net to Pagenary brochureware pipeline`
   - Replace site-local fallback/LLM/content scripts while preserving React UX.
8. #148 `example(brochure): add second tenant fixture and setup guide`
   - Prove a second brochureware tenant can be stood up from content in under
     one day of content work.

## Open Questions To Resolve During Construction

- Should the v1 content module be loaded through native JS only, or should TS
  loading be delegated to the optional React adapter/Vite path?
- Should semantic snapshots use only Pagenary templates in v1, or allow a
  tenant-provided deterministic render hook immediately?
- What exact field names from `magly.net` become canonical versus tenant
  extension fields?
- How much route-level JSON-LD should be inferred by Pagenary versus supplied by
  the tenant?

## Sources Reviewed

- Pagenary `apps/publisher/docs/REACT-SPA-PUBLISHING.md`.
- Pagenary ADR-002, ADR-003, ADR-015, ADR-016.
- Astro content collections:
  https://docs.astro.build/en/guides/content-collections/
- Next.js `getStaticProps` CMS example:
  https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-props
- Next.js draft mode:
  https://nextjs.org/docs/app/guides/draft-mode
- Contentlayer document type schema:
  https://www.contentlayer.dev/docs/reference/source-files/define-document-type-eb9db60e
- Chrome Lighthouse `llms.txt` overview:
  https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt
