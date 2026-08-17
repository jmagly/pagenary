# Choose and install a style

Pagenary styles are versioned override packages. Choose one in the
[style catalog](https://catalog.pagenary.com/), inspect its versioned detail
page, and review the live fixture on the isolated
[preview host](https://preview.catalog.pagenary.com/) before copying any files.
The catalog page is the human-readable view; `style.json` in the downloaded
archive is the contract.

## Choose the right package

A **base package** supplies a complete reusable shell and component treatment.
A **preset** extends a named base and normally changes only semantic tokens and
brand treatment. Install the exact base/version declared by a preset's
`extends` field before installing the preset.

Check these fields on the versioned detail page and in `style.json`:

| Field | Decision it supports |
| --- | --- |
| `version` | The immutable release to pin and record for rollback. |
| `status` | `active` is the normal choice; `preserved` is for audit or rollback; `deprecated` needs a migration plan. |
| `compatibility.pagenary` | Whether the package supports your pinned `@pagenary/publisher` version. |
| `compatibility.contract` | The override contract the package expects. |
| `compatibility.stylesheetMode` | `additive` retains Pagenary's stylesheet; `replacement` supplies its own. |
| `compatibility.loadOrder` | The required order for Pagenary, base, preset, and tenant stylesheets. |
| `license` and `provenance` | Whether you may use the bytes and where they came from. |
| `files[].sha256` | Integrity of each final distributable file. |

Additive styles are the safer default: Pagenary continues to own navigation,
search, export, share controls, and component behavior. A replacement style
can be valid, but it takes responsibility for more of the shell and therefore
needs broader regression testing.

## Pin and download

Substitute values copied from one versioned catalog detail page. Do not invent
an identifier, version, archive digest, license, or compatibility range.

```bash
STYLE_ID=<style-id>
STYLE_VERSION=<x.y.z>
curl --fail --location --proto '=https' --tlsv1.2 \
  --output "${STYLE_ID}-${STYLE_VERSION}.zip" \
  "https://catalog.pagenary.com/downloads/${STYLE_ID}-${STYLE_VERSION}.zip"
curl --fail --location --proto '=https' --tlsv1.2 \
  --output SHA256SUMS \
  "https://catalog.pagenary.com/downloads/SHA256SUMS"
grep "  ${STYLE_ID}-${STYLE_VERSION}.zip$" SHA256SUMS | sha256sum --check --strict -
```

Stop if the archive is absent from `SHA256SUMS`, the digest fails, the catalog
and archive metadata disagree, or rights and provenance are unclear. The
checksum authenticates the downloaded bytes against the catalog manifest; it
does not replace license or provenance review.

## Install into a tenant

Keep a rollback copy, extract into a staging directory, inspect the archive,
then copy only its `overrides/` content into the tenant source. The examples
use a generic tenant at `tenants/acme-docs/`.

```bash
BACKUP="tenants/acme-docs/overrides.before-${STYLE_VERSION}"
if test -d tenants/acme-docs/overrides; then
  cp -a tenants/acme-docs/overrides "$BACKUP"
fi
mkdir -p .style-staging
unzip -q "${STYLE_ID}-${STYLE_VERSION}.zip" -d .style-staging
find ".style-staging/${STYLE_ID}-${STYLE_VERSION}" -maxdepth 3 -type f -print
cp -a ".style-staging/${STYLE_ID}-${STYLE_VERSION}/overrides/." tenants/acme-docs/overrides/
npm test
npm run publisher:build:tenants
npm run publisher:serve
```

The extracted archive root and exact commands are also shown on its catalog
detail page. Inspect `style.json`, `README.md`, and every override before the
copy. Never execute scripts found in an archive merely because the checksum
matches.

## Acceptance checks

Open the local tenant in a narrow mobile viewport and a desktop viewport, in
every supported light/dark state. Verify:

- primary navigation, search, code copy, export/share, and static snapshots;
- keyboard-only use, visible focus, skip links, dialogs, and menu dismissal;
- text and interactive-control contrast, zoom/reflow, and reduced motion;
- long headings, tables, code blocks, diagrams, and missing-image fallbacks;
- the browser console and network panel contain no missing local assets.

Compare those results with the catalog detail page and its isolated preview.
The preview is evidence for the catalog fixture, not a substitute for testing
your content, branding, or Pagenary version.

## Record and roll back

Record the style ID/version, Pagenary version, archive SHA-256, installation
date, and local verification result in your change. To roll back, restore the
saved override directory, restore the previous pinned versions, rebuild, and
repeat the same checks:

```bash
rm -rf tenants/acme-docs/overrides
if test -d "$BACKUP"; then
  mv "$BACKUP" tenants/acme-docs/overrides
fi
npm test
npm run publisher:build:tenants
```

Next: [Configure and use the style](#/styles-configure).

## Agent recipe: install

Copy this prompt and replace every bracketed value with verified information:

```text
Install Pagenary style [STYLE_ID] version [VERSION] from the canonical source
https://git.integrolabs.net/roctinam/pagenary-styles and its versioned page at
https://catalog.pagenary.com/styles/[STYLE_ID]/[VERSION]/ into tenant
[TENANT_PATH]. Inspect the repository, tenant, style.json, README, archive, and
current overrides before editing. Verify the archive against the published
SHA256SUMS and verify final files against style.json. Do not invent or infer
license, provenance, compatibility, version, or hash data; stop if any is
missing, contradictory, or rights are ambiguous. Preserve unrelated work.
Respect stylesheetMode and loadOrder. Run npm test, build the tenant, and check
desktop/mobile, light/dark, keyboard focus, contrast, overflow, missing assets,
search, and the isolated preview. Produce only the required tenant override
files plus an installation record. Report inspected sources, changed files,
exact versions and hashes, commands and results, preview checks, and rollback.
```
