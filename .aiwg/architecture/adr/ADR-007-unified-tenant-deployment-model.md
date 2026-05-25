# ADR-007: Unified Tenant Deployment Model

**Status**: Accepted
**Date**: 2025-12-02
**Decision Makers**: Architecture Team
**Supersedes**: Partial update to ADR-004

## Context

During Construction phase implementation, we refined the tenant deployment model to address practical concerns discovered during development and testing.

### Problem Statement

1. **Root site ambiguity**: The original architecture had a "base" site at `dist/` root with tenants at `dist/<tenant-id>/`. This created confusion:
   - Relative path resolution differed between root and tenant contexts
   - The serve.js dev server couldn't consistently route both modes
   - Unclear which content was "default" vs tenant-specific

2. **Development/Production parity**: Need consistent behavior between:
   - Local dev server (serve.js on port 5173)
   - Docker Caddy (production-like, port 5175)
   - Future production deployments

3. **Build flexibility**: Need to build individual tenants or all tenants, with optional deployment target for different strategies.

### Current State (Before This ADR)

- Base site at `dist/` with full manifest
- Tenants at `dist/tenant-alpha/`, `dist/tenant-beta/` with tenant-specific manifests
- Serve.js tried to serve both root and tenant paths
- Relative path issues when accessing `/tenant-alpha` vs `/tenant-alpha/`

## Decision

### 1. Promote Root Site to tenant-default

All sites are tenants. The "base" documentation site becomes `tenant-default`:

```
tenants/
├── tenant-alpha/      # Custom tenant with own manifest
├── tenant-beta/       # Custom tenant with own manifest
└── tenant-default/    # Empty - uses base src/ content
```

**Behavior**:
- `tenant-default` has no `manifest.json` or `content/` directory
- Build process copies base `src/` to `dist/tenant-default/`
- Full documentation manifest available as a tenant like any other

### 2. Tenant-Only Routing

The serve.js dev server and Caddy both enforce tenant-only routing:

**Serve.js (Development)**:
```
/                      → 302 redirect to /tenant-default/
/tenant-alpha          → 302 redirect to /tenant-alpha/
/tenant-alpha/         → Serves dist/tenant-alpha/index.html
/tenant-alpha/app.js   → Serves dist/tenant-alpha/app.js
/styles.css            → 404 (no root-level serving)
```

**Caddy (Production)**:
```
http://localhost:5175/           → Serves dist/tenant-default/
http://tenant-alpha.local:5175/  → Serves dist/tenant-alpha/
http://tenant-beta.local:5175/   → Serves dist/tenant-beta/
```

### 3. Trailing Slash Enforcement

Critical for relative path resolution in SPAs:

- `/tenant-alpha` redirects to `/tenant-alpha/`
- Ensures `./app.js` resolves to `/tenant-alpha/app.js` not `/app.js`
- Both serve.js and Caddy handle this consistently

### 4. Flexible Build Pipeline

Enhanced `build-tenants.js` with CLI arguments:

```bash
# List available tenants
node scripts/build-tenants.js --list

# Build all tenants
node scripts/build-tenants.js

# Build specific tenant(s)
node scripts/build-tenants.js tenant-alpha
node scripts/build-tenants.js tenant-alpha tenant-beta

# Build with deployment target
node scripts/build-tenants.js tenant-alpha --target /var/www/docs
node scripts/build-tenants.js --target /deploy/staging
```

**Options**:
- `--list`, `-l`: List available tenants
- `--target`, `-t`: Copy built tenant(s) to target directory
- `--help`, `-h`: Show usage help
- Positional args: Specify tenants to build (default: all)

### Architecture

```
Build Time:

  tenants/              build-tenants.js           dist/
  ├── tenant-alpha/ ─────────────────────────────► tenant-alpha/
  ├── tenant-beta/  ─────────────────────────────► tenant-beta/
  └── tenant-default/ ──(empty, uses src/)───────► tenant-default/
                                    │
                                    ▼ (if --target)
                              /deploy/target/
                              ├── tenant-alpha/
                              └── tenant-beta/

Runtime (serve.js):

  Browser                     serve.js                    dist/
     │                           │                          │
     ├── GET /  ────────────────►│                          │
     │◄─── 302 /tenant-default/ ─┤                          │
     │                           │                          │
     ├── GET /tenant-alpha ─────►│                          │
     │◄─── 302 /tenant-alpha/ ───┤                          │
     │                           │                          │
     ├── GET /tenant-alpha/ ────►├──► dist/tenant-alpha/ ──►│
     │◄─── index.html ───────────┤                          │

Runtime (Caddy):

  Browser                      Caddy                      dist/
     │                           │                          │
     ├── tenant-alpha.local ────►├──► dist/tenant-alpha/ ──►│
     ├── tenant-beta.local ─────►├──► dist/tenant-beta/ ───►│
     └── localhost ─────────────►├──► dist/tenant-default/ ►│
```

## Consequences

### Positive

- **Consistent mental model**: Everything is a tenant, no special "root" case
- **Relative paths work correctly**: Trailing slash enforcement ensures SPA routing works
- **Dev/prod parity**: serve.js and Caddy behave consistently
- **Flexible deployment**: Build individual tenants, copy to any target
- **Simpler debugging**: Each tenant is isolated in its own directory
- **Clear defaults**: `tenant-default` explicitly represents the base documentation

### Negative

- **Extra redirect on root**: Accessing `/` adds one redirect hop
- **Host entries required**: Local domain testing needs `/etc/hosts` configuration
- **Breaking change**: Old bookmarks to `/` or direct paths no longer work

### Migration

1. Create `tenants/tenant-default/` directory (empty)
2. Update serve.js with redirect logic
3. Update Caddyfile with `tenant-default` route
4. Rebuild all tenants: `npm run build:tenants`
5. Add hosts entries for local testing:
   ```
   127.0.0.1 tenant-alpha.local tenant-beta.local tenant-default.local
   ```

## Implementation Details

### serve.js Changes

```javascript
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'tenant-default';

// Redirect root to default tenant
if (pathname === '/' && tenantDirs.has(DEFAULT_TENANT)) {
  res.writeHead(302, { Location: `/${DEFAULT_TENANT}/` });
  res.end();
  return;
}

// Redirect tenant path without trailing slash
const tenantOnlyMatch = pathname.match(/^\/(tenant-[^/]+)$/);
if (tenantOnlyMatch && tenantDirs.has(tenantOnlyMatch[1])) {
  res.writeHead(302, { Location: `${pathname}/` });
  res.end();
  return;
}

// Only serve from tenant directories, not root
if (!tenant) {
  res.writeHead(404).end('Not Found - Please specify a tenant');
  return;
}
```

### Caddyfile Structure

```caddyfile
{
  auto_https off
  servers :5175 {
    protocols h1 h2c
  }
}

http://tenant-default.local:5175, http://localhost:5175 {
  root * dist/tenant-default
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}

http://tenant-alpha.local:5175 {
  root * dist/tenant-alpha
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}

http://tenant-beta.local:5175 {
  root * dist/tenant-beta
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}
```

### package.json Scripts

```json
{
  "scripts": {
    "build:tenants": "node scripts/build-tenants.js",
    "build:tenant": "node scripts/build-tenants.js",
    "tenants:list": "node scripts/build-tenants.js --list"
  }
}
```

## Relationship to Other ADRs

- **ADR-004** (Tenant Routing): This ADR refines the routing model. ADR-004's symlink-based deployment strategy remains valid for production; this ADR addresses the development experience and default tenant handling.
- **ADR-005** (File-Based Registry): The `tenants/` directory structure serves as the implicit registry. Explicit `tenants.json` registry still planned for production metadata.
- **ADR-003** (Static JS Deployment): Unchanged - all tenants are still static JS bundles.

## References

- ADR-004: Tenant Routing with Caddy and Atomic Symlinks
- ADR-005: File-Based Tenant Registry
- SPA routing and relative path resolution patterns
