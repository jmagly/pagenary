# Doc Sync Audit - 2026-07-05 - v2026.7.15

Direction: code-to-docs
Scope: release v2026.7.15 GitHub npm trusted-publishing workflow changes

## Scope Reviewed

- Public npm publish workflow: `.github/workflows/npm-publish.yml`
- Release documentation: `RELEASING.md`, `docs/contributing/releasing.md`
- Release metadata: `CHANGELOG.md`, `ci/digests.txt`
- Public packages: `apps/blog-client`, `apps/embed`, `apps/publisher`
- Public package npm surfaces: `apps/blog-client/README.md`,
  `apps/embed/README.md`, package `keywords`

## Findings

No blocking documentation drift found.

Documentation updated for this release:

- Public npm publishing now documents npm trusted publishing/OIDC instead of a
  long-lived npm token.
- Trusted-publisher setup now names all public packages:
  `@pagenary/blog-client`, `@pagenary/embed`, and `@pagenary/publisher`.
- Release docs now note that the Gitea `GH_TOKEN` needs GitHub `workflow` scope
  when a release commit updates `.github/workflows/*`.
- The public npm workflow documents its Node 24/npm 11 runtime and automatic
  provenance behavior.
- The `@pagenary/blog-client` and `@pagenary/embed` READMEs now follow the same
  product README pattern as the main Pagenary/AIWG READMEs: centered summary,
  badges, quick start, API/configuration, CORS/hosting guidance,
  troubleshooting, and package navigation.
- The `@pagenary/blog-client` and `@pagenary/embed` package manifests now carry
  npm keywords for Pagenary, documentation, docs-as-code, embeds, blog indexes,
  CORS, and related discovery terms.

Human-review items:

- Existing docs case-mismatch warnings remain in the docs build. They predate
  this release and were not expanded by the trusted-publishing changes.
- Existing advisory accessibility findings remain in `TENANT-CONFIG.md` and
  `SEO-STRATEGY.md`. They predate this release and are not caused by the
  trusted-publishing workflow changes.

## Validation

- GitHub/Gitea workflow YAML parse passed.
- Public package versions and internal `@pagenary/*` dependency ranges are all
  `2026.7.15`.
- Public package tarball top-level allowlist audit passed for all three
  packages.
- Public package JSON keyword validation passed for all three packages.
- `npm run lint:content --workspace @pagenary/publisher` passed.
- `npm run test --workspace @pagenary/publisher` passed: 27 suites / 506 tests.
- `npm run build --workspace @pagenary/publisher` passed.
- `npm run build:tenants --workspace @pagenary/publisher` passed.
- `npm run check:seo --workspace @pagenary/publisher` passed.
- `git diff --check` passed.

## Files Changed By Doc Sync

- `RELEASING.md`
- `docs/contributing/releasing.md`
- `CHANGELOG.md`
- `ci/digests.txt`
- `apps/blog-client/README.md`
- `apps/embed/README.md`
- `apps/blog-client/package.json`
- `apps/embed/package.json`

## Recommendation

Proceed with the v2026.7.15 release gates after confirming the Gitea GitHub
mirror token has GitHub `workflow` scope and npm trusted publishers are
configured for all three public packages.
