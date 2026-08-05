# ADR-019: Unified Rich Technical Content Rendering

## Status

PROPOSED

## Date

2026-08-05

## Context

Pagenary currently has a custom Markdown renderer and a route-time Mermaid
enhancer. It needs complete planned support for inline LaTeX, full LaTeX-authored
pages, Mermaid, and PlantUML without fragmenting security, caching, diagnostics,
accessibility, or downstream static artifacts.

ADR-002's minimal-dependency goal and ADR-003's static deployment remain valid,
but they do not require hand-writing complex parsers or executing floating CDN
code. Renderer dependencies belong to the build/control path or local lazy assets;
the published read path remains static.

## Decision

Create a typed rich-content intermediate representation and renderer-adapter
layer in the build pipeline.

1. **Inline LaTeX:** build-time KaTeX HTML+MathML, pinned and locally shipped.
2. **LaTeX pages:** separate `.tex` page adapter using a pinned isolated HTML
   converter chosen by a fixture-based LaTeXML/make4ht/Pandoc bake-off. Optional
   PDF uses an isolated compiler such as Tectonic.
3. **Mermaid:** pinned local lazy runtime by default; optional deterministic
   build-time SVG profile. Supersede ADR-012's floating CDN decision.
4. **PlantUML:** pinned local build-time SVG in a sandboxed subprocess/container.
5. **Normalized output:** all adapters produce HTML, assets, semantic/search text,
   dependencies, diagnostics, and cache metadata before downstream artifacts run.

## Component Model

```text
content classifier
  +-- Markdown parser/token protector
  |     +-- inline-latex adapter
  |     +-- mermaid adapter
  |     `-- plantuml adapter
  `-- latex-page adapter
          |
          v
normalized section payload
  { html, text, assets, source, dependencies, diagnostics, rendererMetadata }
          |
          +-- SPA section module
          +-- static SEO page
          +-- search/corpus/llms artifacts
          +-- export/print
          `-- accessibility report
```

## Configuration Shape

```json
{
  "renderers": {
    "failurePolicy": "warn",
    "inlineLatex": {
      "enabled": true,
      "engine": "katex",
      "singleDollar": false,
      "trust": false,
      "maxSourceBytes": 32768,
      "maxExpand": 1000,
      "maxSize": 100
    },
    "latexPage": {
      "enabled": false,
      "profile": "standard-web",
      "converter": "selected-after-bakeoff",
      "pdf": false,
      "network": false
    },
    "mermaid": {
      "enabled": true,
      "mode": "runtime-local",
      "securityLevel": "strict"
    },
    "plantuml": {
      "enabled": false,
      "mode": "local",
      "securityProfile": "SANDBOX",
      "format": "svg"
    }
  }
}
```

Exact numeric defaults remain subject to abuse-case and performance tests. Tenant
or page configuration cannot weaken immutable platform security keys unless an
operator-level policy explicitly permits it.

## Security Boundary

- Pure in-process renderers receive bounded strings and immutable safe config.
- External renderers run with no network, scrubbed environment, temporary cwd,
  read-only toolchain, resource limits, and explicit input/output mounts.
- Includes are disabled by default. Allowlisted mode resolves paths against a
  tenant root, rejects absolute/traversal paths, and verifies symlink containment.
- Generated HTML/SVG is normalized and sanitized before inclusion.
- Cache contents are untrusted until their metadata and content hash validate.
- Remote rendering is never a default. Self-hosted remote use requires an
  explicit privacy/security profile and separate ADR amendment.

## LaTeX Compatibility Contract

“Inline LaTeX” means the complete math-language surface supported by the pinned
KaTeX engine, not a hand-picked notation subset. Unsupported commands generate
diagnostics and fallback according to policy.

“LaTeX page” means a complete document accepted by Pagenary's versioned web
compatibility profile. The profile declares engine, converter, TeX bundle,
packages, fonts, asset rules, and known gaps. Universal CTAN/package compatibility
is explicitly not promised.

The selected `standard-web-v1` profile uses LaTeXML 0.8.8 for semantic HTML5
with Presentation MathML. It allows the built-in `article` bindings plus
`amsmath`, `graphicx`, `booktabs`, and UTF-8 `inputenc`; source-local macros are
accepted when they stay within that profile. Unsupported packages fail preflight
with `LATEX_PACKAGE_NOT_ALLOWED`. Converter-reported errors fail even when
LaTeXML exits zero. The default process budget is 20 seconds and 4 MiB per output
stream (configurable only within 1--120 seconds and 64 KiB--16 MiB). The optional
`pdf-v1` sibling uses Tectonic 0.16.9 with `--untrusted --only-cached` and a
16 MiB PDF default. Pandoc 3.1.3 remains a possible portable-subset converter;
make4ht v0.3m is not selected because its reviewed minimal TeX package surface
failed the qualified `booktabs` fixture.

## Consequences

### Positive

- Static, offline, CSP-compatible, accessible output.
- One place for bounds, errors, cache keys, dependencies, and diagnostics.
- SEO/search/export parity becomes testable rather than renderer-specific.
- Existing Mermaid UX can remain lazy without an external CDN.
- Full-page LaTeX becomes a real content type rather than raw HTML escape hatch.

### Negative

- KaTeX and Mermaid add maintained local assets.
- PlantUML and LaTeX-page support add optional build toolchains and CI images.
- Full LaTeX-to-semantic-HTML compatibility requires an explicit fixture corpus
  and ongoing converter/package qualification.
- Build time and cache storage increase on renderer cache misses.

## Alternatives Rejected

- **Runtime-only for every syntax:** breaks snapshots, offline output, search and
  no-JS parity and moves expensive work to every reader.
- **Public render services by default:** leaks source and adds mutable availability
  and version dependencies.
- **Render full LaTeX pages as PDF only:** inaccessible as the primary web page and
  incompatible with navigation/search/SEO.
- **Treat `.tex` as Markdown:** conflates document and fragment grammars.
- **Promise all LaTeX packages:** unverifiable and operationally unsafe.
- **Keep floating Mermaid CDN:** not deterministic, auditable, or self-only CSP
  compatible.

## Validation Required Before Acceptance

- Converter bake-off and compatibility matrix.
- Threat model for TeX/PlantUML subprocesses and generated SVG/HTML.
- Performance/cache benchmark.
- Accessibility review with MathML and diagram alternatives.
- Existing Mermaid corpus migration run.
- End-to-end fixtures proving all downstream artifacts.

## Supersedes

When accepted and implemented, this ADR supersedes the delivery mechanism in
ADR-012 while retaining its fenced Mermaid authoring contract and lazy-loading
goal.
