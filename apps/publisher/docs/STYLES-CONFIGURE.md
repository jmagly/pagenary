# Configure and use a style

A style is an override layer, not a fork of the publisher. Keep tenant content,
branding inputs, and product components separate from catalog-owned files so a
style can be upgraded or removed without losing local work.

## Load order and ownership

Use the exact `compatibility.loadOrder` from `style.json`. A typical additive
stack is:

1. Pagenary's generated `styles.css` and runtime shell;
2. base-package CSS and progressive enhancements;
3. an optional preset's token file;
4. tenant-owned, namespaced component adjustments.

A replacement package instead supplies the stylesheet named by its contract.
Do not also load Pagenary's base stylesheet unless that package explicitly
requires it. In both modes, preserve required element IDs and the publisher's
navigation, search, export/share, and accessibility hooks.

## Tenant tree before and after

Before:

```text
tenants/acme-docs/
├── config.json
├── manifest.json
└── content/
```

After installing a base and a token-only preset:

```text
tenants/acme-docs/
├── config.json
├── manifest.json
├── content/
└── overrides/
    ├── index.html
    ├── base-style.css
    ├── base-contract.css
    ├── preset-tokens.css
    └── progressive-enhancement.js
```

Names vary by package. Copy only files listed in `style.json`; do not rename or
reorder them unless the package contract permits it.

## Branding and supported customization

Prefer Pagenary tenant inputs such as `title`, `brandMark`, `brandSub`, domain,
tagline, logo/favicon assets, theme colors, font stacks, navigation position,
welcome content, and SEO organization data. See [Tenant Configuration](#/tenant-config)
for the supported fields.

Safe tenant customization normally includes:

- semantic design tokens exposed by the style contract;
- tenant-owned assets with local, stable paths and documented rights;
- product components under a tenant-specific class namespace;
- content and manifest changes that do not alter catalog-owned selectors.

Avoid editing copied base files for one-off branding, redefining global
geometry in a palette preset, removing focus indicators, hiding overflow to
mask broken layout, or depending on undocumented selectors. If a needed hook
is absent, propose a compatible upstream change rather than silently forking.

## Pin, upgrade, and roll back

Pin the Pagenary and style versions together. For an upgrade:

1. Read both manifests and release notes; confirm the new compatibility range.
2. Download and verify the new immutable archive and final file hashes.
3. Save the current override tree and installation record.
4. Replace catalog-owned files as a unit; reapply only documented tenant hooks.
5. Build the same representative content and compare desktop/mobile and
   light/dark screenshots.
6. Run keyboard, contrast, zoom/reflow, reduced-motion, search, export/share,
   static-page, and missing-asset checks.
7. Keep the prior verified archive and override tree until production is
   observed healthy.

Restore the prior pinned pair and saved files if any compatibility or acceptance
gate fails. Never repair a published versioned archive or hash in place.

## Troubleshooting

| Symptom | Check | Corrective action |
| --- | --- | --- |
| Missing CSS, font, or image | Browser network errors; relative URLs; copied file list | Restore the declared path or use a tenant-local asset. Do not hotlink preview assets. |
| Old appearance after rebuild | Output directory, service worker/CDN/browser cache, immutable URL | Clean and rebuild locally; purge only mutable deployment paths; keep versioned assets immutable. |
| Wrong colors in dark mode | Supported color scheme and semantic token overrides | Define both supported states through documented tokens; do not invert the page wholesale. |
| Low contrast or invisible focus | Automated report plus keyboard/manual inspection | Correct semantic foreground/background/focus tokens and retest all states. |
| Horizontal overflow | Long code, tables, URLs, headings, and custom component widths | Use the style's documented wrapping/scroll container; fix the responsible component instead of clipping the page. |
| Search or controls stop working | Required IDs, script order, console errors | Restore the package shell contract and Pagenary-owned hooks. |

## Agent recipe: upgrade

```text
Upgrade tenant [TENANT_PATH] from Pagenary style [STYLE_ID] [OLD_VERSION] to
[NEW_VERSION], sourced only from
https://git.integrolabs.net/roctinam/pagenary-styles and the matching versioned
catalog pages. Inspect the tenant, current installation record, both style
manifests and READMEs, compatibility/load-order contracts, and unrelated git
changes before editing. Do not invent license, provenance, compatibility,
version, or hash data; stop on missing evidence, ambiguous rights, or an
unsupported Pagenary range. Preserve unrelated work and tenant-owned hooks.
Verify archive and final-file SHA-256 values, run npm test and the tenant build,
then compare desktop/mobile and light/dark previews and check keyboard focus,
contrast, overflow, missing assets, search, export/share, and static pages.
Output the updated catalog-owned override files and installation record only.
Report sources, diffs, versions/hashes, verification results, and exact rollback.
```

Next: [Author and package a reusable style](#/styles-author).
