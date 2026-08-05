# Requirements: Rich Technical Content Rendering

**Status:** PROPOSED
**Date:** 2026-08-05
**Scope:** inline LaTeX, LaTeX pages, Mermaid, PlantUML, and downstream parity

## Goals

- Authors can use inline LaTeX in Markdown for inline and displayed mathematics.
- Authors can publish pages whose canonical source is a LaTeX document rather
  than Markdown.
- Mermaid and PlantUML source renders predictably and safely.
- All modes work across SPA reading, no-JS/static pages, search, export,
  accessibility, Markdown delivery, incremental builds, and editor preview.
- Default deployments remain static, private, offline-capable, and compatible
  with a self-only CSP.

## Personas and Use Cases

### UC-RTC-01: Author inline LaTeX in Markdown

An author writes `\(...\)` or display LaTeX in Markdown. Pagenary recognizes the
expression outside protected contexts, renders it during the build, and preserves
accessible semantics and source-aware diagnostics.

### UC-RTC-02: Publish a LaTeX-authored page

An author selects a `.tex` file in the manifest or relies on `.tex` discovery.
Pagenary compiles it under the configured compatibility/security profile and
publishes a normal navigable section with semantic HTML, local assets, metadata,
search text, static snapshot, and optional PDF.

### UC-RTC-03: Publish a Mermaid diagram

An author uses a `mermaid` fence and supplies an accessible title and description.
The tenant chooses local lazy runtime rendering or build-time static rendering.
Both modes preserve usable fallback and downstream content parity.

### UC-RTC-04: Publish a PlantUML diagram

An author uses a `plantuml` or `puml` fence with accessible metadata. Pagenary
renders a local static asset during the build in an isolated environment.

### UC-RTC-05: Diagnose invalid rich content

An author receives file/line, renderer, profile, and safe error details. Strict
mode fails; normal mode produces a visible escaped fallback without aborting other
pages or diagrams.

### UC-RTC-06: Operate without network or client JavaScript

A tenant builds from a pre-provisioned dependency cache and serves all required
assets locally. Static snapshots remain complete without runtime CDN access.

## Functional Requirements

### Shared renderer platform

- **RTC-FR-001:** Parse supported constructs into typed nodes before inline HTML
  transforms; never detect them by scanning already-generated HTML.
- **RTC-FR-002:** Provide renderer adapters with `validate`, `render`, `diagnose`,
  `dependencies`, and `cacheIdentity` contracts.
- **RTC-FR-003:** Produce normalized HTML, local assets, accessible/search text,
  and structured diagnostics for every render.
- **RTC-FR-004:** Support `off`, `warn`, and `strict` failure policies at tenant
  level with optional page override that may only become stricter.
- **RTC-FR-005:** Cache output by source plus every result-affecting input and
  invalidate on renderer/config/theme/font/include changes.
- **RTC-FR-006:** Preserve escaped source on recoverable failure.
- **RTC-FR-007:** Expose renderer availability/version/security profile through
  CLI diagnostics and build metadata.

### Inline LaTeX

- **RTC-FR-010:** Name the embedded capability `inlineLatex` / “inline LaTeX.”
- **RTC-FR-011:** Support the selected KaTeX release's complete math syntax in
  inline and display contexts, subject only to documented safety/resource bounds.
- **RTC-FR-012:** Enable `\(...\)`, `\[...\]`, and `$$...$$` by default; make
  `$...$` opt-in.
- **RTC-FR-013:** Exclude escaped delimiters, inline/fenced code, raw HTML,
  attributes, links, image alt text, Mermaid, PlantUML, media, and form blocks.
- **RTC-FR-014:** Render at build time to HTML+MathML with local CSS/fonts.
- **RTC-FR-015:** Bound source length, `maxSize`, `maxExpand`, macro definitions,
  macro scope, render time, and output size.
- **RTC-FR-016:** Default `trust` to false; allow only explicitly configured safe
  protocols/commands and never persist macros across pages or tenants.
- **RTC-FR-017:** Index normalized LaTeX/source or semantic math text rather than
  KaTeX positioning spans.

### LaTeX page mode

- **RTC-FR-020:** Recognize `.tex` as an explicit page content type and in safe
  manifest auto-discovery.
- **RTC-FR-021:** Require or synthesize a complete document entry point and keep
  the selected engine/converter/package profile explicit.
- **RTC-FR-022:** Convert LaTeX documents to semantic HTML/MathML and local assets;
  PDF is optional parallel output, never the only web representation.
- **RTC-FR-023:** Extract or override title, headings, summary, language,
  bibliography/citations, canonical source link, and reading metadata.
- **RTC-FR-024:** Support a versioned compatibility profile with a tested package
  allowlist and explicit unsupported-package diagnostics.
- **RTC-FR-025:** Disable shell escape, network, arbitrary filesystem access,
  unsafe package loading, and writes outside a temporary work directory.
- **RTC-FR-026:** Resolve `\input`, bibliography, and images only inside declared
  tenant roots after path and symlink validation; record them as incremental-build
  dependencies.
- **RTC-FR-027:** Apply process timeout, memory/CPU/PID, file-count, input/output
  size, and recursion limits.
- **RTC-FR-028:** Normalize converter HTML before section emission: remove full
  document chrome/scripts, sanitize URLs/markup, rewrite local assets and anchors,
  and preserve semantic landmarks/headings.
- **RTC-FR-029:** A converter bake-off over representative fixtures shall select
  and document the default HTML engine before implementation is accepted.

### Mermaid

- **RTC-FR-030:** Replace floating CDN Mermaid with a patched, exact, local
  dependency covered by lock/checksum/license controls.
- **RTC-FR-031:** Support `runtime-local` and `build` modes through one syntax and
  normalized output contract; no CDN mode is enabled by default.
- **RTC-FR-032:** Enforce immutable strict security configuration, input/edge
  bounds, parse validation, suppressed internal error SVG, and per-diagram errors.
- **RTC-FR-033:** Use deterministic IDs and stable cache identity.
- **RTC-FR-034:** Require `accTitle`/`accDescr` or equivalent fence metadata and
  render accessible SVG/figure semantics.
- **RTC-FR-035:** Map Pagenary light/dark theme tokens through Mermaid's supported
  base-theme mechanism and verify contrast.
- **RTC-FR-036:** Gate major upgrades with corpus compatibility and security
  regression fixtures.

### PlantUML

- **RTC-FR-040:** Support `plantuml` and `puml`; consider `uml` only after alias
  collision review. Preserve explicit `@start.../@end...`, otherwise wrap UML.
- **RTC-FR-041:** Default to pinned local build-time rendering and static SVG;
  public remote rendering is forbidden by default.
- **RTC-FR-042:** Run with SANDBOX, no network, scrubbed environment, temp cwd,
  UTF-8, resource limits, and expected-output copying.
- **RTC-FR-043:** An optional ALLOWLIST profile may access only validated,
  tenant-local includes. Absolute paths, traversal, symlink escape, URL includes,
  imports, and secret-bearing environment access remain blocked.
- **RTC-FR-044:** Pin PlantUML, Graphviz/layout engine, fonts, and container/JAR
  checksums; include them in cache identity and license inventory.
- **RTC-FR-045:** Emit content-addressed SVG `<img>` assets by default, optional
  PNG fallback, and sanitize any future inline-SVG mode.
- **RTC-FR-046:** Require alt text, caption/description, or explicit decoration.

### Related features

- **RTC-FR-050:** Static `/pages/` snapshots contain completed render output.
- **RTC-FR-051:** Export/print includes diagrams and math with pagination-safe CSS.
- **RTC-FR-052:** Search, `llms.txt`, corpus artifacts, Docs Map, narration, and
  reading metadata consume normalized semantic/source text.
- **RTC-FR-053:** Markdown delivery preserves authored Markdown/LaTeX and exposes
  generated artifact links where configured.
- **RTC-FR-054:** Accessibility linting validates math semantics and diagram text
  equivalents; strict accessibility can fail builds.
- **RTC-FR-055:** VS Code preview and validation share the parser/config schema and
  show capability-aware diagnostics when a local renderer is unavailable.
- **RTC-FR-056:** Schemas, validators, CLI help/doctor, examples, authoring docs,
  architecture docs, vendoring docs, and supply-chain records are updated.
- **RTC-FR-057:** Incremental and single-file builds rebuild transitive dependents
  and safely prune orphaned generated assets.

## Non-Functional Requirements

- **RTC-NFR-001 Security:** No default renderer reads outside tenant roots, uses
  the network, invokes a shell, or inherits build secrets.
- **RTC-NFR-002 Determinism:** Identical normalized inputs and toolchain produce
  byte-stable outputs except explicitly documented metadata.
- **RTC-NFR-003 Availability:** One recoverable expression/diagram failure never
  prevents unrelated content from rendering in non-strict mode.
- **RTC-NFR-004 Performance:** Cached renderer work adds no process invocation;
  uncached work respects configurable per-item and per-page budgets. Performance
  baselines and final thresholds are set by the bake-off.
- **RTC-NFR-005 Accessibility:** Output targets WCAG 2.2 AA; math has machine-readable
  semantics and diagrams have meaningful text equivalents.
- **RTC-NFR-006 Portability:** Default published output works on static hosting,
  offline, with no external runtime services.
- **RTC-NFR-007 Privacy:** Authored source never leaves the build host unless an
  operator explicitly enables and configures a self-hosted remote renderer.
- **RTC-NFR-008 Observability:** Diagnostics identify source, construct index,
  engine/version, cache status, duration, profile, and sanitized failure class.
- **RTC-NFR-009 Compatibility:** Existing Markdown and Mermaid content remains
  unchanged or receives explicit migration diagnostics.

## Acceptance Boundary

Planning is complete when all requirements map to architecture, tests, risks, and
tracker issues. Delivery is complete only when every supported mode passes unit,
integration, security, accessibility, offline/CSP, snapshot, export, search,
incremental-build, preview, and corpus compatibility gates.
