# Vendoring third-party code

Pagenary's publisher is a **no-bundler** pipeline: `scripts/build.js` copies
`src/` to `dist/` (optionally minified) and the browser loads ES modules by
relative path. Bare specifiers like `import … from '@fortemi/core'` do not
resolve in that environment — there is no bundler to rewrite them and the
browser cannot fetch a node_modules package by name.

So when the publisher needs a third-party library at **runtime**, it
*vendors* it: a copy of the dependency's built artifact is committed into the
repository and loaded by relative path. This is the same practice Go formalizes
as a `vendor/` directory — "copies of all packages needed to build and test …
[plus] a manifest containing a list of vendored packages and the module
versions they were copied from"
([go.dev/ref/mod#vendoring](https://go.dev/ref/mod#vendoring)). Pagenary's
per-file banner is that manifest.

## What is vendored today

| Vendored file | Upstream | Version | Notes |
|---|---|---|---|
| `src/vendor/fortemi-aiwg-index.js` (+ `.d.ts`) | `@fortemi/core` `./aiwg-index` | `2026.7.15` | Dependency-free static v2 search/index engine with hardened validation, privacy filtering, discovery ranking, graph loading, operational-state/state-transfer validation, and rich metadata. Shard conversion remains outside Tier 0 in `./aiwg-index-shard`. See [ADR-015](../../../.aiwg/architecture/adr/ADR-015-fortemi-core-search-adapter.md). |

The runtime search (`src/lib/search.js`) and the build-time index emitter
(`scripts/build-tenants.js`) both import this vendored module by relative path —
never the bare `@fortemi/core` specifier — so it works identically in Node and
the browser.

## The vendoring process

Using `@fortemi/core` as the worked example:

1. **Pull the upstream built artifact** for a specific, registry-published
   version (do not hand-author it):
   ```bash
   curl -fsSL "https://cdn.jsdelivr.net/npm/@fortemi/core@<version>/dist/aiwg-index.js" \
     -o /tmp/aiwg-index.js
   sha256sum /tmp/aiwg-index.js          # record this
   ```
2. **Write it to `src/vendor/<name>.js` under a provenance banner.** The body
   below the banner is the upstream file **verbatim** — do not hand-edit it. The
   banner records:
   - `Source : <pkg>@<version> → dist/<file>`
   - `SHA-256: <hash of the upstream dist file>`
   - `License:` and a short `Why` + `Update` note.
   The committed file is therefore `banner + upstream body + a terminating
   newline` (the trailing newline satisfies `lint:content`; it is the only
   addition to the upstream bytes).
3. **Verify provenance** — re-download the upstream dist for the recorded
   version and confirm its hash matches the banner. This is the authoritative
   check (it compares against the real upstream source, independent of the
   banner/newline the vendored file adds):
   ```bash
   curl -fsSL "https://cdn.jsdelivr.net/npm/<pkg>@<version>/dist/<file>" | sha256sum
   # == the SHA-256 recorded in the banner
   ```
4. **Run the suite.** The tests validate against the *real* vendored engine
   (e.g. `__tests__/src/lib/fortemi-corpus.test.js` runs its output through the
   vendored validators), so a behavioral regression surfaces immediately:
   ```bash
   npm test
   ```
5. **Record the bump** in `CHANGELOG.md` and, where applicable, refresh the
   `.d.ts` the same way.

To **re-vendor** a newer release, repeat with the new version and refresh the
`Source`/`SHA-256` lines. Nothing below the banner is ever edited by hand.

## Version tracking

Each vendored package is also declared in `devDependencies`, pinned to the
**exact** vendored version (e.g. `"@fortemi/core": "2026.7.15"`). The build never
imports it — this entry exists purely so `npm outdated` / dependabot flag new
upstream releases automatically, instead of relying on a human to notice.

> **Release-age gate interaction.** The repo's `.npmrc` sets
> `min-release-age=7` (refuse any dependency published less than 7 days ago — a
> defense against brand-new-malicious-publish supply-chain attacks), so a
> freshly-published *external* version cannot normally be locked until it ages.
> **First-party exception:** because the vendored libraries are our own
> Gitea-hosted projects (e.g. `@fortemi/core` from
> [`Fortemi/fortemi-react`](https://git.integrolabs.net/Fortemi/fortemi-react)),
> we control the source and adopt them fresh via a one-time gate override at
> lock-write time — see the policy block in [`.npmrc`](../../../.npmrc). The
> entry is committed to the lockfile with its integrity hash; `npm ci` then
> installs it without re-tripping the gate, which still guards every other
> `npm install`. Before committing such an entry: verify the upstream SHA-256,
> run `npm audit` (the addition must introduce no new advisories), and confirm
> every resolved version is from `registry.npmjs.org` with integrity.

## Caveat: vendoring bypasses the release-age gate

Vendoring pulls a build artifact directly from a CDN/tarball — it does **not**
go through `npm install`, so `min-release-age` does not apply. A brand-new
upstream release can be vendored the day it ships, inside the very cooldown the
npm gate enforces. Treat that as a deliberate tradeoff:

- Prefer to vendor a release only after it has aged, unless there is a reason to
  take it early (as with the additive 6.6 refresh).
- Always verify the recorded SHA-256 and run the full suite before committing a
  re-vendor — that, plus reading the upstream diff, is the compensating control.

## Runtime CDN dependencies (not yet vendored)

Two libraries are loaded at **runtime in the browser** from the `esm.sh` CDN,
and are therefore outside npm, the lockfile, and any dependency tooling:

| Library | Loaded in | Pin | Status |
|---|---|---|---|
| PrismJS | `src/syntax-highlight.js` | `1.29.0` (exact) | syntax highlighting |
| Mermaid | diagram rendering | `@10` (**floating major**) | diagram rendering |

These are genuine functional dependencies of the generated site. They are
candidates for vendoring/self-hosting on the same pattern above (which would
remove the runtime CDN fetch, work offline, and make them SHA-pinnable). Until
then, note that Mermaid floats on its major version — `esm.sh` resolves `@10` to
the latest `10.x`, so the executed code can change without a Pagenary change.
Pinning Mermaid to an exact `10.x.y` is the minimum hardening if vendoring is
deferred.

## References

- [`go.dev/ref/mod#vendoring`](https://go.dev/ref/mod#vendoring) — canonical
  definition of vendoring (committed dependency copies + a version manifest).
- [`ADR-015`](../../../.aiwg/architecture/adr/ADR-015-fortemi-core-search-adapter.md) —
  why the Fortemi engine is vendored rather than imported.
- [`.npmrc`](../../../.npmrc) — the `min-release-age` supply-chain gate.
- `.claude/rules/dependency-source-policy.md` — registry-source policy this
  practice operates within.
