# Author and package a style

Start from Pagenary Foundation or a compatible catalog base whose contract you
can satisfy. A reusable style is a versioned package with evidence: distributable
bytes, a schema-valid manifest, representative fixtures, accessible previews,
license evidence, and provenance.

## Choose a base and identity

- Use a lowercase kebab-case `id`; it is permanent once published.
- Extend a base only when your package follows its declared contract.
- Use a token-only preset for palette/brand changes; use a base package for a
  shell, component treatments, or progressive enhancements.
- A compatible improvement retains the ID and increments SemVer. A breaking
  shell, selector, token, load-order, or extension-hook contract gets a new
  major version only when consumers can migrate safely; use a new stable ID
  for a distinct or incompatible successor that must coexist.

## Package shape

```text
styles/example-style/
├── README.md
├── style.json
├── LICENSE
├── overrides/
│   ├── index.html
│   └── example-style.css
├── previews/
│   ├── desktop-light.png
│   ├── desktop-dark.png
│   ├── mobile-light.png
│   └── mobile-dark.png
└── provenance/
    └── ... evidence referenced by style.json
```

Use generic fixture content and no source-project branding. The distributable
archive should contain only intentional package files; generated catalog pages
are views, never the metadata source of truth.

## `style.json` contract

The canonical schema is
[`schema/style.schema.json`](https://git.integrolabs.net/roctinam/pagenary-styles/src/branch/main/schema/style.schema.json).
At minimum declare:

```json
{
  "$schema": "../../schema/style.schema.json",
  "id": "example-style",
  "name": "Example Style",
  "version": "1.0.0",
  "description": "A generic reusable Pagenary style.",
  "license": "SPDX-ID-FROM-EVIDENCE",
  "compatibility": {
    "pagenary": ">=VERIFIED_MIN <VERIFIED_MAX",
    "contract": "VERIFIED_CONTRACT",
    "stylesheetMode": "additive",
    "loadOrder": ["styles.css", "example-style.css"]
  },
  "files": [
    { "path": "overrides/example-style.css", "sha256": "FINAL_BYTE_SHA256" }
  ],
  "provenance": {
    "sourceRepository": "VERIFIED_CANONICAL_URL",
    "sourceCommit": "FULL_40_CHARACTER_COMMIT",
    "sourcePath": "VERIFIED_SOURCE_PATH",
    "captured": "YYYY-MM-DD"
  }
}
```

Replace every placeholder with verified evidence before submission. If the
style extends another package, declare its exact ID and version. Record license
evidence using the schema's source-repository or copyright-holder-grant basis;
do not infer a license from public availability.

## Hash final bytes

Finish transformations first, then hash the exact bytes that will ship:

```bash
sha256sum styles/example-style/overrides/*
sha256sum styles/example-style/previews/*
npm test
npm run build:site
npm run test:site
```

Copy those lowercase 64-character digests into `style.json`, rerun validation,
and rebuild twice to prove deterministic archives. A later formatter, optimizer,
or screenshot pass changes the bytes and requires new hashes.

## Representative fixtures and previews

Exercise headings, paragraphs, links, buttons, forms, navigation, search,
tables, long code, diagrams/media fallbacks, callouts, focus states, and long
unbroken content. Capture required desktop/mobile and light/dark previews from
the same fixture. Test keyboard navigation, accessible names, focus visibility,
contrast, zoom/reflow, reduced motion, overflow, and behavior without optional
JavaScript. The isolated preview must not depend on catalog-origin privileges or
unlisted remote assets.

## Agent recipe: author

```text
Author a generic Pagenary style [STYLE_ID] version [VERSION] in the canonical
source repository https://git.integrolabs.net/roctinam/pagenary-styles, starting
from [VERIFIED_BASE_ID] [BASE_VERSION] and its documented contract. Inspect the
repository schema, catalog, base manifest/README, representative fixtures,
tests, and unrelated work before editing. Do not invent license, provenance,
compatibility, source commit/path, version, or hash data; stop on ambiguous
rights, unsupported compatibility, or missing evidence. Preserve unrelated
work and use no source-project branding. Produce the package README, LICENSE or
referenced license evidence, style.json, overrides, provenance evidence, fixture,
and desktop/mobile light/dark previews. Hash only final bytes. Run npm test,
build/test the catalog site and fixtures, and perform keyboard, contrast,
overflow, missing-asset, reduced-motion, and isolated-preview checks. Report all
files, evidence sources, compatibility decisions, hashes, commands/results,
remaining risks, and whether the change is compatible or a breaking successor.
```

Next: [Contribute and review the style](#/styles-contribute).
