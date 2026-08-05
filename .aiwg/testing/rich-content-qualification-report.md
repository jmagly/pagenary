# Rich Technical Content Qualification Report

**Issue:** #176
**Date:** 2026-08-05
**Environment:** Linux, Node.js v24.12.0, npm 11.11.0
**Disposition:** **CONDITIONAL / NOT RELEASE-QUALIFIED**

The implemented in-process rich-content paths pass their focused and complete
test suites, the publisher build/check/package pipelines pass, VS Code smoke
tests pass, generated Mermaid/KaTeX assets are local and stable, and the real
LaTeXML, Mermaid CLI/browser, PlantUML, and Tectonic corpus passes in a pinned
networkless container.
Release qualification remains conditional because two high-severity transitive
audit findings remain in the supply-chain cooldown window and browser/CSP/AT
qualification is still outstanding.

## Results

| Gate | Result | Evidence |
|---|---:|---|
| Rich-content focused tests | PASS | 8 suites, 62 tests, 1.889 s Jest time after external-renderer hardening |
| Publisher `check` | PASS WITH WARNINGS | 4.60 s wall, 165,616 KiB max RSS; two existing example color-contrast warnings |
| Publisher build | PASS | 2.44 s wall, 167,180 KiB max RSS; subsequent build 1.45 s / 172,056 KiB |
| Complete publisher tests | PASS | 47 suites, 675 tests, 417.886 s after external-renderer hardening |
| VS Code extension tests | PASS | Scaffold and activation smoke tests; 0.35 s wall, 69,628 KiB max RSS |
| Registry schema validation | PASS | `tenants.json` and `examples/recipes.tenants.json` validate with Ajv |
| Offline/CDN runtime scan | PASS | No CDN/runtime HTTP imports in publisher source/scripts or generated runtime; documentation-only jsDelivr examples and generated canonical URLs excluded |
| Rich asset reproducibility | PASS | Mermaid JS and KaTeX CSS hashes identical across consecutive builds |
| Whole-build reproducibility | PASS | With `SOURCE_DATE_EPOCH=1704067200`, two isolated builds had identical file sets and byte content; the focused build suite compares every emitted file |
| Dependency pinning | PASS | KaTeX 0.18.1 and Mermaid 11.16.0 are exact lockfile versions with integrity hashes |
| Dependency audit | CONDITIONAL | Policy-aged exact overrides fixed `js-yaml` and `postcss`; `npm audit` now reports 2 high, 0 critical (`brace-expansion`, `fast-uri`), neither introduced by the renderer packages; cooldown follow-up is #179 |
| External renderer matrix | PASS | Pinned Ubuntu 24.04 image; LaTeXML 0.8.8, Mermaid CLI 11.16.0/Puppeteer 24.16.0, PlantUML 1.2026.4 SANDBOX, and Tectonic 0.16.9; networkless/read-only/non-root/resource-bounded run |
| Mermaid static visual matrix | PASS | Five representative families × neutral/forest/dark themes; byte-identical repeated SVG plus real headless-browser PNG snapshots with hashes |

## Exact Commands and Evidence

### Focused tests

```sh
cd apps/publisher
/usr/bin/time -v node --experimental-vm-modules ../../node_modules/jest/bin/jest.js \
  --runInBand \
  __tests__/scripts/inline-latex.test.js \
  __tests__/scripts/latex-page.test.js \
  __tests__/scripts/mermaid-build-adapter.test.js \
  __tests__/scripts/plantuml-renderer.test.js \
  __tests__/scripts/renderer-security.test.js \
  __tests__/scripts/rich-content-core.test.js \
  __tests__/scripts/rich-content-materialization.test.js \
  __tests__/scripts/semantic-html.test.js
```

Current result: `Test Suites: 8 passed, 8 total`; `Tests: 62 passed, 62 total`.

### Full check and build

```sh
/usr/bin/time -v npm run check --workspace @pagenary/publisher
/usr/bin/time -v npm run build --workspace @pagenary/publisher
```

All lint, accessibility, media, narration, reading metadata, build, and SEO
commands passed. Accessibility reported pre-existing warning-level contrast of
2.77 for `examples/blog-demo/config.json` and `examples/showcase/config.json`.

### Full test suite

```sh
cd apps/publisher
timeout --signal=INT --kill-after=10s 300s /usr/bin/time -v \
  node --experimental-vm-modules ../../node_modules/jest/bin/jest.js \
  --runInBand --verbose
```

The tenant-build harness defaults spawned fixture builds to development mode
while preserving caller overrides; production minification remains covered by
`build.test.js`. Four identical two-tenant assertions share a single setup
build. The current complete in-band run passes 47/47 suites and 675/675 tests
in 417.886 seconds.

### VS Code tests and schema

```sh
/usr/bin/time -v npm test --workspace @pagenary/vscode-extension
node - <<'NODE'
const fs = require('fs');
const Ajv = require('ajv');
const validate = new Ajv({ allErrors: true, strict: false })
  .compile(JSON.parse(fs.readFileSync('apps/publisher/tenants.schema.json')));
for (const file of ['apps/publisher/tenants.json',
  'apps/publisher/examples/recipes.tenants.json']) {
  console.log(file, validate(JSON.parse(fs.readFileSync(file))) ? 'PASS' : validate.errors);
}
NODE
```

Both extension smoke checks and both registry validations passed.

### Reproducibility, offline operation, and size

Two consecutive publisher builds were hashed with sorted `sha256sum` manifests.
The local renderer assets were unchanged:

- `vendor/mermaid/mermaid.min.js`: 3,565,102 bytes
- complete `vendor/katex`: 1,101,299 bytes
- complete `dist`: 5,420,652 bytes after an isolated normal build

The normal build retains a useful current-time `x-build` value. Reproducible
builds set the standard `SOURCE_DATE_EPOCH` environment variable; the builder
converts its non-negative Unix-seconds value to the same ISO metadata format.
Invalid and out-of-range values fail explicitly instead of silently producing
unstable metadata. `build.test.js` performs two isolated builds at epoch
`1704067200`, compares their sorted file sets and every file's bytes, and passed
as part of a 15-test focused suite.

```sh
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!*.map' \
  '(https?:)?//(cdn|unpkg|jsdelivr|cdnjs)|cdn\.jsdelivr|unpkg\.com' \
  apps/publisher/src apps/publisher/scripts apps/publisher/docs apps/publisher/package.json
rg -n --glob '!*.map' \
  '<script[^>]+src=["'"' ]https?:|<link[^>]+href=["'"' ]https?:' \
  apps/publisher/dist
```

No runtime CDN reference was found. The source hit is limited to download and
checksum examples in `docs/VENDORING.md`; generated HTTP links are canonical
metadata for test tenants, not fetched runtime dependencies. Mermaid loads
`./vendor/mermaid/mermaid.min.js`, and KaTeX CSS/fonts are copied locally.

## Dependency and License Inventory

Direct publisher dependencies at qualification time:

| Package | Version | License | Role |
|---|---:|---|---|
| `@fortemi/core` | 2026.7.15 | AGPL-3.0-only | Existing corpus/index dependency |
| `jest` | 30.4.2 | MIT | Test-only |
| `katex` | 0.18.1 | MIT | Inline/display LaTeX rendering |
| `mermaid` | 11.16.0 | MIT | Local Mermaid runtime/build input |
| `terser` | 5.48.0 | BSD-2-Clause | Build minification |

Both new renderer dependencies are exact package/lockfile pins. Lockfile SRI:

- KaTeX: `sha512-Td8GCYSxDAoMhHOlKmCFMJ/hz5qlAAb71n66Dryw9nfCVfumLo7nhuotbvKom/XPADmrYC3O5QR71EPq4DarJQ==`
- Mermaid: `sha512-Zvm3kbstgdpvIJPPItlL7fppIZ3kibvc1oZIGxdvk9t6UFz6flv+Jw7FtRGKwfcI8OckmH04LqG6LlS6X4B1pA==`

Mermaid 11.16.0 was published on 2026-06-25, more than five weeks before this
qualification; it is not the newly published release. Mermaid 11.16.1 was
published on 2026-08-04 and is deliberately not adopted while inside the
repository's seven-day release-age gate. Moving backward to 11.15.0 would add a
renderer change without improving the cooldown posture, so 11.16.0 remains the
qualified exact v11 pin.

### Audit attribution

The initial `npm audit --json` reported four high-severity, zero critical
findings:

- `brace-expansion` through Jest -> glob -> minimatch (test-only path)
- `js-yaml` through Jest/Babel/Istanbul (test-only path)
- `fast-uri` through existing `@fortemi/core` -> Ajv and React workspace paths
- `postcss` through the React workspace's Vite dependency

Neither KaTeX nor Mermaid is in these four dependency paths. This attribution
does not make the findings acceptable. Exact root overrides to policy-aged
`js-yaml@3.15.0` and `postcss@8.5.23` removed those two findings and passed the
focused build suite. The post-remediation audit reports only `brace-expansion`
and `fast-uri` (2 high, 0 critical). Their fixed compatible releases were
published July 30 and July 31 respectively and remain inside the configured
minimum-release-age window on August 5. Canonical Gitea issue #179 tracks
adoption after cooldown without bypassing repository supply-chain policy.

## External Tool Gates

The reproducible qualification image is defined in
`ci/rich-content/Dockerfile` and its real-adapter corpus in
`ci/rich-content/qualify.mjs`. The qualified local image manifest list was
`sha256:32a13c9806d6d38614912b6e26a023c6fa3906e4403e523fd53e4ae47e1ec1b7`
(946,227,570 bytes). It also contains a lockfile-backed Mermaid CLI 11.16.0 and
Puppeteer 24.16.0 browser plus pinned Pandoc and make4ht packages for the
converter-selection regression.
Its immutable base image and downloaded renderer artifacts are digest/checksum
pinned. Tectonic resources are warmed from the accepted representative fixture
during the networked image build; runtime PDF generation uses `--untrusted
--only-cached`.

```sh
docker run --rm --network none --read-only \
  --user 10001:10001 --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,nosuid,nodev,mode=1777,size=768m \
  --cpus 2 --memory 2g --pids-limit 256 \
  pagenary-rich-content:2026-08-05
```

Result: `PASS`. The six positive LaTeXML fixtures each rendered twice
with byte-identical normalized HTML. The hostile fixture was rejected at
preflight with `LATEX_UNSAFE_COMMAND`; unsupported-package and malformed-input
fixtures also failed safely. PlantUML rendered sequence, class,
component, activity, state, ER, JSON, and YAML diagrams twice with byte-identical
sanitized SVG under SANDBOX, plus a valid 2,772-byte optional PNG fallback.
Tectonic emitted a 32,379-byte PDF with network
disabled and cached-only mode. Mermaid rendered flowchart, sequence, class,
state, and ER diagrams under neutral, forest, and dark themes. Each repeated SVG
was byte-identical, sanitized, and content-addressed; the pinned headless browser
also captured and hashed a valid PNG visual snapshot for all 15 combinations.

Qualified tools:

| Tool | Status | Version/evidence |
|---|---:|---|
| Pandoc | PASS / NOT SELECTED | 3.1.3; all five positive fixtures converted in the networkless image |
| make4ht | MEASURED / NOT SELECTED | v0.3m; four fixtures passed, baseline `booktabs` fixture exposed missing package surface |
| Java | CONTAINER PINNED | OpenJDK 21.0.11 |
| Graphviz | CONTAINER PINNED | 2.42.2 |
| Mermaid CLI | PASS | 11.16.0 exact npm lockfile pin; deterministic secured SVG and content-addressed output |
| Puppeteer/browser | PASS | Puppeteer 24.16.0 exact lockfile pin; cached Chrome Headless Shell 139.0.7258.66 visual snapshots |
| LaTeXML | PASS | 0.8.8; six positive semantic fixtures plus hostile, unsupported-package, and malformed rejection |
| PlantUML | PASS | MIT JAR 1.2026.4; eight diagram families; SANDBOX and sanitized deterministic SVG |
| Tectonic | PASS | 0.16.9; untrusted cached-only PDF output |

PlantUML's qualified toolchain records PlantUML MIT 1.2026.4 and its verified
JAR checksum, Graphviz EPL-1.0 2.42.2, Fontconfig 2.15.0, and DejaVu fonts under
their permissive Bitstream Vera-derived license. The stable toolchain-input
digest is `sha256:eeeb2887f90fbca52c03e96ec13a05a3138b8661fc437a72ab1e08822f071b57`;
it, versions, sorted font identities, include profile, dependencies, security
profile, and output format all participate in PlantUML cache identity.

RTC-FR-040 through RTC-FR-046 evidence is explicit: alias/envelope unit tests;
local-only pinned rendering; hardened SANDBOX container/subprocess execution;
default-off and tenant-contained ALLOWLIST include tests; recorded toolchain and
licenses; content-addressed sanitized SVG plus PNG fallback; and accessible
image text/caption behavior. A real materialization test also routes `puml`
through the publisher, writes the immutable SVG, and proves the completed image
markup is what static HTML consumers receive.

The matching Gitea workflow builds this exact Dockerfile and runs the same image
with network denial, a read-only filesystem, non-root UID, dropped capabilities,
and explicit CPU/memory/PID/tmpfs limits. It supplies continuous version,
isolation, corpus, determinism, and visual-snapshot regression coverage.

## Risks and Required Follow-up

1. Complete #179 after the release-age cooldown, then prove `npm audit` has no
   remaining high/critical findings; do not use an unreviewed blanket
   `npm audit fix`.
2. Complete the remaining whole-page CSP and assistive-technology matrix. The
   real Chrome syntax-gallery smoke now proves five runtime Mermaid families,
   accessible captions/names/source fallback, and KaTeX MathML; the external
   gate proves 15 static Mermaid browser snapshots offline, but manual AT
   qualification remains.
3. Add explicit timeout/termination attack execution to the external container
   corpus; unit tests already cover the bounded subprocess paths and hostile
   preflight, but a real deliberately non-terminating converter shim remains a
   useful defense-in-depth regression.
4. Keep an eye on payload cost: Mermaid is about 3.57 MB on disk. It is lazy
   loaded, but compression and first-diagram latency should be measured in the
   browser performance gate.
