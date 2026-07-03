# Doc Sync Audit - 2026-07-03

## Scope

- Direction: code-to-docs
- Trigger: sync documentation after `3c6862b` (`feat: support authored section heading pages`)
- Changed-code focus:
  - `apps/publisher/scripts/build-tenants.js`
  - `apps/publisher/src/manifest.js`
  - `apps/publisher/src/lib/router.js`
  - `apps/publisher/__tests__/scripts/build-tenants.test.js`
  - `apps/publisher/__tests__/src/lib/router.test.js`
- Documentation focus:
  - `apps/publisher/docs/TENANT-CONFIG.md`
  - `apps/publisher/docs/SEO-STRATEGY.md`
  - `apps/publisher/docs/API.md`
  - `apps/publisher/docs/DEVELOPER-GUIDE.md`

## Findings

### Fixed

- `apps/publisher/docs/API.md` still showed grouped manifest entries as
  container-only. Updated the manifest example, `flattenManifest`,
  `collectExportableSections`, and `SectionEntry` notes to describe authored
  group pages that carry both `module` and `subsections`.
- `apps/publisher/docs/DEVELOPER-GUIDE.md` described nested `sections` only as
  expandable groups. Updated it to explain when a grouped entry should include
  `file` and when it should remain navigation-only.
- `apps/publisher/src/lib/search.js` had a stale implementation comment saying
  group entries with subsections are not navigable targets. Updated it to
  distinguish authored groups with modules from container-only groups.
- `apps/publisher/src/lib/export.js` described exportable sections as leaves.
  Updated the comment to cover module-bearing authored groups.

### Already aligned

- `apps/publisher/docs/TENANT-CONFIG.md` documents `file` alongside
  `subsections`, the generated child links, and the first-child route fallback.
- `apps/publisher/docs/SEO-STRATEGY.md` documents section heading page usage,
  profile-aware SEO artifacts, and doorway/keyword-stuffing guardrails.

## Validation

- `npm test --workspace @pagenary/publisher -- __tests__/src/lib/search.test.js __tests__/src/lib/export.test.js --runInBand`
  passed: 59 tests.
- `npm run check --workspace @pagenary/publisher` passed. It reported the
  existing example config contrast warnings and no failures.

## Remaining human-review items

- None identified.
