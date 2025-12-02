# ADR-004: Tenant Routing with Caddy and Atomic Symlinks

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team

## Context

The Pagenary publisher component requires dynamic multi-tenant routing to serve static documentation sites. Each tenant's content is served from a dedicated domain that maps to their specific distribution directory.

### Problem Statement

- Multi-tenant platform needs domain-based routing (e.g., `tenant-alpha.local` to `dist/tenant-alpha/`)
- **NFR-1**: Tenants can trigger updates/redeployments at any time without scheduling constraints
- **NFR-2**: Updates must not cause downtime for other tenants (isolation guarantee)
- **NFR-3**: Minimal outage for the updating tenant (atomic swap requirement)
- Must align with the project's zero-dependency philosophy

### Current State

- Docker Caddy reverse proxy (caddy:2-alpine) serving static files
- Manual Caddyfile configuration for each tenant
- Direct writes to `dist/<tenant-id>/` directories
- No automated way to trigger configuration reloads

### Identified Gaps

1. Manual configuration requires editing Caddyfile for tenant changes
2. No coordination mechanism for config reloads after content updates
3. Direct writes risk serving partial updates during deployment
4. No centralized tenant registry or metadata source

## Decision

We will implement a Caddy-based routing solution with file-based tenant registry and atomic symlink deployment:

### 1. Caddy as Reverse Proxy

- Retain Caddy as the reverse proxy (already in use)
- Enable the admin API for graceful configuration reloads
- Generate Caddyfile programmatically from tenant registry

### 2. File-Based Tenant Registry

- Maintain tenant metadata in `tenants.json` (JSON format)
- Schema includes: tenant ID, enabled status, domain mappings, timestamps
- Git-friendly, version controlled, human readable

### 3. Dynamic Configuration Generation

- Node.js script generates Caddyfile from registry
- Validates configuration before applying
- Triggers Caddy graceful reload via admin API

### 4. Atomic Symlink Deployment

- Deploy new tenant versions to timestamped directories: `dist/tenant-alpha-{timestamp}/`
- Active version referenced via symlink: `dist/tenant-alpha/` pointing to current version
- Use POSIX atomic rename for symlink swap:
  ```bash
  ln -sfn tenant-alpha-v{timestamp} dist/tenant-alpha.tmp
  mv -Tf dist/tenant-alpha.tmp dist/tenant-alpha
  ```

### 5. Graceful Reload Protocol

- For content updates (existing tenant): Symlink swap only, no Caddy reload needed
- For configuration changes (new tenant/domain): Regenerate Caddyfile and trigger graceful reload
- Caddy validates new config before applying; auto-rollback on failure

### Architecture Diagram

```
                                      +-------------------+
                                      | Tenant Registry   |
                                      | (tenants.json)    |
                                      +--------+----------+
                                               |
                                               v
                                      +-------------------+
                                      | Config Generator  |
                                      | (Node.js script)  |
                                      +--------+----------+
                                               |
                                               v
+------------------+                  +-------------------+
| Client Requests  | ----HTTP---->   |  Caddy Server     |
| tenant-alpha.local                 |  (graceful reload)|
+------------------+                  +--------+----------+
                                               |
                                               v
                                      +-------------------+
                                      |  dist/            |
                                      |  +- tenant-alpha/ | (symlink)
                                      |  |  +- v1638360000/
                                      |  |  +- v1638370000/
                                      |  +- tenant-beta/  | (symlink)
                                      |     +- v1638365000/
                                      +-------------------+
```

### Directory Structure

```
apps/publisher/
+-- dist/
|   +-- tenant-alpha/              # Symlink to current version
|   +-- tenant-alpha-1638360000/   # Versioned deployment
|   +-- tenant-alpha-1638370000/   # Newer version
|   +-- tenant-beta/               # Symlink to current version
|   +-- tenant-beta-1638365000/
+-- tenants.json                   # Tenant registry
+-- scripts/
|   +-- generate-caddyfile.js      # Generate config from registry
|   +-- deploy-tenant.js           # Deploy with atomic swap
|   +-- cleanup-old-versions.js    # Garbage collection
|   +-- add-tenant.js              # Register new tenant
+-- Caddyfile                      # Generated (do not edit manually)
+-- docker-compose.yml
```

## Consequences

### Positive

- **Zero downtime for other tenants**: Caddy graceful reload processes new connections with new config while existing connections complete on old config
- **Near-zero downtime for updating tenant**: Atomic symlink swap completes in less than 1ms (single syscall)
- **No database required**: File-based registry aligns with zero-dependency philosophy
- **Works with existing setup**: Minimal changes to Docker Caddy configuration
- **Git-friendly operations**: Registry and config changes are version controlled and reviewable
- **Simple rollback**: Flip symlink back to previous version directory
- **Natural versioning**: Timestamped directories provide deployment history

### Negative

- **Filesystem dependency**: Requires filesystem that supports atomic symlinks (POSIX-compliant systems)
- **Config generation overhead**: Requires running script to regenerate Caddyfile for tenant/domain changes
- **Version accumulation**: Old version directories require cleanup job (mitigated by automated cleanup script)
- **File-based limitations**: No query interface; acceptable for less than 1000 tenants

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Symlink race condition | Low | Medium | Use temp symlink + atomic mv pattern |
| Disk space exhaustion | Medium | High | Automated cleanup (keep N versions), monitoring alerts |
| Caddyfile generation error | Low | High | Validate config before applying, auto-rollback on failure |
| Registry corruption | Low | High | Git-tracked, easy to revert to known good state |
| Caddy reload edge cases under high traffic | Low | Medium | Automatic rollback, alerting, documented in SAD |

### NFR Validation

| Requirement | Status | Mechanism |
|-------------|--------|-----------|
| NFR-1: Updates at any time | Met | Scripts run on-demand, no scheduling constraints |
| NFR-2: No downtime for other tenants | Met | Caddy graceful reload + isolated symlinks |
| NFR-3: Minimal outage for updating tenant | Met | Atomic symlink swap (~0ms) |

## Alternatives Considered

### 1. Traefik with Docker Labels

**Approach**: Replace Caddy with Traefik using Docker label-based service discovery for automatic routing updates.

**Rejected because**:
- More complex infrastructure than needed for static file serving
- Requires Docker integration for full benefit
- Does not align with zero-dependency philosophy
- Overkill for the use case; adds complexity without proportional benefit

**Estimated effort**: 5-7 days (includes migration and learning curve)

### 2. Nginx with Dynamic Upstream

**Approach**: Replace Caddy with Nginx using server-side routing and SIGHUP for graceful reload.

**Rejected because**:
- Less elegant configuration syntax
- Slower reload mechanism compared to Caddy API
- No advantage over current Caddy setup
- Would require migration effort with no clear benefit

**Estimated effort**: 3-4 days (includes migration)

### 3. Blue-Green Deployment

**Approach**: Maintain two full copies of each tenant's content (blue and green), switch traffic between them.

**Rejected because**:
- 2x storage requirement per tenant
- Unnecessary complexity for static file content
- Atomic symlink provides equivalent guarantees with less overhead
- Over-engineered for the use case

**Estimated effort**: 4-5 days

### 4. Content-Addressable Storage

**Approach**: Store content by hash (git-like model), update routing to point to new hash.

**Rejected because**:
- Additional complexity in build pipeline
- Hash calculation overhead
- Storage management more complex
- Deduplication benefits minimal for distinct tenant content
- Over-engineered for simple static hosting

**Estimated effort**: 4-5 days

### 5. Caddy + File Registry + Atomic Symlinks (Current Choice)

**Accepted because**:
- Simple, proven patterns
- Minimal infrastructure changes
- Aligns with zero-dependency philosophy
- 2-3 day implementation effort
- Clear migration path if scale increases

## Implementation Notes

### Package.json Scripts

```json
{
  "scripts": {
    "config:generate": "node scripts/generate-caddyfile.js",
    "config:reload": "docker compose exec caddy caddy reload --config /srv/app/Caddyfile",
    "config:apply": "npm run config:generate && npm run config:reload",
    "deploy:tenant": "node scripts/deploy-tenant.js",
    "tenant:add": "node scripts/add-tenant.js",
    "tenant:cleanup": "node scripts/cleanup-old-versions.js"
  }
}
```

### Tenant Registry Schema

```json
{
  "version": "1.0",
  "tenants": [
    {
      "id": "tenant-alpha",
      "enabled": true,
      "domains": ["tenant-alpha.local"],
      "created": "2025-01-15T10:00:00Z",
      "updated": "2025-01-20T14:30:00Z"
    }
  ]
}
```

### Atomic Symlink Swap Commands

```bash
# Deploy new version to timestamped directory
rsync -a build/ dist/tenant-alpha-v$(date +%s)/

# Atomic swap using temp symlink and mv
ln -sfn tenant-alpha-v$(date +%s) dist/tenant-alpha.tmp
mv -Tf dist/tenant-alpha.tmp dist/tenant-alpha
```

### Future Migration Path

When tenant count exceeds approximately 100-500:
1. Migrate registry from JSON file to SQLite
2. Keep same generation scripts, change data source
3. Consider Caddy JSON config for programmatic generation
4. Evaluate sharding across multiple Caddy instances for 1000+ tenants

## References

- [Caddy Admin API Documentation](https://caddyserver.com/docs/api)
- [Caddy Reload Command](https://caddyserver.com/docs/command-line#caddy-reload)
- [Blue-Green Deployment Pattern](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- POSIX mv(1) atomicity guarantees
- Internal Research: `/home/manitcor/integro/dbbuilder/.aiwg/working/routing-spike/tenant-routing-research.md`
