# Test Strategy: Rich Technical Content Rendering

**Status:** PROPOSED
**Date:** 2026-08-05

## Quality Risks

The highest risks are arbitrary file/network/process access, denial of service,
silent semantic loss, inaccessible output, mismatch among SPA/static/export/search
surfaces, non-deterministic artifacts, and false claims of LaTeX compatibility.

## Test Layers

### Parser and contract unit tests

- Inline LaTeX delimiters, escaped delimiters, nesting, multiline display, macro
  definitions, Unicode, invalid input, and optional single-dollar behavior.
- Protected contexts: inline/fenced code, HTML, links, attributes, image alt,
  Mermaid, PlantUML, media, forms, and ordinary currency.
- Fence aliases, metadata, explicit PlantUML start/end families, and accessibility
  fields.
- `.tex` discovery, manifest resolution, metadata override precedence, and
  generated dependency graphs.
- Stable cache key changes for source, tool version, config, theme, font, include,
  output format, and security profile.

### Renderer adapter tests

- KaTeX HTML+MathML output, complete supported syntax corpus, macro isolation,
  trust callback, max expansion/size/output, and escaped fallback.
- Mermaid parse/render config, stable IDs, strict secure keys, theme mapping,
  supported diagram families, and known advisory regression inputs.
- PlantUML SVG/PNG, UTF-8, supported diagram families, strict/warn failure, cache,
  and sanitized diagnostics.
- LaTeX-page converter fixtures for article/report/book fragments, sections,
  equations, cross-references, citations, tables, figures, lists, footnotes,
  Unicode, custom macros, allowed packages, and unsupported packages.

### Security tests

- TeX shell escape, pipe input, file read/write, path traversal, symlink escape,
  URL fetch, package auto-install, recursive include, decompression/file bombs,
  huge expansion, and timeout termination.
- PlantUML local/parent/URL includes, `!import`, environment/credential access,
  SVG links/scripts/event handlers, huge dimensions, deep graphs, and timeout.
- Mermaid state/classDef injection, architecture prototype pollution, sequence
  KaTeX labels, large radar ticks, excessive text/edges, directives/frontmatter
  attempting to override secure configuration.
- Cache poisoning, malformed cache metadata, cross-tenant key collision, and
  secret/absolute-path leakage in diagnostics.

### Integration and artifact parity

For every syntax/mode fixture, assert:

- section module contains normalized output;
- SPA route renders and route cleanup is safe;
- `/pages/<id>.html` is complete without JavaScript;
- search index contains useful text and excludes layout noise;
- `llms.txt`, corpus JSON/text, Docs Map and reading metadata remain valid;
- page/site export retains math, figures, captions, local assets, and print CSS;
- Markdown delivery preserves canonical source;
- accessibility report includes or clears the appropriate findings;
- incremental/single-file builds rebuild changed transitive dependencies and
  prune orphan assets;
- content-hashed filenames and stable-cache mode behave correctly.

### Browser, accessibility, and visual tests

- Chromium/Firefox/WebKit at supported desktop/mobile breakpoints.
- JavaScript disabled, network offline, self-only CSP, light/dark/high-contrast,
  reduced motion, zoom/reflow, keyboard pan/zoom controls, and print/PDF.
- Screen-reader inspection of representative MathML, inline/display boundaries,
  diagram names/descriptions, fallback panels, and reading order.
- Visual regression for equations, overflow, long diagrams, fonts, captions,
  theme switching, and page-level LaTeX structures.

### Performance and reliability

- Cold/warm builds by expression/diagram/page count and size.
- Cache hit ratio and invalidation cost.
- Runtime Mermaid chunk size, lazy-load latency, and route interruption.
- Subprocess timeout/kill cleanup, temp-file cleanup, partial cache writes, and
  concurrent tenant isolation.
- Establish budgets in the bake-off; CI enforces agreed regression thresholds.

## Fixture Matrix

| Fixture set | Minimum coverage |
|---|---|
| Inline LaTeX | arithmetic, AMS-style environments supported by engine, matrices, macros, tags, Unicode, invalid/adversarial |
| LaTeX pages | article, bibliography, cross-refs, tables, figures, footnotes, custom macros, allowed/denied packages |
| Mermaid | flowchart, sequence, state, class, ER, Gantt, architecture/radar security fixtures, invalid |
| PlantUML | sequence, class, component, activity, state, ER, JSON/YAML, include attacks, invalid/slow/large |

The fixture corpus is versioned. Renderer upgrades must run old and new outputs,
classify semantic/visual differences, and require explicit approval for breaking
changes.

## Entry and Exit Gates

### Construction entry

- ADR decision accepted.
- Converter bake-off complete.
- Threat model and immutable security defaults approved.
- Toolchain licenses/checksums recorded.
- Fixtures and test harness skeleton committed.

### Release exit

- All RTC requirements trace to passing automated tests or documented manual UAT.
- No open critical/high security or accessibility defects.
- Offline/self-CSP, no-JS snapshots, export, search, and incremental builds pass.
- Performance budgets pass on clean and warm caches.
- Upgrade/rollback, authoring, configuration, preview, and troubleshooting docs
  are complete.
