# Releasing `@pagenary/publisher`

Publishing is automated by `.gitea/workflows/npm-publish.yml`, triggered on a
version tag push. Versioning is **CalVer** — `YYYY.M.PATCH`, no leading zeros
(see `.claude/rules/versioning.md`). The setup mirrors `roctinam/aiwg`'s
supply-chain hardening, adapted to this repo.

## Required variables / secrets

| Name | Type | Where | Purpose |
|------|------|-------|---------|
| `NPM_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | Gitea API token (`gta_…`) with `package:write` **and** `repository:write`. Authenticates the Gitea-registry publish *and* the Gitea release-creation API. **Not** an npmjs.org token. |
| `GH_TOKEN` | **secret** | Gitea repo → Settings → Actions → Secrets | GitHub PAT with `repo` (or `public_repo`) scope. Used by `release.yml` to push the mirror and create the GitHub release with assets. The GitHub leg skips gracefully if absent. |
| `REQUIRE_SIGNED_TAGS` | variable (optional) | Gitea repo → Settings → Actions → Variables | Set to `true` to turn the signed-tag gate from dormant into a hard requirement. Needs a committed maintainer key (below). |
| Maintainer signing key | committed file | `.gitea/keys/maintainers.asc` (GPG) **or** `.gitea/allowed_signers` (SSH) | Public key the signed-tag gate verifies against. Only the public key is committed; you sign tags locally with the private key. |
| `NPMJS_TOKEN` *or* npm trusted publisher | secret *or* npm config | npmjs.org | Only for the **public npm** leg (below). Prefer OIDC trusted publishing (no secret). |

The Gitea-registry release path needs only `NPM_TOKEN`. Everything else is
opt-in hardening.

## Release steps

```bash
# 1. Bump the version in apps/publisher/package.json (CalVer).
#    e.g. 2026.5.1 -> 2026.5.2, or new month -> 2026.6.0.
#    No leading zeros: June is 2026.6.0, not 2026.06.0. (See versioning rule.)

# 2. Finalize the CHANGELOG: rename the "## [Unreleased]" heading to
#    "## [VERSION] - YYYY-MM-DD". Keep it accurate — release notes link here.

# 3. Update docs if the release changes config/behavior, then commit it all.
git commit -am "release: v2026.5.2 — <one-line summary> (#refs)"

# 4. Tag with a SIGNED, v-prefixed tag (the workflow guards tag == version).
#    Sign with the RELEASE key, not the default commit key — see note below.
git tag -s -u 719AB63879E84CE8 v2026.5.2 -m "v2026.5.2 — <summary>"

# 5. Push the commit, then the tag, to ORIGIN ONLY. The tag push is what
#    triggers CI. Do NOT push the tag to the github mirror yourself (see pitfall).
git push origin main
git push origin v2026.5.2
```

**A `v*` tag push triggers three workflows:** `npm-publish.yml` (publishes the
package), `release.yml` (Gitea + GitHub release records), and `docsite-deploy.yml`
(the tag matches its `v*` trigger, so docs.pagenary.com redeploys too).

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

- **Don't push the tag to the `github` remote manually.** `release.yml` pushes
  `main` + the tag to the GitHub mirror itself (via `GH_TOKEN`). If the tag is
  already on the mirror, that step fails with *"Updates were rejected because the
  tag already exists"* and the GitHub **release record** is not created (the
  package + Gitea release are unaffected). Push only to `origin`.
  - *Recovery:* create the GitHub release for the existing tag manually
    (`gh release create v2026.5.2 …`), or delete the mirror tag and re-run
    `release.yml` so it re-pushes and creates the record.
- **`NPM_TOKEN` scope:** the publish needs a Gitea token with **both**
  `package:write` and `repository:write`. If `npm-publish.yml` fails on auth,
  fix the token scope and re-run it via `workflow_dispatch` (idempotent —
  re-publishing the same version is a no-op, dist-tag promotion is safe to repeat).

## What the workflow enforces

In order, on a `v*` tag push:

1. **Signed-tag verify** *(opt-in — only if `REQUIRE_SIGNED_TAGS=true`)* — `tools/ci/verify-signed-tag.sh`
2. **npm ≥ 11.5** — required for the `min-release-age=7` gate in `.npmrc`
3. **`npm ci`** — locked install
4. **`npm audit signatures`** — verifies the dep graph against registry signing keys
5. **Build + test** — `publisher:build`, `publisher:test`
6. **Tag/version guard** — tag `vX` must equal `apps/publisher/package.json` version
7. **Tarball top-level audit** — diff against `ci/expected-tarball-top-level.txt` (catches new-file-at-root injection)
8. **`.aiwg/` exclusion** — fails if project artifacts leak into the tarball
9. **Publish** to the Gitea npm registry, then idempotent `latest` dist-tag promotion

## Release records & artifacts (Gitea + GitHub)

`.gitea/workflows/release.yml` runs alongside the npm publish on the same `v*`
tag. It builds the package once and then:

- **Gitea** — creates (or reuses) a Gitea release for the tag and attaches the
  built tarball (`pagenary-publisher-<version>.tgz`) plus `checksums.txt`
  (SHA-256). Uses `NPM_TOKEN` (needs `repository:write`).
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

The Gitea registry is the default. To also publish to public npmjs.org, add a
GitHub Actions leg using **OIDC trusted publishing + provenance** (mirrors
aiwg's `.github/workflows/npm-publish.yml`). One-time operator setup:

1. npmjs.org → the package's Settings → Trusted Publishers → add:
   `Provider: GitHub Actions`, `Owner: jmagly`, `Repository: pagenary`,
   `Workflow: npm-publish.yml`.
2. The GitHub workflow declares `permissions: id-token: write` and runs
   `npm publish --provenance --access public` on a Node ≥ 22.14 runner.
3. Push tags to the GitHub mirror too: `git push github main --tags`.

No long-lived `NPMJS_TOKEN` is needed with OIDC. (A token-based leg is the
fallback if OIDC is unavailable, but it then becomes a secret to rotate.)

## When `npm audit signatures` fails

If a transitive dependency trips the signature audit, do **not** suppress the
step. Either update the dependency to a signed version, or record a
time-bounded waiver and re-evaluate it (mirroring aiwg's
`ci/npm-audit-signatures-waivers.yaml`). Suppressing CI security signals is
prohibited by `.claude/rules/dev-pipeline-safety.md`.
