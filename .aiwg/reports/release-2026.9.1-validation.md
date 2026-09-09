# Release 2026.9.1 validation

The published 2026.9.0 publisher package omitted the shared authoring contract. Its CLI help worked, but importing the installed renderer failed with `ERR_MODULE_NOT_FOUND`. Workspace-only tests had not covered this package boundary.

The patch bundles the canonical contract during prepack and routes all four publisher imports through a resolver. Development still uses the canonical workspace module; detached installations use the bundled copy. Existing canonical load errors propagate.

Validation passed:

- 48 publisher suites, 726 tests, zero failures.
- Real prepack, extraction, detached renderer imports and a consumer tenant build with asserted output content.
- Isolated omission control: required packed-file assertion fails when the bundle is omitted, then the same regression passes after restoration; shared source hashes are unchanged.
- Content lint, default build, tenant builds and SEO smoke.
- All three public packages at 2026.9.1 pass tarball top-level and `.aiwg` exclusion checks; publisher includes the bundled contract.
- Documentation drift review and release-note threat assessment.

Pre-publication evidence: `.aiwg/testing/packaging-evidence-2026.9.1.tar.gz` (58 files), SHA-256 `b8fd2125b5a5be9ddfd6ce9fc6b790e760c6683db13d3919ea1b39c74a0ac747`. Extract from repository root to restore original logical paths. Failed test-development runs are retained alongside final passing evidence. The earlier 81-file conformance audit remains a historical snapshot; this patch adds package-boundary qualification without claiming measured coverage or rebinding old receipts.

This report records local gates before tag publication. Forge, registry and downloaded-artifact verification follow in the release workflow.
