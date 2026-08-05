# Rich Technical Content Delivery Traceability

**Requirements:** `REQ-rich-technical-content.md`
**Architecture:** `architecture/adr/ADR-019-rich-technical-content-rendering.md`
**Release gate:** `testing/rich-content-qualification-report.md` and Gitea #176

Each row names concrete executable or reviewed evidence. The canonical
qualification workflow runs `ci/rich-content/qualify.mjs`; the documentation
workflow runs the syntax inventory and real-browser matrix.

## Shared renderer platform

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-001 | `rich-content-tokenizer.js` | `rich-content-core.test.js` protected typed-node tests |
| RTC-FR-002 | `rich-content-adapters.js` adapter contract | `rich-content-core.test.js` registry/normalization test |
| RTC-FR-003 | normalized adapter payload and semantic HTML utilities | core, materialization, and `semantic-html.test.js` |
| RTC-FR-004 | `resolveFailurePolicy` and strictness ordering | core diagnostics plus Mermaid/PlantUML/LaTeX strict/warn tests |
| RTC-FR-005 | `rich-content-cache.js`; renderer-specific identities | cache integrity/concurrency tests and LaTeX dependency invalidation test |
| RTC-FR-006 | escaped fallback utility | core, Mermaid, PlantUML, and LaTeX fallback tests |
| RTC-FR-007 | CLI doctor plus renderer metadata | `cli-doctor.test.js`, LaTeX availability metadata, external version probes |

## Inline LaTeX

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-010 | `inlineLatex` schema/config and “Inline LaTeX” help | syntax inventory and VS Code schema tests |
| RTC-FR-011 | exact KaTeX 0.18.1 parser/renderer | syntax gallery complete math-language examples and `inline-latex.test.js` |
| RTC-FR-012 | delimiter configuration | default/opt-in delimiter tests |
| RTC-FR-013 | protected Markdown regions | inline-LaTeX exclusion test and shared tokenizer test |
| RTC-FR-014 | build-time HTML+MathML and local vendor assets | inline render test, offline scan, browser MathML assertion |
| RTC-FR-015 | clamped KaTeX/source/macro/output controls | resource-bound and strict-error test |
| RTC-FR-016 | immutable `trust:false`, per-page macro copy | macro isolation/security tests |
| RTC-FR-017 | semantic extraction without KaTeX layout noise | `semantic-html.test.js`, search/corpus rich-text tests |

## Complete LaTeX pages

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-020 | manifest `contentType: latexPage` and safe discovery | content-type/schema/discovery tests |
| RTC-FR-021 | complete-document preflight and explicit profiles | document-boundary/profile tests |
| RTC-FR-022 | semantic HTML/MathML plus optional sibling PDF | materialization/PDF tests and real external corpus |
| RTC-FR-023 | normalized page/reading/accessibility metadata | metadata extraction test and syntax-gallery page |
| RTC-FR-024 | versioned profile/package allowlist | unsupported-package fixture and renderer inventory |
| RTC-FR-025 | unsafe-command/package rejection and bounded no-shell runner | hostile fixture, command-runner test, networkless/read-only container |
| RTC-FR-026 | contained dependency/symlink validation and hashes | nested include, symlink escape, asset rewrite, cache invalidation tests |
| RTC-FR-027 | source/dependency/recursion/output/process bounds | preflight bounds, PDF limit, subprocess timeout, container limits |
| RTC-FR-028 | semantic normalizer and local asset rewriting | active-content/URL sanitization and materialization tests |
| RTC-FR-029 | documented converter comparison and selection | `research/spikes/latex-page-converter-bakeoff.md` plus canonical external corpus |

## Mermaid

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-030 | exact local Mermaid 11.16.0 lock and copied bundle | lock integrity, offline scan, 4 MiB browser budget |
| RTC-FR-031 | runtime-local and build adapters with shared fence syntax | materialization mode tests and external build corpus |
| RTC-FR-032 | immutable strict configuration and source/edge/output bounds | renderer-security and build-adapter failure tests |
| RTC-FR-033 | deterministic IDs/cache material | stable ID and repeated-render tests |
| RTC-FR-034 | caption/source disclosure and named figure/SVG output | adapter test and three-engine reading-order matrix |
| RTC-FR-035 | supported theme configuration | 5 families × neutral/forest/dark external visual matrix and forced-color browser gate |
| RTC-FR-036 | versioned compatibility/security gate | qualification workflow, syntax corpus, and upgrade/rollback runbook |

## PlantUML

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-040 | `plantuml`/`puml` aliases and wrapper normalizer | alias/envelope tests and eight-family external corpus |
| RTC-FR-041 | local-only build renderer | unavailable-tool fallback test and networkless container |
| RTC-FR-042 | SANDBOX bounded scrubbed subprocess | renderer/security tests and restricted canonical Docker invocation |
| RTC-FR-043 | default-off contained ALLOWLIST includes | traversal/symlink/import/include tests |
| RTC-FR-044 | pinned Java/PlantUML/Graphviz/fonts/toolchain digest | external version probes, checksum and license inventory |
| RTC-FR-045 | content-addressed sanitized SVG and optional PNG | adapter SVG/PNG tests and real corpus assets |
| RTC-FR-046 | required text equivalent/caption/decoration | adapter accessibility diagnostics and browser figure assertions |

## Delivery surfaces

| Requirement | Implementation evidence | Verification evidence |
|---|---|---|
| RTC-FR-050 | normalized section HTML feeds static snapshot generator | syntax-gallery static pages and self-CSP redirect matrix |
| RTC-FR-051 | semantic export plus print CSS | `export.test.js`, markdown-delivery rich-content test, print/PDF browser gate |
| RTC-FR-052 | shared semantic extractor for search/discovery artifacts | search index, SEO corpus, semantic HTML, Docs Map, and reading tests |
| RTC-FR-053 | authored-source embedding and Markdown delivery artifacts | `markdown-delivery.test.js` rich math/diagram and route tests |
| RTC-FR-054 | accessibility content linter/report | linter/report tests, strict policy tests, syntax-gallery advisory gate |
| RTC-FR-055 | shared authoring contract, schema, preview and diagnostics | VS Code schema/validation/preview smoke and exact-package tests |
| RTC-FR-056 | schemas, doctor/help, docs, examples, vendoring and inventory | 56/56 executable syntax inventory and documentation build |
| RTC-FR-057 | dependency hashes and targeted/incremental rebuild pipeline | LaTeX dependency identity tests and build-tenants incremental/pruning tests |

## Non-functional requirements

| Requirement | Verification evidence |
|---|---|
| RTC-NFR-001 | path/symlink/environment/command tests; networkless, read-only, non-root canonical container |
| RTC-NFR-002 | repeated byte comparisons, content-addressed outputs, fixed-epoch whole-build reproducibility |
| RTC-NFR-003 | warn-mode per-node fallbacks and unrelated-content materialization tests |
| RTC-NFR-004 | cold/miss and warm/hit invocation-count tests; configurable timeout/output bounds; browser cold/warm Mermaid thresholds |
| RTC-NFR-005 | MathML, captions/names/reading order, WCAG media/reflow matrix, Chromium accessibility tree, AT UAT record |
| RTC-NFR-006 | three-engine offline/self-CSP matrix, local assets, static snapshot/no-JS tests |
| RTC-NFR-007 | no remote renderer defaults, strict external-request denial, scrubbed environment tests |
| RTC-NFR-008 | source-located sanitized diagnostics and renderer metadata tests/qualification report |
| RTC-NFR-009 | shared syntax gallery, legacy Mermaid runtime mode, compatibility corpus and migration diagnostics |

## Canonical execution

- `docsite-build.yml`: syntax inventory, real tenant build, Chromium accessibility
  smoke, syntax-gallery smoke, and Chromium/Firefox/WebKit rich-content matrix.
- `rich-content-qualification.yml`: pinned real LaTeXML, Pandoc, make4ht,
  Tectonic, Mermaid CLI/browser, PlantUML, Graphviz, fonts, timeout attack,
  determinism, sanitizer, and network/isolation corpus.
- `rich-content-qualification-report.md`: exact commands, versions, resource
  posture, results, remaining manual evidence, and supply-chain disposition.
