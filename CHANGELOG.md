# Changelog

All notable changes to `@pagenary/publisher` are documented here.
Format is based on [Keep a Changelog](https://keepachangelog.com/); versioning
is CalVer (`YYYY.M.PATCH`, no leading zeros — see `.claude/rules/versioning.md`).

## [2026.5.1] - 2026-05-26

### Fixed

- **CLI from a consumer repo (#11):** `pagenary build:tenants` resolved
  `build.js` and packaged assets against the caller's CWD, so
  `npx @pagenary/publisher build:tenants` failed with `MODULE_NOT_FOUND` when
  run from a consumer project. The bin now resolves bundled scripts/assets from
  the package directory while keeping tenant `source`/`target`/`registry`
  relative to the caller.
- **`strictLinks` gate (#12):** `strictLinks: true` logged broken-link errors
  but the build still succeeded and exited 0, making the gate a no-op. Broken
  internal links now fail the tenant and exit non-zero so CI can gate on them.
  `strictLinks: false` remains warn-and-continue.
- **External-tenant SEO (#13):** building an external `type: local` tenant
  surfaced `sectionEntry is not defined` and skipped SEO artifacts. Fixed via
  the `strictLinks` propagation above; clean and warn-mode builds now generate
  `sitemap.xml`, `robots.txt`, and `llms.txt` correctly.

## [2026.5.0] - 2026-05-25

### Added

- Initial public release of `@pagenary/publisher` — a multi-tenant static
  documentation publisher (hash-based routing, per-tenant bundles, zero runtime
  dependencies).
- CI-portable `pagenary` own-docs tenant — the dogfooded reference site.
- Compiled site shipped inside the npm package under `site/` via `prepack`.
- `pagenary` bin CLI: `build`, `build:tenants [id]`, `tenants:list`, `serve`.
- Compiled site bundle attached to Gitea + GitHub releases (with checksums).
- Supply-chain split: internal Gitea registry (Gitea CI) and public npmjs.org
  with provenance (GitHub Actions).

### Fixed

- Repaired the search/export test suites (17 failures) — a `flattenManifest`
  regression that dropped module-less sections, plus a stale export-branding test.
