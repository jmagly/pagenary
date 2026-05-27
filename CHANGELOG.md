# Changelog

All notable changes to `@pagenary/publisher` are documented here.
Format is based on [Keep a Changelog](https://keepachangelog.com/); versioning
is CalVer (`YYYY.M.PATCH`, no leading zeros — see `.claude/rules/versioning.md`).

## [Unreleased]

### Fixed

- **Nav disclosure arrow misaligned on Firefox:** the left-nav group arrow
  (`.nav-parent` / `.nav-parent-with-content`) relied on CSS Grid auto-placement
  mixed with a column-spanning summary, which Firefox resolved differently from
  Chromium — bumping the arrow onto its own centered row instead of beside the
  group title. Pinned the title, arrow/toggle, and summary to explicit grid
  rows/columns so placement is deterministic cross-browser.

## [2026.5.3] - 2026-05-27

### Added

- **Collection support (#18):** mark a content folder as a collection via
  `config.collections` (e.g. a blog) and the build emits a machine-readable
  `index.json` — `{ title, route, count, generated, posts[] }` derived from each
  post's YAML front matter (`title`, `date`, `summary`, `hero`, `tags`,
  `reading_time`, absolute `canonical`, `path`), sorted by `sortBy`/`order`.
  Optional RSS `feed.xml` (`feed: true`). Lets downstream sites consume posts
  without scraping rendered HTML. Adds a minimal, zero-dependency front-matter
  parser (`scripts/lib/frontmatter.js`).

### Fixed

- **Minification for installed consumers (#14):** `terser` is now an
  `optionalDependency` instead of a clone-only `devDependency`. Consumers
  building via the `pagenary` bin previously got `Terser not installed; skipping
  minification` and shipped unminified section JS unless they added `terser`
  themselves; it now installs and minifies by default.

## [2026.5.2] - 2026-05-27

### Added

- **`og:image` / `twitter:image` support (#16):** new `seo.ogImage` config field
  (absolute or site-relative) plus per-section `ogImage` override. When set,
  static snapshots and the runtime SPA emit `og:image` + `twitter:image` and
  upgrade `twitter:card` to `summary_large_image`. Absent → unchanged.

### Changed

- **Absolute SEO URLs by default (#15):** the SEO generator now resolves its
  base URL as `seo.siteUrl` → tenant `domain` (https-prefixed) → relative.
  Tenants that declare only `domain` now emit valid **absolute** sitemap
  `<loc>`, canonical, `og:url`, and robots `Sitemap:` URLs — previously these
  fell back to relative `/` (invalid per the sitemap spec) unless `seo.siteUrl`
  was set explicitly. Builds now warn when neither `domain` nor `seo.siteUrl`
  is configured.
- **Self-canonical static snapshots (#17):** static pages and the runtime SPA
  now canonicalize to the crawlable static URL (`/pages/<id>.html`) instead of
  the SPA `#hash` route. Search engines ignore URL fragments, so the previous
  `/#id` canonicals collapsed every page onto the homepage. The `#hash` route
  is still used for the human-facing JS redirect and "interactive version" link.
- Default site-title fallback changed from `Docs Toolkit` to `Documentation`.

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
