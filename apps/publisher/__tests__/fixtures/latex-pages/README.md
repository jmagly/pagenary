# LaTeX page converter bake-off fixtures

This corpus qualifies a converter for the `standard-web-v1` LaTeX-page
compatibility profile described by ADR-019. Each entry is a complete document
unless its name begins with `_`, in which case it is a declared local
dependency.

| Fixture | Capability under test | Required normalized result |
| --- | --- | --- |
| `01-structure-math.tex` | title, author, sections, lists, footnotes, inline/display math | semantic headings/lists/footnote; native MathML; useful plain text |
| `02-crossrefs.tex` | labels, equation numbering, internal references | stable local IDs and working local links |
| `03-bibliography.tex` | BibTeX source and citation | citation and bibliography content; `_references.bib` recorded as a dependency |
| `04-includes-assets.tex` | tenant-local `\input` and image | include and image resolved locally; both dependencies recorded; asset URL rewritten |
| `05-unicode-tables.tex` | UTF-8 text, language, table, code-like text | Unicode preserved; semantic table; no executable markup |
| `06-policy-negative.tex` | forbidden package and out-of-root/network/shell attempts | preflight rejection with source-aware diagnostics; no command executed or resource fetched |
| `07-custom-macros.tex` | source-local macro over qualified math commands | macro expands to semantic MathML without broadening the package profile |
| `08-unsupported-package.tex` | package outside the allowlist | source-aware `LATEX_PACKAGE_NOT_ALLOWED` preflight rejection |
| `09-malformed.tex` | unbalanced LaTeX syntax | bounded converter failure with no partial page publication |

The negative fixture must never be passed to an unsandboxed TeX engine. A test
harness should preflight it and, in defense in depth, invoke any converter in the
same networkless/resource-bounded sandbox used in production.

These fixtures intentionally avoid claiming arbitrary CTAN compatibility. They
form the minimum gate; future supported packages require a fixture and profile
revision.
