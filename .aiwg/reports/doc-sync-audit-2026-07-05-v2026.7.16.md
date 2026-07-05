# Doc Sync Audit - 2026-07-05 - v2026.7.16

Direction: code-to-docs
Scope: release v2026.7.16 docsite favicon and share-target changes

## Scope Reviewed

- Pagenary docsite tenant config and public assets:
  `apps/publisher/tenants/pagenary/config.json`,
  `apps/publisher/tenants/pagenary/.public/favicon.svg`
- Shared shell favicon markup: `apps/publisher/src/index.html`
- Share target catalog, schema, tests, docs, and icon assets:
  `apps/publisher/src/lib/share.js`, `apps/publisher/tenants.schema.json`,
  `apps/publisher/docs/TENANT-CONFIG.md`,
  `apps/publisher/src/assets/share-icons/*`,
  `apps/publisher/__tests__/src/lib/share.test.js`
- Release metadata: `CHANGELOG.md`

## Findings

No blocking documentation drift found.

Documentation and configuration updated for this release:

- The Pagenary docsite now ships the same `favicon.svg` artwork as the main
  `pagenary.com` site.
- The shared shell now advertises SVG favicon support first, with the existing
  PNG favicon path retained as an alternate fallback.
- Pocket was removed from the supported built-in share target list because the
  service has shut down.
- Tenant schema, share target docs, local icon manifest/readme, focused tests,
  and the Pagenary tenant's enabled share services were updated to remove Pocket.

Human-review items:

- Existing docs case-mismatch warnings remain in the docs build. They predate
  this release and were not expanded by the favicon/share-target change.
- Existing advisory accessibility findings remain in `TENANT-CONFIG.md` and
  `SEO-STRATEGY.md`. They predate this release and are not caused by this
  change.

## Validation

- `npm run build:site --workspace @pagenary/publisher` passed.
- `npm run test --workspace @pagenary/publisher -- --runTestsByPath __tests__/src/lib/share.test.js` passed.
- Pagenary docsite `site/favicon.svg` matches the main `pagenary.com` favicon.
- Source and generated docsite output contain no remaining Pocket share target
  references.
- Public package version and lockfile sync should be checked by the release
  wrapper before tagging.

## Files Changed By Doc Sync

- `CHANGELOG.md`
- `apps/publisher/docs/TENANT-CONFIG.md`
- `apps/publisher/src/assets/share-icons/README.md`
- `apps/publisher/src/assets/share-icons/manifest.json`
- `apps/publisher/tenants.schema.json`

## Recommendation

Proceed with the v2026.7.16 release gates.
