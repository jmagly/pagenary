# Progress: Pagenary example-config gallery (#31) + browser smoke tooling (#32)

## Task contract
- Original request: "we want to make sure people have example for common patterns,
  different colors, basic style changes, left, right, top, bottom, hybrid nav,
  including an example showing a fully customized layout for a fictitious AI deep-tech
  company making interociters (sp)." + "you have playwright access, build out
  recommended tooling" + "file issues and complete work using address-issues and
  aiwg skill discovery as needed."
- Delivery: direct mode (commit to main; `Fixes #N`), CalVer release per RELEASING.md,
  tag signed with release key `719AB63879E84CE8`, push origin only.
- Completion criteria (measurable):
  - #31: example tenants build clean via `npm run build:tenants`, `npm run ci` green,
    each documented in a THEMING-RECIPES.md gallery, each verified by a Playwright
    screenshot. Nav positions left/right/top/bottom/hybrid all render correctly.
  - #32: `scripts/smoke-browser.mjs` + `npm run test:browser` that boots serve.js,
    drives Playwright over a built tenant, asserts title/nav/search, exits non-zero on failure.

## Current status (2026-06-15)
- SHIPPED: v2026.6.8 (npm + Gitea release published; runs 85/86/87 green).
  - #29 (runtime <title> brand) — fixed, verified live, closed.
  - #30 (sidebar spacing) — tightened styles.css, verified via screenshot, closed.
  - Base-URL `<base href>` subpath fix verified in a real browser.
- address-issues BATCH CLEARED (this session):
  - #24 search: replace local mirror — closed (vendored real @fortemi/core engine, ADR-015).
  - #25 build-time index artifact — closed; wired the build-time VALIDATION GATE
    (assertAiwgFortemiChunkManifest/Part) in search-index-generator.js (commit df449de) +
    negative test. 274 tests green.
  - #26 framework-agnostic controller — closed (createAiwgIndexController wired, no React).
  - #27 JS-only graph utils — closed (DECISION: adopt data-prep buildCommunityGraph now,
    defer rendered docs-map view); filed follow-up #33 for the view.
  - #32 browser smoke tooling — closed; scripts/smoke-browser.mjs + npm run test:browser,
    Playwright kept out of deps (dynamic-import skip / SMOKE_REQUIRE=1 hard-fail). Verified
    green via Playwright MCP (base, title, nav=12, search 'deploy'=4 results). Commit 678f2bc.
- DOCS DEPLOY FIXED: the transient rsync flake (run 84) cleared on the df449de push —
  runs 88+89 green, so the live docs site has v2026.6.8. (Gitea re-run/dispatch APIs are 404
  on this version, so the fix-forward path is "push to a trigger path", which df449de did.)

## DONE: #31 SHIPPED to main (2026-06-15), docsite deployed, live verified
- navPosition top/bottom/hybrid added (attr-scoped CSS in styles.css; hybrid strip
  injected from manifest in build-tenants.js applyNavPosition). left/right unchanged.
- 10 example recipes: examples/content-base (shared docs) + examples/interocitor
  (full custom showcase) + examples/recipes.tenants.json. `npm run build:examples`
  (-> dist/<id>) and `build:examples:site` (-> dist/pagenary/<id> for docsite).
- docs/THEMING-RECIPES.md gallery (10 Playwright screenshots in docs/images/recipes/,
  live-demo table, "In the wild" real-site links). Added as a pagenary docs page
  (Guides → Theming Recipes; content symlink + manifest section). TENANT-CONFIG.md
  expanded (navPosition + full theme/font keys). Linked from both READMEs.
- 8 nav-position jest tests added; full `npm run ci` green (282 tests).
- CI: docsite-build.yml + docsite-deploy.yml build examples into dist/pagenary/<id>/
  + stage docs/images at /images/. Both green (runs 94 build, 95 deploy).
- Commits: 6b3a177 (release: v2026.6.9 ... Fixes #31 — closed #31) + 3d55939
  (fix(docsite): strictLinks broke pagenary build; registered gallery page +
  live example deploy). Both on main, pushed origin, signed (G).
- LIVE verified (200 + browser): docs.pagenary.com/{nav-top,interocitor,theme-dark}/,
  /images/recipes/*, /sections/theming-recipes.js. nav-top base resolves correctly.

## FOLLOW-ONS this session (all on main, CI green):
- #34 filed — markdown parser: support GFM autolinks (`<url>` rendered literally;
  worked around in 9f59f07 by using `[text](url)` in the gallery table).
- #35 filed — runtime theme/color picker control + per-tenant theme selection.
- #36 SHIPPED (commit 096999a, Fixes #36) — bespoke interocitor: overlay CSS
  (.public/interocitor.css) + overrides/index.html (links overlay, body.interocitor)
  + custom hero (content/overview.html). Deep-space console look, no resemblance
  to default shell, src/ untouched. CI green (runs 98 build / 99 deploy).
  - LIVE caveat: chrome is live (index.html DYNAMIC + new overlay css), but the
    rewritten sections/overview.js (hero) is masked by Cloudflare's 4h edge cache
    (old md filename existed). Origin verified correct (cache-bust → iox-hero).
    Self-heals ≤4h or on purge. → filed #37.
- #37 filed — docsite edits to EXISTING pages/assets masked by 4h edge cache
  (stable filenames; options: content-hash filenames / lower max-age / purge-on-deploy).

## ISSUE SWEEP (/goal address-issues remaining) — 2026-06-16:
- #34 SHIPPED (fd98e11, Fixes #34) — GFM autolinks (angle-bracket + bare URL) in
  the markdown parser + 6 tests. Live.
- #37 WIRED (5502437, Refs #37 — left OPEN) — Cloudflare purge-on-deploy step in
  docsite-deploy.yml, guarded on CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN secrets
  (no-op + deploy still succeeds when absent). DEPLOYMENT.md cache guidance fixed.
  REMAINING: operator adds the two Cloudflare secrets (scoped Zone→Cache Purge),
  then #37 closes. Alternative offered: content-hashed filenames (no secret).
- #35 SHIPPED (1e63398, Fixes #35) — runtime theme/color picker. applyThemeColors
  refactored to pure resolveTheme/renderThemedCss; applyThemePicker emits a full
  themed stylesheet per theme + injects a header <select> + swappable <link>;
  app.js initThemePicker (localStorage + prefers-color-scheme). New theme-picker
  recipe. 4 tests. Verified LIVE on docs.pagenary.com/theme-picker/ (switch +
  persist work in production). CI green (runs 104 build / 105 deploy).
- #33 SHIPPED (94cca6d, Fixes #33) — user chose the standalone #/docs-map route.
  src/lib/docs-map.js (framework-free SVG community graph from buildCommunityGraph,
  computed client-side from MANIFEST; nodes clickable; empty/small placeholder).
  applyDocsMap emits sections/docs-map.js + injects a docs-map MANIFEST entry
  (router/nav/palette drive it; zero app.js change). New docs-map recipe. 3 tests.
  Verified LIVE: docs.pagenary.com/docs-map/#docs-map (8 nodes, clickable). CI
  green (106 build / 107 deploy).

## SWEEP COMPLETE — only #37 remains open (wired, pending operator Cloudflare secret).
## All actionable issues addressed: #31,#32,#33,#34,#35,#36 shipped+live; #37 wired.

### REMAINING (maintainer action only):
- package.json is at 2026.6.9 but NO signed release tag was cut. The docsite is
  already deployed (docs-only deploy on the main push). To publish the npm package
  + Gitea/GitHub release records, the maintainer cuts the signed tag with the
  RELEASE key (interactive GPG — agent cannot do this):
    git tag -s -u 719AB63879E84CE8 v2026.6.9 -m "v2026.6.9 — example-config gallery + nav positions (#31)"
    git push origin main && git push origin v2026.6.9
  (Tag push triggers release.yml + npm-publish.yml + a tag-deploy of docs.)

## (historical) REMAINING was: #31 only (the large example-config gallery)

## Next action (#31, in order)
1. Nav-position support is the real feature gap. Today `applyNavPosition`
   (apps/publisher/scripts/build-tenants.js:1231) only handles `navPosition: 'right'`
   (left = CSS default). Add `'top'`, `'bottom'`, `'hybrid'`:
   - build: extend applyNavPosition to inject a `data-nav-position` attr / body class
     and (for top/bottom) emit a horizontal nav region; hybrid = top primary + left sub.
   - CSS: add `.layout--nav-top/.--nav-bottom/.--nav-hybrid` rules in src/styles.css.
   - test: extend __tests__/scripts/build-tenants.test.js with a position assertion.
2. Example tenants under `apps/publisher/tenants/examples/` (or examples/ docs):
   - `theme-colors` — palette/CSS-var overrides only (different colors).
   - `basic-styles` — minimal style tweaks (font, radius, spacing).
   - `nav-left` / `nav-right` / `nav-top` / `nav-bottom` / `nav-hybrid` — one per position.
   - `interocitor` — fully-customized showcase: fictitious deep-tech AI company that makes
     "interociters" (This Island Earth ref). Custom palette, layout, hero, nav, content.
3. `apps/publisher/docs/THEMING-RECIPES.md` — gallery doc linking each example with a
   screenshot + the exact config diff that produces it. Link from both READMEs.
4. Verify every example with a Playwright screenshot (build → serve --dev → navigate →
   browser_take_screenshot). Use serve.js `--dev` (no-store) to bypass cache.
5. Run `npm run ci`; commit `Fixes #31`; cut release.

## Then #32
- `apps/publisher/scripts/smoke-browser.mjs`: spawn `node serve.js --dev` on an ephemeral
  port, Playwright-navigate the pagenary tenant, assert document.title contains the tenant
  brand, nav has >0 items, command palette opens + returns search results; exit non-zero on
  any failure; always tear down the server. Add `"test:browser"` to package.json. Make
  Playwright an OPTIONAL devDep (skip with a clear message if absent, like terser). Commit
  `Fixes #32`.

## Verification notes / gotchas
- serve.js caches non-html immutable in non-dev mode — ALWAYS use `--dev` when
  screenshotting after a rebuild, or the browser shows a stale manifest.js/styles.css.
- Do NOT `pkill -f serve.js` (kills the session tree, exit 144). Free a port with
  `lsof -tiTCP:<port> -sTCP:LISTEN | head -1 | xargs -r kill`.
- Release tag signing key is `719AB63879E84CE8` (AIWG Release Signing), distinct from the
  commit key. CalVer YYYY.M.PATCH, no leading zeros. Never delete a pushed tag — roll forward.
- npm tarball top-level audit: any new top-level dir in `files` must be added to
  `ci/expected-tarball-top-level.txt` or npm-publish fails (cost us v2026.6.6 -> 6.7).

## State references
- Commits: a945d95 (#29/#30 fix), a2f9724 (release v2026.6.8). Tag v2026.6.8.
- Issues: #29 closed, #30 closed, #31 open (examples), #32 open (browser tooling).
- Screenshots are throwaway artifacts; `.playwright-mcp/` is gitignored.
