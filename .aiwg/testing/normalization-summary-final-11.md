# Completed testing normalization — 2026-09-08 (America/New_York)

The final AIWG testing-quality 2.0.0 assessment is **conformant: 181 passed gates, zero failed, zero unknown**. All 24 required lanes have complete discovery and passing execution, all 81 test/harness files have complete-file oracle reviews, and all 25 production-source negative controls were detected and restored successfully. This closes the recorded testing findings within the declared protocol.

Work is uncommitted in `/tmp/pagenary-runtime-delivery-184-186`, branch `work/184-186-runtime`, based on `e4f4e6fa3ea7e31bcf0faa35196e3d22788f5232`. The original checkout's preexisting source changes were preserved. No commit, push, PR or release was performed.

- [Machine assessment](assessment-final-11.json) and [CLI report](report-final-11.md)
- [Protocol](conformance.yaml), [inventory](inventory-11.json), [discovery](discovery-all-11.json), [execution](execution-all-11.json), [negative controls](controls-all-11.json)
- [Independent restored inventory](inventory-restored-11.json): exact file records and snapshot match baseline
- [48 publisher file reviews](reviews-publisher-06.json) and [33 React/harness/tooling file reviews](reviews-harnesses-react-tooling-05.json)

Protocol hash: `ac3233dffcc0b7d5dc972f58fa45d4d6e801623508f09c5d32b64d1a32786225`.
Source/configuration/test snapshot: `d01e38381957cd336e52fedb0d1df9720e8abbeb1bc49c58c6f811911b2060f3`.
Execution run: `9b84b54f-3684-442d-aecf-44bd90bf3329`; controls run: `245b02b0-e8c9-4fa4-88f8-3d2a52224617`.

The inventory binds 192 source files, 81 test files and 163 configuration/input files; some roles overlap. Static declarations are not used as executed-case totals. Actual runner registration expands parameterized tests. There are no missing required registrations, failed executions or skips in this assessment.

| Lane | Files | Registered cases/actions | Passed / failed / skipped |
| --- | ---: | ---: | ---: |
| `publisher` | 48 | 725 | 725 / 0 / 0 |
| `react` | 10 | 49 | 49 / 0 / 0 |
| `apps-publisher-scripts-check-accessibility-linter-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-accessibility-report-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-accessibility-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-media-renderers-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-narration-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-reading-metadata-js` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-rich-content-traceability-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-check-syntax-inventory-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-smoke-accessibility-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-smoke-browser-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-smoke-rich-content-atspi-py` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-smoke-rich-content-matrix-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-publisher-scripts-smoke-syntax-gallery-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-react-scripts-audit-runtime-bundles-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-react-scripts-test-dataset-browser-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-react-scripts-test-record-browser-mjs` | 1 | 1 | 1 / 0 / 0 |
| `apps-vscode-extension-scripts-smoke-mjs` | 1 | 1 | 1 / 0 / 0 |
| `ci-rich-content-qualify-mjs` | 1 | 1 | 1 / 0 / 0 |
| `extension-activation` | 1 | 1 | 1 / 0 / 0 |
| `publisher-seo` | 1 | 1 | 1 / 0 / 0 |
| `tooling` | 2 | 12 | 12 / 0 / 0 |
| `apps-publisher-scripts-smoke-styles-mjs` | 1 | 1 | 1 / 0 / 0 |

Publisher has 725 cases, React 49 and tooling 12. Each of the 21 standalone harness lanes reports one file-level action; internal checks are not independent canonical cases. Lanes overlap in behavior (for example styles and SEO), so adding these numbers is not a unique-behavior test count.

| Observed testing | Actual boundary and resources | Limit |
| --- | --- | --- |
| Publisher unit/integration | Real modules, builds, filesystem fixtures and owned child processes; explicit doubles where appropriate | Doubles prove their configured boundary |
| React/runtime | Real validation, projections and browser IndexedDB/dataset/record actions | Unit Node lane is not browser rendering coverage |
| Browser/style/accessibility | Actual Chromium, Firefox and WebKit; generated content, computed CSS, no-JavaScript scrolling; owned Firefox AT-SPI session | Linux and pinned engine versions only |
| Extension | Validator and activation behavior through mocked VS Code host | No installed-editor session claimed |
| External renderers | Offline restricted container, real pinned tools and readonly live-source bind | Qualified image and fixture corpus only |
| Collector qualification | Genuine Node events, malformed streams and owned child failures | Node 24.12.0 qualified; other versions require qualification |

Coverage measurements are **unavailable**. The protocol defines no line/branch/function coverage thresholds; its passing coverage-policy gate does not mean measured coverage or threshold enforcement. The 25 controls are bounded sensitivity demonstrations, not a whole-program mutation score.

The initial sample (20 publisher files plus the smaller original areas) expanded to a full 81-file census. The two final review artifacts retain **73 resolved findings** (50 publisher, 23 other), their explanations and source bindings. No unreviewed remainder remains. Original assessments, failed runs and superseded reviews remain intact, including the incorrect early DocsMap resolution explicitly corrected by the final review.

| Repair group | Result and verification |
| --- | --- |
| Registration and execution | Explicit Node 24.12.0 CI, sequential root scripts, pinned browser setup, genuine Jest/Node registration, strict canonical outcomes and 12 tooling qualification cases |
| Test oracles | Independent expected values, nonempty prerequisites, required IDs before ordering/absence, direct production imports, exact diagnostics and actual browser assertions |
| Fixture ownership | Isolated build workspaces, explicit setup, bounded process/server lifecycle, fresh standalone fixtures and cleanup registered before assertions |
| Production defects exposed by tests | Strict renderer policy, password-colon parsing, own-key lookup guards, recursive exports/llms, unsafe-TeX detection, viewport scrolling and inert search-text extraction repaired |
| Live harnesses | DocsMap derived from real source configuration, observed hashed browser assets, dataset/record cleanup, AT-SPI owned-route checks and live-source offline renderer qualification |

Every source/configuration normalization used a concrete guarded plan and preserved apply receipt. Failed historical experiments remain evidence; no failed/setup/skipped outcome was converted into a pass. Final `git diff --check` passed. [Testing instructions](../../TESTING.md) explain setup, runtime pins and full collection; the final status-only documentation update is outside the inventoried SUT and has its own [plan](plan-testing-final-11.json) and [receipt](apply-testing-final-11.json).

All controls selected cases that passed before mutation, failed under the exact source-only change, and passed after restoration with unchanged identities. Semantic reviews are recorded for [publisher](review-publisher-control-11.json), [React](review-react-control-11.json), [standalone harnesses](review-control-harnesses-11.json), [search](review-search-control-11.json) and [tooling](review-tooling-control-11.json). No process startup error or collector timeout qualified as a kill. The matrix control reached the loaded browser page and failed waiting for the specific removed MathML selector; its inference is limited to that first mutant browser. Node canonical reports retain case statuses but omit assertion stacks: React/tooling attribution therefore also uses hash-matched immutable test bodies and exact source deltas. Search's valid-200 sentinel request isolates the unwanted resource activation from incidental 404s.

The local protocol intentionally records absolute browser paths, checkout mounts and an immutable renderer image ID. Another host/checkout must review and rebind those values and regenerate evidence. Browser tooling was explicitly provisioned before collection, not installed implicitly by a runner. The Node 20 incompatibility and successful Node 24 qualification are retained in the runtime qualification history. No new tool recommendation or claim of future-version compatibility is made.

No required testing evidence remains open for this snapshot. Repository AIWG health is tracked separately in the original checkout: signed-release authentication and explicit context-baseline authorization remain pending.
