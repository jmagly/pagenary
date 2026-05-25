# ADR-008: External Tenant Source Model

**Status**: Accepted
**Date**: 2025-12-02
**Decision Makers**: Architecture Team
**Supersedes**: Extends ADR-005

## Context

The current tenant model assumes tenant content directories are co-located within the publisher project at `tenants/<tenant-id>/`. This works for development and testing but doesn't reflect real-world usage where:

1. **Tenant content lives elsewhere**: Documentation sources are typically in separate repositories, different directories, or managed by different teams
2. **Build and publish are separate concerns**: The publisher should take content from any source and publish to any target
3. **Multiple deployment targets**: Same content might publish to staging, production, or CDN locations

### Current Model (Before This ADR)

```
apps/publisher/
├── tenants/
│   ├── tenant-alpha/     # Source content here
│   │   ├── manifest.json
│   │   ├── config.json
│   │   └── content/
│   └── tenant-beta/
├── dist/
│   ├── tenant-alpha/     # Built output here (implicit)
│   └── tenant-beta/
```

### Problem Statement

- Tenant directories in `tenants/` are examples/fixtures, not production content
- No way to specify where content comes FROM
- No way to specify where builds go TO (beyond `--target` flag)
- Each tenant's source and target are potentially different

## Decision

### 1. Implement Tenant Registry with Source/Target Paths

Create `tenants.json` (as planned in ADR-005) with extended schema supporting external sources:

```json
{
  "tenants": [
    {
      "id": "tenant-alpha",
      "enabled": true,
      "source": {
        "type": "local",
        "path": "/path/to/tenant-alpha-docs"
      },
      "target": {
        "type": "local",
        "path": "/var/www/docs/tenant-alpha"
      },
      "domains": ["tenant-alpha.example.com"],
      "config": {
        "title": "Tenant Alpha Documentation",
        "brandMark": "Alpha"
      }
    }
  ],
  "defaults": {
    "source": {
      "type": "local",
      "path": "./tenants"
    },
    "target": {
      "type": "local",
      "path": "./dist"
    }
  }
}
```

### 2. Source Types

Initially support `local` paths, with extensibility for future types:

| Type | Description | Path Format |
|------|-------------|-------------|
| `local` | Local filesystem path | Absolute or relative to publisher root |
| (future) `git` | Git repository | `git@github.com:org/repo.git#branch` |
| (future) `s3` | S3 bucket | `s3://bucket/prefix` |

### 3. Target Types

| Type | Description | Path Format |
|------|-------------|-------------|
| `local` | Local filesystem path | Absolute or relative to publisher root |
| (future) `s3` | S3 bucket for static hosting | `s3://bucket/prefix` |
| (future) `ssh` | Remote server via SCP/rsync | `user@host:/path` |

### 4. Backwards Compatibility

When `tenants.json` is absent or a tenant is not in the registry:
- **Source default**: `./tenants/<tenant-id>/`
- **Target default**: `./dist/<tenant-id>/`

This preserves current behavior for the example tenants.

### 5. Registry Location

The registry can be specified via:

1. **Default**: `./tenants.json` in publisher root
2. **Environment variable**: `TENANT_REGISTRY=/path/to/tenants.json`
3. **CLI argument**: `--registry /path/to/tenants.json`

### 6. Updated CLI Interface

```bash
# Use default registry (tenants.json or fallback to tenants/ directory)
node scripts/build-tenants.js

# Specify registry explicitly
node scripts/build-tenants.js --registry /path/to/tenants.json

# Build specific tenant (uses registry for source/target resolution)
node scripts/build-tenants.js tenant-alpha

# Override target for all tenants (useful for CI/CD)
node scripts/build-tenants.js --target /deploy/staging

# List tenants from registry
node scripts/build-tenants.js --list
```

### 7. Config Resolution Order

Tenant configuration is resolved in this priority order:

1. `config` object in registry entry (inline)
2. `config.json` in tenant source directory
3. Built-in defaults

This allows registry-level overrides without modifying source directories.

## Architecture

```
Build Pipeline:

  tenants.json              build-tenants.js              Targets
  ┌─────────────┐          ┌─────────────────┐
  │ tenant-alpha│          │                 │
  │   source: A │────┐     │  1. Read source │────► /var/www/alpha/
  │   target: X │    │     │  2. Build       │
  ├─────────────┤    ├────►│  3. Write target│
  │ tenant-beta │    │     │                 │
  │   source: B │────┘     │                 │────► /cdn/beta/
  │   target: Y │          │                 │
  └─────────────┘          └─────────────────┘

  External Sources:

  /home/user/docs/alpha/    ─────► tenant-alpha source
  /repos/product-docs/      ─────► tenant-beta source
  ./tenants/tenant-default/ ─────► fallback (local example)
```

## Consequences

### Positive

- **Separation of concerns**: Content management is decoupled from publisher
- **Flexible deployment**: Different targets per tenant
- **CI/CD friendly**: Registry can be environment-specific
- **Backwards compatible**: Existing tenants/ structure still works
- **Explicit configuration**: Source and target are documented, not implicit

### Negative

- **Configuration overhead**: Need to maintain registry for production deployments
- **Path management**: Must ensure source paths are accessible at build time
- **No built-in sync**: Doesn't fetch from remote sources (must be pre-fetched)

### Migration

1. Existing projects continue working without changes (fallback behavior)
2. Create `tenants.json` when ready to use external sources
3. Gradually migrate tenants from `tenants/` to external locations

## Implementation Notes

### Registry Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "tenants": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id"],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "enabled": { "type": "boolean", "default": true },
          "source": {
            "type": "object",
            "properties": {
              "type": { "enum": ["local"], "default": "local" },
              "path": { "type": "string" }
            }
          },
          "target": {
            "type": "object",
            "properties": {
              "type": { "enum": ["local"], "default": "local" },
              "path": { "type": "string" }
            }
          },
          "domains": { "type": "array", "items": { "type": "string" } },
          "config": { "type": "object" }
        }
      }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "source": { "type": "object" },
        "target": { "type": "object" }
      }
    }
  }
}
```

### Path Resolution

- Relative paths resolve from publisher root (`apps/publisher/`)
- Absolute paths used as-is
- Environment variables expanded: `$HOME/docs` or `${DOCS_ROOT}/tenant`

## Relationship to Other ADRs

- **ADR-005** (File-Based Registry): This ADR implements and extends the registry concept
- **ADR-007** (Unified Tenant Model): tenant-default continues as a local example tenant
- **ADR-004** (Tenant Routing): Caddyfile generation reads domains from registry

## References

- ADR-005: File-Based Tenant Registry
- ADR-007: Unified Tenant Deployment Model
- 12-Factor App: Config in Environment
