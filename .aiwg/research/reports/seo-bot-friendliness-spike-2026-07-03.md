# SEO And Bot Friendliness Research Spike

Generated: 2026-07-03
Scope: Pagenary tenant options for crawler friendliness, AI/LLM extraction, and advisory lockdown.
Mode: research spike with internal corpus survey, external source validation, and tracker follow-up filing.

## Executive Summary

Pagenary is already aligned with the strongest crawler-friendly pattern for a hash-routed SPA: generate durable static artifacts rather than relying on bot-specific dynamic rendering. Current output includes static `/pages/*.html` snapshots, sitemap, robots, `llms.txt`, JSON-LD, runtime metadata, and root HTML fallback metadata.

The next product step is a clear tenant policy model. Users should be able to choose a high-level discoverability profile instead of stitching together low-level SEO flags. The two ends of the product spectrum are:

- `open`: make the corpus intentionally easy for search crawlers, AI tools, archives, and extractors to consume without JavaScript.
- `locked`: emit an advisory static-site lockdown profile that reduces discovery artifacts, while clearly documenting that real privacy requires hosting-layer access control.

Alternate crawlable SEO variants should remain behind the #109 spike. Honest machine-readable extracts are valuable; query-targeted duplicate pages can cross into doorway/scaled-content risk without strong guardrails.

## Internal Research Corpus

Checked `/home/roctinam/dev/research`.

Finding: the local sponsor mirror currently contains only repository policy/index files and no published SEO/crawler/LLM-docs findings. No internal source was available to cite for this spike.

Action taken: filed source induction issues in `section9/research-papers` for the sources below.

## Corpus Induction Issues Filed

- section9/research-papers#155 — Google Search Central: JavaScript SEO basics
- section9/research-papers#156 — Google Search Central: dynamic rendering workaround guidance
- section9/research-papers#157 — Google Search Central: robots.txt, noindex, robots meta, X-Robots-Tag
- section9/research-papers#158 — Google Search Central: spam policies for doorway/scaled duplicate content
- section9/research-papers#159 — Google Search Central: AI features and publisher controls
- section9/research-papers#160 — llms.txt specification
- section9/research-papers#161 — Cloudflare AI crawler controls and content signals
- section9/research-papers#162 — Fern AI-agent docs and llms.txt generation patterns
- section9/research-papers#163 — GitBook llms.txt docs best practices
- section9/research-papers#164 — Orbit Media doorway/orphan-page practitioner guidance
- section9/research-papers#165 — Sitemaps.org XML sitemap protocol
- section9/research-papers#166 — Google Search Central structured data guidance

## Pagenary Issues Filed

- #113 — add `seo.discoverabilityProfile` presets
- #114 — emit open-profile machine-readable corpus artifacts
- #115 — make limited and locked profiles suppress discovery artifacts coherently
- #116 — add AI crawler content-signal controls to generated `robots.txt`
- #117 — add profile matrix verification and bot-friendliness smoke checks

Existing issues updated:

- #108 — parent feature comment linking the child issues and induction batch.
- #109 — spike comment with alternate-page guardrails and source links.

## Findings

### 1. Static artifacts are the right foundation

Google documents that JavaScript pages go through crawling, rendering, and indexing, and that app-shell HTML without content requires rendering before the page content is visible. It also describes dynamic rendering as a workaround, not a recommended long-term solution.

Pagenary's current approach is therefore directionally right: static snapshots and root fallback HTML make meaningful content available before JavaScript executes.

Alignment: aligned.
Confidence: high.
Evidence:

- Google Search Central, JavaScript SEO basics: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google Search Central, dynamic rendering: https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering

### 2. Robots, noindex, and artifact generation need a coherent profile resolver

Google's robots.txt guidance states that robots.txt controls crawler access, not whether a page is kept out of Google. Google also warns that `noindex` must be visible to the crawler; if robots.txt blocks the page, the crawler may never see the `noindex` directive.

That means Pagenary should not treat `robots.blockAll`, `noIndex`, sitemap generation, `llms.txt`, static pages, and root fallback as independent toggles in user-facing docs. Internally they can remain independent, but product-level profiles should resolve them coherently.

Alignment: partial.
Confidence: high.
Evidence:

- Google robots.txt intro: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Google noindex guidance: https://developers.google.com/search/docs/crawling-indexing/block-indexing
- Google robots meta/X-Robots-Tag: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag

### 3. `open` should mean more than crawlable HTML

Static HTML is useful, but LLM and automation consumers benefit from concise and structured extraction formats. The llms.txt proposal describes a root Markdown map for LLM-friendly navigation. Practitioner sources from Fern and GitBook converge on the same pattern: generate AI-readable docs during the build, keep them current, prioritize canonical pages, and offer clean Markdown/structured forms rather than forcing agents to parse visual HTML.

Pagenary should add `content-index.json`, `documents.jsonl`, and per-page JSON/text/Markdown extracts under the `open` profile.

Alignment: partial.
Confidence: moderate.
Evidence:

- llms.txt specification: https://llmstxt.org/
- Fern llms.txt guide: https://buildwithfern.com/post/optimizing-api-docs-ai-agents-llms-txt-guide
- GitBook llms.txt guide: https://www.gitbook.com/blog/what-is-llms-txt

### 4. AI crawler controls are advisory but product-relevant

Cloudflare distinguishes search, AI input/grounding, and AI training signals in generated robots.txt content signals. Cloudflare also stresses these are preferences, not hard technical countermeasures. Google AI features use existing Google Search controls, so Pagenary should not imply that content signals govern every AI/search surface.

Pagenary should expose optional AI crawler/content-signal preferences, document them as advisory, and include them in profile defaults only when useful.

Alignment: missing capability.
Confidence: moderate.
Evidence:

- Cloudflare managed robots.txt docs: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
- Cloudflare Content Signals Policy: https://blog.cloudflare.com/content-signals-policy/
- Google AI features and your website: https://developers.google.com/search/docs/appearance/ai-features

### 5. Alternate crawlable copies require anti-doorway guardrails

Google spam policies constrain pages created mainly for search manipulation, scaled duplicate content, and misleading differences between bot-facing and user-facing content. Practitioner guidance also warns that orphan/generated pages can look like doorway pages when they mainly funnel users back to a canonical page.

Pagenary should separate honest machine-readable extracts from alternate SEO variants. The former belongs in #108/#114. The latter should stay in #109 until the product can define user value, canonical/back-link behavior, sitemap rules, and noindex/index defaults.

Alignment: design risk identified.
Confidence: high for policy risk, moderate for practitioner pattern.
Evidence:

- Google spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Orbit Media doorway/orphan-page guidance: https://www.orbitmedia.com/blog/doorway-pages-seo/

### 6. Structured data should represent visible, canonical content

Pagenary emits JSON-LD for static snapshots. As machine-readable outputs expand, structured data should stay tied to visible page content and canonical URLs. Do not add schema markup for hidden or variant content that is not represented on the page.

Alignment: generally aligned, needs profile tests.
Confidence: high.
Evidence:

- Google structured data intro: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data
- Google structured data policies: https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## Recommended Profile Matrix

| Output / Behavior | standard | open | limited | locked |
|---|---:|---:|---:|---:|
| Root fallback HTML | yes | yes | yes or explicit | no by default |
| Root/default-page meta | yes | yes | yes with noindex | minimal/noindex |
| `/pages/*.html` snapshots | yes | yes | optional/off | no |
| `sitemap.xml` | yes | yes | no by default | no |
| `robots.txt` | allow public paths | allow extract paths | restrictive/no sitemap | `Disallow: /` |
| `llms.txt` | yes | yes, richer | no | no |
| `llms-full.txt` | no | optional/size-gated | no | no |
| `content-index.json` | no | yes | no | no |
| `documents.jsonl` | no | yes | no | no |
| per-page JSON/text/Markdown | no | yes | no | no |
| AI content signals | optional | search/ai-input friendly, configurable | restrictive | restrictive |
| Hosting auth required for real privacy | n/a | n/a | yes if private | yes |

## Phased Roadmap

### Phase 0: Source induction and issue setup

Status: completed in this spike.

- Filed induction issues #155-#166 in `section9/research-papers`.
- Filed Pagenary issues #113-#117.
- Linked #108 and #109 to the new work.

### Phase 1: Profile resolver

Implement #113 first.

- Add `seo.discoverabilityProfile` schema enum.
- Add a single resolver that converts profile + overrides into effective SEO behavior.
- Document the matrix.
- Add tests for resolved settings.

### Phase 2: Coherent limited/locked behavior

Implement #115 before adding more open artifacts.

- Ensure restrictive profiles suppress sitemap, `llms.txt`, future machine-readable outputs, and static snapshots as designed.
- Make `noIndex` and `robots.blockAll` interactions explicit.
- Keep privacy warnings prominent.

### Phase 3: Open extraction artifacts

Implement #114.

- Generate `content-index.json`.
- Generate `documents.jsonl`.
- Generate per-page JSON and text/Markdown extracts.
- Consider size-gated `llms-full.txt`.
- Update `llms.txt` to prioritize canonical pages and link to extracts.

### Phase 4: AI crawler controls

Implement #116 after the profile resolver.

- Add optional content-signal config.
- Generate advisory `Content-Signal` lines/comments in robots.txt.
- Make defaults profile-aware.
- Document limitations and interaction with Google AI/Search controls.

### Phase 5: Verification gates

Implement #117 across the prior phases.

- Add profile matrix tests.
- Expand `check:seo`.
- Validate parseability and presence/absence of generated artifacts.
- Add fixtures for open, standard, limited, and locked tenants.

### Phase 6: Alternate crawlable variants

Continue #109 only after the above work stabilizes.

- Research legitimate use cases.
- Define anti-doorway guardrails.
- Require canonical/back-link behavior and sitemap/noindex rules.
- Default variants to conservative visibility until proven useful.

## Open Questions

- Should `limited` keep root fallback visible for no-JS humans while omitting `/pages/` and LLM artifacts?
- Should `open` emit Markdown extracts derived from source Markdown, rendered HTML, or both?
- Should `documents.jsonl` include raw HTML, plain text, Markdown, or separate fields for each?
- Should `Content-Signal` be profile default behavior or only explicit opt-in?
- Should Pagenary produce `.well-known` discovery files for API/documentation catalogs in a later phase?

