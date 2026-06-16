# Changelog

All notable changes to `@pagenary/publisher` are documented here.
Format is based on [Keep a Changelog](https://keepachangelog.com/); versioning
is CalVer (`YYYY.M.PATCH`, no leading zeros — see `.claude/rules/versioning.md`).

## [Unreleased]

## [2026.6.9] - 2026-06-15

### Added

- **Theming recipe gallery (#31).** A copy-paste gallery of common
  customization patterns — colors (custom palette, `dark`, `matrix`), basic
  style changes (fonts + brand), and every navigation position — plus a
  fully-custom showcase tenant. All recipes share one small docs set in
  `apps/publisher/examples/content-base/` and differ only by `config.json`; the
  showcase ("Interocitor Labs") lives in `apps/publisher/examples/interocitor/`.
  Build them with the new `npm run build:examples` (registry:
  `examples/recipes.tenants.json`). Documented in
  [`docs/THEMING-RECIPES.md`](apps/publisher/docs/THEMING-RECIPES.md) with a
  Playwright screenshot per recipe.
- **`navPosition: top | bottom | hybrid` (#31).** Navigation can now render as a
  horizontal bar above (`top`) or below (`bottom`) the content, or as a `hybrid`
  layout — a horizontal primary strip (generated from the tenant's top-level
  sections) plus the full left rail. Layout rules are scoped to a
  `data-nav-position` attribute set at build time; `left` (default) and the
  existing `right` are unchanged. Now documented in
  [`docs/TENANT-CONFIG.md`](apps/publisher/docs/TENANT-CONFIG.md), which also
  gains the previously-undocumented `theme`/`inkColor`/`mutedColor`/
  `gridLineColor`/`fontBody`/`fontMono` keys.

## [2026.6.8] - 2026-06-15

### Fixed

- **Runtime page `<title>` uses the tenant title, not the generic brand (#29).**
  The legacy manifest build path (the one Pagenary uses) dropped `siteTitle` from
  `SITE_CONFIG`, so `src/seo.js` rendered the runtime `<title>` as
  "<page> · Documentation" even though the static shell title (#28) was correct.
  `processTenantManifestLegacy` now receives `config` and sets
  `siteTitle`/`siteUrl`/`ogImage` (parity with the nested path). Verified in a real
  browser: "Welcome · Pagenary Docs". Caught only by a live check — static build
  tests passed throughout.
- **Tighter sidebar spacing (#30).** Reduced the default nav gap (`0.75rem` →
  `0.15rem`), item padding, and title↔summary gap so the left navigation reads
  denser and cleaner.

## [2026.6.7] - 2026-06-15

### Fixed

- **Allowlist `examples/` in the npm tarball audit so the package publishes.**
  v2026.6.6 added `examples/` to the published `files` but not to
  `ci/expected-tarball-top-level.txt`, so the supply-chain top-level audit failed
  and the npm publish aborted (the docs site and Gitea release still shipped).
  v2026.6.7 is the first npm build to include the publishing examples.

## [2026.6.6] - 2026-06-15

### Added

- **Publishing on-ramp for any docs repo.** New `docs/PUBLISHING.md` plus
  copy-paste `examples/` (GitHub Pages + Gitea Pages workflows and a minimal
  `tenants.json`) make it easy to turn any folder of Markdown into a deployed
  Pagenary site — navigation and titles are auto-discovered, so no manifest is
  required even when the layout isn't tidy. The `examples/` directory now ships in
  the npm package, and both READMEs link the guide.

## [2026.6.5] - 2026-06-15

### Changed

- **Repositioned the docs and the pagenary.com landing** around low-cost,
  self-hosted documentation for individual developers and app makers: turn a git
  repo of Markdown into a fast, searchable, SEO-ready docs site you host yourself
  for next to nothing, with the features you'd expect from a paid docs platform.
  Multi-tenant is demoted from the lead to a "scales to many sites when you need
  it" note. Refreshed value props and use cases across both READMEs,
  `SEO-STRATEGY.md`, `QUICKSTART.md`, and the `pagenary` tenant landing
  (`config.json` welcome block + `content/welcome.md`).

## [2026.6.4] - 2026-06-15

### Fixed

- **Shell `<title>` now derives from the default page's metadata title (#28).**
  The crawler-visible root `<title>` was the generic brand; it now uses the
  default section's metadata title as `"<page title> · <brand>"` (mirroring the
  runtime), falling back to the generic brand only when no default title exists —
  a stronger on-page SEO signal for the most-linked URL.

### Changed

- Update the vendored `@fortemi/core` static-index engine to **2026.6.3**
  (additive: adds `buildAiwgChunkedIndex` / `createAiwgFetchDetailLoader`; the
  API Pagenary uses is unchanged).

## [2026.6.3] - 2026-06-15

### Fixed

- **Shell asset URLs resolve correctly under both domain-root and subpath
  serving.** The shell used root-absolute `/styles.css` / `/app.js` / `/sections/`
  (needed for production domain-root deploys with SPA fallback) which 404'd under
  a subpath mount such as the dev preview server's `/<tenant>/`. The shell now uses
  `./`-relative URLs plus a build-injected `<base href>` bootstrap that resolves to
  the tenant root — `/<tenant>/` under a subpath, `/` on a domain root (where
  `./styles.css` equals the previous `/styles.css`, so production behaviour is
  unchanged). Module paths emit `./sections/` so dynamic `import()` resolves
  against `app.js`'s base-resolved URL. Also satisfies the SEO smoke stylesheet
  check.

## [2026.6.2] - 2026-06-15

### Fixed

- **Publish the Fortemi search feature (v2026.6.1 publish failed).** v2026.6.1's
  npm publish aborted on a failing build test: an unreleased, in-progress
  shell/module URL rework (tenant-relative `styles.css` / `./sections/`) had
  leaked into `build-tenants.js` and its build test while the matching
  `index.html` change was excluded, conflicting with the shipped #22 root-based
  URLs. Reverted `build-tenants.js` and the build test to the #22 root-based
  behavior so the release carries only the Fortemi search feature. **v2026.6.2 is
  the first published build of that feature** (see the 2026.6.1 notes below).

## [2026.6.1] - 2026-06-15

### Changed

- **Search now runs on the real `@fortemi/core` static-index engine (ADR-015):**
  the publisher's bespoke search reimplementation is replaced by the vendored
  `@fortemi/core` `aiwg-index` engine. Builds emit a deterministic chunked index
  per tenant under `dist/<tenant>/search-index/`; the command palette loads it via
  an index controller with lazy chunk fetch (precache), ranked results with
  snippets, and offset paging for infinite scroll. A legacy in-browser index
  remains as a transparent fallback — bundles stay statically hostable (no server,
  no WASM, no React).

### Added

- Build-time `scripts/lib/search-index-generator.js` and a shared, deterministic
  corpus builder `src/lib/fortemi-corpus.js` (records sorted/deduped by id, content
  `build_hash`), both validated against the vendored `@fortemi/core` contract.
- `searchContentPage()` paged search and `buildCommunityGraph()` (Fortemi community
  graph) in `src/lib/search.js`; command-palette infinite scroll in `app.js`.
- `@fortemi/core` and `aiwg` npm badges in the root and publisher READMEs.
- AIWG CalVer release process: `.aiwg/release.config` (flow-release gates) and
  `RELEASING.md` runbook.

## [2026.6.0] - 2026-06-13

### Fixed

- **Deep-linked nested routes hydrate correctly (#22):** shell asset URLs and
  generated section module imports now resolve from the site root, and nested
  section IDs emit deterministic encoded module filenames. Cold loads such as
  `/blog/<slug>` now request `/styles.css`, `/app.js`, and the matching section
  module instead of resolving relative to the nested route.
- **Collection post metadata is rendered and ordered (#23):** auto-discovered
  collection posts now use frontmatter title, summary, date, and reading time,
  respect collection `sortBy`/`order`, and honor `showDate`, `showSummary`, and
  `showReadingTime` on post pages.

## [2026.5.4] - 2026-05-28

### Changed

- **Build pipeline documentation refreshed (#20/#21):** API, architecture, and developer docs now cover the build-time `scripts/lib/*` surface: SEO artifact generation, collection manifests/feeds, and frontmatter parsing. The architecture guide also shows the actual tenant build order through SEO and collections, and the developer guide now explains collection post authoring and SEO extension points.

### Fixed

- **Page renderer leaked YAML frontmatter as visible text (#19):** the
  markdown render path (`markdownToHtml` in `scripts/build-tenants.js`) did not
  strip a leading `---`-fenced frontmatter block, so collection posts — where
  #18 made frontmatter mandatory — rendered the YAML keys as `<p>` paragraphs
  above the first heading. Wired the existing `parseFrontmatter()` helper —
  already used by `scripts/lib/collections-generator.js` — into the renderer
  so every caller benefits. Added regression tests for the strip, the
  no-op-without-frontmatter case, and preservation of mid-document `---`
  horizontal rules in the body.
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
