# Releasing Pagenary Packages

Public npm publishing and the public GitHub release are owned by
`.github/workflows/npm-publish.yml`, triggered by the operator's version tag
push to GitHub. `.gitea/workflows/npm-publish.yml` publishes the internal npm
packages, while `.gitea/workflows/release.yml` mirrors verified public release
assets from GitHub to Gitea. Versioning is **CalVer** — `YYYY.M.PATCH`, no leading zeros
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
| `GT_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | Preferred Gitea API token with `package:write` for internal npm and `repository:write` for the Gitea release mirror. |
| `NPM_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | Backward-compatible fallback when `GT_TOKEN` is absent; the same Gitea scopes apply. **Not** an npmjs.org token. |
| `github.token` | ephemeral workflow token | GitHub Actions | Creates the public GitHub release and uploads assets with `contents: write`. No GitHub PAT is needed. |
| `REQUIRE_SIGNED_TAGS` | variable (optional) | Gitea repo → Settings → Actions → Variables | Set to `true` to turn the signed-tag gate from dormant into a hard requirement. Needs a committed maintainer key (below). |
| Maintainer signing key | committed file | `.gitea/keys/maintainers.asc` (GPG) **or** `.gitea/allowed_signers` (SSH) | Public key the signed-tag gate verifies against. Only the public key is committed; you sign tags locally with the private key. |
| npm trusted publisher | package settings | npmjs.org | Required for the **public npm** leg. Configure each public package for GitHub Actions trusted publishing; no long-lived `NPMJS_TOKEN` is required for publishing. |

The Gitea workflows prefer `GT_TOKEN` and fall back to `NPM_TOKEN`. Public npm
requires the trusted-publisher settings below. Signed-tag verification in CI
is optional hardening; maintainers still sign release tags locally.

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
tools/release/cut-tag.sh 2026.5.2 -m "v2026.5.2 — <summary>"

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
(publishes the internal package set), `release.yml` (mirrors the stable public
GitHub release to Gitea), and `docsite-deploy.yml` (redeploys docs.pagenary.com).
**A `v*` tag push to github triggers the public npmjs.org workflow** in
`.github/workflows/npm-publish.yml`, which also owns the public release.
Gitea never pushes `main` or tags to GitHub. The internal npm and release
mirror workflows use distinct concurrency groups.

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
  `origin` first, then `github`. The operator's GitHub push supplies the tag
  event; there is no Gitea-to-GitHub push job.
- **`GT_TOKEN` / fallback `NPM_TOKEN` scope:** the workflows need a Gitea token with **both**
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

For stable releases, `.github/workflows/npm-publish.yml` publishes the public
npm package set first, then creates the public GitHub release and uploads its
assets and SHA-256 checksums. It uses the ephemeral `github.token` with
`contents: write` for release operations and OIDC for npm publishing; no
long-lived GitHub PAT is required.

`.gitea/workflows/release.yml` downloads the public release assets and checksum
manifest from GitHub, verifies every asset before making Gitea writes, and
mirrors the exact asset bytes and release body to the matching Gitea release.
It does not rebuild the assets or push anything to GitHub. Gitea writes use
`GT_TOKEN`, falling back to `NPM_TOKEN`, with `repository:write` access.
Public release mirroring accepts stable CalVer tags only; prerelease tags do
not enter this path.

If mirroring fails before the public release is available, finish or rerun the
GitHub npm workflow first. Then dispatch Gitea `release.yml` using the workflow
on `main`, with `tag_to_publish` set to the existing stable tag, for example
`v2026.9.1`. This recovers the mirror without moving or deleting the signed
tag. A change to released product content requires a new patch version.

## Signed release tags (enabling the gate)

1. Generate / choose a maintainer key and commit the **public** part:
   - GPG: `gpg --armor --export <keyid> > .gitea/keys/maintainers.asc`
   - SSH: add a line to `.gitea/allowed_signers` —
     `release <principal> namespaces="git" <ssh-ed25519 AAAA…>`
2. Configure local signing (`git config user.signingkey …`, `gpg.format ssh` for SSH).
3. Set the repo variable `REQUIRE_SIGNED_TAGS=true`.
4. Create signed tags with `tools/release/cut-tag.sh YYYY.M.PATCH -m "…"`.

## Public npm (npmjs.org) and GitHub release ownership

Public npmjs.org publishing is handled by `.github/workflows/npm-publish.yml`
after the operator pushes the signed tag to GitHub. It uses npm trusted
publishing/OIDC and automatic provenance, then creates the public release that
Gitea mirrors.
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

No long-lived `NPMJS_TOKEN` or GitHub PAT is needed. The workflow requests
`id-token: write` for npm trusted publishing and `contents: write` for its own
GitHub release. Gitea only reads public GitHub assets and authenticates its
writes to Gitea with the existing Gitea token.

## When `npm audit signatures` fails

If a transitive dependency trips the signature audit, do **not** suppress the
step. Either update the dependency to a signed version, or record a
time-bounded waiver and re-evaluate it (mirroring aiwg's
`ci/npm-audit-signatures-waivers.yaml`). Suppressing CI security signals is
prohibited by `.claude/rules/dev-pipeline-safety.md`.
