#!/usr/bin/env bash
# Verify the tag triggering this CI run is cryptographically signed by a
# maintainer key published in the repo. Hard-fails if no maintainer keys are
# present or the tag's signature does not verify. Modeled on roctinam/aiwg's
# tools/ci/verify-signed-tag.sh.
#
# Wired OPT-IN: the publish workflow only runs this when repo variable
# REQUIRE_SIGNED_TAGS == 'true'. Enable it after committing a maintainer
# public key (see docs/contributing/releasing.md § Signed release tags).
#
# Signing formats (pick one; both may coexist):
#   - GPG via .gitea/keys/maintainers.asc   (ASCII-armored pubkey ring)
#   - SSH via .gitea/allowed_signers        (OpenSSH allowed-signers format)
#
# Usage (from a workflow run: block, with $GITHUB_REF set by the runner):
#   bash tools/ci/verify-signed-tag.sh

set -euo pipefail

GH_REF="${GITHUB_REF:-}"
TAG="${GH_REF#refs/tags/}"
if [ -z "$TAG" ] || [ "$TAG" = "$GH_REF" ]; then
  echo "verify-signed-tag: not a tag push (GITHUB_REF=$GH_REF). This must run only on tag-triggered events." >&2
  exit 1
fi

GPG_RING=".gitea/keys/maintainers.asc"
SSH_SIGNERS=".gitea/allowed_signers"

if [ ! -f "$GPG_RING" ] && [ ! -f "$SSH_SIGNERS" ]; then
  cat >&2 <<EOF
verify-signed-tag: no maintainer keys found.
  Expected one of:
    $GPG_RING        (GPG: gpg --armor --export <keyid> > $GPG_RING)
    $SSH_SIGNERS     (SSH: "<principal> namespaces=\"git\" <ssh-pubkey>")
  See docs/contributing/releasing.md § Signed release tags.
EOF
  exit 1
fi

# Prefer GPG if a ring is present, else SSH allowed-signers.
if [ -f "$GPG_RING" ]; then
  TMP_HOME="$(mktemp -d)"
  trap 'rm -rf "$TMP_HOME"' EXIT
  GNUPGHOME="$TMP_HOME" gpg --quiet --import "$GPG_RING"
  if GNUPGHOME="$TMP_HOME" git -c gpg.program=gpg tag -v "$TAG" 2>&1; then
    echo "✓ Tag $TAG verified against $GPG_RING (GPG)"
    exit 0
  fi
  echo "✗ Tag $TAG failed GPG verification against $GPG_RING" >&2
  exit 1
else
  if git -c gpg.format=ssh -c gpg.ssh.allowedSignersFile="$SSH_SIGNERS" tag -v "$TAG" 2>&1; then
    echo "✓ Tag $TAG verified against $SSH_SIGNERS (SSH)"
    exit 0
  fi
  echo "✗ Tag $TAG failed SSH verification against $SSH_SIGNERS" >&2
  exit 1
fi
