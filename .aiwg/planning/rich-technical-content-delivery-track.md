# SDLC Planning Track: Rich Technical Content Rendering

**Status:** PLANNED — pending planning audit
**Date:** 2026-08-05
**Scope:** inline LaTeX, LaTeX pages, Mermaid, PlantUML, and all related surfaces

## Outcome

Deliver secure, deterministic, accessible, static-first support for four authoring
modes through one rendering platform. Construction must not begin until the user
audits this planning baseline.

## Work Breakdown and Dependencies

### Phase 0 — Decisions and risk retirement

1. Approve REQ-rich-technical-content and ADR-019.
2. Build representative fixture corpus and run LaTeXML/make4ht/Pandoc/Tectonic
   bake-off for LaTeX pages.
3. Threat-model external renderers, generated markup, caches, and tenant policy.
4. Benchmark cold/warm builds and set numeric resource/performance defaults.
5. Complete dependency/license/checksum review and CI image strategy.

**Gate:** selected page converter/profile, approved security boundary, measurable
budgets, no unresolved P0/P1 feasibility risk.

### Phase 1 — Shared rendering foundation

1. Introduce source-aware tokenizer/typed nodes without changing existing output.
2. Add renderer adapter, structured diagnostic, dependency graph, and cache APIs.
3. Add tenant/page schemas and validator/CLI doctor reporting.
4. Wire normalized payloads into section modules, snapshots, search/corpus,
   `llms.txt`, export, Markdown delivery, accessibility, and incremental builds.
5. Establish fixtures and artifact-parity test harness.

**Gate:** no Markdown regression; mock adapter proves every downstream surface.

### Phase 2 — Inline LaTeX

1. Vendor/pin KaTeX CSS/fonts/runtime build dependency.
2. Implement protected delimiter tokenizer and build-time HTML+MathML adapter.
3. Implement bounds, macro scope, trust policy, warnings/strict failure.
4. Add semantic search extraction, print/reflow styles, accessibility linting.
5. Add documentation, examples, VS Code validation/preview, and full test matrix.

**Gate:** complete supported-syntax corpus, security bounds, screen-reader review,
offline/self-CSP, snapshot/search/export parity.

### Phase 3 — Mermaid hardening

1. Inventory existing Mermaid corpus and snapshot version-compatibility behavior.
2. Replace CDN import with exact local patched dependency.
3. Harden immutable config, bounds, parse validation, deterministic IDs, errors,
   theme tokens, and accessible metadata.
4. Implement optional build-time adapter and normalized static fallback.
5. Add advisory regression, offline/CSP, accessibility, visual, and upgrade tests.
6. Accept ADR-019 and mark ADR-012 superseded after migration.

**Gate:** corpus compatibility accepted; runtime and build modes meet parity.

### Phase 4 — PlantUML

1. Package pinned JAR/container, Graphviz/layout engine, fonts, and licenses.
2. Implement fences/metadata and content-addressed asset adapter.
3. Implement SANDBOX process isolation, environment scrubbing, limits, cache, and
   safe output handling.
4. Add optional tenant-local ALLOWLIST includes with dependency tracking.
5. Add accessibility, static/export/search integration, attack fixtures, docs,
   CLI doctor, and preview diagnostics.

**Gate:** security suite proves filesystem/network/secret isolation and timeout.

### Phase 5 — LaTeX page mode

1. Add `.tex` discovery and explicit manifest content type.
2. Package the selected pinned converter/toolchain and standard-web profile.
3. Implement isolated compilation, include/asset/bibliography dependency tracking,
   output normalization/sanitization, metadata extraction, and optional PDF.
4. Integrate navigation, anchors, TOC, search, corpus, `llms.txt`, SEO snapshots,
   export, narration/reading metadata, accessibility reports, and source delivery.
5. Implement incremental rebuild/pruning, CLI diagnostics, editor preview, docs,
   migration guide, and compatibility report.

**Gate:** representative corpus meets declared compatibility profile; unsupported
packages fail transparently; HTML remains the accessible primary page.

### Phase 6 — System hardening and release

1. Cross-engine concurrency, cache poisoning, cleanup, and multi-tenant tests.
2. Browser/accessibility/visual/print/offline/CSP UAT.
3. Performance regression and artifact reproducibility gates.
4. Supply-chain SBOM/checksum, upgrade and rollback runbooks.
5. Documentation completeness plus a help-doc syntax gallery and functional
   example tenants covering every supported authoring feature.
6. Final traceability and release readiness audit.

## Issue Map

The canonical Gitea epic owns the delivery graph. Planned children:

1. [#166](https://git.integrolabs.net/roctinam/pagenary/issues/166) — LaTeX page converter bake-off and fixture corpus.
2. [#167](https://git.integrolabs.net/roctinam/pagenary/issues/167) — Renderer threat model and sandbox baseline.
3. [#168](https://git.integrolabs.net/roctinam/pagenary/issues/168) — Shared parser/adapter/cache/diagnostic foundation.
4. [#169](https://git.integrolabs.net/roctinam/pagenary/issues/169) — Downstream static/search/export/accessibility integration.
5. [#170](https://git.integrolabs.net/roctinam/pagenary/issues/170) — Inline LaTeX implementation.
6. [#171](https://git.integrolabs.net/roctinam/pagenary/issues/171) — Mermaid local vendoring and hardening.
7. [#172](https://git.integrolabs.net/roctinam/pagenary/issues/172) — Mermaid build-time mode.
8. [#173](https://git.integrolabs.net/roctinam/pagenary/issues/173) — PlantUML local sandboxed renderer.
9. [#174](https://git.integrolabs.net/roctinam/pagenary/issues/174) — LaTeX page-mode implementation.
10. [#175](https://git.integrolabs.net/roctinam/pagenary/issues/175) — VS Code preview/schema/CLI doctor integration.
11. [#176](https://git.integrolabs.net/roctinam/pagenary/issues/176) — Cross-renderer test, performance, reproducibility, and release hardening.
12. [#177](https://git.integrolabs.net/roctinam/pagenary/issues/177) — Documentation, examples, migration, operations, and rollback.
13. [#178](https://git.integrolabs.net/roctinam/pagenary/issues/178) — Comprehensive functional syntax gallery and help-doc example base.
14. [#180](https://git.integrolabs.net/roctinam/pagenary/issues/180) — Refresh examples and the help-doc base as supported syntax expands.

Parent epic: [#165](https://git.integrolabs.net/roctinam/pagenary/issues/165).

Research-induction issues
[section9#774](https://git.integrolabs.net/section9/research-papers/issues/774),
[#775](https://git.integrolabs.net/section9/research-papers/issues/775),
[#776](https://git.integrolabs.net/section9/research-papers/issues/776), and
[#777](https://git.integrolabs.net/section9/research-papers/issues/777) track the
four papers named in the best-practices report. They are evidence dependencies of
the planning epic, not implementation blockers unless the planning audit requests
deeper validation.

## Definition of Ready for Construction

- Planning audit accepts scope, terminology, architecture, and issue graph.
- All RTC requirements have an issue and planned verification.
- Research sources and induction tasks are linked.
- Page converter and security defaults have evidence rather than placeholders.
- High risks have spike/threat-model owners and acceptance gates.
- No child issue silently weakens full inline-LaTeX math syntax or the declared
  page-level LaTeX compatibility profile.
