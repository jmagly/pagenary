# Doc Sync Audit - 2026-07-07 - Docs Map Dogfood

## Scope

- Direction: code-to-docs.
- Changed code/config:
  - `apps/publisher/tenants/pagenary/config.json`
  - `apps/publisher/scripts/lib/seo-generator.js`
  - `apps/publisher/__tests__/scripts/build-tenants.test.js`
- Documentation lanes:
  - Pagenary tenant configuration docs.
  - SEO/static snapshot architecture and API docs.
  - Root README feature summary.
  - Release changelog.

## Findings

### Fixed

- `docsMap.enabled` is now dogfooded by the Pagenary docs tenant. Updated
  `CHANGELOG.md` and root `README.md` so release-facing documentation describes
  the Docs Map as part of the dogfooded docs surface.
- The code now generates a bounded static fallback for dynamic Docs Map sections.
  Updated `apps/publisher/docs/TENANT-CONFIG.md`,
  `apps/publisher/docs/ARCHITECTURE.md`, and `apps/publisher/docs/API.md` so
  static snapshots, sitemap entries, and no-JS behavior match the implementation.

### Human Review

- Existing advisory build warnings remain outside this scoped sync:
  case-mismatch links in docs content, one raw HTML image missing alt text in
  `TENANT-CONFIG.md`, and one risky raw HTML `javascript:` URL in
  `SEO-STRATEGY.md`.

## Files Changed

- `CHANGELOG.md`
- `README.md`
- `apps/publisher/docs/TENANT-CONFIG.md`
- `apps/publisher/docs/ARCHITECTURE.md`
- `apps/publisher/docs/API.md`
- `.aiwg/.last-doc-sync`

## Validation

- `npm test -- --runTestsByPath __tests__/scripts/build-tenants.test.js --runInBand -t "docs map"`
- `npm run build:site`
- `git diff --check`

## Next Recommended Skill

- `flow-release` for the configured release gates.
