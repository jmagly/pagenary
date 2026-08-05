# Rich Technical Content Qualification Report

**Issue:** #176
**Date:** 2026-08-05
**Environment:** Linux, Node.js v24.12.0, npm 11.11.0
**Disposition:** **CONDITIONAL / NOT RELEASE-QUALIFIED**

The implemented in-process rich-content paths pass their focused and complete
test suites, the publisher build/check/package pipelines pass, VS Code smoke
tests pass, and generated Mermaid/KaTeX assets are local and stable. Release
qualification remains conditional because two high-severity transitive audit
findings remain in the supply-chain cooldown window and the external
LaTeX/PlantUML renderer matrix cannot be exercised on this host.

## Results

| Gate | Result | Evidence |
|---|---:|---|
| Rich-content focused tests | PASS | 8 suites, 53 tests, 2.07 s wall, 187,424 KiB max RSS |
| Publisher `check` | PASS WITH WARNINGS | 4.60 s wall, 165,616 KiB max RSS; two existing example color-contrast warnings |
| Publisher build | PASS | 2.44 s wall, 167,180 KiB max RSS; subsequent build 1.45 s / 172,056 KiB |
| Complete publisher tests | PASS | 47 suites, 668 tests, 715.773 s; the isolated 79-test tenant-build suite passed in 279.25 s after harness optimization |
| VS Code extension tests | PASS | Scaffold and activation smoke tests; 0.35 s wall, 69,628 KiB max RSS |
| Registry schema validation | PASS | `tenants.json` and `examples/recipes.tenants.json` validate with Ajv |
| Offline/CDN runtime scan | PASS | No CDN/runtime HTTP imports in publisher source/scripts or generated runtime; documentation-only jsDelivr examples and generated canonical URLs excluded |
| Rich asset reproducibility | PASS | Mermaid JS and KaTeX CSS hashes identical across consecutive builds |
| Whole-build reproducibility | PASS | With `SOURCE_DATE_EPOCH=1704067200`, two isolated builds had identical file sets and byte content; the focused build suite compares every emitted file |
| Dependency pinning | PASS | KaTeX 0.18.1 and Mermaid 11.16.0 are exact lockfile versions with integrity hashes |
| Dependency audit | CONDITIONAL | Policy-aged exact overrides fixed `js-yaml` and `postcss`; `npm audit` now reports 2 high, 0 critical (`brace-expansion`, `fast-uri`), neither introduced by the renderer packages; cooldown follow-up is #179 |
| External renderer matrix | NOT RUN | Pandoc available; LaTeXML, PlantUML, and Tectonic absent |

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

Result: `Test Suites: 8 passed, 8 total`; `Tests: 53 passed, 53 total`.

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

The tenant-build harness now defaults spawned fixture builds to development
mode while preserving caller overrides; production minification remains
covered by `build.test.js`. Four identical two-tenant assertions also share a
single setup build. The affected suite passes 79/79 in 279.25 seconds (down
from Jest's earlier 512-second estimate), and the final complete in-band run
passes 47/47 suites and 668/668 tests in 715.773 seconds.

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

Tool probe:

| Tool | Status | Version/evidence |
|---|---:|---|
| Pandoc | AVAILABLE | 3.1.3 |
| Java | AVAILABLE | OpenJDK 21.0.11 |
| Graphviz `dot` | AVAILABLE | 2.43.0 |
| LaTeXML | ABSENT | `command -v latexml` returned no path |
| PlantUML | ABSENT | `command -v plantuml` returned no path |
| Tectonic | ABSENT | `command -v tectonic` returned no path |

No system tools were installed. Consequently, qualification covers fallback,
diagnostic, and mocked adapter behavior but does **not** qualify real LaTeXML
semantic conversion, PlantUML diagram generation, or optional Tectonic PDF
generation. Those require a pinned CI image/toolchain and corpus tests.

## Risks and Required Follow-up

1. Exercise real external renderers in a pinned sandboxed CI job, including
   timeout, output-size, path, shell-escape, network-denial, and malicious-corpus
   cases.
2. Complete #179 after the release-age cooldown, then prove `npm audit` has no
   remaining high/critical findings; do not use an unreviewed blanket
   `npm audit fix`.
3. Add a browser/CSP qualification that renders representative Mermaid and
   KaTeX pages with networking disabled and asserts accessibility output. Static
   scans prove local references but do not substitute for browser execution.
4. Keep an eye on payload cost: Mermaid is about 3.57 MB on disk. It is lazy
   loaded, but compression and first-diagram latency should be measured in the
   browser performance gate.
