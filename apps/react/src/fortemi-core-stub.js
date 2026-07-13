// Build-time stub for @fortemi/core, aliased in by the React tenant adapter
// (see ../src/index.js resolve.alias).
//
// Why: @fortemi/graph's published barrel (dist/index.js) statically imports
// `GraphRepository` and `CommunitiesRepository` from @fortemi/core for its
// `GraphController` — which transitively pulls @electric-sql/pglite (~16MB of
// WASM + data). The Pagenary docs-map uses only @fortemi/graph's pure layout /
// color / filter / neighborhood helpers and never constructs the controller, so
// aliasing @fortemi/core to this stub keeps PGlite out of the tenant bundle.
//
// Remove this stub (and the alias) once fortemi-react #261 makes PGlite optional
// and @fortemi/graph no longer statically imports @fortemi/core. A tenant that
// opts into the full browser-only PGlite runtime must not apply this alias.
export class GraphRepository {}
export class CommunitiesRepository {}
