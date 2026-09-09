# Testing Pagenary

Use **Node 24.12.0** for repository tests and conformance collection. The repository test workflow pins that version and its container digest. Node reporter registration and terminal-summary handling are qualified against this runtime; qualify another version before using its results as conformance evidence.

From the repository root:

```sh
npm ci
npm run test:setup
npm test
```

`test:setup` explicitly installs Playwright **1.55.1** under the system temporary directory (`/tmp/pagenary-playwright` on the audit host) and downloads Chromium. On a Linux host needing browser system libraries, use `npm run test:setup -- --with-deps`. Test runners do not install prerequisites themselves. CI runs this setup before `npm test`.

`npm test` runs publisher Jest tests with two workers, React Node tests, extension smoke/activation checks, and tooling qualification tests in sequence. A failure stops the command. The publisher suite includes **real Chromium browser layout tests**: responsive navigation, computed styles, RSS parsing, and generated static-page scrolling with JavaScript disabled. Browser setup is therefore required for the default suite. Its default style engine is Chromium; `PAGENARY_STYLE_BROWSERS=chromium,firefox,webkit` requests all three installed engines.

| Command | Scope |
| --- | --- |
| `npm run test:publisher` | Publisher Jest unit/integration tests and real-browser style checks |
| `npm run test:react` | React, records, dataset, projection and theme Node tests |
| `npm run test:extension` | Extension validation and mocked-host activation checks |
| `npm run test:tooling` | Node registration/reporter and standalone outcome qualification |
| `npm run test:checks` | Publisher content checks, build and SEO checks |
| `npm run test:browser` | Required publisher browser smoke |
| `npm run test:inventory` | AIWG source/configuration/test inventory |
| `npm run test:conformance` | AIWG assessment of supplied evidence; does not collect it automatically |

A passing default suite does not complete the full conformance audit. The reviewed local protocol at [`.aiwg/testing/conformance.yaml`](.aiwg/testing/conformance.yaml) has **24 required lanes**, including publisher and React suites, tooling, standalone publisher checks, three-engine style checks, browser dataset/record paths, AT-SPI accessibility, extension checks and external-renderer qualification. Extension activation uses a mocked VS Code host, not an installed-editor integration session.

Before collecting all lanes, provision and review these additional prerequisites:

- Install Firefox and WebKit using the same pinned Playwright installation: `node /tmp/pagenary-playwright/node_modules/playwright/cli.js install --with-deps firefox webkit`. Adjust the temporary-directory path when necessary. The full publisher and standalone style lanes explicitly request Chromium, Firefox and WebKit.
- Provide the protocol's Chromium binary for the syntax-gallery browser check. Review `PLAYWRIGHT_MODULE`, `PAGENARY_PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` and `CHROME_PATH` together; their paths must refer to the installation actually being qualified.
- For Linux AT-SPI, provide `/usr/bin/python3` with GI/Atspi bindings, D-Bus, Xvfb and the selected Firefox binary. The owned-session runner rebuilds the syntax gallery, launches an isolated D-Bus/display/browser session, and runs the registered math/diagram checker against that browser's accessibility tree.
- Build the external-renderer image from the checked-in Dockerfile, for example `docker build -f ci/rich-content/Dockerfile -t pagenary-rich-content-qualification .`. Resolve the resulting image ID and review/rebind the protocol recipe before collection. The image supplies pinned renderer tools and warmed caches. Qualification runs offline with a read-only bind of the **current checkout** at `/workspace`, restricted capabilities and bounded writable temporary storage. This bind makes source mutations visible instead of testing image-baked application source. Rebuild the image when its Dockerfile or tool inputs change; do not rebuild an application snapshot separately for each mutation.

The checked-in audit protocol contains host-specific absolute browser paths, an image ID and a Docker checkout mount. They are reviewed local bindings, not portable defaults. For another checkout or machine, prepare a guarded protocol update, rebind those values and regenerate inventory, control plans and evidence. Keep each control's command, environment and result recipe exactly equal to its lane. Never rewrite hashes in old receipts to make them appear current.

The complete historical audit is shipped as a compressed [evidence bundle](.aiwg/testing/DELIVERY.md). Extract it before following the final report's raw-receipt links in a fresh clone.

AIWG's `testing-quality` addon provides `aiwg test-conformance`. If the namespace is unavailable, deploy it through `aiwg use testing-quality --provider codex`. Preserve distinct artifact paths for each run. After reviewing the protocol and provisioning its prerequisites, a collection sequence is:

```sh
aiwg test-conformance inventory --output .aiwg/testing/inventory-next.json
aiwg test-conformance collect --mode discovery --lane all --output .aiwg/testing/discovery-next.json
aiwg test-conformance collect --mode execution --lane all --output .aiwg/testing/execution-next.json
aiwg test-conformance collect --mode controls --lane all --evidence .aiwg/testing/execution-next.json --output .aiwg/testing/controls-next.json
```

Discovery and execution have different meanings. Jest registration uses a no-match test-name filter and its structured report to observe registered case identities; `--listTests` only lists files. Node registration observes genuine `test:enqueue` events, including dynamic children, and requires a matching final population. Node discovery may execute tests to observe dynamic registration. The canonical execution reporter retains failures/skips, excludes describe-suite containers from case totals and rejects missing attribution, duplicate identities, contradictory counts and truncated streams.

Each standalone harness is registered as **one file-level action**. Its wrapper checks that the command names the registered file, executes it with a deadline and retained diagnostics, and distinguishes assertion failures from missing prerequisites, skipped work and interrupted execution. The conformance adapter binds the canonical identity to the lane, file and action name. A file-level pass does not claim an independently reported case for every internal assertion.

Run conformance lanes and controls sequentially when they share generated outputs. Publisher build-integration tests use owned workspaces, but standalone browser fixtures rebuild shared tenant output. Browser, AT-SPI and SEO recipes prepare fresh fixtures for baseline, mutant and restored runs; style checks serve current source directly. Do not run other collectors or edit source while controls are active. Each guarded control changes inventoried production source, runs the exact lane, restores the source and reruns the lane. Selected cases must pass before/after and fail for the intended mutation with the same identities. Setup errors, missing cases and timeouts are not mutation kills.

Inventory, configuration, complete-file oracle reviews, guarded plans and execution/control receipts bind to the checkout's source hashes. A changed source, runner or protocol requires the affected evidence to be refreshed. Keep initial audit evidence intact and create new artifacts for repairs and subsequent runs.

The initial audit sampled 20 of 48 publisher files, all 10 React files and the original 20 standalone harnesses. Review has expanded to a census of **81 test/harness files**: 48 publisher, 10 React, 21 standalone harnesses and two tooling files. The completed [conformance report](.aiwg/testing/normalization-summary-final-11.md) records **181 passed gates, zero failed and zero unknown**: all 24 required discovery/execution lanes, complete-file reviews and all 25 source-only negative controls passed, with restoration independently inventoried. This result is relative to the recorded protocol and source snapshot; it does not establish unmeasured code coverage or future changes.

When maintaining tests, state the observable claim, require expected members before checking ordering or absence, reject empty prerequisite populations, compare with independent expected values and register cleanup before assertions. Parameterized titles must identify each case. Preserve required assertions, prerequisites and gates when repairing failures.
