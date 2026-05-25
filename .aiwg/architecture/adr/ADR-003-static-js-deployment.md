# ADR-003: Static JavaScript Deployment Model

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team

## Context

Pagenary requires a deployment model for multi-tenant documentation that minimizes operational overhead while maximizing portability and reliability.

**Motivating Factors:**

- Need to deploy multi-tenant documentation with minimal operational cost
- Must work with any hosting provider (CDN, S3, GitHub Pages, etc.)
- Security through simplicity - no server-side execution
- Maximum cacheability for performance
- Tenants should be isolated from each other
- Documentation must remain accessible even during partial infrastructure failures

## Decision

Adopt a pure static JavaScript deployment model where complete bundles (HTML, CSS, JS) are built at deployment time.

**Key Implementation Details:**

- **Build-Time Bundling**: All content is compiled into static assets during the build phase
- **Hash-Based Client-Side Routing**: Use `#/page-id` routing pattern for navigation
- **Tenant Isolation**: Each tenant receives an independent bundle directory
- **No Runtime Dependencies**: No server-side rendering or API calls required for content delivery
- **Immutable Deployments**: Each deployment creates versioned, immutable file sets

**Deployment Structure:**

```
/static/
  /tenant-a/
    index.html
    bundle.[hash].js
    styles.[hash].css
    /assets/
  /tenant-b/
    index.html
    bundle.[hash].js
    styles.[hash].css
    /assets/
```

## Consequences

### Positive

- **Deploy Anywhere**: Compatible with any static host, CDN, or object storage (S3, GCS, Azure Blob, GitHub Pages, Cloudflare Pages, Netlify, etc.)
- **Zero Runtime Costs**: No compute costs beyond storage and bandwidth
- **Maximum Cache Effectiveness**: Immutable files with content-hashed names enable aggressive caching
- **No Server to Maintain**: Eliminates server patching, monitoring, and security concerns
- **Trivial Horizontal Scaling**: CDN handles global distribution automatically
- **Instant Failover**: Files replicated globally with no single point of failure
- **Predictable Performance**: No cold starts, no database queries, consistent response times
- **Security by Default**: No server-side execution means no server-side vulnerabilities

### Negative

- **Full Rebuild Required**: Updates require complete rebuild and deploy cycle
- **No Dynamic Content**: Real-time features require external APIs
- **Hash Routing Limitations**: SEO is limited with hash routing (less critical for documentation use case)
- **Cache Invalidation**: Large changes may require cache invalidation across CDN edge nodes
- **Build Time Scaling**: Build time increases with content volume (mitigated by incremental builds)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Bundle size growth with many sections | Medium | Medium | Implement code splitting and lazy loading |
| Hash routing breaks browser history expectations | Low | Low | Document behavior, implement proper history API integration |
| Long build times for large tenants | Medium | Low | Implement incremental builds, parallel processing |
| CDN cache inconsistency during deploy | Low | Medium | Use atomic deployments with versioned directories |

## Alternatives Considered

### 1. Server-Side Rendering (SSR)

Generate HTML on each request using Node.js or similar runtime.

**Pros:**
- SEO-friendly with proper meta tags
- Dynamic content possible
- Can personalize per request

**Cons:**
- Requires server infrastructure
- Operational complexity (monitoring, scaling, security patching)
- Cold start latency
- Higher cost at scale

**Decision**: Rejected - Adds unnecessary complexity for documentation use case

### 2. Hybrid (Static Site Generation + API)

Pre-render static pages but fetch dynamic content via API calls.

**Pros:**
- Balance of static performance and dynamic capability
- Can update content without full redeploy

**Cons:**
- Runtime API dependency
- More complex deployment
- API availability affects user experience

**Decision**: Rejected - Documentation does not require real-time updates

### 3. Fully Dynamic CMS

Traditional CMS approach where server renders everything on demand.

**Pros:**
- Maximum flexibility
- Immediate content updates
- Rich editing experience

**Cons:**
- Maximum operational complexity
- Highest cost
- Largest attack surface
- Database dependency
- Scaling challenges

**Decision**: Rejected - Overkill for documentation delivery

### 4. Pure Static with Hash Routing (Selected)

Pre-build complete bundles with client-side routing.

**Pros:**
- Simplest operational model
- Lowest cost
- Most portable
- Best reliability

**Cons:**
- No dynamic content
- SEO limitations (acceptable for docs)

**Decision**: Accepted - Best fit for documentation requirements

## Implementation Notes

### Build Pipeline

```
Source Files --> Build Process --> Static Bundle --> CDN Distribution
     |                |                  |                  |
  Markdown      Vite/Webpack        index.html         Edge Cache
   + Config       + Plugins         bundle.js           Global
                                   styles.css
```

### Routing Implementation

```javascript
// Hash-based routing for single-page application
window.addEventListener('hashchange', () => {
  const pageId = window.location.hash.slice(2); // Remove '#/'
  loadPage(pageId);
});
```

### Cache Strategy

| Asset Type | Cache Duration | Strategy |
|------------|---------------|----------|
| index.html | 5 minutes | Short cache, frequent revalidation |
| bundle.[hash].js | 1 year | Immutable, content-hashed |
| styles.[hash].css | 1 year | Immutable, content-hashed |
| /assets/* | 1 year | Immutable, content-hashed |

## References

- [The JAMstack Architecture](https://jamstack.org/)
- [Static Site Generation Best Practices](https://web.dev/rendering-on-the-web/)
- [CDN Caching Strategies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)

## Revision History

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-01 | Architecture Team | Initial decision |
