# ADR-001: Read/Write Path Segregation

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team

---

## Context

Pagenary is a multi-tenant static documentation publisher that enables resellers to package shared documentation templates into tenant-specific branded bundles. The platform faces several architectural challenges:

### Business Requirements
- Multi-tenant documentation platform must serve content efficiently and securely
- Resellers need to white-label documentation for their customers
- Hosting costs must be minimized (target: <$5/month per tenant)
- Platform must support deployment to any static hosting provider

### Technical Challenges
- Content management (editing, versioning, approval) has fundamentally different requirements than content delivery
- Security requirements differ significantly between authoring and viewing
- Performance optimization strategies conflict between dynamic management and static serving
- Need to support zero-downtime updates for individual tenants without affecting others

### Quality Attribute Priorities
1. **Security**: Minimal attack surface for published content
2. **Portability**: Deploy to any static host without modification
3. **Cost Efficiency**: Near-zero runtime infrastructure costs
4. **Reliability**: Inherent availability through static files
5. **Maintainability**: Simple, understandable codebase

---

## Decision

**Completely separate the Read Path (content delivery) from the Control Path (content management).**

### Read Path (Content Delivery)
- **Technology**: Static JavaScript, HTML, CSS deployed as self-contained bundles
- **Deployment**: CDN, S3, Cloudflare Pages, Netlify, Vercel, or self-hosted static servers
- **Routing**: Hash-based client-side routing (`#/page-id`) for maximum host compatibility
- **Optimization Focus**: Caching, performance, minimal attack surface
- **Runtime Dependencies**: Zero (no server-side execution)

### Control Path (Content Management)
- **Technology**: Git repositories + CI/CD pipelines + Node.js build scripts
- **Components**:
  - Tenant Registry (`tenants.json`) - source of truth for active tenants
  - Build Pipeline (`build.js`, `build-tenants.js`) - generates static bundles
  - Config Generator - produces Caddyfile from tenant registry
  - Deployment Manager - atomic symlink swap for zero-downtime updates
- **Optimization Focus**: Verification, auditability, security, transactional integrity

### Architectural Boundary

```
+-----------------------------------------------------------------------------+
|                              CONTROL PATH                                    |
|                                                                              |
|  +----------------+    +----------------+    +------------------------+      |
|  | Tenant         |    | Build          |    | Deployment             |      |
|  | Registry       |--->| Pipeline       |--->| Manager                |      |
|  | (JSON in Git)  |    | (Node.js)      |    | (Atomic Symlink)       |      |
|  +----------------+    +----------------+    +------------------------+      |
|                                                       |                      |
|                                                       v                      |
|                           +------------------------------------+             |
|                           |   OUTPUT: dist/<tenant-id>/        |             |
|                           +------------------------------------+             |
+-----------------------------------------------------------------------------+
                                        |
                          ============ BOUNDARY ============
                                        |
                                        v
+-----------------------------------------------------------------------------+
|                               READ PATH                                      |
|                                                                              |
|   +--------------------------------------------------------------------+    |
|   |                    Static Bundles (per tenant)                      |    |
|   |                                                                     |    |
|   |   - index.html (SPA shell)                                          |    |
|   |   - app.js (vanilla JS, ES modules)                                 |    |
|   |   - styles.css                                                      |    |
|   |   - manifest.js (navigation data)                                   |    |
|   |   - content/ (pre-rendered HTML, processed Markdown)                |    |
|   |                                                                     |    |
|   +--------------------------------------------------------------------+    |
|                                                                              |
|   Served via: CDN / Static Host / Caddy                                     |
|   No server-side execution whatsoever                                       |
+-----------------------------------------------------------------------------+
```

---

## Consequences

### Positive

1. **Minimal Attack Surface on Read Path**
   - Static files have essentially zero server-side vulnerabilities
   - No database connections, no authentication endpoints, no API to exploit
   - Security posture: defense in depth by elimination

2. **Independent Optimization per Path**
   - Read path: Aggressive caching at CDN, edge, browser levels
   - Control path: Comprehensive validation, audit logging, security checks
   - Neither path compromises the other's optimization strategy

3. **Maximum Caching Potential**
   - Static files can be cached at every network layer
   - CDN edge nodes serve content without origin requests
   - Long cache TTLs with cache-busting via hashed filenames

4. **Clear Security Boundaries**
   - Control path can implement strict access control (Git SSH keys, CI/CD secrets)
   - Read path requires no authentication for public documentation
   - Secrets never touch the read path

5. **Cost Efficiency**
   - Zero runtime servers for content delivery
   - CDN pricing for bandwidth only
   - Scales to millions of requests at minimal cost

6. **Deployment Flexibility**
   - Bundles deploy to any static host without modification
   - No vendor lock-in for hosting
   - Easy migration between providers

7. **Tenant Isolation by Design**
   - Each tenant has a completely separate bundle
   - No shared runtime state between tenants
   - Tenant A's update cannot affect Tenant B

### Negative

1. **Increased Architectural Complexity**
   - Two distinct systems to understand and maintain
   - More moving parts in the overall solution
   - Developers must understand the boundary

2. **Non-Instant Updates**
   - Changes require build/deploy cycle (typically 5-30 seconds)
   - Cannot have true real-time content updates
   - Preview requires build step

3. **Synchronization Management**
   - Must ensure control path and read path stay in sync
   - Failed builds leave read path with stale content
   - Need monitoring to detect sync failures

4. **Limited Dynamic Features**
   - No server-side personalization
   - No dynamic content without client-side JavaScript
   - Search must be client-side or pre-indexed

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Build pipeline becomes single point of failure | Medium | High | Redundant CI/CD, manual deploy fallback |
| Inconsistency if sync fails | Low | Medium | Automated health checks, alerting on stale content |
| Complex debugging across paths | Low | Low | Clear logging, tracing build -> deploy |

---

## Alternatives Considered

### Alternative 1: Traditional CMS (Monolithic)

**Description**: Single system handles both content management and content delivery (WordPress, Drupal, custom CMS).

**Evaluation**:
- Pro: Single system to maintain
- Pro: Instant content updates
- Pro: Familiar pattern for many developers

**Rejected Because**:
- Attack surface includes all management functionality
- Database becomes single point of failure
- Harder to cache (dynamic pages, session handling)
- Scaling requires application servers, not just CDN
- Multi-tenant isolation requires complex database design
- Hosting costs scale with compute, not just bandwidth

### Alternative 2: Headless CMS with API

**Description**: Content stored in headless CMS (Contentful, Strapi, Sanity), served via API at runtime.

**Evaluation**:
- Pro: Clean separation of concerns
- Pro: Rich content modeling features
- Pro: Real-time content updates

**Rejected Because**:
- Still requires runtime API calls for every page load
- Cannot cache as aggressively (API responses expire)
- Attack surface includes API endpoints
- Added dependency on CMS provider
- API latency adds to page load time
- Multi-tenant requires careful API key management

### Alternative 3: Static Site Generator with Server Rendering

**Description**: Use frameworks like Next.js, Nuxt, or Gatsby with server-side rendering.

**Evaluation**:
- Pro: Modern developer experience
- Pro: SEO benefits from SSR
- Pro: Hybrid static/dynamic possible

**Rejected Because**:
- Requires Node.js server for SSR (runtime dependency)
- Framework dependency contradicts zero-dependency philosophy
- Increased complexity for minimal benefit in documentation use case
- SSR hosting more expensive than static hosting

### Alternative 4: Current Choice - Static Site Generator (Vanilla)

**Description**: Pre-render everything to static files using vanilla JavaScript build pipeline.

**Accepted Because**:
- Simplest possible read path (static files)
- Best caching (aggressive TTLs, CDN-friendly)
- Minimal attack surface (no server execution)
- Zero-dependency philosophy (no framework lock-in)
- Aligns with all stated quality attributes
- Clear path to scale

---

## Implementation Notes

### Read Path Implementation
- SPA shell with hash-based routing
- Section templates render content to HTML strings
- Build pipeline copies shell + tenant config to dist/
- Deploy to any static host

### Control Path Implementation
- Git repositories store tenant configurations
- CI/CD triggers builds on push
- Build scripts generate static bundles
- Atomic symlink swap for zero-downtime deployment
- Caddyfile generation for self-hosted routing

### Key Files

| Component | Location | Purpose |
|-----------|----------|---------|
| SPA Shell | `apps/publisher/src/` | Runtime viewer |
| Build Pipeline | `apps/publisher/scripts/` | Bundle generation |
| Tenant Config | `apps/publisher/tenants/<id>/` | Per-tenant settings |
| Tenant Registry | `apps/publisher/tenants.json` | Active tenant list |
| Routing Config | `apps/publisher/Caddyfile` | Host-based routing |

---

## Related Decisions

- **ADR-002**: Zero-Dependency Philosophy
- **ADR-003**: Static JS Deployment Model
- **ADR-004**: Tenant Routing with Caddy + Atomic Symlinks
- **ADR-005**: File-Based Tenant Registry

---

## References

- Software Architecture Document: `.aiwg/architecture/software-architecture-doc.md`
- Routing Research: `.aiwg/working/routing-spike/tenant-routing-research.md`
- Architecture Notes: `apps/publisher/docs/ARCHITECTURE.md`

---

## Decision Log

| Date | Author | Action |
|------|--------|--------|
| 2025-12-01 | Architecture Team | Initial decision documented |
| 2025-12-01 | Architecture Team | Status: Accepted |
