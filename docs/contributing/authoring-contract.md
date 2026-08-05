# Changing the authoring contract

Pagenary treats supported authoring syntax as a tested public contract. Any
change to a delimiter, fence, alias, page content type, renderer profile, or
configuration mode must update all of these surfaces in the same change:

- production parsing and validation in `apps/authoring-contract/` and the publisher;
- `examples/syntax-gallery/syntax-inventory.json` with a stable feature ID;
- a functional, buildable example under `examples/syntax-gallery/content/`;
- a copyable explanation and prerequisites in `apps/publisher/docs/SUPPORTED-SYNTAX.md`;
- fallback/error, security-boundary, offline/CSP, and accessibility behavior;
- focused unit coverage and browser qualification when rendered semantics change.

Run the maintenance gate before committing:

```sh
npm --workspace @pagenary/publisher run check:syntax
npm --workspace @pagenary/publisher test -- --runInBand __tests__/scripts/syntax-gallery.test.js
npm --workspace @pagenary/publisher run test:syntax-gallery:browser
```

`check:syntax` prints the release-auditable coverage count and fails if an
inventory entry loses its example, example anchor, or help anchor. Removing or
reducing syntax is also a contract change: document the incompatibility and
migration path instead of silently deleting its example.
