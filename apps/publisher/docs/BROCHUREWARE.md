# Brochureware Content Contract

Pagenary's brochureware pipeline lets a React SPA keep ownership of its visual
experience while the publisher owns validation, semantic fallbacks, search, and
machine-readable artifacts. The first contract is
`pagenary.brochure.content.v1`; see
`examples/portfolio-brochure/content.json` for a complete fixture.

## Canonical fields

The root contains `schemaVersion`, optional `templateClass`, `site`, `entities`,
and `routeManifest`. `site` requires a title, description, absolute HTTP(S)
canonical URL, and language. Canonical entity groups are `profile`, `offers`,
`projects`, `experience`, `updates`, `testimonials`, and `links`. Entity ids are
addressed from routes as `<group>.<id>`.

Every route declares a unique id and safe absolute path, a template role,
entity references, extraction policy, and prerender policy. Public routes also
require a title and summary. Duplicate ids/paths, dangling references, unsafe
paths, invalid canonical URLs, and incomplete public routes fail validation.

Presentation policy remains data. Fields such as an offer's `showPrice` are
validated and passed through; Pagenary does not decide how the tenant renders
them.

## Extensions and diagnostics

Tenant-specific data belongs under the root `extensions` object, preferably
using a reverse-domain or domain/path key such as
`example.com/brand`. Extension values pass through without interpretation.
Unknown root fields are also retained but produce a warning so a misspelled
canonical field is visible. Unused entities, absent social images, and optional
summary gaps warn; contract, routing, privacy, and output-safety errors fail.

The base publisher contract remains plain JavaScript and keeps the publisher's
Node 16 floor. Loading TypeScript content modules belongs to the opt-in
React/Vite adapter described by the next construction stage.

## Tenant configuration

Enable the loader only for a React-SPA tenant:

```json
{
  "runtime": { "mode": "react-spa", "react": { "entry": "app/main.jsx" } },
  "brochureware": {
    "enabled": true,
    "templateClass": "portfolio-brochure",
    "contentModule": "content.mjs"
  }
}
```

The module must stay within the tenant source directory and export either
`pagenaryContent` or a default value. JavaScript, MJS, and JSON load in the
publisher. TypeScript must first be compiled by the optional React/Vite adapter;
the base publisher does not add a TypeScript runtime loader.
