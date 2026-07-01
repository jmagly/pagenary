#!/usr/bin/env bash
set -euo pipefail

RELEASE_KEY_FINGERPRINT="${AIWG_RELEASE_KEY_FINGERPRINT:-FE9272F0BC5781E1DE77FAAA719AB63879E84CE8}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version> [-m \"tag message\"]" >&2
  exit 1
fi

VERSION="$1"
shift
TAG="v${VERSION}"
TAG_MESSAGE=""

while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message)
      TAG_MESSAGE="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

echo "Pagenary cut-tag preflight for ${TAG}"

if ! [[ "$VERSION" =~ ^[0-9]{4}\.([1-9]|1[0-2])\.([0-9]|[1-9][0-9]+)$ ]]; then
  echo "FAIL: '$VERSION' is not CalVer YYYY.M.PATCH with no leading zeros." >&2
  exit 1
fi
echo "  [1/8] CalVer shape OK"

PKG_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('apps/publisher/package.json','utf8')).version)")
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "FAIL: apps/publisher/package.json version is '$PKG_VERSION', expected '$VERSION'." >&2
  exit 1
fi
echo "  [2/8] apps/publisher/package.json version OK"

LOCK_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package-lock.json','utf8')).packages['apps/publisher'].version)")
if [ "$LOCK_VERSION" != "$VERSION" ]; then
  echo "FAIL: package-lock.json apps/publisher version is '$LOCK_VERSION', expected '$VERSION'." >&2
  exit 1
fi
echo "  [3/8] package-lock.json workspace version OK"

if ! grep -q "^## \\[${VERSION}\\]" CHANGELOG.md; then
  echo "FAIL: CHANGELOG.md does not contain '## [${VERSION}]'." >&2
  exit 1
fi
echo "  [4/8] CHANGELOG.md entry OK"

if ! gpg --list-secret-keys "$RELEASE_KEY_FINGERPRINT" >/dev/null 2>&1; then
  echo "FAIL: release signing key '$RELEASE_KEY_FINGERPRINT' is not available locally." >&2
  exit 1
fi
echo "  [5/8] release signing key present locally"

if ! gpg --show-keys --with-colons .gitea/keys/maintainers.asc 2>/dev/null \
  | awk -F: '$1=="fpr" {print $10}' | grep -qx "$RELEASE_KEY_FINGERPRINT"; then
  echo "FAIL: release signing key is not published in .gitea/keys/maintainers.asc." >&2
  exit 1
fi
echo "  [6/8] release signing key published"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "FAIL: tag '$TAG' already exists locally." >&2
  exit 1
fi

if [ -z "$TAG_MESSAGE" ]; then
  TAG_MESSAGE="${TAG}"
fi

git tag -s -u "$RELEASE_KEY_FINGERPRINT" "$TAG" -m "$TAG_MESSAGE"
echo "  [7/8] signed tag created"

git tag -v "$TAG" >/dev/null
echo "  [8/8] local tag signature verification passed"

cat <<EOF

Ready to push:
  git push origin main
  git push origin ${TAG}

EOF
