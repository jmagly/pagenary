# Release 2026.9.0 documentation sync

Direction: code-to-docs, incremental since v2026.8.2, dry run first. Scope: root/publisher/blog-client/embed READMEs, RELEASING.md, publisher docs. No source, configuration, package, or TESTING.md edits; no commit or push.

## Findings and fixes

All ten dry-run finding groups were documentation-only and high confidence. Updated the root/publisher README routing, static defaults and optional runtime links; distinguished static ranked search from optional record/PGlite/dataset APIs; corrected shipping tier/mode status and required route fallbacks; corrected registry schema and build order; replaced stale runtime CDN examples with local Mermaid/Prism loading; clarified embed import resolution and Node fetch prerequisites; added browser setup and default-build release prerequisites.

## Reviewed without a release change

Blog-client/embed exports and source are unchanged since v2026.8.2. npm badge identities match package names. CORS guidance covers public index/feed fetches, host allowlists, cache behavior and CDN/WAF deployment boundaries. Root and publisher README freshness were explicitly reviewed. This is a bounded release drift review, not an exhaustive certification of historical docs or live npm/CDN availability.

## Validation and handoff

`git diff --check` passes. All22 newly added local Markdown links/anchors resolve. Eleven assigned Markdown files changed; detailed paths, hashes and findings are in `.aiwg/working/doc-sync/release-2026.9.0-review.json`.

Parent owns package versions, CI compatibility and delivery/release. The out-of-scope `.aiwg/release.config` still contains an obsolete warn-only SEO stylesheet rationale. Public Node badges currently agree with package engines; test tooling independently requires Node24.12.0. Continue the release workflow after reviewing the documentation diff.
