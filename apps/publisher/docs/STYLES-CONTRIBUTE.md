# Contribute and review a style

The canonical project is
[`roctinam/pagenary-styles` on Gitea](https://git.integrolabs.net/roctinam/pagenary-styles).
GitHub is a publication mirror, not the contribution tracker or source of
truth. Start with the catalog's
[contribution guide](https://catalog.pagenary.com/contribute/) and the repository
`CONTRIBUTING.md` when it is present.

## Git and pull-request path

1. Fork the canonical Gitea repository using Gitea's Fork action.
2. Clone your fork and add canonical upstream:

   ```bash
   git clone git@git.integrolabs.net:<your-user>/pagenary-styles.git
   cd pagenary-styles
   git remote add upstream git@git.integrolabs.net:roctinam/pagenary-styles.git
   git fetch upstream
   git switch --create style/example-style upstream/main
   npm ci
   ```

3. Add `styles/example-style/`, its catalog entry, fixtures, previews, manifest,
   provenance, and license evidence. Preserve unrelated files.
4. Validate the exact submission:

   ```bash
   npm test
   npm run build:site
   npm run test:site
   npm run test:fixtures
   npm run test:browser
   git diff --check
   git status --short
   ```

5. Commit, push the branch to your Gitea fork, and open a pull request against
   `roctinam/pagenary-styles:main`. Describe compatibility, rights/provenance,
   final hashes, fixture and preview coverage, accessibility results, and
   rollback. Do not open the canonical contribution on the GitHub mirror.

Browser checks may require the repository's documented browser prerequisite.
If unavailable, report the missing gate rather than claiming it passed.

## Review checklist

Reviewers should be able to answer yes to each item:

- The stable ID, SemVer change, and compatible-versus-breaking decision match
  the actual shell/token/selector/load-order contract.
- Every catalog entry agrees with `style.json`; every distributable and preview
  hash matches final bytes.
- Source repository, full commit, source path, capture date, transformations,
  license, and license evidence are verifiable.
- The archive builds deterministically and contains no unexpected files.
- Generic fixtures and desktop/mobile light/dark previews exercise representative
  content without source-project branding.
- Keyboard, accessible-name, focus, contrast, zoom/reflow, reduced-motion,
  overflow, missing-asset, search, and isolated-preview gates pass.
- The PR is green on canonical Gitea. Publication happens from the merged,
  trusted commit; the verified result may be mirrored to GitHub afterward.

The contribution page should remain a task-oriented front door. Future non-Git
submission methods can add sibling paths without changing the package evidence
and review gates described here.

## Agent recipe: contribute

```text
Prepare a contribution of Pagenary style [STYLE_ID] [VERSION] to canonical
https://git.integrolabs.net/roctinam/pagenary-styles from my Gitea fork and a
branch based on upstream/main. Inspect the canonical repository, contribution
guide, CONTRIBUTING.md if present, package manifest, catalog entry, schema,
fixtures, tests, and unrelated work before editing. Do not invent license,
provenance, compatibility, version, source commit/path, or hash data; stop on
ambiguous rights, unsupported compatibility, missing evidence, or unclear
target branch. Preserve unrelated work. Produce only the package, catalog entry,
evidence, fixtures/previews, and required tests/docs. Run npm test, catalog
build/site tests, fixture tests, browser/preview checks, and git diff --check.
Push only to my Gitea fork and prepare a PR to roctinam/pagenary-styles:main;
do not use GitHub as the canonical tracker. Report files, evidence, hashes,
commands/results, branch/PR target, remaining gates, and rollback. Do not claim
success or publish if any required check is unavailable or fails.
```

Return to [Choose and install a style](#/styles-install).
