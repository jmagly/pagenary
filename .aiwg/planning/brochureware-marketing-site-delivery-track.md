# Brochureware/Marketing-Site Delivery Track Plan

Issue: #139
Research gate: #140, ADR-017
Date: 2026-07-16
Status: Planning complete; construction issues filed (#141-#148)

## Direction

Pagenary should support brochureware, marketing, and portfolio sites where the
tenant owns the final UX. The initial buildout is `magly.net`, because its
content already lives as typed React app data (`src/data/*`) and its open
fallback/LLM-content issues are generic Pagenary publisher capabilities.

The product inversion is:

- Today: Pagenary owns content and the full docs UX.
- New track: Pagenary owns content management and static delivery artifacts; the
  tenant owns UX.

ADR-017 defines the boundary. This plan defines the first template class,
tenant-zero migration, roadmap sequencing, and construction breakdown.

## Default Template Class: `portfolio-brochure`

The default brochureware template class should be derived from `magly.net`'s
information architecture without copying its visual design.

### Required route roles

| Role | Purpose | Typical content entities |
|---|---|---|
| `home` | First impression, positioning, primary CTAs | profile, offers summary, selected projects, recent updates |
| `about` | Person/company credibility and operating model | profile, experience, values, credentials |
| `work` | Proof and examples | projects, case studies, outcomes, technologies |
| `services` | Offers, packages, engagement model | offers, pricing policy fields, ladder narratives, FAQs |
| `updates` | Posts, notes, announcements, changelog | updates collection, tags, feed metadata |
| `contact` | Conversion path | profile/contact links, CTAs, availability, form/embed metadata |
| `machine-readable` | Agent/search/feed surfaces | route extracts, JSON-LD, corpus/index/feed artifacts |

The route roles are conceptual. A tenant may use different public paths or merge
roles, but the route manifest must state which roles are covered so the build can
detect missing public surfaces.

### Core entity groups

- `site`: title, description, canonical URL, language, social image.
- `profile`: owner/company identity, tagline, summary, contact links.
- `offers`: services/catalog entries with structured problem points, pillars,
  process/ladder narratives, CTA labels, and presentation policy fields such as
  `showPrice`.
- `projects`: work examples, client/domain labels, outcomes, technologies,
  links, featured/sort metadata.
- `experience`: roles, credentials, timeline, proof points.
- `updates`: date-stamped posts or notes, optionally Markdown-backed.
- `testimonials` and `links`: optional v1 extensions.

### Required publisher artifacts

- Semantic HTML snapshot for every public route.
- `llms.txt`, optional `llms-full.txt`, `content-index.json`,
  `documents.jsonl`, per-route JSON/text extracts.
- `sitemap.xml`, `robots.txt`, canonical metadata, JSON-LD.
- Fortemi static search index.
- Portfolio/brochure JSON surfaces for offers, projects, profile/experience, and
  updates/feed.
- Route coverage/drift report.

## Tenant Zero: `magly.net` Migration Plan

The `magly.net` migration should preserve the existing React 19 SPA look and
behavior while moving generic static-delivery work into Pagenary.

### Phase 0: Source audit and mapping

- Inventory `magly.net/src/data/*` entities and route usage.
- Map existing fields to `pagenary.brochure.content.v1`.
- Classify fields as canonical schema, `portfolio-brochure` extension, or
  tenant-specific pass-through.
- Identify current site-local scripts for HTML fallback, `llms.txt`,
  `llms-full.txt`, and `content.json`.

### Phase 1: Contract adapter

- Add `pagenary.content.ts` in `magly.net` that re-exports normalized content
  from existing data modules.
- Add a route manifest that covers public routes and entity refs.
- Keep `magly.net` UI imports pointed at existing local data during this phase
  unless sharing the normalized module is trivial.

### Phase 2: Pagenary artifact generation

- Build Pagenary brochureware artifacts from the content module.
- Compare generated snapshots and machine-readable outputs against current
  site-local outputs.
- Enable route coverage/drift guard so a route added to the SPA without
  delivery artifacts fails the build.

### Phase 3: Replace site-local scripts

- Remove or disable `magly.net`'s local fallback/LLM/content export scripts.
- Consume Pagenary-generated artifacts in deploy packaging.
- Keep React UX unchanged; verify visual behavior with the existing magly.net
  test/smoke flow.

### Phase 4: Tenant-zero acceptance

- All public routes have semantic no-JS snapshots.
- `llms.txt`, `llms-full.txt` where size permits, `content.json`/corpus outputs,
  sitemap, JSON-LD, search index, and feed artifacts come from Pagenary.
- No UX regression from the current `magly.net` SPA.
- Pagenary docs include enough setup guidance to build a second tenant from the
  template class.

## Second Tenant Proof

The v1 track is not done until a second brochureware tenant can be stood up from
the template in under one day of content work.

Candidate proof tenants:

- `integrolabs.io`: same operator, adjacent brand, likely reusable service and
  proof entities.
- A small client/portfolio fixture inside Pagenary examples: lower external
  coordination, better CI fixture.

Recommendation: build the Pagenary example fixture first for repeatable tests,
then apply the same contract to `integrolabs.io` or a real client tenant.

## Roadmap Alignment And Sequencing

### Blocks before construction

1. #134: re-vendor `@fortemi/core` static index to 2026.7.4.
   - Reason: brochureware search should not start on the pre-hardening
     `aiwg-index` contract when #134 already scopes security and v2 schema
     changes.
2. #140: boundary spike and ADR.
   - Status: ADR-017 and spike report provide the construction gate.

### Can run in parallel after #134 and #140

- Brochureware schema/loader work.
- Semantic snapshot/corpus emission work.
- `magly.net` adapter preparation in the tenant repo.

### Deferred behind tenant-zero proof

- #136 Knowledge Shard export.
- #137 Tier-2 PGlite tenant.
- Tenant-provided high-fidelity React prerender hook, unless semantic snapshots
  are insufficient for `magly.net` acceptance.

This keeps the first track focused on static delivery and zero UX regression
instead of mixing in persistence and knowledge-base export concerns.

## Construction Issue Set

These construction issues were filed after #140 landed:

1. #141 `schema(brochure): define pagenary.brochure.content.v1 contract`
   - Deliver schemas, validator, extension policy, and magly-shaped fixture.
2. #142 `build(brochure): load tenant content modules for react-spa tenants`
   - Load configured content modules and expose normalized records to publisher
     artifact generation.
3. #143 `build(brochure): add route manifest coverage and drift guard`
   - Validate public routes, paths, role coverage, entity refs, and missing
     delivery artifacts.
4. #144 `seo(brochure): emit semantic snapshots and corpus artifacts`
   - Generate route snapshots, LLM/corpus outputs, sitemap, robots, and JSON-LD.
5. #145 `template(brochure): emit portfolio-brochure JSON surfaces`
   - Offers/services, projects, profile/experience, updates/feed.
6. #146 `search(brochure): map brochureware routes into Fortemi static index`
   - Reuse ADR-015/#134 static index contract for route/entity search.
7. #147 `tenant(magly): migrate magly.net to the Pagenary brochureware pipeline`
   - Cross-repo work; replace site-local scripts and prove zero UX regression.
8. #148 `example(brochure): add second tenant fixture and setup guide`
   - Prove repeatability and document the under-one-day content setup path.

## Definition Of Done For #139 Planning

- #140 spike deliverables are present and linked.
- ADR-017 records the content/UX boundary, runtime posture, emissions, prior-art
  takeaways, README stance, and Fortemi storage recommendation.
- This plan defines the `portfolio-brochure` route/entity shape.
- Tenant-zero migration and second-tenant proof are sequenced.
- Construction issues #141-#148 are filed on the canonical Gitea tracker.

## References

- #139: planning epic.
- #140: boundary spike.
- ADR-017: `.aiwg/architecture/adr/ADR-017-brochureware-content-boundary.md`.
- Spike report:
  `.aiwg/research/spikes/brochureware-content-boundary-spike.md`.
- React/SPA baseline:
  `apps/publisher/docs/REACT-SPA-PUBLISHING.md`.
- Fortemi sequencing:
  `.aiwg/planning/fortemi-2026.7.4-integration-plan.md`.
