# LaTeX Page Converter Bake-off

**Issue:** Pagenary #166
**Date:** 2026-08-05
**Decision:** Select LaTeXML for `standard-web-v1` HTML; select Tectonic only for
the optional PDF sibling
**Requirements:** RTC-FR-020--029, RTC-FR-050--057; RTC-NFR-001--009
**Risks:** R7, R10

## Technical question

Which bounded, locally executable toolchain most reliably turns a declared
LaTeX-page profile into semantic HTML/MathML and local assets, while supporting
Pagenary's normalization, diagnostics, dependency tracking, offline operation,
and optional PDF output?

Success requires a primary HTML converter, an explicit compatibility profile,
a representative regression corpus, and an honest account of security and
operational gaps. Universal TeX/CTAN compatibility is not a success criterion.

## Scope and evidence boundary

The fixture corpus is at
`apps/publisher/__tests__/fixtures/latex-pages/`. It covers structure, math,
cross-references, bibliography, local includes/assets, Unicode, tables, and
policy rejection. This is a tool-selection spike, not production integration.

All four candidates now run in the pinned Ubuntu 24.04 qualification image:
LaTeXML 0.8.8, make4ht v0.3m, Pandoc 3.1.3, and Tectonic 0.16.9. The image runs
networkless, read-only, non-root, and resource-bounded. `ci/rich-content/qualify.mjs`
is the executable record, so the comparison is continuously reproducible. The
current image is 416,374,433 bytes and has manifest-list digest
`sha256:35be8644ecd18b2d74b0b6e05964ae26546da0d44cd4349cfa898950a8bf001f`.

## Candidate roles

### LaTeXML

LaTeXML is purpose-built to digest TeX/LaTeX into a structured XML DOM, rewrite
that DOM, parse mathematics, and serialize web formats. Its official manual
documents HTML5 output with Presentation MathML, label/cross-reference scanning,
bibliography processing, graphics conversion/copying, validation, and an
omittable timestamp. These features directly align with semantic HTML, MathML,
determinism, and normalization requirements.

Package behavior depends on LaTeXML bindings. The manual also documents that
native style files are ignored by default unless `--includestyles` is enabled.
That is a compatibility limitation, but a useful basis for Pagenary's explicit
package allowlist: unsupported packages fail qualification instead of silently
turning into arbitrary executable build behavior.

### make4ht / TeX4ht

make4ht drives a real LaTeX engine plus TeX4ht and t4ht. The official manual
documents HTML5 as the default, several other structured formats, MathML cleanup
DOM filters, output/build directories, bibliography/index commands, image
handling, and extensible Lua build files. This likely offers greater TeX engine
fidelity for packages that LaTeXML cannot model.

That fidelity carries a larger attack and determinism surface. The documented
pipeline invokes LaTeX repeatedly, processes DVI, can call external programs,
and permits build-file command templates executed by the operating system.
`--shell-escape` is opt-in, but simply omitting it is not a complete sandbox.
Pagenary would still need to constrain the engine, build files, `.env`, helper
programs, filesystem, and outputs. make4ht is therefore the fallback converter
profile, not the default.

### Pandoc

Pandoc has a native LaTeX reader and can produce HTML5 with MathML. Its AST and
filter model are attractive for Pagenary normalization. The installed 3.1.3
binary converted the positive corpus quickly and produced useful HTML for core
constructs, but revealed important profile gaps:

- all five positive fixtures exited 0 in 0.03--0.34 seconds, with approximately
  100--103 MiB maximum RSS (single warm-host observations, not release budgets);
- math became MathML with embedded `application/x-tex` annotations;
- headings, lists, footnotes, Unicode, tables, local links, and a local image were
  retained;
- `\input` was unresolved when invoked from the repository root, despite a
  resource path, and only resolved when the process working directory was the
  fixture root;
- raw `\bibliography{...}` did not independently create a bibliography; the
  successful run required explicit `--citeproc --bibliography=_references.bib`;
- equation/reference presentation is parse-oriented rather than full TeX
  execution fidelity.

These are manageable for a constrained document subset, but Pandoc's LaTeX
reader is not the best default for the promised complete-document profile. Keep
it as a normalization/export tool and possible `portable-subset-v1` converter,
not as `standard-web-v1`.

### Tectonic

Tectonic is a XeTeX/TeXLive-derived typesetting engine whose primary strength is
PDF compilation. Its current CLI documentation exposes a pinned/local bundle,
cache-only operation, dependency makefile output, explicit output directory,
and an `--untrusted` mode that disables known-dangerous features even when other
flags request them. These are valuable defense-in-depth controls for RTC-FR-025
through 027 and incremental dependency capture.

Tectonic is not selected as the semantic HTML converter. Although its current
CLI lists an HTML output kind, its documented identity and compatibility model
are typesetting-oriented, and this spike has no evidence that its HTML output
meets Pagenary's semantic/MathML requirements. Use it only to create an optional
PDF sibling from the same vetted source/profile. `--untrusted` supplements, but
does not replace, Pagenary's networkless OS/container sandbox.

## Weighted comparison

Scores are 0 (does not meet), 1 (major gaps), 2 (meets with adapter work), or 3
(strong native fit). Scores marked **M** include local measurement; **D** are
documentation-derived. Security scores assume Pagenary's external sandbox and
never assert that a converter alone safely processes hostile input.

| Criterion | Weight | LaTeXML | make4ht | Pandoc | Tectonic |
| --- | ---: | ---: | ---: | ---: | ---: |
| Semantic HTML/landmarks | 20 | 3 M | 2 M | 2 M | 1 M |
| Native MathML | 15 | 3 M | 3 M | 3 M | 0 M |
| References/bibliography | 10 | 3 M | 3 M | 2 M | 1 M |
| Local assets/dependency observability | 10 | 2 M | 2 M | 2 M | 3 M |
| Profile/package predictability | 10 | 2 M | 1 M | 2 M | 3 M |
| Sandboxability/minimal helpers | 15 | 2 M | 1 M | 2 M | 2 M |
| Normalization/diagnostics | 10 | 3 M | 2 M | 3 M | 1 M |
| Determinism/offline operation | 10 | 2 M | 2 M | 3 M | 3 M |
| **Weighted total / 300** | **100** | **255** | **200** | **235** | **160** |

Pandoc's total is close because it is operationally simple and has a good AST;
the decisive distinction is document compatibility. LaTeXML models LaTeX
structure, math, cross-references, and bibliography as its core conversion job,
whereas Pandoc parses the supported subset into its own document model. Tectonic
wins the separate PDF role and should not be penalized for not being the chosen
HTML converter.

## Decision and versioned profiles

### `standard-web-v1` (default LaTeX page profile)

- **HTML converter:** an exactly pinned LaTeXML release and toolchain image;
  initial qualification target is the documented 0.8.8 behavior, but #174 must
  pin the then-reviewed patch release by immutable image digest.
- **Input:** UTF-8, complete `article` document; Pagenary may synthesize the
  wrapper only for an explicitly declared fragment mode.
- **Allowed baseline packages:** `amsmath`, `graphicx`, `booktabs`, and the
  converter's built-in article bindings. `inputenc` is accepted for UTF-8 source
  compatibility. Every additional package needs a passing fixture and profile
  revision.
- **Output:** HTML5 fragment normalized from LaTeXML HTML, Presentation MathML,
  copied content-addressed local assets, normalized semantic/search text, and
  structured diagnostics.
- **LaTeXML policy:** strict conversion/validation; HTML5; Presentation MathML;
  no timestamp; no custom stylesheet, JavaScript, remote CSS, daemon, arbitrary
  preload, or `--includestyles`. Remove document chrome/default resource links
  during normalization rather than trusting converter HTML directly.
- **Dependencies:** preflight `\input`, `\include`, bibliography, and graphics;
  resolve only declared tenant-root files after realpath/symlink containment.
  Reconcile that list with converter outputs/logs and fail on undeclared reads.
- **Bounds:** networkless sandbox, scrubbed environment, read-only pinned
  toolchain, temporary working directory, non-root UID, seccomp/process and
  filesystem isolation, wall/CPU/memory/PID/file/output limits. Exact numeric
  budgets are set by #176 measurements.
- **Failure:** unsupported package or construct produces source-aware diagnostics.
  In `warn`, emit escaped source fallback; in `strict`, fail that page/build per
  RTC-FR-004. Never silently drop content.

### `portable-subset-v1` (optional future profile)

Pandoc may back a deliberately smaller profile for documents limited to the
qualified fixture subset. Invoke it with an explicit tenant-root working
directory, `--from=latex --to=html5 --mathml`, and explicit bibliography/citeproc
arguments derived by trusted preflight. Do not advertise this as general LaTeX
page support.

### `pdf-v1` (optional sibling artifact)

Use exactly pinned Tectonic with a pinned local bundle, cache-only behavior,
`--untrusted`, explicit output directory, and dependency rules. Run it inside the
same external sandbox as LaTeXML. PDF never substitutes for normalized HTML.

### Fallback qualification

If a material `standard-web-v1` fixture fails under the pinned LaTeXML image,
evaluate make4ht for a separate `tex4ht-compat-v1` profile. It must not inherit
user build files or configuration, and every executable/helper must be allowlisted
and pinned. Do not silently retry the same source through another converter:
converter identity affects semantics, cache keys, diagnostics, and attack surface.

## Required adapter gates for #174

1. Run all positive fixtures in the pinned networkless image and snapshot the
   normalized fragment, semantic text, assets, dependencies, diagnostics, and
   converter metadata.
2. Prove the negative fixture is rejected during preflight and cannot create
   `SHOULD-NOT-EXIST`, read `/etc/passwd`, traverse the tenant root, or contact a
   URL even if preflight is bypassed.
3. Add malformed syntax, timeout/expansion bomb, oversized input/output, symlink
   escape, hostile SVG/HTML, duplicate IDs, and converter-crash fixtures.
4. Verify HTML sanitization and anchor/asset rewriting before any output reaches
   SPA modules, static pages, search, exports, or narration.
5. Capture exact executable/image/bundle/package/font versions, checksums,
   license inventory, elapsed time, peak RSS, output size, and cache identity.
6. Compare normalized output byte-for-byte across two clean builds and document
   any irreducible metadata.
7. Run accessibility checks for heading order, table semantics, footnotes,
   links, MathML exposure, images, language, and PDF tagging limitations.
8. Record unsupported-package diagnostics and author-facing remediation rather
   than expanding the allowlist during tests.

R7 is **mitigated, not retired**: the compatibility boundary is now explicit and
has a fixture gate, but retirement requires the pinned LaTeXML adapter to pass the
full corpus in #174. R10 remains open until #176 establishes cold/cached build and
toolchain-size budgets.

## Measured corpus results

LaTeXML converted all five positive fixtures twice to byte-identical normalized
HTML and semantic text. Pandoc converted all five with explicit citeproc and
bibliography arguments; output sizes were 1,458, 813, 421, 375, and 612 bytes.
make4ht converted four fixtures (2,791, 1,889, 737, and 1,302 bytes) but rejected
the Unicode/table fixture because the minimal pinned TeX installation does not
contain `booktabs.sty`. That is an intentional compatibility signal: make4ht
needs a larger reviewed TeX package set before it can qualify for the baseline
profile. Tectonic produced a 32,379-byte PDF in untrusted, cached-only mode. The
policy-negative source was rejected by Pagenary preflight before invocation.

## Reproduction notes

The safe local probe used commands equivalent to:

```sh
docker build -f ci/rich-content/Dockerfile -t pagenary-rich-content:bakeoff .
docker run --rm --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,mode=1777,size=512m \
  --tmpfs /home/renderer/.cache/fontconfig:rw,nosuid,nodev,mode=0700,uid=10001,gid=10001,size=16m \
  --cpus 2 --memory 1g --pids-limit 128 \
  -v "$PWD:/workspace:ro" pagenary-rich-content:bakeoff
```

The script copies fixtures to a fresh temporary directory, invokes each candidate
with a 60-second and 8-MiB output bound, emits structured JSON, and removes the
temporary directory. The container has no runtime network and the repository is
mounted read-only.

## Primary sources

All sources were retrieved on 2026-08-05.

1. NIST, **LaTeXML Manual 0.8.8**, conversion architecture and commands:
   https://math.nist.gov/~BMiller/LaTeXML/manual/
2. NIST, **LaTeXML basic postprocessing**, HTML5/MathML, references,
   bibliography, graphics:
   https://math.nist.gov/~BMiller/LaTeXML/manual/usage/usage.single.html
3. NIST, **latexmlpost command**, validation, timestamp, resource, and output
   controls:
   https://math.nist.gov/~BMiller/LaTeXML/manual/commands/latexmlpost.html
4. Michal Hoftich, **The make4ht build system**, pipeline, formats, directories,
   extensions, DOM filters, and external commands:
   https://www.kodymirus.cz/make4ht/make4ht-doc.html
5. Pandoc project, **Pandoc User's Guide**, LaTeX reader, MathML, citations,
   resource paths, and filters: https://pandoc.org/MANUAL.html
6. Tectonic project, **`tectonic -X compile`**, local bundles, cache-only mode,
   dependency rules, output formats, and untrusted mode:
   https://tectonic-typesetting.github.io/book/latest/v2cli/compile.html
7. Tectonic project, **Tectonic source and release documentation**:
   https://github.com/tectonic-typesetting/tectonic

## Outcome

**GO with profile constraints.** Use LaTeXML for semantic HTML/MathML and
Tectonic for optional PDF. Keep Pandoc as a possible constrained subset and
normalization/export tool. Reserve make4ht for an explicitly selected fallback
profile when real-engine fidelity is necessary and its wider execution surface
is justified. The decision satisfies RTC-FR-029 without weakening ADR-019's
security boundary or claiming universal LaTeX compatibility.
