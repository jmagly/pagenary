# Severity
P2 (high)

# Problem
`GIT_CREDENTIALS` is documented as supported authentication input but is not actually applied in runtime logic.

# Evidence
- Help text advertises it as a supported env var (`apps/publisher/scripts/build-tenants.js:184-186`).
- Error path recommends "Check SSH keys or GIT_CREDENTIALS" (`apps/publisher/scripts/build-tenants.js:554`).
- Search shows no actual read/use of `process.env.GIT_CREDENTIALS` in implementation.

# Impact
Hosted installs relying on HTTPS credential auth for private repos get misleading guidance and cannot use the stated token flow. Operators are forced toward SSH or ad hoc secrets wiring, increasing deployment friction and reducing consistency of private-repo hosting.

# Suggested fix
Implement `GIT_CREDENTIALS` support in a non-leaking manner (e.g., temporary `GIT_ASKPASS` helper or token-bearing URL transform limited to clone/fetch subprocesses) and add a regression test covering private HTTPS source auth.
