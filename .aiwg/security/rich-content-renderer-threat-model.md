# Rich Content Renderer Threat Model

**Status:** Validated
**Date:** 2026-08-05
**Issue:** #167
**Related Requirements:** `REQ-rich-technical-content.md` RTC-FR-020..046, RTC-NFR-001, RTC-NFR-007, RTC-NFR-008
**Related Architecture:** `ADR-019-rich-technical-content-rendering.md`
**Supporting Evidence:** `apps/publisher/scripts/lib/renderer-security.js`, renderer adapters, focused abuse tests, and `ci/rich-content/`

## Scope

This threat model covers the immutable security boundary for:

- Mermaid 11.16.0 local rendering policy and generated SVG/HTML handling
- LaTeX page conversion subprocesses and temporary work directories
- PlantUML subprocesses, include resolution, and output handling
- Renderer cache metadata boundaries and tenant isolation expectations
- Diagnostics surfaced to authors and operators

It does not select cryptographic primitives or boot-chain trust anchors. Those
concerns are out of scope for issue #167.

## Security Objectives

1. Author content must never gain shell, network, secret, or host-path access by
   passing through a renderer.
2. Renderer failures must stay bounded in CPU time, output volume, filesystem
   reach, and tenant scope.
3. Immutable platform security settings must not be weakened by tenant or page
   content.
4. Generated diagnostics must remain useful without disclosing secrets, absolute
   host paths, or other tenants.
5. Cache and dependency decisions must be explicit enough to support later R9
   retirement work.

## Assets

- Tenant source trees and any allowlisted include targets
- Host secrets present in the build environment
- Renderer toolchains: Mermaid runtime, TeX converter, PlantUML, Graphviz, fonts
- Build host filesystem outside the tenant root
- Generated HTML, SVG, and cache artifacts
- Diagnostics, logs, and build metadata exposed to authors/operators

## Actors

- Trusted operator configuring toolchains and policy
- Trusted build pipeline invoking renderers
- Untrusted author content in Markdown, `.tex`, Mermaid, and PlantUML sources
- Malicious dependency or vulnerable renderer output
- Adjacent tenant attempting cache or path collisions

## Trusted Host Assumptions

- The operator pins renderer binaries and local JS dependencies before enabling
  a renderer in production.
- The build host can create temporary directories and enforce process kills.
- Renderer invocations are launched only through an allowlisted absolute command
  path, never through a shell string or tenant-controlled executable name.
- Secrets are not intentionally injected into renderer-specific override env vars.

## Trust Boundaries

1. Author content to parser/adapter boundary.
   Raw Markdown, `.tex`, Mermaid, and PlantUML are untrusted input.
2. In-process renderer boundary.
   Mermaid and KaTeX receive bounded strings plus immutable baseline config.
3. External subprocess boundary.
   LaTeX and PlantUML conversions execute in isolated child processes with a
   scrubbed env, explicit cwd, and output/time bounds.
4. Filesystem boundary.
   Allowlisted includes resolve relative to a tenant root and must survive
   symlink containment checks before the subprocess sees them.
5. Output and diagnostics boundary.
   Generated markup and error details are treated as untrusted until normalized
   and redacted.

## Data Flow Summary

1. Author submits rich-content source.
2. Adapter validates syntax and merges it with immutable renderer baselines.
3. Optional includes resolve through tenant-root containment checks.
4. External renderers run as allowlisted commands with scrubbed env and bounded
   stdout/stderr/time budgets.
5. Generated artifacts move into normalization/sanitization and later cache
   storage.
6. Diagnostic text passes through redaction before it is emitted to logs or CLI.

## Abuse Cases

| Abuse case | Target | Expected control |
|---|---|---|
| Mermaid frontmatter/directives try to set `securityLevel: loose` | Browser/runtime integrity | Immutable Mermaid baseline blocks authored overrides |
| TeX document attempts shell escape or package auto-install | Host integrity | `allowShellEscape: false`, `allowPackageInstall: false`, no shell command invocation |
| PlantUML `!include` points outside tenant root or to URL | Host secrecy | Relative-only path resolution, URL rejection, symlink containment, SANDBOX default |
| Renderers inherit `GITHUB_TOKEN`, cloud creds, or SSH secrets | Secret confidentiality | Scrubbed env allowlist with secret-key rejection |
| Malicious diagram emits infinite/huge output or hangs | Build availability | Timeout, stdout/stderr byte ceilings, reliable termination |
| Diagnostics reveal `/srv/...`, `/home/...`, or tokens | Privacy and cross-tenant isolation | Structured diagnostic redaction |
| Cache key or artifact path collides across tenants | Tenant separation | Future cache identity must include tenant identity, renderer version, profile, and toolchain pins |

## STRIDE Analysis

| Category | Threat | Control set | Residual risk |
|---|---|---|---|
| Spoofing | Tenant content impersonates operator policy by embedding weaker Mermaid or renderer flags | Frozen profile merge, immutable path list, allowlisted command paths | Low after integration |
| Tampering | Includes or symlinks redirect renderer reads outside tenant root | Relative-only path parsing plus realpath containment checks | Low for reads; still depends on caller using the helper everywhere |
| Repudiation | Failures cannot be traced because diagnostics are stripped too aggressively | Redaction preserves relative tenant path context and renderer failure class | Low |
| Information Disclosure | Env vars, absolute host paths, or cross-tenant files leak through subprocess or logs | Scrubbed env, path containment, diagnostic redaction | Low; deployment must retain the qualified container boundary |
| Denial of Service | Recursive includes, macro expansion, or verbose output stall builds | Timeout, kill grace, source/file/stdout/stderr ceilings, container CPU/memory/PID limits | Low within the qualified container profile |
| Elevation of Privilege | Shell strings or PATH lookup execute attacker-controlled binaries | Absolute allowlisted commands only, `shell: false` | Low after integration |

## Required Controls

### Immutable Profiles

- Mermaid baseline targets version `11.16.0` (published 2026-06-25) with
  `securityLevel: strict`, `startOnLoad: false`, `suppressErrorRendering: true`,
  bounded `maxTextSize`, bounded `maxEdges`, and a secure-key list that authored
  content cannot weaken.
- LaTeX page mode defaults to `allowShellEscape: false`, `allowNetwork: false`,
  `allowPackageInstall: false`, `allowAbsolutePaths: false`, and
  `allowParentTraversal: false`.
- PlantUML defaults to `securityProfile: SANDBOX` with network and external
  include access disabled.

### Environment Handling

- Renderer subprocesses inherit only a minimal allowlist (`PATH`, locale, temp
  dir, OS path helpers) plus operator-supplied non-secret overrides.
- Secret-shaped env keys are rejected from renderer-specific overrides.
- Build secrets remain outside renderer envs by default.

### Path and Include Handling

- Requested include paths must be tenant-relative, non-URL, non-absolute, and
  free of `..` traversal segments.
- Existing path segments resolve through `realpath` so symlink hops cannot escape
  the tenant root.
- Missing leaf paths may be tolerated only after every existing ancestor has
  passed containment.

### Subprocess Execution

- Every renderer command must be an explicit absolute path present in an
  operator-provided allowlist.
- `shell: false` is mandatory.
- Timeout and stdout/stderr byte ceilings terminate runaway renderers.
- Reliable termination uses a short `SIGTERM` grace period followed by `SIGKILL`.

### Diagnostics

- Diagnostics replace tenant roots with symbolic labels such as
  `<tenant-root>/content/page.tex`.
- Generic absolute paths collapse to `<abs-path>`.
- Secret assignments and sensitive query parameters are redacted.

## Verification Plan

- Unit tests prove immutable profile rejection, env scrubbing, relative path
  enforcement, symlink escape rejection, timeout/output kills, and diagnostic
  redaction.
- Integrated verification now includes container CPU/memory/PID and read-only
  filesystem limits, generated SVG/HTML normalization, tenant-scoped cache
  identity/integrity tests, and exact dependency/checksum/license evidence for
  Mermaid, PlantUML, Graphviz, LaTeXML, Tectonic, and fonts.

## Residual Risks

1. Operators enabling external renderers must retain the qualified disposable,
   non-root, networkless, read-only container profile. Running the binaries
   directly on an unrestricted host is outside the validated boundary.
2. The repository-wide dependency audit remains conditional on #179's release-age
   cooldown, although the renderer dependencies themselves are exact and the
   remaining advisories are not in their dependency paths.
3. Newly supported packages, renderer versions, or output formats require corpus
   and sanitizer requalification before entering the standard profile.

## R6 / R9 Disposition

### R6: TeX/diagram renderer arbitrary access or resource exhaustion

- **Current disposition:** Retired for the qualified default profiles.
- **Evidence:** immutable baselines, env scrubbing, path/symlink containment,
  allowlisted subprocesses, timeout/output termination, hostile corpus tests,
  and a non-root networkless/read-only container with CPU/memory/PID ceilings.

### R9: Renderer dependency drift or vulnerable generated markup

- **Current disposition:** Mitigated and monitored.
- **Evidence:** exact KaTeX/Mermaid versions with lockfile integrity; pinned image,
  package, JAR, and binary digests/checksums; recorded licenses; advisory
  fixtures; deterministic generated-markup sanitization; and a gated external
  renderer workflow. #179 tracks the unrelated residual repository audit items.

## Gate Summary

- Threat model created: yes
- Assets, trust boundaries, actors, abuse cases, controls, residual risks, and
  verification documented: yes
- Reusable security primitives integrated into all external renderer call sites: yes
- Tests covering profile immutability, env scrubbing, path containment, timeout
  and output bounds, and diagnostic redaction: yes
- R6 retired for qualified profiles; R9 mitigated with upgrade monitoring: yes
