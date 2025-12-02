# Supplemental Specification: Non-Functional Requirements

**Project:** Pagenary - Multi-Tenant Static Documentation Publisher
**Version:** 1.0
**Date:** 2025-12-01
**Status:** BASELINED

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Performance Requirements](#2-performance-requirements)
3. [Reliability Requirements](#3-reliability-requirements)
4. [Scalability Requirements](#4-scalability-requirements)
5. [Security Requirements](#5-security-requirements)
6. [Maintainability Requirements](#6-maintainability-requirements)
7. [Portability Requirements](#7-portability-requirements)
8. [Operability Requirements](#8-operability-requirements)
9. [Usability Requirements](#9-usability-requirements)
10. [Compliance Requirements](#10-compliance-requirements)
11. [Requirements Traceability](#11-requirements-traceability)

---

## 1. Introduction

### 1.1 Purpose

This Supplemental Specification documents all non-functional requirements (NFRs) for Pagenary, a multi-tenant static documentation publisher. Non-functional requirements define system qualities, constraints, and characteristics that are not directly related to specific features but are critical to system success.

### 1.2 Scope

This document covers:
- Performance targets for page load, build time, and search
- Reliability guarantees for availability and zero-downtime updates
- Scalability limits for tenants, sections, and concurrent users
- Security requirements for read path, tenant isolation, and data protection
- Maintainability standards for code quality, dependencies, and documentation
- Portability requirements for deployment flexibility
- Operability requirements for deployment, monitoring, and troubleshooting

### 1.3 Relationship to Other Documents

This document complements:
- **Use Case Specifications** (`use-cases.md`) - Defines functional behaviors
- **Software Architecture Document** (`.aiwg/architecture/software-architecture-doc.md`) - Describes architectural approaches to meet NFRs
- **Master Test Plan** (`.aiwg/testing/master-test-plan.md`) - Details how NFRs will be validated

### 1.4 Priority Levels

Non-functional requirements are prioritized using MoSCoW method:

| Priority | Description | Examples |
|----------|-------------|----------|
| **CRITICAL** | System unusable without this requirement | Zero-downtime updates, tenant isolation |
| **HIGH** | Major impact on user experience or operations | Page load time, build time |
| **MEDIUM** | Important but workaround exists | Rollback time, code coverage |
| **LOW** | Nice to have, minimal impact | Optional features, future enhancements |

---

## 2. Performance Requirements

### 2.1 Read Path Performance

#### NFR-P1: Page Load Time

**ID:** NFR-P1
**Priority:** HIGH
**Category:** Performance - User Experience

**Requirement:**
Documentation pages MUST load within 2 seconds on a 3G connection (1.6 Mbps download, 400ms RTT).

**Rationale:**
Fast page load is critical for user satisfaction and search engine ranking. Documentation users expect instant access to information.

**Measurement Methodology:**
- Use Chrome DevTools network throttling (Fast 3G profile)
- Measure `DOMContentLoaded` event timing
- Test with median tenant bundle size (5MB uncompressed, ~1.5MB gzipped)
- Measure from multiple geographic locations if CDN deployed

**Acceptance Criteria:**
- [ ] Initial page load (cold cache) <2 seconds on 3G
- [ ] Subsequent navigation (warm cache) <500ms
- [ ] Time to Interactive (TTI) <3 seconds on 3G
- [ ] First Contentful Paint (FCP) <1 second on 3G
- [ ] Largest Contentful Paint (LCP) <2.5 seconds (Google Core Web Vitals)

**Test Approach:**
- Automated Lighthouse performance tests in CI/CD
- Manual testing with throttled connection
- Real User Monitoring (RUM) in production (optional)

**Related Components:**
- SPA Shell (`app.js`, `styles.css`)
- CDN caching configuration
- Gzip/Brotli compression (Caddy)

---

#### NFR-P2: Build Time Per Tenant

**ID:** NFR-P2
**Priority:** HIGH
**Category:** Performance - Development/Operations

**Requirement:**
Tenant bundle build MUST complete within 30 seconds for typical tenant (50 sections, 2MB content).

**Rationale:**
Fast build times enable rapid iteration during content authoring and quick deployments for urgent updates.

**Measurement Methodology:**
- Measure total execution time of `npm run build:tenants [tenant-id]`
- Baseline: Sample tenant-alpha (15 sections, 500KB) builds in ~5 seconds
- Scaling factor: ~100ms per section, ~50ms per MB content

**Acceptance Criteria:**
- [ ] Tenant with 50 sections, 2MB content: <30 seconds
- [ ] Tenant with 100 sections, 5MB content: <60 seconds
- [ ] Tenant with 500 sections, 10MB content: <3 minutes
- [ ] Build with minification disabled: 50% faster than with minification
- [ ] Incremental build (single file change): <5 seconds (future enhancement)

**Test Approach:**
- CI/CD tracks build duration per tenant
- Alert if build exceeds threshold
- Performance regression tests comparing build times across commits

**Related Components:**
- `build-tenants.js` script
- Markdown parser
- terser minification
- File I/O operations

---

#### NFR-P3: Command Palette Search Performance

**ID:** NFR-P3
**Priority:** HIGH
**Category:** Performance - User Experience

**Requirement:**
Command palette search results MUST appear within 100ms of user input for typical tenant (100 sections).

**Rationale:**
Search is a critical navigation tool. Perceived lag >100ms makes search feel unresponsive.

**Measurement Methodology:**
- Measure time from keypress event to DOM update with results
- Use browser Performance API for precise timing
- Test with search index containing 100 sections, 5000 total words

**Acceptance Criteria:**
- [ ] Cold search (index not cached): <100ms
- [ ] Warm search (index cached in localStorage): <50ms
- [ ] Search scales linearly with section count (O(n) or better)
- [ ] Fuzzy matching does not exceed 2x time of exact matching
- [ ] No perceived UI freeze during search

**Test Approach:**
- Automated performance tests with mock search index
- Manual testing with production-scale tenant
- Browser profiling to identify bottlenecks

**Related Components:**
- Command palette UI (`app.js`)
- Search index generation (`build-tenants.js`)
- Fuzzy matching algorithm (Levenshtein distance)
- localStorage caching

---

### 2.2 Infrastructure Performance

#### NFR-P4: Static File Serving

**ID:** NFR-P4
**Priority:** MEDIUM
**Category:** Performance - Infrastructure

**Requirement:**
Static files MUST be served with sub-100ms response time at 95th percentile for CDN-cached requests.

**Rationale:**
Static file serving is delegated to CDN/host infrastructure. This requirement ensures appropriate deployment environment.

**Acceptance Criteria:**
- [ ] 95th percentile response time <100ms for cached files
- [ ] 99th percentile response time <500ms for cache misses
- [ ] Support HTTP/2 or HTTP/3 for multiplexing
- [ ] Gzip compression enabled with >60% size reduction
- [ ] Brotli compression enabled (if supported by host)

**Test Approach:**
- Load testing with Apache Bench or similar
- CDN analytics review
- Real User Monitoring (if available)

**Related Components:**
- CDN/host infrastructure (Netlify, Vercel, S3+CloudFront, Caddy)
- Caddy compression configuration

---

## 3. Reliability Requirements

### 3.1 Availability

#### NFR-R1: Read Path Availability

**ID:** NFR-R1
**Priority:** HIGH
**Category:** Reliability - Availability

**Requirement:**
Published tenant sites MUST achieve 99.9% availability (8.76 hours downtime per year) when deployed to CDN infrastructure.

**Rationale:**
Documentation availability is critical for customer support and operational efficiency. 99.9% is standard for static CDN-hosted sites.

**Measurement Methodology:**
- Uptime = (Total time - Downtime) / Total time
- Monitor with external uptime service (e.g., UptimeRobot, Pingdom)
- Exclude scheduled maintenance windows from calculation
- Measure per tenant (not aggregate)

**Acceptance Criteria:**
- [ ] 99.9% uptime over rolling 30-day period
- [ ] <5 minutes unplanned downtime per month
- [ ] Scheduled maintenance communicated 7 days in advance
- [ ] Downtime incidents logged with root cause analysis

**Test Approach:**
- Continuous uptime monitoring with alerts
- Monthly availability reports
- Incident postmortems for downtime >5 minutes

**Related Components:**
- CDN/host infrastructure SLA
- Health check endpoints
- Monitoring and alerting system

---

### 3.2 Zero-Downtime Updates

#### NFR-R2: Zero Downtime for Other Tenants During Update

**ID:** NFR-R2
**Priority:** CRITICAL
**Category:** Reliability - Tenant Isolation

**Requirement:**
When one tenant deploys an update, all other tenants MUST experience zero downtime and no service degradation.

**Rationale:**
Multi-tenancy requires strong isolation guarantees. One tenant's operations must never impact others.

**Measurement Methodology:**
- Deploy update to Tenant A
- Monitor HTTP requests to Tenant B during Tenant A deployment
- Measure request success rate, latency, and error rate for Tenant B
- Zero downtime = no failed requests, no increased latency

**Acceptance Criteria:**
- [ ] 100% request success rate for unaffected tenants during deployment
- [ ] No statistically significant latency increase for unaffected tenants
- [ ] No HTTP 5xx errors for unaffected tenants
- [ ] Caddy graceful reload completes without dropping connections
- [ ] Filesystem operations isolated to updating tenant directory

**Test Approach:**
- Automated integration tests with parallel requests
- Load testing scenario: Update Tenant A while hammering Tenant B with requests
- Verify Caddy reload behavior with test harness

**Technical Justification:**
- **Filesystem Isolation:** Each tenant has independent directory tree (`dist/tenant-a/`, `dist/tenant-b/`)
- **Symlink Isolation:** Symlink swap for tenant-a only modifies `dist/tenant-a` symlink, not tenant-b
- **Caddy Graceful Reload:** When Caddyfile changes, Caddy performs zero-downtime reload:
  - Existing connections continue with old configuration
  - New connections use new configuration
  - No requests dropped during transition
  - Reference: [Caddy Admin API - Config Reload](https://caddyserver.com/docs/api)

**Related Components:**
- Atomic symlink deployment (`deploy-tenant.js`)
- Caddy graceful reload
- Filesystem isolation

---

#### NFR-R3: Minimal Outage for Updating Tenant

**ID:** NFR-R3
**Priority:** CRITICAL
**Category:** Reliability - Deployment

**Requirement:**
Tenant content update MUST complete with less than 100ms effective downtime (atomic symlink swap).

**Rationale:**
Even the updating tenant should experience minimal disruption. 100ms is imperceptible to users and acceptable for any use case.

**Measurement Methodology:**
- "Effective downtime" = time between last successful request to old version and first successful request to new version
- Measure using automated test script making continuous requests during deployment
- Theoretical upper bound: <1ms (filesystem operation latency)
- Practical measurement: 0ms (no observable gap)

**Acceptance Criteria:**
- [ ] Atomic symlink swap completes in <1ms
- [ ] In-flight requests to old version complete successfully
- [ ] New requests see new version immediately after swap
- [ ] No HTTP 404 or 503 errors during transition
- [ ] No broken requests due to file disappearing mid-read

**Test Approach:**
- Continuous request test during deployment (1 request per 10ms)
- Verify all requests return 200 OK
- Verify content consistency (no partial old/new mix)

**Technical Justification:**
- **POSIX Atomicity:** The `rename()` system call (used by `mv -Tf`) is atomic per IEEE Std 1003.1 (POSIX.1-2017):
  > "If the link named by the new argument exists, it shall be removed and old renamed to new. In this case, a link named new shall remain visible to other processes throughout the renaming operation and refer either to the file referred to by new or old before the operation began."
- **In-Flight Request Handling:** Requests that opened file descriptors before swap continue reading from old version (file descriptor remains valid even if path changes)
- **New Request Handling:** Requests after swap resolve symlink to new version atomically

**Filesystem Compatibility:**
| Filesystem | Atomic Rename | Notes |
|------------|---------------|-------|
| ext4 | Yes | Default Linux, fully supported |
| xfs | Yes | Enterprise Linux, fully supported |
| btrfs | Yes | Copy-on-write, fully supported |
| NFS v4 | Conditional | Atomic on same server; cross-server not atomic |

**Related Components:**
- Atomic symlink deployment (`deploy-tenant.js`)
- POSIX filesystem operations (`fs.rename()`)

---

### 3.3 Data Integrity

#### NFR-R4: Build Integrity

**ID:** NFR-R4
**Priority:** HIGH
**Category:** Reliability - Data Integrity

**Requirement:**
Tenant bundle build process MUST validate data integrity before deployment to prevent broken content.

**Acceptance Criteria:**
- [ ] Manifest JSON schema validation
- [ ] All content files referenced in manifest exist
- [ ] HTML/Markdown content parses without errors
- [ ] JavaScript modules execute without syntax errors
- [ ] Checksum validation for copied files
- [ ] Failed builds do not deploy

**Test Approach:**
- Unit tests for validation functions
- Integration tests with intentionally broken content
- CI/CD fails on validation errors

**Related Components:**
- `build-tenants.js` (validation logic)
- `lint-content.js` (content checks)
- Deployment script (checksum validation)

---

## 4. Scalability Requirements

### 4.1 Tenant Scalability

#### NFR-S1: Support 100+ Tenants

**ID:** NFR-S1
**Priority:** HIGH
**Category:** Scalability - Multi-Tenancy

**Requirement:**
Platform MUST support at least 100 active tenants on a single deployment instance without performance degradation.

**Rationale:**
File-based tenant registry and routing configuration must scale to support business growth.

**Acceptance Criteria:**
- [ ] 100 tenant entries in `tenants.json` without parsing issues
- [ ] Caddyfile with 100 host blocks loads in <5 seconds
- [ ] Caddy graceful reload with 100 tenants completes in <10 seconds
- [ ] Disk space usage scales linearly (~5MB per tenant)
- [ ] Routing performance does not degrade with tenant count

**Test Approach:**
- Load testing with 100 sample tenants
- Measure Caddy startup and reload times
- Profile `generate-caddyfile.js` performance

**Scalability Limit:**
- Current architecture supports ~1000 tenants with file-based registry
- Beyond 1000 tenants, migrate to SQLite or database-backed registry

**Related Components:**
- `tenants.json` registry
- `generate-caddyfile.js` script
- Caddy configuration

---

#### NFR-S2: Support 1000+ Sections Per Tenant

**ID:** NFR-S2
**Priority:** HIGH
**Category:** Scalability - Content Volume

**Requirement:**
Tenant bundle MUST support at least 1000 documentation sections without performance degradation.

**Rationale:**
Large enterprises may have extensive documentation. Platform must handle large content volumes.

**Acceptance Criteria:**
- [ ] Manifest with 1000 section entries parses in <500ms
- [ ] Navigation sidebar with 1000 sections renders in <1 second
- [ ] Search index with 1000 sections builds in <5 seconds
- [ ] Command palette search across 1000 sections completes in <200ms
- [ ] Bundle size with 1000 sections (10MB content) is <5MB gzipped

**Test Approach:**
- Generate large synthetic tenant with 1000 sections
- Measure build time, page load, and search performance
- Profile browser performance with large navigation tree

**Related Components:**
- Manifest parsing (`app.js`)
- Navigation rendering
- Search index generation
- Gzip compression

---

### 4.2 Concurrent Users

#### NFR-S3: Support High Concurrent Users

**ID:** NFR-S3
**Priority:** MEDIUM
**Category:** Scalability - Concurrent Access

**Requirement:**
Published tenant site MUST handle at least 10,000 concurrent users without degradation when deployed to CDN.

**Rationale:**
Static site on CDN can handle essentially unlimited concurrent users. This requirement ensures appropriate deployment.

**Acceptance Criteria:**
- [ ] 10,000 concurrent users with <5% error rate
- [ ] Response time <2 seconds at 10,000 concurrent users
- [ ] CDN cache hit rate >90%
- [ ] Origin server handles cache misses without overload

**Test Approach:**
- Load testing with Apache Bench or similar
- Simulate 10,000 concurrent users accessing various pages
- Monitor CDN analytics for cache hit rate

**Related Components:**
- CDN infrastructure
- Caddy origin server (for cache misses)

---

## 5. Security Requirements

### 5.1 Read Path Security

#### NFR-SEC1: No Server-Side Code Execution in Read Path

**ID:** NFR-SEC1
**Priority:** CRITICAL
**Category:** Security - Attack Surface

**Requirement:**
Published tenant bundles MUST contain only static files (HTML, CSS, JavaScript). No server-side code execution is permitted in the read path.

**Rationale:**
Static-only deployment minimizes attack surface to near-zero. Server-side vulnerabilities (SQL injection, RCE, etc.) are impossible.

**Acceptance Criteria:**
- [ ] Tenant bundle contains only `.html`, `.css`, `.js`, image, and font files
- [ ] No server-side scripting languages (PHP, Python, Ruby, etc.)
- [ ] No database connections in read path
- [ ] No user input stored server-side
- [ ] All interactivity is client-side JavaScript

**Test Approach:**
- Automated bundle structure validation
- Security scanning of deployed sites (DAST)
- Code review of build pipeline

**Related Components:**
- SPA Shell (client-side JavaScript only)
- Static hosting infrastructure (CDN, S3, Caddy)

---

#### NFR-SEC2: Tenant Bundle Isolation

**ID:** NFR-SEC2
**Priority:** CRITICAL
**Category:** Security - Multi-Tenancy

**Requirement:**
Tenant bundles MUST be completely isolated with no shared runtime state or cross-tenant access.

**Rationale:**
Multi-tenant security requires strong isolation. One tenant must not be able to access or affect another tenant's content.

**Acceptance Criteria:**
- [ ] Each tenant has independent directory tree
- [ ] No shared JavaScript execution context between tenants
- [ ] No localStorage or cookie sharing between tenant domains
- [ ] Domain-based routing prevents cross-tenant requests
- [ ] Build process isolates tenant configurations

**Test Approach:**
- Automated isolation tests (attempt cross-tenant access)
- Security review of routing configuration
- Browser console verification (no shared variables)

**Related Components:**
- Filesystem structure (`dist/tenant-a/`, `dist/tenant-b/`)
- Caddy host-based routing
- Browser Same-Origin Policy

---

#### NFR-SEC3: HTTPS Required for Production

**ID:** NFR-SEC3
**Priority:** HIGH
**Category:** Security - Transport

**Requirement:**
All production tenant sites MUST be served over HTTPS with valid TLS certificates.

**Rationale:**
HTTPS prevents man-in-the-middle attacks, protects user privacy, and is required for modern browser features.

**Acceptance Criteria:**
- [ ] TLS 1.2 or higher
- [ ] Valid certificate from trusted CA (Let's Encrypt or commercial)
- [ ] HTTP requests automatically redirect to HTTPS
- [ ] HSTS header present (`Strict-Transport-Security`)
- [ ] No mixed content warnings

**Test Approach:**
- SSL Labs test (A rating or higher)
- Automated HTTPS redirect verification
- Browser security panel shows green lock

**Exemptions:**
- Local development (`*.local` domains) may use HTTP
- Internal testing environments behind VPN may use HTTP

**Related Components:**
- Caddy automatic HTTPS (Let's Encrypt integration)
- CDN SSL/TLS configuration

---

### 5.2 Content Security

#### NFR-SEC4: Content Sanitization

**ID:** NFR-SEC4
**Priority:** MEDIUM
**Category:** Security - XSS Prevention

**Requirement:**
User-provided HTML content MUST be sanitized during build to prevent XSS attacks.

**Rationale:**
While content authors are trusted, defense-in-depth requires sanitization to prevent accidental script injection.

**Acceptance Criteria:**
- [ ] HTML content sanitized with allowlist approach
- [ ] Script tags removed from user HTML
- [ ] Event handler attributes removed (`onclick`, etc.)
- [ ] JavaScript modules are trusted (authored by content team)
- [ ] Markdown-generated HTML is safe by default

**Test Approach:**
- Unit tests with XSS payloads
- Security scanning (SAST) of sanitization logic
- Manual testing with malicious HTML

**Related Components:**
- `build-tenants.js` (HTML sanitization)
- Markdown parser (safe by default)

---

#### NFR-SEC5: Security Headers

**ID:** NFR-SEC5
**Priority:** MEDIUM
**Category:** Security - Browser Protection

**Requirement:**
Production deployments MUST include security headers to enable browser-based protections.

**Acceptance Criteria:**
- [ ] `Content-Security-Policy` header restricts resource loading
- [ ] `X-Frame-Options: DENY` prevents clickjacking
- [ ] `X-Content-Type-Options: nosniff` prevents MIME sniffing
- [ ] `Strict-Transport-Security` enforces HTTPS
- [ ] `Referrer-Policy` limits referrer leakage

**Test Approach:**
- Automated header validation in CI/CD
- Security scanning tools (Observatory, Security Headers)

**Related Components:**
- Caddy header configuration
- CDN security settings

---

## 6. Maintainability Requirements

### 6.1 Code Quality

#### NFR-M1: Zero Runtime Dependencies

**ID:** NFR-M1
**Priority:** CRITICAL
**Category:** Maintainability - Dependencies

**Requirement:**
Published tenant bundles MUST have zero runtime dependencies. Build dependencies MUST be limited to essential tools.

**Rationale:**
Zero-dependency philosophy ensures long-term maintainability, no framework churn, and minimal security surface.

**Acceptance Criteria:**
- [ ] Published bundles contain only vanilla JavaScript (ES2020+)
- [ ] No React, Vue, Angular, or other frameworks
- [ ] No npm packages in browser bundles
- [ ] Build dependencies limited to: Node.js, terser (optional)
- [ ] No bundler required (webpack, rollup, parcel, etc.)

**Test Approach:**
- Automated dependency audit
- Code review enforces vanilla JavaScript
- CI/CD fails if new dependencies added

**Related Components:**
- SPA Shell (vanilla JavaScript)
- Build scripts (Node.js built-ins only)

---

#### NFR-M2: Build Dependency Constraints

**ID:** NFR-M2
**Priority:** HIGH
**Category:** Maintainability - Dependencies

**Requirement:**
Build process MUST limit dependencies to essential tools, avoiding complex framework ecosystems.

**Acceptance Criteria:**
- [ ] Total build dependencies <5 packages
- [ ] All dependencies have >1M weekly downloads (active maintenance)
- [ ] All dependencies have open-source licenses
- [ ] No deprecated packages
- [ ] Dependency update process documented

**Current Dependencies:**
- `terser`: 5.44.0 (JavaScript minification, optional)

**Test Approach:**
- Automated dependency scanning (npm audit, Dependabot)
- Quarterly dependency review
- CI/CD fails on deprecated dependencies

**Related Components:**
- `package.json` dependencies
- Build scripts

---

#### NFR-M3: Code Coverage

**ID:** NFR-M3
**Priority:** MEDIUM
**Category:** Maintainability - Testing

**Requirement:**
Automated test suite MUST achieve at least 70% code coverage for build pipeline and core application logic.

**Acceptance Criteria:**
- [ ] Overall coverage >70%
- [ ] Build scripts coverage >85%
- [ ] Section templates coverage >90%
- [ ] Manifest parsing coverage >90%
- [ ] Router logic coverage >80%
- [ ] Coverage tracked in CI/CD

**Test Approach:**
- Jest with coverage reporting
- CI/CD fails if coverage drops below threshold
- Coverage reports published per commit

**Related Components:**
- Jest test suite
- Coverage tools (nyc, Istanbul)

---

### 6.2 Documentation

#### NFR-M4: Comprehensive Documentation

**ID:** NFR-M4
**Priority:** MEDIUM
**Category:** Maintainability - Knowledge Transfer

**Requirement:**
Codebase MUST include comprehensive documentation for developers, operators, and content authors.

**Acceptance Criteria:**
- [ ] README with quick start guide
- [ ] Architecture documentation (ARCHITECTURE.md)
- [ ] Developer guide (DEVELOPER-GUIDE.md)
- [ ] Deployment guide (DEPLOYMENT.md)
- [ ] API documentation (API.md)
- [ ] Inline code comments for complex logic
- [ ] Runbooks for common operations

**Test Approach:**
- Documentation review by new team members
- Regular documentation updates with code changes

**Related Components:**
- `apps/publisher/docs/` directory
- Inline code comments

---

## 7. Portability Requirements

### 7.1 Deployment Flexibility

#### NFR-PORT1: Deploy to Any Static Host

**ID:** NFR-PORT1
**Priority:** CRITICAL
**Category:** Portability - Deployment

**Requirement:**
Tenant bundles MUST be deployable to any infrastructure that serves static files, without modification.

**Rationale:**
Avoids vendor lock-in, enables cost optimization by choosing cheapest or most appropriate hosting per tenant.

**Acceptance Criteria:**
- [ ] Hash-based routing works without server configuration
- [ ] No build-time assumptions about hosting environment
- [ ] No environment-specific code in bundles
- [ ] Deployment tested on: Netlify, Vercel, S3+CloudFront, GitHub Pages, self-hosted Caddy

**Test Approach:**
- Deploy sample tenant to each supported platform
- Verify functionality (navigation, search, export)

**Supported Platforms:**
- CDN platforms (Netlify, Vercel, Cloudflare Pages)
- Object storage + CDN (S3 + CloudFront, GCS + Cloud CDN)
- Self-hosted (Caddy, nginx, Apache)
- GitHub Pages, GitLab Pages

**Related Components:**
- Hash-based routing (no server rewrites needed)
- Static bundle structure

---

#### NFR-PORT2: Run Locally Without Network Access

**ID:** NFR-PORT2
**Priority:** HIGH
**Category:** Portability - Offline

**Requirement:**
Tenant bundles MUST be fully functional when opened locally via `file://` protocol without network access.

**Rationale:**
Enables offline documentation access, airgapped environments, and local development without dependencies.

**Acceptance Criteria:**
- [ ] All functionality works with `file://` URLs
- [ ] No external CDN dependencies (fonts, libraries)
- [ ] No API calls to external services
- [ ] Navigation, search, and export work offline
- [ ] Browser console shows no network errors

**Test Approach:**
- Manual testing with network disabled
- Automated tests with `file://` protocol

**Related Components:**
- SPA Shell (no external dependencies)
- Inline styles and scripts

---

#### NFR-PORT3: No Vendor Lock-In

**ID:** NFR-PORT3
**Priority:** HIGH
**Category:** Portability - Vendor Independence

**Requirement:**
Platform MUST avoid proprietary technologies or vendor-specific features that prevent migration.

**Acceptance Criteria:**
- [ ] No platform-specific APIs (AWS Lambda, Netlify Functions, etc.)
- [ ] No proprietary build tools or frameworks
- [ ] Configuration files are standard formats (JSON, YAML)
- [ ] Migration guide documents switching hosting providers
- [ ] Export functionality allows full data extraction

**Test Approach:**
- Periodic migration tests between platforms
- Review of technology choices for lock-in risk

**Related Components:**
- Build scripts (Node.js, no cloud-specific tools)
- Deployment process (standard file copy)

---

## 8. Operability Requirements

### 8.1 Deployment Operations

#### NFR-O1: Tenants Can Update/Redeploy Anytime

**ID:** NFR-O1
**Priority:** CRITICAL
**Category:** Operability - Flexibility

**Requirement:**
Tenants MUST be able to trigger content updates and redeployments at any time without scheduling restrictions or platform approval.

**Rationale:**
Operational flexibility is critical for urgent documentation updates (hotfixes, incident response).

**Acceptance Criteria:**
- [ ] Deployments can occur 24/7 without maintenance windows
- [ ] No manual approval required for content updates
- [ ] Git push triggers automatic deployment
- [ ] Manual deployment script available for emergency use
- [ ] No queuing or throttling of deployments

**Test Approach:**
- Integration tests with CI/CD pipeline
- Manual deployment verification

**Related Components:**
- Git webhooks
- CI/CD pipeline
- Deployment scripts

---

#### NFR-O2: Automated Deployment

**ID:** NFR-O2
**Priority:** HIGH
**Category:** Operability - Automation

**Requirement:**
Tenant updates MUST deploy automatically via Git webhook or CI/CD pipeline without manual intervention.

**Acceptance Criteria:**
- [ ] Git push triggers CI/CD job
- [ ] Build and deployment fully automated
- [ ] Success/failure notifications sent automatically
- [ ] Manual deployment option available for troubleshooting
- [ ] Deployment logs preserved for audit

**Test Approach:**
- Integration tests with mock git push
- Verify end-to-end automation

**Related Components:**
- Git webhooks
- CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
- Notification system

---

#### NFR-O3: Rollback Within 5 Minutes

**ID:** NFR-O3
**Priority:** HIGH
**Category:** Operability - Recovery

**Requirement:**
Platform operators MUST be able to roll back a tenant deployment to the previous version within 5 minutes of detecting an issue.

**Rationale:**
Fast rollback minimizes impact of broken deployments or content errors.

**Acceptance Criteria:**
- [ ] Rollback script completes in <2 minutes
- [ ] Previous 3 versions retained for rollback
- [ ] Rollback uses same atomic symlink mechanism as deployment
- [ ] Rollback can be triggered manually or automatically
- [ ] Rollback notifications sent to relevant stakeholders

**Test Approach:**
- Manual rollback testing
- Automated rollback integration tests
- Time measurement from issue detection to rollback completion

**Related Components:**
- Deployment script with rollback function
- Versioned bundle directories
- Atomic symlink mechanism

---

### 8.2 Monitoring and Observability

#### NFR-O4: Health Check Endpoints

**ID:** NFR-O4
**Priority:** MEDIUM
**Category:** Operability - Monitoring

**Requirement:**
Each tenant site MUST provide a health check endpoint for automated monitoring.

**Acceptance Criteria:**
- [ ] `/health` or `/` endpoint returns 200 OK if site is accessible
- [ ] Health check does not require JavaScript execution
- [ ] External monitoring services can poll health endpoint
- [ ] Health check includes timestamp or version info

**Test Approach:**
- Automated health check testing in CI/CD
- Integration with monitoring service (UptimeRobot, Pingdom)

**Related Components:**
- Static health check page
- Monitoring service configuration

---

#### NFR-O5: Deployment Logging

**ID:** NFR-O5
**Priority:** MEDIUM
**Category:** Operability - Auditability

**Requirement:**
All deployment operations MUST be logged with timestamp, operator, tenant ID, and result status.

**Acceptance Criteria:**
- [ ] Structured logs (JSON or key=value format)
- [ ] Logs include: timestamp, tenant ID, operator, bundle hash, result
- [ ] Logs preserved for at least 90 days
- [ ] Logs searchable by tenant ID, timestamp, operator
- [ ] Failed deployments include error details

**Test Approach:**
- Verify log output format
- Query logs for historical deployments

**Related Components:**
- Deployment scripts (logging to stdout/file)
- Log aggregation system (optional)

---

## 9. Usability Requirements

### 9.1 Developer Experience

#### NFR-U1: Quick Start Time

**ID:** NFR-U1
**Priority:** MEDIUM
**Category:** Usability - Developer Onboarding

**Requirement:**
New developer MUST be able to build and run the platform locally within 15 minutes of cloning the repository.

**Acceptance Criteria:**
- [ ] README includes clear setup instructions
- [ ] Prerequisites clearly documented (Node.js 18+, Docker)
- [ ] Setup script automates common tasks
- [ ] Developer can build sample tenant in <5 commands
- [ ] Developer can view sample tenant in browser in <10 minutes

**Test Approach:**
- Onboarding test with new team member
- Time measurement from clone to running site

**Related Components:**
- README documentation
- Setup scripts
- Sample tenant configurations

---

#### NFR-U2: Intuitive Navigation

**ID:** NFR-U2
**Priority:** HIGH
**Category:** Usability - End User Experience

**Requirement:**
End users MUST be able to navigate documentation intuitively without training.

**Acceptance Criteria:**
- [ ] Sidebar navigation is self-explanatory
- [ ] Current page is clearly highlighted
- [ ] Breadcrumb trail shows location in hierarchy
- [ ] Search is discoverable (visible search box or Ctrl+K hint)
- [ ] Links use clear, descriptive text

**Test Approach:**
- Usability testing with representative users
- Analytics review (if available) for navigation patterns

**Related Components:**
- SPA Shell UI design
- Navigation sidebar
- Command palette

---

#### NFR-U3: Accessible Design

**ID:** NFR-U3
**Priority:** MEDIUM
**Category:** Usability - Accessibility

**Requirement:**
Published tenant sites SHOULD meet WCAG 2.1 Level AA accessibility standards.

**Acceptance Criteria:**
- [ ] All interactive elements keyboard accessible
- [ ] Sufficient color contrast (4.5:1 for text)
- [ ] Images include alt text
- [ ] Semantic HTML for screen readers
- [ ] ARIA labels where appropriate
- [ ] Skip-to-content link present

**Test Approach:**
- Automated accessibility scanning (axe, Lighthouse)
- Manual keyboard navigation testing
- Screen reader testing (optional)

**Related Components:**
- SPA Shell HTML structure
- CSS styling (color contrast)
- ARIA attributes

---

## 10. Compliance Requirements

### 10.1 Data Privacy

#### NFR-C1: No PII Collection

**ID:** NFR-C1
**Priority:** HIGH
**Category:** Compliance - Privacy

**Requirement:**
Platform MUST NOT collect or store Personally Identifiable Information (PII) without explicit consent.

**Rationale:**
Documentation is public content. No user accounts or personal data needed, simplifying compliance.

**Acceptance Criteria:**
- [ ] No user registration or login
- [ ] No cookies except strictly necessary (localStorage acceptable)
- [ ] No user tracking or analytics by default
- [ ] If analytics added, privacy-preserving (e.g., Plausible, no Google Analytics)
- [ ] Privacy policy documents data handling

**Test Approach:**
- Code review for data collection
- Cookie audit
- Privacy policy review

**Related Components:**
- SPA Shell (no user accounts)
- Analytics integration (if any)

---

#### NFR-C2: Open Source Licensing

**ID:** NFR-C2
**Priority:** LOW
**Category:** Compliance - Licensing

**Requirement:**
All code and dependencies MUST use permissive open-source licenses compatible with project goals.

**Acceptance Criteria:**
- [ ] Core platform uses MIT or Apache 2.0 license
- [ ] All dependencies use OSI-approved licenses
- [ ] No GPL dependencies (copyleft incompatible with proprietary use)
- [ ] License files included in repository

**Test Approach:**
- Dependency license audit
- Legal review if distributing to third parties

**Related Components:**
- LICENSE file
- package.json licenses

---

## 10A. Build Source Requirements (ADR-009)

### 10A.1 Git Source Support

#### NFR-B1: Git Source Cloning

**ID:** NFR-B1
**Priority:** HIGH
**Category:** Build - Source Fetching

**Requirement:**
Build pipeline MUST support cloning tenant content from git repositories with configurable branch, tag, or commit reference.

**Rationale:**
Most production content is stored in git repositories. Direct git integration eliminates need for pre-fetch scripts and enables true CI/CD workflows.

**Acceptance Criteria:**
- [ ] Support HTTPS and SSH git URLs
- [ ] Support branch, tag, and commit SHA references
- [ ] Support subdirectory extraction (path within repo)
- [ ] Shallow clone by default (depth=1) for performance
- [ ] Sparse checkout for monorepo efficiency (optional)
- [ ] Clone completes within 60 seconds for typical repo (<100MB)

**Test Approach:**
- Unit tests with mock git commands
- Integration tests with real public repositories
- Performance tests measuring clone duration

**Related Components:**
- `build-tenants.js` (git source handling)
- Git binary on build machine

---

#### NFR-B2: Git Authentication

**ID:** NFR-B2
**Priority:** HIGH
**Category:** Build - Security

**Requirement:**
Build pipeline MUST support authenticated access to private git repositories via SSH keys or HTTPS tokens without exposing credentials in logs or configuration.

**Rationale:**
Enterprise and private documentation repos require authentication. Credentials must be handled securely.

**Acceptance Criteria:**
- [ ] SSH key authentication via ssh-agent or GIT_SSH_COMMAND
- [ ] HTTPS token authentication via environment variable
- [ ] Credentials never logged to console
- [ ] Credentials never stored in registry file
- [ ] Support for GitHub App installation tokens (short-lived)
- [ ] Clear error message if auth fails (without exposing credentials)

**Test Approach:**
- Security review of credential handling
- Integration test with private repo
- Log audit for credential leakage

**Related Components:**
- `build-tenants.js` (credential handling)
- Environment variables (GIT_CREDENTIALS, GIT_SSH_COMMAND)

---

#### NFR-B3: Git Clone Caching

**ID:** NFR-B3
**Priority:** MEDIUM
**Category:** Build - Performance

**Requirement:**
Build pipeline SHOULD cache cloned repositories to avoid redundant fetches for unchanged content.

**Rationale:**
CI/CD pipelines may run multiple builds. Caching reduces network usage and build time.

**Acceptance Criteria:**
- [ ] Cache key based on URL + ref + path
- [ ] Immutable refs (tags, SHAs) reuse cached clone
- [ ] Mutable refs (branches) fetch to update
- [ ] Cache location configurable via CLI or environment
- [ ] Cache cleanup on build completion (default) or preserve (optional)
- [ ] Max cache age configurable (default 24 hours for branches)

**Test Approach:**
- Performance test: first clone vs cached clone
- Verify cache invalidation for branch updates

**Related Components:**
- `build-tenants.js` (cache management)
- `.cache/git/` directory

---

#### NFR-B4: Git Error Handling

**ID:** NFR-B4
**Priority:** HIGH
**Category:** Build - Reliability

**Requirement:**
Build pipeline MUST handle git clone failures gracefully with retry logic and clear error messages.

**Rationale:**
Network issues, auth failures, and missing refs are common. Clear errors help operators diagnose issues.

**Acceptance Criteria:**
- [ ] Retry network failures 3 times with exponential backoff
- [ ] Clear error for auth failure (without exposing credentials)
- [ ] Clear error for missing branch/tag/commit
- [ ] Clear error for missing subdirectory path
- [ ] 5-minute timeout per clone operation
- [ ] Failed tenant does not block other tenants

**Test Approach:**
- Unit tests with simulated failures
- Integration test with invalid refs

**Related Components:**
- `build-tenants.js` (error handling)

---

### 10A.2 NFR to ADR Mapping (Build Sources)

| NFR ID | ADR Reference | Description |
|--------|---------------|-------------|
| NFR-B1 | ADR-009 | Git source cloning with refs |
| NFR-B2 | ADR-009 | Git authentication |
| NFR-B3 | ADR-009 | Clone caching strategy |
| NFR-B4 | ADR-009 | Error handling and retries |

---

## 11. Requirements Traceability

### 11.1 NFR to Architecture Mapping

| NFR Category | Related Architectural Decisions | SAD Section |
|--------------|--------------------------------|-------------|
| **Performance** | Zero-dependency philosophy, Static deployment, CDN caching | 4.2 Read Path Components |
| **Reliability** | Atomic symlink swap, Caddy graceful reload, Per-tenant isolation | 5.4 Zero-Downtime Update Process |
| **Scalability** | File-based registry (up to 1000 tenants), Tenant directory structure | 6.4 Tenant Registry Model |
| **Security** | Read/write path segregation, Static-only read path, Domain isolation | 7. Security Architecture |
| **Maintainability** | Zero runtime dependencies, Vanilla JavaScript, Comprehensive docs | 2.1.5 Maintainability |
| **Portability** | Hash-based routing, No server dependencies, Standard formats | 2.1.2 Portability |
| **Operability** | Automated deployment, Git webhooks, Rollback mechanism | 5. Deployment Architecture |
| **Build Sources** | Git source type, Clone caching, Authentication | ADR-009 |

### 11.2 NFR to Component Mapping

| NFR ID | Primary Components | Test Components |
|--------|-------------------|----------------|
| NFR-P1 | `app.js`, `styles.css`, CDN | Lighthouse, network throttling |
| NFR-P2 | `build-tenants.js`, `terser` | CI/CD timing |
| NFR-P3 | Command palette, search index | Performance API tests |
| NFR-R1 | CDN infrastructure | Uptime monitoring |
| NFR-R2, NFR-R3 | `deploy-tenant.js`, atomic symlink | Integration tests |
| NFR-S1 | `tenants.json`, `generate-caddyfile.js` | Load testing |
| NFR-S2 | Manifest parsing, navigation rendering | Synthetic large tenants |
| NFR-SEC1 | Static bundle structure | DAST scanning |
| NFR-SEC2 | Filesystem isolation, Caddy routing | Security tests |
| NFR-SEC3 | Caddy TLS, CDN SSL | SSL Labs |
| NFR-M1, NFR-M2 | `package.json`, build scripts | Dependency audit |
| NFR-M3 | Jest test suite | Coverage reports |
| NFR-PORT1 | Hash routing, static bundles | Cross-platform tests |
| NFR-O1, NFR-O2 | CI/CD pipeline, Git webhooks | Deployment automation tests |
| NFR-O3 | Rollback script, versioned directories | Rollback timing tests |
| NFR-B1 | `build-tenants.js`, git binary | Clone integration tests |
| NFR-B2 | `build-tenants.js`, credential env vars | Security tests |
| NFR-B3 | `build-tenants.js`, `.cache/git/` | Performance tests |
| NFR-B4 | `build-tenants.js` error handling | Failure simulation tests |

### 11.3 NFR Priority Matrix

| Priority | NFR IDs | Summary |
|----------|---------|---------|
| **CRITICAL** | NFR-R2, NFR-R3, NFR-SEC1, NFR-SEC2, NFR-M1, NFR-PORT1, NFR-O1 | Zero-downtime, security, zero dependencies, deployment flexibility |
| **HIGH** | NFR-P1, NFR-P2, NFR-P3, NFR-R1, NFR-R4, NFR-S1, NFR-S2, NFR-SEC3, NFR-M2, NFR-PORT2, NFR-PORT3, NFR-O2, NFR-O3, NFR-U2, NFR-C1, NFR-B1, NFR-B2, NFR-B4 | Performance, reliability, scalability, portability, git sources |
| **MEDIUM** | NFR-P4, NFR-S3, NFR-SEC4, NFR-SEC5, NFR-M3, NFR-M4, NFR-O4, NFR-O5, NFR-U1, NFR-U3, NFR-B3 | Infrastructure, code quality, monitoring, usability, git caching |
| **LOW** | NFR-C2 | Licensing compliance |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-01 | Requirements Analyst Agent | Initial baseline |
| 1.1 | 2025-12-02 | Requirements Analyst Agent | Added Section 10A: Build Source Requirements (NFR-B1 to NFR-B4) per ADR-009 |

---

**End of Document**
