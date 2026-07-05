# Doc Sync Audit - 2026-07-05

Direction: code-to-docs
Scope: release v2026.7.14 package/release/docs changes

## Scope Reviewed

- Public packages: `apps/blog-client`, `apps/embed`, `apps/publisher`
- Blog consumption documentation: `apps/publisher/docs/BLOG-CONSUMPTION.md`,
  `API.md`, `BLOG-LAYOUT.md`, `TENANT-CONFIG.md`
- Release documentation and config: `RELEASING.md`,
  `docs/contributing/releasing.md`, `.aiwg/release.config`,
  `tools/release/cut-tag.sh`
- Published docs tenant wiring:
  `apps/publisher/tenants/pagenary/manifest.json` and
  `apps/publisher/tenants/pagenary/content/BLOG-CONSUMPTION.md`

## Findings

No blocking documentation drift found.

High-confidence fix applied during the gate:

- Added the missing docs-tenant symlink for `BLOG-CONSUMPTION.md`; the first
  `build:tenants` run reported the file missing from the pagenary tenant content
  root even though the guide existed under `apps/publisher/docs/`.

Human-review items:

- Existing case-mismatch warnings remain in the docs build. They predate this
  release and were not expanded beyond the new guide references.
- Existing advisory accessibility findings remain in `TENANT-CONFIG.md` and
  `SEO-STRATEGY.md`. They predate this release and are not caused by the new
  package/docs work.

## Validation

- `npm run lint:content --workspace @pagenary/publisher` passed.
- `npm run test --workspace @pagenary/publisher` passed: 27 suites / 506 tests.
- `npm run build --workspace @pagenary/publisher` passed.
- `npm run build:tenants --workspace @pagenary/publisher` passed after adding
  the guide symlink; output includes 21 records and 23 sitemap URLs for the
  pagenary tenant.
- `npm run check:seo --workspace @pagenary/publisher` passed.

## Files Changed By Doc Sync

- `apps/publisher/tenants/pagenary/content/BLOG-CONSUMPTION.md`

## Recommendation

Proceed with the v2026.7.14 release gates.
