# Releasing Pagenary

Pagenary uses **CalVer** (`YYYY.M.PATCH`, no leading zeros) and the AIWG
**`flow-release`** process. The gate sequence is declared in
[`.aiwg/release.config`](.aiwg/release.config); this document is the
human-readable runbook.

## Versioning

- Format: `YYYY.M.PATCH` — e.g. `2026.6.1`. **No leading zeros** (`2026.6.1`,
  never `2026.06.1`). Enforced by [`.claude/rules/versioning.md`](.claude/rules/versioning.md).
- Source of truth: **`apps/publisher/package.json`**. Public workspace packages
  (`apps/blog-client`, `apps/embed`, and `apps/publisher`) must carry the same
  version. The Gitea and GitHub publish workflows verify the pushed tag equals
  this version and that internal `@pagenary/*` dependencies match it exactly.
- Tag format: `v{version}` (e.g. `v2026.6.1`), **GPG-signed** with the maintainer
  release key.
- Same month → bump `PATCH` (`2026.6.0` → `2026.6.1`). New month → reset
  (`2026.6.x` → `2026.7.0`).

## Cut a release

Drive it with the AIWG skill — it walks the gates in `.aiwg/release.config`:

```
flow-release v2026.6.1            # or: "cut a release", "release v2026.6.1"
```

Or run the gates manually:

1. **Local quality** — from the repo root:
   ```bash
   npm run lint:content --workspace @pagenary/publisher
   npm run test         --workspace @pagenary/publisher
   npm run build:tenants --workspace @pagenary/publisher
   npm run check:seo    --workspace @pagenary/publisher
   ```
2. **Doc-sync** — reconcile `apps/publisher/docs/*.md` + READMEs with the code.
3. **Changelog** — add a `## [<version>] - <YYYY-MM-DD>` section to
   [`CHANGELOG.md`](CHANGELOG.md) (Keep a Changelog format). Move items out of
   `## [Unreleased]`.
4. **README freshness** — review root + `apps/publisher/README.md`.
5. **Bump versions** — set `apps/blog-client/package.json`,
   `apps/embed/package.json`, and `apps/publisher/package.json` `version` to the
   target. Keep `apps/embed`'s `@pagenary/blog-client` dependency pinned to the
   same exact version.
6. **Release commit** — stage *deliberately* (do not sweep unrelated working-tree
   changes), then:
   ```bash
   git commit -m "release: v<version> — <summary>"
   ```
7. **Signed tag + push** — *maintainer action*. Sign with the **release key**,
   not the default commit key (a bare `git tag -s` signs with the wrong key).
   Push to `origin` first, then push the same commit and signed tag to `github`
   so GitHub Actions receives the public npm trusted-publishing tag event.
   ```bash
   git tag -s -u 719AB63879E84CE8 v<version> -m "v<version> — <summary>"
   git push origin main
   git push origin v<version>
   git push github main
   git push github v<version>
   ```
   The tag push triggers `.gitea/workflows/release.yml` (Gitea + GitHub release
   records, pushes `main`), `npm-publish.yml` (publishes `@pagenary/blog-client`,
   `@pagenary/embed`, and `@pagenary/publisher` to the Gitea npm registry), and
   `docsite-deploy.yml` (redeploys docs.pagenary.com).
8. **Post-release** — verify the Gitea release + npm publish, restore an empty
   `## [Unreleased]` in the changelog, and thank/close any imported reporter
   issues.

## Signing keys

Release **tags** are signed with the **release key**, never the per-developer
commit key. `user.signingkey` defaults to the commit key, so a bare `git tag -s`
signs with the *wrong* key — always pass `-u` with the **long** release key id.

| Key | ID | Use |
|-----|----|-----|
| Commit signing | `0117DAAA677A5BF2` | normal commits (`git config user.signingkey`) |
| **Release signing** | `719AB63879E84CE8` — *AIWG Release Signing `<release@aiwg.io>`* | **release tags** (`git tag -s -u 719AB63879E84CE8 …`) |

Verify a cut tag with `git tag -v v<version>` — the good signature must show the
release key (`719AB63879E84CE8` / *AIWG Release Signing*). Full details, the
opt-in `REQUIRE_SIGNED_TAGS` CI gate, and `.gitea/keys` setup live in the
canonical [`docs/contributing/releasing.md`](docs/contributing/releasing.md).

## Conventions

- **No AI attribution** in commit messages, tags, or release notes
  ([`.claude/rules/no-attribution.md`](.claude/rules/no-attribution.md)).
- **Delivery mode is `direct`** — release commits land on `main` (no PR).
- **Push the tag to both remotes, in order** — `origin` drives the Gitea release
  and internal package workflows; `github` drives public npm trusted publishing.
  Push `origin` first, then `github`.
- **GitHub mirror token scope** — when a release commit changes
  `.github/workflows/*`, the `GH_TOKEN` used by `release.yml` must include
  GitHub `workflow` scope or GitHub rejects the mirror push.
- **GitHub npm `ENEEDAUTH`** — if the GitHub npm workflow starts but `npm
  publish` says auth is required, npm trusted publishing is not configured or
  does not exactly match `jmagly/pagenary` + `npm-publish.yml` for that package.
- **Never force-push** (`force_push_policy: never`). Never delete a pushed tag;
  if a post-tag step fails, bump `PATCH` and re-cut.
- **Never finalize on red CI** — wait for `release.yml` / `npm-publish.yml` green.
