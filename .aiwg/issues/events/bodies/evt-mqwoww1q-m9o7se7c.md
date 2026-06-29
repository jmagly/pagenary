# Severity
P1 (critical)

# Problem
`build-tenants.js` executes git commands through a shell with unsanitized tenant-derived values. This enables shell injection if tenant registry values (`source.url`, `source.ref`, `source.path`, or generated `safeUrl`) are attacker controlled.

# Evidence
- `execWithRetry()` uses `spawn('sh', ['-c', command])` (`apps/publisher/scripts/build-tenants.js:291`).
- Git command strings are interpolated before execution in clone/update flow:
  - `git clone --depth ...` command built from `ref`, `url`, and `subPath` (`apps/publisher/scripts/build-tenants.js:515-530`, `516-533`).
  - `git -C "${cloneDir}" fetch ... ${ref}` (`apps/publisher/scripts/build-tenants.js:496-498`).
  - `git -C "${cloneDir}" checkout FETCH_HEAD` etc (`apps/publisher/scripts/build-tenants.js:499`).
  - Similar interpolation in `getHeadCommit()` and `getChangedFiles()` (`apps/publisher/scripts/build-tenants.js:367`, `388`).

# Impact
A crafted value can inject shell metacharacters and run arbitrary commands under the build worker identity. In hosted service mode this is equivalent to remote code execution against the worker host/runner.

# Suggested fix
- Replace shell-string execution with argument-vector `spawn()` for git commands.
- Validate `ref` with strict allow-list for branches/tags/SHA and block shell metacharacters entirely.
- Keep directory arguments path-normalized and quote-free by using non-shell form (`spawn('git', [...])`).
