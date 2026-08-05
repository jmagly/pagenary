# Best-Practices Audit: LaTeX, Mermaid, and PlantUML Rendering

**Generated:** 2026-08-05
**Depth:** deep
**Scope:** Pagenary publisher, generated static sites, SEO snapshots, export, search, accessibility, author tooling, and supply chain
**Method:** parallel primary-source review plus current-code inspection

## Executive Summary

Pagenary should adopt a shared build-time rich-content pipeline rather than add
three unrelated post-render hooks. Inline LaTeX should be compiled to accessible
HTML and MathML during the build. PlantUML should be compiled in an isolated local
process to content-addressed static SVG. Mermaid should move from a floating CDN
import to a pinned local dependency, retaining lazy runtime rendering by default
but offering deterministic build-time SVG for strict-CSP, offline, and SEO-heavy
tenants. Full-page LaTeX is a distinct content type and must be converted to
semantic HTML in a sandbox before entering Pagenary's normal section pipeline.

No renderer may bypass the downstream contracts for static snapshots, search,
`llms.txt`, Markdown delivery, export, accessibility linting, incremental builds,
or editor preview.

## Current-State Findings

1. The custom Markdown renderer emits all unknown fences as escaped code blocks.
   This provides a clean interception point but no math-aware inline tokenizer.
2. Mermaid is enhanced after route mounting through a floating
   `https://esm.sh/mermaid@10/...` import. It is not lockfile-controlled, offline,
   deterministic, or present in static SEO snapshots.
3. Inline/display LaTeX remains literal source. Fenced LaTeX remains code.
4. PlantUML fences remain code and have no configured syntax highlighter.
5. Content discovery recognizes Markdown, HTML, and JavaScript modules only;
   `.tex` is not a page content type.
6. Search and snapshots consume compiled section HTML. Rendering before section
   module emission therefore gives all downstream consumers the strongest parity.
7. Existing ADR-012 remains `PROPOSED` and its floating-CDN choice is contradicted
   by the repository's newer vendoring and supply-chain guidance.

## Decision Evidence

### Inline LaTeX

KaTeX provides server-side `renderToString`, HTML+MathML output, bounded macro
expansion and size, strictness controls, and a trust policy. These are a strong fit
for deterministic static generation. Its CSS and fonts must still be shipped
locally. KaTeX's supported math-language surface—not arbitrary document-level
TeX—is the compatibility contract.

The feature name is **inline LaTeX** and includes inline and display contexts.
Default delimiters are `\(...\)`, `\[...\]`, and `$$...$$`. Single-dollar
`$...$` is opt-in because it collides with ordinary currency prose. Tokenization
must honor CommonMark escapes and exclude code spans, fences, raw HTML,
attributes, links, and other structured blocks.

Bounds do not intentionally reduce normal mathematical notation. They limit
input length, output size, macro expansion, macro scope, trust-sensitive commands,
wall-clock work, and failure handling. Document constructs belong to LaTeX-page
mode.

### LaTeX Page Mode

A `.tex` page is not a large inline expression. It has document structure,
packages, cross-references, bibliography, images, and potentially dangerous I/O
features. It must be a separate manifest/content type that produces a normalized
Pagenary section: semantic HTML body, extracted title/headings/summary, local
assets, plain-text search representation, source artifact, diagnostics, and an
optional PDF sibling.

LaTeXML, TeX4ht/make4ht, Pandoc, and Tectonic cover different parts of this
problem. The implementation must begin with a time-boxed converter bake-off over
a representative fixture corpus. The planned default is a pinned, local,
containerized LaTeXML or make4ht HTML converter; Tectonic is a candidate for the
optional PDF path and documents an untrusted mode, cached-only operation, and
deterministic mode. Pandoc is a fallback for a documented portable subset, not a
claim of full LaTeX compatibility.

“Full LaTeX” means full documents within a declared compatibility profile. It
cannot mean every package ever published to CTAN. Supported engine, TeX bundle,
packages, fonts, converter, and known incompatibilities must be versioned and
reported by `pagenary doctor` and build diagnostics.

### Mermaid

The existing lazy strategy remains useful for page weight, but the runtime must
be local and exactly pinned. Defaults should retain `securityLevel: strict`, set
root-level `htmlLabels: false` unless explicitly justified, secure immutable
configuration keys, bound `maxTextSize` and `maxEdges`, suppress Mermaid's own
error SVG, and use deterministic IDs.

The default profile is `runtime-local`. An opt-in `build` profile uses the
official Mermaid CLI to create stable SVG for strict CSP, no-JavaScript, offline,
SEO, and export parity. A corpus compatibility test must gate any major upgrade.
Recent Mermaid advisories demonstrate why floating releases and missing input
bounds are unacceptable.

### PlantUML

PlantUML should run locally at build time, never in the reader's browser. Public
PlantUML/Kroki servers are not a default because they disclose authored source and
make output dependent on remote versions and availability. A self-hosted remote
backend may be an explicit advanced profile.

The default local profile runs with `PLANTUML_SECURITY_PROFILE=SANDBOX`, no
network, a temporary working directory, scrubbed environment, pinned renderer and
Graphviz/font inputs, UTF-8, timeout, memory/CPU/PID limits, and bounded output.
It emits content-addressed SVG referenced as an `<img>` inside a semantic figure.
An `ALLOWLIST` profile may permit tenant-local includes after traversal and
symlink checks. `LEGACY` and public URL includes are forbidden in standard builds.

## Shared Architecture Pattern

```text
source file
  -> content classifier and source-aware parser
  -> typed rich-content nodes
  -> bounded renderer adapter
  -> normalized HTML + local assets + diagnostics + plain-text representation
  -> section module
  -> SPA / static snapshot / search / llms.txt / export / Markdown delivery
```

Every renderer adapter implements:

- exact engine identity and version;
- normalized configuration and security profile;
- deterministic cache key;
- source location and structured diagnostics;
- strict and recoverable failure modes;
- accessible name/description contract;
- HTML, local asset, and searchable-text outputs;
- build dependency discovery for incremental invalidation;
- cleanup and resource-limit enforcement.

## Cross-Cutting Requirements

- Local assets and `script-src 'self'`/`font-src 'self'` compatibility.
- No network access by default during rendering.
- Exact versions, checksums/digests, license inventory, and upgrade policy.
- Stable output/cache keys include source, renderer, configuration, fonts,
  included files, and theme.
- Strict mode fails the build; normal mode emits escaped, accessible fallback and
  a source-located warning.
- Accessibility linting requires alternatives for diagrams and verifies MathML or
  equivalent math semantics.
- Export and static snapshots must not depend on route-time rendering.
- Search should index meaningful source/semantic text, not generated layout spans.
- Markdown delivery preserves authored source and may add links to generated
  artifacts without silently replacing the canonical source.
- VS Code preview must use the same parser/config contract or clearly label a
  reduced preview; it may not invent a fourth renderer behavior.
- Content hashing and incremental builds include transitive renderer inputs.

## Dissent and Trade-offs

- Runtime Mermaid is lighter operationally than CLI rendering, while build-time
  Mermaid gives better offline and snapshot parity. Supporting both through one
  adapter resolves this as a tenant profile rather than a universal choice.
- KaTeX is smaller and faster for embedded math; MathJax has richer interactive
  accessibility and broader TeX package behavior. KaTeX is the default for inline
  LaTeX, while the page converter and a future high-accessibility profile may use
  MathJax where evidence and testing justify it.
- LaTeXML often yields semantic web output; make4ht tracks TeX execution more
  closely. Neither can honestly promise universal package compatibility. The
  fixture bake-off is therefore a construction gate, not optional exploration.
- Renderer dependencies qualify ADR-002's zero-dependency philosophy: they are
  isolated build dependencies and local lazy assets, not always-loaded reader
  dependencies.

## Sources

All sources were retrieved successfully on 2026-08-05.

- KaTeX API: https://katex.org/docs/api
- KaTeX options: https://katex.org/docs/options
- KaTeX security: https://katex.org/docs/security
- KaTeX Node and fonts: https://katex.org/docs/node and https://katex.org/docs/font
- MathJax 4 accessibility: https://docs.mathjax.org/en/latest/basic/accessibility.html
- MathJax TeX delimiters/options: https://docs.mathjax.org/en/latest/input/tex/delimiters.html and https://docs.mathjax.org/en/latest/options/input/tex.html
- MathJax Node examples: https://docs.mathjax.org/en/v4.0/server/examples.html
- MathML Core: https://www.w3.org/TR/mathml-core/
- CommonMark 0.31.2: https://spec.commonmark.org/0.31.2/
- Mermaid configuration and schema: https://mermaid.js.org/config/configuration.html and https://mermaid.js.org/config/schema-docs/config.html
- Mermaid theming: https://mermaid.js.org/config/theming.html
- Mermaid CLI: https://github.com/mermaid-js/mermaid-cli
- Mermaid advisories: https://github.com/mermaid-js/mermaid/security/advisories
- PlantUML CLI/security/preprocessor/SVG: https://plantuml.com/command-line, https://plantuml.com/security, https://plantuml.com/preprocessing, https://plantuml.com/svg
- PlantUML server and licenses: https://github.com/plantuml/plantuml-server and https://github.com/plantuml/plantuml/blob/master/LICENSES.md
- Kroki configuration: https://docs.kroki.io/kroki/setup/configuration/
- Tectonic build/compile security: https://tectonic-typesetting.github.io/book/latest/v2cli/build.html and https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html
- TeX4ht/make4ht: https://tug.org/tex4ht/ and https://ctan.org/tex-archive/support/make4ht
- LaTeXML manual: https://dlmf.nist.gov/LaTeXML/manual.pdf
- Pandoc manual: https://pandoc.org/MANUAL.html
- WCAG non-text content: https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html
- CSP Level 3: https://www.w3.org/TR/CSP3/
- Docker resource constraints: https://docs.docker.com/engine/containers/resource_constraints/

## Research References Recommended for Section 9 Induction

1. **Mathoid: Robust, Scalable, Fast and Accessible Math Rendering for
   Wikipedia** — https://arxiv.org/abs/1404.6179 — induction
   [section9#774](https://git.integrolabs.net/section9/research-papers/issues/774)
2. **WikiTexVC: MediaWiki's native LaTeX to MathML converter for Wikipedia** —
   https://arxiv.org/abs/2401.16786 — induction
   [section9#775](https://git.integrolabs.net/section9/research-papers/issues/775)
3. **E-books and Graphics with LaTeXML** — https://arxiv.org/abs/1404.6547 —
   induction
   [section9#776](https://git.integrolabs.net/section9/research-papers/issues/776)
4. **Tooling for digital accessibility in mathematics** —
   https://arxiv.org/abs/2603.28494 — induction
   [section9#777](https://git.integrolabs.net/section9/research-papers/issues/777)

Official product documentation remains cited directly in this report; the four
papers above merit corpus induction because they contain reusable architectural or
accessibility evidence rather than only API instructions.
