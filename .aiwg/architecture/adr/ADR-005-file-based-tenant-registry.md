# ADR-005: File-Based Tenant Registry

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team

## Context

What is the issue motivating this decision?

- Need to track tenant configurations (domain, bundle path, status)
- Must support dynamic Caddyfile generation
- Should align with zero-dependency philosophy
- Simplicity is a key priority

## Decision

What is the change being proposed/decided?

- Store tenant registry in a JSON file (tenants.json)
- Schema includes: id, domain, bundlePath, status, createdAt, updatedAt
- Generate Caddyfile from registry using Node.js script
- Version control the registry alongside code
- No database required

## Consequences

### Positive

- Zero runtime dependencies (just a file)
- Easy to version control and audit
- Portable across environments
- Simple to backup and restore
- Can be edited manually if needed

### Negative

- No concurrent write safety (single writer assumed)
- Limited query capabilities
- Must regenerate Caddyfile after changes
- May need database if tenant count exceeds ~1000

### Risks

- Concurrent writes could corrupt file (mitigated by deployment script locking)
- Performance degrades with many tenants (acceptable for current scale)

## Alternatives Considered

1. **SQLite**: Lightweight embedded database
   - Rejected: Adds complexity, not needed for current scale

2. **PostgreSQL/MySQL**: Full relational database
   - Rejected: Significant operational overhead

3. **Redis**: In-memory data store
   - Rejected: Another service to maintain

4. **Consul/etcd**: Service discovery
   - Rejected: Over-engineered for the use case

5. **JSON File (Current Choice)**: Simple file-based storage
   - Accepted: Simplest solution that works, can upgrade later if needed

## Migration Path

If scale requires database:

1. Export tenants.json to SQL insert statements
2. Add database adapter to config generator
3. Maintain file as backup/audit trail
