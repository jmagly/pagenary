# Changelog

All notable changes to `@pagenary/publisher` are documented here.
Format is based on [Keep a Changelog](https://keepachangelog.com/); versioning
is CalVer (`YYYY.M.PATCH`, no leading zeros — see `.claude/rules/versioning.md`).

## [Unreleased]

## [2026.7.1] - 2026-07-02

### Fixed

- Published the mixed docs + blog materialization fix so npm-pinned consumers
  receive navigable collection posts: manifestless flat `content/` tenants now
  render `content/posts/*.md` as hash-routed sections/pages in addition to
  collection metadata.
- Regenerated and guarded packaged site CSS so released artifacts preserve the
  rail on-this-page TOC viewport cap, static header/controls, and internal list
  scrolling rules.

### Documentation

- Clarified the supported mixed docs + blog configuration, hash-router linking
  rule (`entry.id` for `#...` links), and the `pageToc.placement: "rail"` CSS
  contract for stylesheet customizations.

## [2026.7.0] - 2026-07-01

### Fixed

- Repaired the page-effects figure image reference in the published docs so the
  current examples render with the expected visual asset.
- Capped the wide rail on-this-page TOC to the viewport and moved scrolling into
  the heading list, keeping the title and prev/next controls visible while long
  outlines scroll internally.

## [2026.6.19] - 2026-06-29

### Changed

- Declared the repository remote topology in AIWG project config: Gitea
  `origin` remains the primary, issue-tracker, and CI remote, while GitHub is
  now recorded as a secondary `publish` mirror for release workflows.

## [2026.6.18] - 2026-06-29

### Changed

- Trimmed the published package to the public publisher surface. Internal
  commercial tooling that is not part of the open publisher has been moved to a
  separate private repository, and the related tenant-config fields were removed
  from the public schema. The supported CLI surface is `build`, `serve`,
  `tenants`, `check`, `new`/`init`, `doctor`, `lint`, `clean`, `sync`, and
  `caddy` (run `npx pagenary --help`).

## [2026.6.17] - 2026-06-28

### Added

- **On-this-page TOC placements.** `pageToc.placement` selects where and how the
  outline renders: **`right`** — a persistent nav-style list in the right gutter,
  collapsible to a chevron handle for full-width reading; **`left`** — the same
  nav-style list mirrored into the sidebar under the site navigation (content runs
  full-width); **`top`** — a bordered block above the content; **`rail`** — a
  pinnable panel that collapses to a prev/next bar revealed on hover/tap. The heading
  list scrolls on its own with the title and prev/next pinned above it.
- **Quick-copy control on code blocks (#89).** Opt-in via `codeCopy: true` — a Copy
  button on each `<pre>` copies the exact source via the Clipboard API with transient
  "Copied" feedback; a pure enhancement (code stays selectable with JavaScript off).
- The Pagenary docs enable reading-progress and code-copy as live examples.

### Changed

- **Docs content is centered by default** (`.doc-content`), so wide and landscape
  viewports get balanced margins instead of crammed-left layouts.

### Fixed

- The on-this-page rail no longer inflates a long page to ~300,000px (a stray
  grid-row span over the row gap).
- Scroll-spy now activates the final heading at the bottom of the page — the last
  entry was unreachable, so Next greyed one entry early.
- The right-placement list is bounded to the viewport: it scrolls independently with
  the title and prev/next pinned above, and never runs past the fold or under the
  footer.

## [2026.6.16] - 2026-06-27

### Added

- **Prev/next article navigation is a generic docs feature, on by default.** The
  bottom prev/next pager (titled links to the adjacent article in nav order) now
  shows on all screen sizes for docs layouts — `bottomNav` defaults to `"always"`
  and is read from `config.json` as well as the manifest. Readers move between
  pages without opening the menu; scope it down with `"mobile"` or `"never"`.

### Changed

- **Deploy: Cloudflare edge-cache purge** now uses the `CF_ZONE_ID` /
  `CF_CACHE_PURGE` secrets, so a docs deploy purges the `pagenary.com` edge cache
  and edits to existing pages/assets go live immediately instead of waiting out
  the 4-hour cache TTL.

## [2026.6.15] - 2026-06-27

### Added

- **Page-effects primitives.** Disclosure accordions (`.pe-accordion`, native
  `<details>`, optional single-open), staggered reveal (`data-reveal-stagger`),
  generalized parallax on any element (`data-pe-parallax`), accessible figure
  zoom (`.pe-figure[data-pe-zoom]` → focus-trapped `<dialog>`), scroll-snap
  sections (`.pe-snap`), and scrollytelling (`.pe-scrolly`, sticky stage + step
  observers). Living scroll now applies to any layout, not just blog.
- **On-this-page TOC.** Opt-in heading nav generated from each page's `h2`/`h3`
  with scroll-spy, prev/next section controls, a landscape rail that uses the
  gutter, and a portrait collapsible menu. Configurable via `pageToc`
  (`rail`/`top`/`off`, `minHeadings`).
- **Collapsible navigation.** The sidebar nav and the on-this-page TOC both
  collapse. New `navCollapse` config selects the drawer behavior: `overlay`
  (default — a mobile-style drawer over full-width content), `push`, or `instant`.
- **Showcase.** A live, in-docbase demo section (one engine, many styles): a
  landing gallery (hero, staggered reveal grid, accordion, scroll-snap), a
  theming-palettes demo, a figure-zoom demo, and a scrollytelling story.

### Changed

- **Documentation restructured for publishing.** `apps/publisher/docs` is now the
  user-facing docbase; planning, spikes, and in-dev specs moved to the `.aiwg`
  SDLC workspace. Getting Started and Publishing are now published; Accessible
  Authoring promoted; nav reorganized (Welcome · Getting Started · Guides ·
  Showcase · Reference).

### Fixed

- TOC rail no longer overlaps content or stretches the first heading's row; the
  Fortémi info icon stays clear of the rail; the overlay nav drawer is opaque.
- Print/export TOC no longer splits across a page break; scrollytelling no longer
  leaks raw HTML; the accordion open/close animates smoothly.
- Reliable smooth scrolling for TOC navigation (rAF-based, replacing the
  silently-dropped native smooth `scrollTo` on the nested scroller); prev/next
  step deterministically via a navigation cursor.

## [2026.6.14] - 2026-06-27

### Added

- **Blog layout family (`layout: "blog"`).** A second layout alongside docs: a
  chronological index of post cards and reading-first post pages with hero,
  byline, and tags, driven by the existing collections engine. `blog.sidebar`
  chooses a single centered column (`hidden`) or a posts rail (`rail`).
- **Blog post navigation.** Every post ends with a persistent, accessible
  control — previous post · back to index · next post — scoped to the collection
  and visible on all screen sizes. Configurable via `postNav`.
- **Living scroll for blog posts (`blog.livingScroll`).** Post content reveals as
  it enters the viewport, with a reading-progress bar. Opt-in, reduced-motion and
  JS-off safe (the full article is in the prerendered snapshot).
- **Page-effects toolkit.** A runtime lifecycle that attaches/​tears down effects
  per render (gated on `prefers-reduced-motion` and `html.has-js`);
  reveal-on-scroll and a reading-progress bar; and rich **hero / banner
  primitives** — full-bleed, overlay scrim, parallax, sticky, and a CTA band —
  authored by class/`data-*`, fenced HTML, or a declarative frontmatter
  `hero` / `banner` block. New **Page Effects** guide and a `page-effects` recipe.
- **Themed blog example gallery.** `blog-dark`, `blog-editorial`, `blog-rail`,
  `blog-vivid`, and `blog-matrix` — one set of posts, many looks.
- **Accessibility tooling.** Narration artifacts, report artifacts, a content
  strict mode, a contrast/focus gate, browser smoke scans, and an authoring
  guide + planning baseline.
- **Media accessibility metadata** and **configurable media renderers**.
- **Reading metadata model** — realistic reading-length estimation from content.
- **Configurable export** (`export.enabled`, `export.scopes`) so publishers can
  disable export or restrict it to single-page exports.
- A **`navAlign`** sidebar list alignment option.

### Changed

- **Export renders to the browser print / Save-as-PDF dialog** from an off-screen
  frame — no pop-up window to allow or dismiss, and nothing left open afterward.
- **Content-addressed runtime URLs are now the default.** Tenant builds emit
  deterministic hashed copies for browser-loaded runtime assets and rendered
  section modules, rewrite the shell/manifests to those URLs, and keep stable
  compatibility files on disk. Use `cacheStrategy: "stable"` only for legacy
  hosts that require unversioned filenames.
- **Docs Map: force-directed layout + renderer controls and smoke coverage.** The
  SVG-backed renderer gains search/focus, zoom/fit, drag-pan, neighbor
  highlighting, and node-detail popups, covered by the browser smoke script while
  preserving the no-React static-site runtime.
- The sidebar list is **top-aligned by default**.

### Fixed

- **Export print table of contents no longer splits across pages** — the
  front-matter (header + TOC) takes its own page and the TOC stays whole, while
  long content sections break naturally.
- The **site title in the header is a home link** (pointer cursor, routes to the
  default section) instead of inert text.
- **Blog index cards behave as clickable tiles** — the whole card is one link, no
  text caret over the body.
- The **Quick Find palette stays above** page-effects heroes.
- Theme-token config alignment; docsite registration for the
  page-effects spike page; Fortemi deep-link format/hook-count docs.

## [2026.6.13] - 2026-06-21

### Changed

- **Re-vendored `@fortemi/core` 2026.6.7 → 2026.6.8** and updated the exact
  devDependency/lockfile pin. The new `aiwg-index` contract adds relationship
  labels/confidence/privacy/metadata plus optional SKOS concepts/relations and
  PROV-style provenance events. Pagenary now emits those rich fields in generated
  Fortemi records, preserves them in `search-index/metadata.json`, and surfaces
  them through the quiet per-page metadata panel.
- **Docs Map now consumes the Fortemi graph artifact directly.** Build-time
  docs-map output includes the Fortemi weighted community graph plus compact
  node/relationship metadata, and the SVG renderer uses that data for edge
  weight, relationship confidence, shared-concept context, zoom/pan controls,
  neighbor highlighting, and node-inspection popups before navigation.

## [2026.6.12] - 2026-06-18

### Changed

- **Updated dev tooling to latest gate-eligible versions: `jest` 29.7 → 30.4.2,
  `terser` 5.44 → 5.48.0.** Both cleared the `.npmrc` `min-release-age=7` gate
  (jest 30.4.2 published 40 days ago, terser 5.48.0 27 days ago — neither needed
  an override) and resolve from `registry.npmjs.org` with integrity. The jest 30
  major **reduced** the dev-tree audit surface from 22 advisories (incl. 2 high)
  to 17 (all moderate, all still dev-only — no production/runtime exposure). The
  production build (terser-minified) and SEO smoke checks pass unchanged.
- **Fixed the search-index determinism test for jest 30's ESM loader.** jest 30's
  `--experimental-vm-modules` changed dynamic-`import()` behavior: the *first*
  import of a temp ESM section module is misclassified ("Unexpected export
  statement in CJS module") and degrades to title/summary, while a *second*
  import of the same path succeeds and extracts the body — a sandbox-only
  cold/warm asymmetry. The "byte-identical across runs" test now warms the module
  registry before its two measured runs, so it asserts the generator's
  determinism contract rather than jest's import cache. No product code changed;
  real-Node determinism is independently covered by `build-tenants.test.js`'s
  spawned build. Full suite (303 tests) green.
- **Tracked `@fortemi/core` 2026.6.6 → 2026.6.7** (devDependency pin + lockfile).
  The 6.7 release's `aiwg-index` dist is **byte-for-byte identical** to 6.6 — both
  the `.js` and `.d.ts` — verified by SHA-256 (`70cb729f…`, unchanged) against the
  upstream CDN; the 6.7 release changed other parts of the package, not the surface
  Pagenary vendors. So `src/vendor/fortemi-aiwg-index.js` needed only a banner
  `Source` bump (no body change), and the `.d.ts` is unchanged. Adopting the
  fresh (<7-day) version used the documented **first-party gate exception** in
  `.npmrc` (`@fortemi/core` is our own Gitea-hosted lib); the lockfile resolves it
  from `registry.npmjs.org` with an integrity hash, and `npm audit` shows **no new
  advisories** (the 22 pre-existing are all in the jest dev-tree). Provenance
  re-verified, `lint:content` clean, full suite (303 tests) green. `VENDORING.md`
  manifest updated to `2026.6.7`.

## [2026.6.11] - 2026-06-17

### Added

- **Traceable `@fortemi/core` declaration.** The vendored search engine is now
  declared in `devDependencies`, pinned to the exact vendored version
  (`@fortemi/core` `2026.6.6`), so the dependency is visible and auditable in
  `package.json` + the lockfile (integrity hashes, `npm audit signatures`) and
  tracked by `npm outdated` / dependabot — not just recorded in a code comment.
  It stays out of `dependencies` (the build never imports it; the vendored copy
  is self-contained). Adding it fresh required a documented **first-party
  exception** to the `min-release-age=7` gate, valid because `@fortemi/core` is
  our own Gitea-hosted lib ([`Fortemi/fortemi-react`](https://git.integrolabs.net/Fortemi/fortemi-react));
  the policy is recorded in `.npmrc`. The addition introduces **no new audit
  findings** (the 22 pre-existing advisories are all in the jest dev-tree), and
  `npm ci` installs the locked version without re-tripping the gate.
- **`docs/VENDORING.md`** — documents how third-party runtime code is vendored
  (the `@fortemi/core` process: pull upstream dist → commit under a provenance
  banner with `Source`/`SHA-256` → verify the hash against the upstream dist →
  run the suite), why (no-bundler, relative-path module loading), the
  first-party release-age-gate exception, and the remaining undeclared runtime
  CDN loads (PrismJS pinned, Mermaid floating on `@10` via `esm.sh`). Links the
  canonical definition of vendoring.

## [2026.6.10] - 2026-06-17

### Changed

- **Re-vendored `@fortemi/core` 2026.6.3 → 2026.6.6** (`src/vendor/fortemi-aiwg-index.js`
  + `.d.ts`). The only code change landed in 6.5 (6.4 and 6.6 ship identical
  `aiwg-index` dist — doc-only); it is purely additive: two new exports
  (`encodeAiwgDetailId`, `aiwgDetailHrefForId` for `base64url` detail-id
  encoding) and a transparent LRU match-cache inside `queryAiwgFortemiIndex`
  that speeds repeated command-palette searches at no API cost. Every existing
  export is signature- and behavior-stable, so no Pagenary code changed; the
  match-cache benefit is gained automatically. Banner SHA-256 refreshed to the
  upstream 6.6 dist; all 303 tests pass against the re-vendored engine.

## [2026.6.9] - 2026-06-16

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
  Playwright screenshot per recipe — and is itself a page on the docs site
  (Guides → Theming Recipes).
- **Live recipe demos on the docs site (#31).** The docsite build now also
  builds every example recipe into `dist/pagenary/<id>/`, so each is deployed
  and clickable at `https://docs.pagenary.com/<id>/` (e.g. `/nav-top/`,
  `/interocitor/`). The gallery links each live demo and lists real-world
  Pagenary sites (docs.aiwg.io, docs.fortemi.io, docs.roko.network). Wired into
  both `docsite-build.yml` (validation) and `docsite-deploy.yml`.
- **`navPosition: top | bottom | hybrid` (#31).** Navigation can now render as a
  horizontal bar above (`top`) or below (`bottom`) the content, or as a `hybrid`
  layout — a horizontal primary strip (generated from the tenant's top-level
  sections) plus the full left rail. Layout rules are scoped to a
  `data-nav-position` attribute set at build time; `left` (default) and the
  existing `right` are unchanged. Now documented in
  [`docs/TENANT-CONFIG.md`](apps/publisher/docs/TENANT-CONFIG.md), which also
  gains the previously-undocumented `theme`/`inkColor`/`mutedColor`/
  `gridLineColor`/`fontBody`/`fontMono` keys.
- **Docs Map relationship view (#33).** Opt-in `docsMap.enabled` adds a
  standalone, framework-free SVG view of how a tenant's pages relate. The build
  runs each page's full body through a concept-extraction procedure (the same
  Fortemi model that powers search): pages cluster into communities by nav group
  and pages that share salient concepts are linked with `related` edges, then
  the graph is embedded as `docs-map-data.js` and rendered client-side (sparse
  tenants fall back to a manifest-derived graph). The new
  `examples/docs-map-corpus/` recipe is a 14-page interconnected "Lumen API"
  sample that produces 5 clusters and dozens of concept edges.
- **Runtime theme/color picker (#35).** Opt-in `themePicker` emits a per-theme
  stylesheet for each selectable theme and injects a `<select>` control that
  swaps the active stylesheet, persists the choice to `localStorage`, and
  honors `prefers-color-scheme` on first load — no rebuild required.
- **GFM autolinks (#34).** The markdown parser now linkifies angle-bracket
  autolinks (`<https://…>`, `<mailto:…>`) and bare URLs in prose, without
  double-wrapping existing `[label](url)` links or touching fenced code.
- **Bespoke Interocitor showcase (#36).** The Interocitor Labs example now
  demonstrates a fully-custom look that shares Pagenary's controls/data but
  bears no resemblance to the defaults — built with a `.public/` CSS overlay and
  post-build `overrides/`, the supported deep-customization path.

### Changed

- **Cloudflare edge-cache purge on deploy (#37).** The docsite deploy now purges
  the Cloudflare edge cache after publishing (guarded on `CLOUDFLARE_ZONE_ID` +
  `CLOUDFLARE_API_TOKEN`), so edits to stable filenames are visible immediately
  instead of after the 4-hour TTL. Cache guidance in
  [`docs/DEPLOYMENT.md`](apps/publisher/docs/DEPLOYMENT.md) corrected.

### Fixed

- **App-shell clipping on orientation change & short viewports.** The mobile
  layout used a static `calc(100vh - 120px)` that overflowed the real
  header+footer height (chopping content and the footer when rotating between
  portrait and landscape). Replaced with the grid app-shell's natural `1fr`
  sizing plus dynamic-viewport (`dvh`) units, and gave the scroll canvas
  `align-content: start` so tall sections are no longer clipped to the
  container height.
- **Awkward line spacing from soft-wrapped markdown.** Source lines within a
  paragraph were each emitted as a separate `<p>`, so the inter-paragraph grid
  gap appeared mid-sentence. Soft-wrapped lines are now merged into one
  paragraph; blank lines still separate paragraphs.

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
