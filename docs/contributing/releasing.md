# Releasing Pagenary Packages

Publishing is automated by `.gitea/workflows/npm-publish.yml`, triggered on a
version tag push. Versioning is **CalVer** — `YYYY.M.PATCH`, no leading zeros
(see `.claude/rules/versioning.md`). The setup mirrors `roctinam/aiwg`'s
supply-chain hardening, adapted to this repo.

The public npm package set is:

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@pagenary/blog-client` | `apps/blog-client` | Fetch, normalize, and merge one or many Pagenary blog indexes. |
| `@pagenary/embed` | `apps/embed` | Framework-agnostic `<pagenary-blog>` web component. Depends on the same-version `@pagenary/blog-client`. |
| `@pagenary/publisher` | `apps/publisher` | Static site generator and CLI. |

All public packages release together on the same version tag. The workflows
verify every package version equals `apps/publisher/package.json` and every
internal `@pagenary/*` dependency is pinned to that exact version.

## Required variables / secrets

| Name | Type | Where | Purpose |
|------|------|-------|---------|
| `NPM_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | Gitea API token (`gta_…`) with `package:write` **and** `repository:write`. Authenticates the Gitea-registry publish *and* the Gitea release-creation API. **Not** an npmjs.org token. |
| `GH_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | GitHub PAT with `repo` (or `public_repo`) scope, plus `workflow` scope when commits may update `.github/workflows/*`. Used by `release.yml` to push the mirror and create the GitHub release with assets. The GitHub leg skips gracefully if absent. |
| `REQUIRE_SIGNED_TAGS` | variable (optional) | Gitea repo → Settings → Actions → Variables | Set to `true` to turn the signed-tag gate from dormant into a hard requirement. Needs a committed maintainer key (below). |
| Maintainer signing key | committed file | `.gitea/keys/maintainers.asc` (GPG) **or** `.gitea/allowed_signers` (SSH) | Public key the signed-tag gate verifies against. Only the public key is committed; you sign tags locally with the private key. |
| npm trusted publisher | package settings | npmjs.org | Required for the **public npm** leg. Configure each public package for GitHub Actions trusted publishing; no long-lived `NPMJS_TOKEN` is required for publishing. |

The Gitea-registry release path needs only `NPM_TOKEN`. Everything else is
opt-in hardening.

## Release steps

```bash
# 1. Bump the version in apps/blog-client/package.json,
#    apps/embed/package.json, and apps/publisher/package.json (CalVer).
#    Keep apps/embed's @pagenary/blog-client dependency pinned to the same
#    exact version.
#    e.g. 2026.5.1 -> 2026.5.2, or new month -> 2026.6.0.
#    No leading zeros: June is 2026.6.0, not 2026.06.0. (See versioning rule.)

# 2. Finalize the CHANGELOG: rename the "## [Unreleased]" heading to
#    "## [VERSION] - YYYY-MM-DD". Keep it accurate — release notes link here.

# 3. Update docs if the release changes config/behavior, then commit it all.
git commit -am "release: v2026.5.2 — <one-line summary> (#refs)"

# 4. Tag with a SIGNED, v-prefixed tag (the workflow guards tag == version).
#    Sign with the RELEASE key, not the default commit key — see note below.
git tag -s -u 719AB63879E84CE8 v2026.5.2 -m "v2026.5.2 — <summary>"

# 5. Push the commit, then the tag, to origin first. Then push the same commit
#    and signed tag to github so GitHub Actions receives the public npm trigger.
git push origin main
git push origin v2026.5.2
git push github main
git push github v2026.5.2
```

`origin` should be the Gitea SSH remote:

```bash
git@git.integrolabs.net:roctinam/pagenary.git
```

HTTPS remotes require interactive credentials and can fail in automation with
`could not read Username`.

**A `v*` tag push to origin triggers Gitea workflows:** `npm-publish.yml`
(publishes the internal package set), `release.yml` (Gitea + GitHub release
records), and `docsite-deploy.yml` (the tag matches its `v*` trigger, so
docs.pagenary.com redeploys too). **A `v*` tag push to github triggers the
public npmjs.org workflow** in `.github/workflows/npm-publish.yml`.

### Signing key (important)

Release tags are signed with the **release key**, not the per-developer commit
key:

| Key | ID | Use |
|-----|----|----|
| Commit signing | `0117DAAA677A5BF2` | normal commits (`git config user.signingkey`) |
| **Release signing** | `719AB63879E84CE8` — *AIWG Release Signing `<release@aiwg.io>`* | **release tags** |

Because `user.signingkey` defaults to the commit key, a bare `git tag -s` signs
with the *wrong* key. Always pass `-u 719AB63879E84CE8` explicitly. Use the
**long key id** — the short form (`719AB638`) fails with `gpg: No secret key`.

Preview without publishing: run `npm-publish.yml` manually
(`workflow_dispatch`) with the `dry_run` input `true` (builds + `npm pack`, no
publish).

### Common pitfalls & recovery

- **Push both remotes.** `origin` drives Gitea release/internal package
  workflows. The `github` tag push is what triggers
  `.github/workflows/npm-publish.yml` for public npm trusted publishing. Push
  `origin` first, then `github`; do not wait for the Gitea mirror leg as the
  only GitHub trigger.
- **`NPM_TOKEN` scope:** the publish needs a Gitea token with **both**
  `package:write` and `repository:write`. If `npm-publish.yml` fails on auth,
  fix the token scope and re-run it via `workflow_dispatch` (idempotent —
  re-publishing the same version is a no-op, dist-tag promotion is safe to repeat).
- **GitHub npm `ENEEDAUTH`:** if the GitHub npm workflow starts but `npm publish`
  says auth is required, npm did not accept the run as a trusted publisher.
  Confirm every public package has npm Trusted Publisher settings for
  `Provider: GitHub Actions`, `Owner: jmagly`, `Repository: pagenary`,
  `Workflow: npm-publish.yml`, allowed action `npm publish`.

## What the workflow enforces

In order, on a `v*` tag push:

1. **Signed-tag verify** *(opt-in — only if `REQUIRE_SIGNED_TAGS=true`)* — `tools/ci/verify-signed-tag.sh`
2. **npm ≥ 11.5** — required for the `min-release-age=7` gate in `.npmrc`
3. **`npm ci`** — locked install
4. **`npm audit signatures`** — verifies the dep graph against registry signing keys
5. **Build + test** — `publisher:build`, `publisher:test`
6. **Tag/version guard** — tag `vX` must equal every public package version;
   internal `@pagenary/*` dependencies must equal that exact version
7. **Tarball top-level audit** — diff every package against its
   `ci/expected-tarball-top-level*.txt` allowlist (catches new-file-at-root
   injection)
8. **`.aiwg/` exclusion** — fails if project artifacts leak into any tarball
9. **Publish** `@pagenary/blog-client`, `@pagenary/embed`, and
   `@pagenary/publisher` to the Gitea npm registry in dependency order, then
   idempotently promote each `latest` dist-tag

## Release records & artifacts (Gitea + GitHub)

`.gitea/workflows/release.yml` runs alongside the npm publish on the same `v*`
tag. It builds the package once and then:

- **Gitea** — creates (or reuses) a Gitea release for the tag and attaches the
  publisher tarball (`pagenary-publisher-<version>.tgz`), the compiled site
  bundle, and `checksums.txt` (SHA-256). npm package publishing for all public
  packages is handled by `npm-publish.yml`. Uses `NPM_TOKEN` (needs
  `repository:write`).
- **GitHub** *(stable tags only)* — pushes `main` + the tag to the mirror via a
  transient mode-600 credential file (no token in the URL), then creates a
  matching GitHub release with the same assets. Uses `GH_TOKEN`. Pre-release
  tags (e.g. `v2026.5.0-rc.1`) skip this leg.

Release notes are auto-composed: install snippet, a commit changelog since the
previous tag, and the artifact's SHA-256. Asset uploads are idempotent, so
re-running the workflow on an existing tag refreshes rather than duplicates.

## Signed release tags (enabling the gate)

1. Generate / choose a maintainer key and commit the **public** part:
   - GPG: `gpg --armor --export <keyid> > .gitea/keys/maintainers.asc`
   - SSH: add a line to `.gitea/allowed_signers` —
     `release <principal> namespaces="git" <ssh-ed25519 AAAA…>`
2. Configure local signing (`git config user.signingkey …`, `gpg.format ssh` for SSH).
3. Set the repo variable `REQUIRE_SIGNED_TAGS=true`.
4. Tag with `git tag -s vYYYY.M.PATCH -m "…"` from then on.

## Public npm (npmjs.org) — optional second leg

The Gitea registry is the default. Public npmjs.org publishing is handled by
`.github/workflows/npm-publish.yml` after `release.yml` mirrors the tag to
GitHub. It uses npm trusted publishing/OIDC and automatic provenance.
One-time operator setup:

1. For each public package (`@pagenary/blog-client`, `@pagenary/embed`,
   `@pagenary/publisher`), npmjs.org -> package Settings -> Trusted Publishers
   -> add: `Provider: GitHub Actions`, `Owner: jmagly`,
   `Repository: pagenary`, `Workflow: npm-publish.yml`, allowed action
   `npm publish`.
2. The GitHub workflow declares `permissions: id-token: write`, runs on a
   GitHub-hosted runner with pinned Node 24, rewrites each package's
   `repository.url` to the GitHub mirror for provenance matching, and runs
   `npm publish --access public` for each package. npm automatically generates
   provenance for trusted publishing from a public repository.
3. Push the signed release tag to the `github` remote after pushing `origin`.
   GitHub Actions needs the tag event to start the public npm workflow.

No long-lived `NPMJS_TOKEN` is needed with OIDC. If `release.yml` fails while
pushing to GitHub with a message about updating `.github/workflows/*`, replace
`GH_TOKEN` with a PAT that includes `workflow` scope and rerun the release job
or cut the next patch release.

## When `npm audit signatures` fails

If a transitive dependency trips the signature audit, do **not** suppress the
step. Either update the dependency to a signed version, or record a
time-bounded waiver and re-evaluate it (mirroring aiwg's
`ci/npm-audit-signatures-waivers.yaml`). Suppressing CI security signals is
prohibited by `.claude/rules/dev-pipeline-safety.md`.
