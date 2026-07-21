# Minimizing Supply-Chain Exposure

Pagenary is designed so you can publish a complete site with **no external
runtime dependencies at all**. If limiting supply-chain exposure is a priority
for you — regulated environment, air-gapped host, or simply a low-trust stance
toward the npm ecosystem — this guide shows how to keep that posture, and how to
harden the higher tiers when you genuinely need React or the Fortémi tooling.

Read [Dependency Posture & Operational Tiers](DEPENDENCY-POSTURE.md) first for
what each tier adds. This guide is the hardening playbook.

## The one decision that matters most: stay at Tier 0

The single most effective control is to **not add the dependency in the first
place.** Tier 0 (the default static publisher) ships zero npm packages to the
browser and uses no bundler. Its Docs Map, search, routing, and SEO artifacts
are all hand-written ES modules or build-time output. There is nothing in the
delivered site to audit, pin, or trust beyond your own content and the small,
**vendored** search artifact (a specific version committed to your repo — see
[Vendoring](VENDORING.md)).

Everything below is for when a specific interactive requirement forces you to
Tier 1+. If it does, apply these controls in order — each one narrows the
window an attacker or a compromised package can act through.

## 1. Scope the dependency, don't adopt it wholesale

- Use `runtime.mode: "hybrid"`, not `"react-spa"`. Mount React only on the
  routes that need it (`runtime.react.routes`) and keep every other tenant and
  route at Tier 0.
- Keep the rest of the site — nav, search, Docs Map fallback, SEO — on the
  dependency-free static path. React should be a surgical addition, not the
  substrate.

## 2. Lock, and install from the lock

- Commit `package-lock.json`. It pins exact versions **and** integrity hashes
  for the entire transitive tree.
- In CI, run **`npm ci`**, never `npm install`. `npm ci` installs exactly what
  the lockfile says and fails on any mismatch; it does not re-resolve, so it
  cannot silently pull a newer (possibly malicious) version.
- Review lockfile diffs like code. A changed integrity hash or a new transitive
  package is a supply-chain event, not noise.

## 3. Let new versions age before you trust them

Pagenary ships a committed `.npmrc` with a **release-age gate**:

```ini
min-release-age=7
```

Any `npm install` refuses a dependency version published less than 7 days ago,
bounding the window for brand-new-malicious-publish attacks (the "Mini
Shai-Hulud" class, where a compromised maintainer publishes a poisoned version
that is caught and unpublished within days). `npm ci` against a committed
lockfile is unaffected — the gate only bites when you resolve new versions.

- Keep the gate. Requires npm 11.5+ (the release workflow installs it before
  `npm ci`).
- The documented exception is first-party libraries you control (hosted in your
  own Gitea): adopt them fresh with a one-time, lock-only override, then commit
  the lockfile. See the comments in `.npmrc` for the exact command.

## 4. Verify provenance and known vulnerabilities

```bash
npm audit signatures     # every package was published by an authenticated maintainer
npm audit                # known CVEs in the resolved tree
```

Run both in CI and gate the build on `npm audit signatures`. A package that
cannot prove registry provenance should not ship.

## 5. Reject non-registry dependency sources

Per the project's **`dependency-source-policy`** rule, `git+`, `github:`, raw
tarball URLs, `file:`, and `link:` dependency sources are forbidden by default —
in `package.json` *and* transitively in the lockfile. These bypass registry
signature verification and can execute arbitrary code at install time via
lifecycle scripts (the primary Mini Shai-Hulud vector). If a non-registry source
is genuinely unavoidable, it must be allowlisted with an owner, reason, and
review date — never adopted silently.

```bash
# Flag exotic sources in the lockfile:
grep -nE '"resolved": *"(git\+|git:)' package-lock.json
```

## 6. Pin your CI execution environment

Per **`ci-action-pinning`**: pin every GitHub/Gitea Action by full 40-char
commit SHA and every container image by `sha256:` digest — not by moving tags
like `@v4` or `:latest`. A moved tag is remote code you did not review running
in CI with your secrets. Maintain a pin manifest (`ci/digests.txt`) and gate on
a lint that rejects floating tags.

## 7. Verify what actually shipped

Building React does not mean trusting what you think you built — check the
bytes. The adapter deliberately keeps PGlite (~16 MB WASM/data) out of the
docs-map bundle by importing the PGlite-free `@fortemi/react/graph` subpath and
using the graph-only `@fortemi/graph` root. Database orchestration lives at
`@fortemi/graph/controller`. The adapter audits emitted filenames and JS for
database markers and fails the build if that boundary regresses; confirm the
bytes independently too:

```bash
# No PGlite / WASM / data blobs in a Tier-1 docs bundle:
find dist/<tenant>/assets/react -iname '*.wasm' -o -iname '*.data'   # expect empty

# Full inventory of what the React tier emitted, largest first:
find dist/<tenant>/assets/react -type f -printf '%s\t%p\n' | sort -rn
```

A ~200 KB JS bundle is Tier 1 as intended. Multi-megabyte WASM/data means a DB
or model engine leaked in — stop and investigate before publishing.

## 8. Self-host everything; require no external network

The static output already needs no external network. Keep it that way at every
tier:

- No CDN `<script>`/`<link>`, no remote fonts, no external images — Vite output
  is hashed and served from your own host; embed or self-host assets.
- No runtime `fetch` to third-party APIs from the shipped site unless
  explicitly intended and documented.
- Ship a **Content-Security-Policy** that blocks external hosts (`default-src
  'self'`), so even a compromised dependency cannot exfiltrate to or pull from
  an outside origin.
- The result: the site runs identically on a static host, behind Caddy, or fully
  offline/air-gapped.

## 9. Protect the build and the publishers

- No secrets in bundles or committed files; keep CI secrets scoped to protected
  branches (`dev-secret-hygiene`).
- Enforce **2FA / hardware keys** for everyone with write access to the repo and
  publish rights (`committer-2fa-required`).
- No committed binary blobs without documented provenance (`no-binary-blobs`);
  no banned/dangerous APIs (`banned-apis`).

## 10. The ultimate control: vendor it

If you want a capability but not an npm runtime dependency, **vendor** it the way
the publisher already vendors its search engine: pull a specific,
registry-published built artifact, record its SHA-256, commit it under a
provenance banner, and load it by relative path. No bundler, no `node_modules`
in the browser, no install-time scripts — a frozen, auditable copy you control
and update deliberately. See [Vendoring](VENDORING.md).

This is the path to keep a Tier-0-style posture even for a capability that ships
as an npm package upstream. (The framework-agnostic `@fortemi/graph` engine is a
natural future vendoring candidate — a JS-only renderer that needs no React and
no PGlite is proposed upstream as
[fortemi-react #259](https://git.integrolabs.net/Fortemi/fortemi-react/issues/259).)

## Hardening checklist

- [ ] Site is Tier 0 wherever possible; React scoped to specific routes only
- [ ] `package-lock.json` committed; CI uses `npm ci`, not `npm install`
- [ ] `.npmrc` release-age gate (`min-release-age=7`) present and honored
- [ ] `npm audit signatures` and `npm audit` run and gated in CI
- [ ] No `git+`/`github:`/tarball/`file:`/`link:` sources (direct or transitive)
- [ ] CI Actions pinned by SHA; containers pinned by digest (`ci/digests.txt`)
- [ ] Built React bundle inspected — no unexpected WASM/data; PGlite absent
- [ ] All assets self-hosted; CSP blocks external origins; runs offline
- [ ] No secrets in output; 2FA enforced for writers/publishers
- [ ] Any capability you can vendor is vendored, not shipped as a live npm dep

## Related

- [Dependency Posture & Operational Tiers](DEPENDENCY-POSTURE.md)
- [Vendoring third-party code](VENDORING.md)
- [React/SPA Publishing](REACT-SPA-PUBLISHING.md) · [Deployment](DEPLOYMENT.md)
- Project rules: `dependency-source-policy`, `ci-action-pinning`,
  `dev-secret-hygiene`, `no-binary-blobs`, `committer-2fa-required`,
  `banned-apis` (in `.claude/rules/`)
