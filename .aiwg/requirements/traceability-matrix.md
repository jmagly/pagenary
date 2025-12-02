# Requirements Traceability Matrix

**Project:** Pagenary - Multi-Tenant Static Documentation Publisher
**Version:** 1.0
**Date:** 2025-12-01
**Status:** BASELINED

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Use Case to SAD Component Traceability](#2-use-case-to-sad-component-traceability)
3. [NFR to Architectural Approach Traceability](#3-nfr-to-architectural-approach-traceability)
4. [Use Case to NFR Traceability](#4-use-case-to-nfr-traceability)
5. [Test Coverage Traceability](#5-test-coverage-traceability)
6. [Change Impact Analysis](#6-change-impact-analysis)

---

## 1. Introduction

### 1.1 Purpose

This Requirements Traceability Matrix (RTM) establishes bidirectional traceability between:
- Use cases and Software Architecture Document (SAD) components
- Non-functional requirements (NFRs) and architectural approaches
- Use cases and NFRs they satisfy
- Requirements and test coverage

### 1.2 Benefits

Traceability enables:
- **Impact Analysis:** Understand which components are affected by requirement changes
- **Coverage Verification:** Ensure all requirements are implemented and tested
- **Design Validation:** Confirm architecture addresses all requirements
- **Change Management:** Track ripple effects of modifications
- **Audit Support:** Demonstrate requirement satisfaction for compliance

### 1.3 Maintenance

This matrix should be updated when:
- New use cases or NFRs are added
- Architecture components are added, modified, or removed
- Test coverage changes
- Requirements change or are deprecated

---

## 2. Use Case to SAD Component Traceability

### 2.1 Core Read Path Use Cases

#### UC-001: View Documentation Section

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| SPA Shell | Application Logic | `apps/publisher/src/app.js` | Router loads and renders sections |
| Section Templates | Rendering Engine | `apps/publisher/src/sections/section-templates.js` | Provides rendering logic for content types |
| Routing Layer | Infrastructure | Caddy server + `Caddyfile` | Routes tenant domains to correct bundle |
| Content Files | Data | `tenants/<tenant-id>/content/` | Source of section content (MD, HTML, JS) |
| SPA Entry Point | UI Shell | `apps/publisher/src/index.html` | Defines page structure (sidebar, canvas, footer) |
| Styles | UI Presentation | `apps/publisher/src/styles.css` | Provides layout and typography |

**SAD Sections:** 4.2.1 SPA Shell, 4.2.2 Section Templates, 4.4.1 Routing Layer

---

#### UC-002: Navigate Documentation

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| SPA Shell | Application Logic | `apps/publisher/src/app.js` | Handles hashchange events and updates UI |
| Navigation Sidebar | UI Component | `apps/publisher/src/index.html` | Renders navigation tree with highlighting |
| Manifest Data | Configuration | `tenants/<tenant-id>/manifest.json` | Defines navigation structure and hierarchy |
| Browser LocalStorage | State Persistence | Browser API | Stores expanded/collapsed group state |

**SAD Sections:** 4.2.1 SPA Shell, 4.2.3 Tenant Configuration

---

#### UC-003: Search Documentation

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Command Palette | UI Component | `apps/publisher/src/app.js` | Overlay UI for search input and results |
| Search Index | Data | `apps/publisher/src/manifest.js` | Embedded at build time from manifest |
| Fuzzy Matching Algorithm | Business Logic | `apps/publisher/src/app.js` | Levenshtein distance for fuzzy search |
| Browser LocalStorage | Cache | Browser API | Caches search index and recent queries |

**SAD Sections:** 4.2.1.1 Command Palette Search Architecture

---

#### UC-004: Export Documentation

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Export Handler | Application Logic | `apps/publisher/src/app.js` | Assembles sections into single document |
| Section Templates | Rendering Engine | `apps/publisher/src/sections/section-templates.js` | Renders each section for export |
| Print Styles | UI Presentation | `apps/publisher/src/styles.css` | `@media print` rules for print layout |
| Manifest Data | Configuration | `tenants/<tenant-id>/manifest.json` | Provides section order and metadata |

**SAD Sections:** 4.2.1 SPA Shell, 4.2.2 Section Templates

---

### 2.2 Tenant Management Use Cases

#### UC-005: Configure New Tenant

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Tenant Directory | File Structure | `tenants/<tenant-id>/` | Houses all tenant configuration and content |
| Tenant Registry | Configuration | `tenants.json` (proposed) | Central registry of active tenants |
| Content Lint Script | Validation | `apps/publisher/scripts/lint-content.js` | Validates content quality and format |
| SEO Validation Script | Validation | `apps/publisher/scripts/seo-smoke.js` | Checks SEO metadata completeness |
| Git Repository | Version Control | Git | Tracks configuration history |

**SAD Sections:** 4.2.3 Tenant Configuration, 4.3.2 Tenant Registry

---

#### UC-006: Update Tenant Content

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Git Repository | Version Control | Git | Content source and trigger for updates |
| Git Webhook | Integration | Git hosting service | Triggers CI/CD on push |
| CI/CD Pipeline | Automation | GitHub Actions, GitLab CI, etc. | Orchestrates build and deployment |
| Build Script | Build System | `apps/publisher/scripts/build-tenants.js` | Generates updated tenant bundle |
| Deployment Script | Deployment System | `apps/publisher/scripts/deploy-tenant.js` (proposed) | Deploys updated bundle |
| Notification System | Monitoring | Email, Slack, CI/CD native | Notifies stakeholders of result |

**SAD Sections:** 4.3.3 Build Pipeline, 4.3.5 Deployment Manager, 5.4 Zero-Downtime Update Process

---

#### UC-007: Deploy Tenant Bundle

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Deployment Script | Deployment System | `apps/publisher/scripts/deploy-tenant.js` (proposed) | Orchestrates deployment with atomic swap |
| Atomic Symlink Mechanism | Infrastructure | POSIX `fs.rename()` | Provides zero-downtime deployment |
| Config Generator | Configuration | `apps/publisher/scripts/generate-caddyfile.js` (proposed) | Generates Caddy routing config |
| Caddy Admin API | Infrastructure | Caddy server | Triggers graceful reload |
| Health Check | Monitoring | HTTP GET request | Verifies deployment success |
| Audit Log | Logging | Structured log file | Records deployment history |

**SAD Sections:** 4.3.5 Deployment Manager, 5.4 Zero-Downtime Update Process, 5.4.1 Atomic Deployment Guarantees

---

#### UC-008: Remove or Disable Tenant

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Tenant Registry | Configuration | `tenants.json` | Controls tenant enable/disable status |
| Config Generator | Configuration | `apps/publisher/scripts/generate-caddyfile.js` | Removes tenant from routing |
| Caddy Admin API | Infrastructure | Caddy server | Applies updated routing |
| File Operations | Utility | Node.js `fs` module | Removes tenant files (hard delete) |
| Git Repository | Version Control | Git | Tracks removal/disable history |

**SAD Sections:** 4.3.2 Tenant Registry, 4.3.4 Config Generator

---

### 2.3 Development/Operations Use Cases

#### UC-009: Build Tenant Bundles

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Build Script | Build System | `apps/publisher/scripts/build-tenants.js` | Main build orchestration |
| Core Build Script | Build System | `apps/publisher/scripts/build.js` | Core build logic (src → dist) |
| Content Lint Script | Validation | `apps/publisher/scripts/lint-content.js` | Validates content before build |
| Terser | Minification | npm package `terser` | Optional JavaScript minification |
| Markdown Parser | Content Processing | `apps/publisher/scripts/build.js` | Converts Markdown to HTML |

**SAD Sections:** 4.3.3 Build Pipeline, 4.3.3.1 Build Performance Considerations

---

#### UC-010: Test Multi-Tenant Routing

| SAD Component | Component Type | Component Location | Mapping Rationale |
|--------------|----------------|-------------------|-------------------|
| Docker Compose | Container Orchestration | `apps/publisher/docker-compose.yml` | Starts Caddy container |
| Caddyfile | Routing Configuration | `apps/publisher/Caddyfile` | Defines host-based routing rules |
| Caddy Container | Infrastructure | Docker image | Reverse proxy server |
| Tenant Bundles | Static Content | `apps/publisher/dist/` | Content served by Caddy |
| Host Mapping | Network Configuration | `/etc/hosts` | Resolves tenant domains to localhost |

**SAD Sections:** 4.4.1 Current Implementation (Docker Caddy), 5.2 Local Multi-Tenant Testing

---

## 3. NFR to Architectural Approach Traceability

### 3.1 Performance Requirements

#### NFR-P1: Page Load Time <2s on 3G

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Zero-dependency philosophy | 2.1.5 Maintainability | No framework overhead, minimal JavaScript payload |
| Static deployment model | 4.1 Architectural Overview | CDN edge caching for fast delivery |
| Single CSS file | 4.2.1 SPA Shell | Minimal HTTP requests |
| ES modules for code splitting | 4.2.1 SPA Shell | Lazy loading of section content |
| Gzip/Brotli compression | 5.3 Production Deployment | ~70% size reduction for text assets |
| CDN deployment | 5.3 Production Deployment | Global edge nodes reduce latency |

**Design Rationale:** Static files on CDN provide inherent performance without complex optimization.

---

#### NFR-P2: Build Time <30s Per Tenant

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Zero-dependency build scripts | 4.3.3 Build Pipeline | No framework compilation overhead |
| Lightweight Markdown parser | 4.3.3 Build Pipeline | Simple, fast parsing without heavy libraries |
| Optional minification | 4.3.3 Build Pipeline | Can skip minification for dev builds |
| Linear build process | 4.3.3.1 Build Performance | Single-threaded but simple (future: parallelization) |

**Design Rationale:** Simple build process optimizes for maintainability first, performance second.

---

#### NFR-P3: Search <100ms

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Build-time search index | 4.2.1.1 Command Palette | Index pre-computed, not generated at runtime |
| Client-side fuzzy matching | 4.2.1.1 Command Palette | Levenshtein distance algorithm |
| LocalStorage caching | 4.2.1.1 Command Palette | Index cached for session performance |

**Design Rationale:** Pre-computed index and client-side search avoid network round-trips.

---

### 3.2 Reliability Requirements

#### NFR-R1: 99.9% Availability

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Static deployment model | 4.1 Architectural Overview | No database or server failures |
| CDN infrastructure | 5.3 Production Deployment | CDN provider SLA (typically 99.9%+) |
| No runtime dependencies | 2.1.4 Reliability | No backend services to fail |

**Design Rationale:** Static files on CDN are inherently reliable without HA configurations.

---

#### NFR-R2: Zero Downtime for Other Tenants

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Filesystem isolation | 4.4.2 Production Architecture | Each tenant has independent directory tree |
| Per-tenant symlink deployment | 5.4 Zero-Downtime Update | Symlink swap only affects target tenant |
| Caddy graceful reload | 4.3.4 Config Generator | Zero-downtime routing updates |

**Design Rationale:** Complete isolation at filesystem and routing levels prevents cross-tenant impact.

**Technical Guarantee:** See SAD Section 7.3.1 for detailed technical justification.

---

#### NFR-R3: <100ms Outage for Updating Tenant

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Atomic symlink swap | 5.4 Zero-Downtime Update | POSIX-guaranteed atomic rename operation |
| In-flight request handling | 5.4.1 Atomic Deployment | Open file descriptors remain valid during swap |
| Symlink indirection | 5.4 Zero-Downtime Update | Stable production path points to versioned directories |

**Design Rationale:** POSIX atomicity guarantees zero observable downtime.

**Technical Guarantee:** See SAD Section 5.4.1 for POSIX specification reference and filesystem compatibility.

---

### 3.3 Scalability Requirements

#### NFR-S1: Support 100+ Tenants

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| File-based tenant registry | 4.3.2 Tenant Registry | Simple JSON file scales to ~1000 tenants |
| Config generator pattern | 4.3.4 Config Generator | Caddyfile generated from registry |
| Per-tenant build isolation | 4.3.3 Build Pipeline | Tenants build independently |
| Linear disk usage | 5.4 Zero-Downtime Update | ~5MB per tenant, predictable growth |

**Design Rationale:** File-based approach sufficient for initial scale; migration path to database exists.

---

#### NFR-S2: Support 1000+ Sections Per Tenant

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Client-side manifest parsing | 4.2.1 SPA Shell | Browser handles large JSON efficiently |
| Lazy section rendering | 4.2.2 Section Templates | Only render sections when navigated to |
| Search index optimization | 4.2.1.1 Command Palette | Pre-computed index scales linearly |

**Design Rationale:** Client-side rendering avoids server-side scalability issues.

---

### 3.4 Security Requirements

#### NFR-SEC1: No Server-Side Execution

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Read/write path segregation | 2.1.1 Security | Published content is static-only |
| Static deployment model | 4.1 Architectural Overview | No server-side scripting languages |
| Hash-based routing | 4.2.1 SPA Shell | Client-side routing, no server logic |

**Design Rationale:** Static files have essentially zero attack surface.

---

#### NFR-SEC2: Tenant Bundle Isolation

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Independent bundle directories | 4.4.2 Production Architecture | No shared files between tenants |
| Domain-based routing | 4.4.1 Current Implementation | Host header determines bundle |
| No shared JavaScript context | 4.2.1 SPA Shell | Each tenant loads independent bundle |
| Browser Same-Origin Policy | 7.3 Tenant Isolation | Browser enforces isolation |

**Design Rationale:** Complete isolation at filesystem, routing, and browser levels.

**Technical Guarantee:** See SAD Section 7.3.1 for isolation technical guarantees.

---

#### NFR-SEC3: HTTPS Required

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Caddy automatic HTTPS | 7.2 Read Path Security | Let's Encrypt integration |
| CDN SSL/TLS | 5.3 Production Deployment | CDN providers include SSL certificates |
| Security headers | 7.2 Read Path Security | HSTS, CSP headers in Caddy configuration |

**Design Rationale:** Modern infrastructure makes HTTPS essentially free.

---

### 3.5 Maintainability Requirements

#### NFR-M1: Zero Runtime Dependencies

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Vanilla JavaScript | 4.2.1 SPA Shell | No React, Vue, Angular frameworks |
| Zero-dependency philosophy | 2.1.5 Maintainability | Only terser for optional minification |
| ES modules | 4.2.1 SPA Shell | Native browser module system |

**Design Rationale:** Avoids framework churn and ensures long-term maintainability.

---

#### NFR-M2: Limited Build Dependencies

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Node.js built-ins only | 4.3.3 Build Pipeline | No third-party build libraries |
| Terser for minification | 4.3.3 Build Pipeline | Single optional dependency |

**Design Rationale:** Minimal dependencies reduce maintenance burden and security surface.

---

#### NFR-M3: Code Coverage >70%

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Jest test framework | 8.1 Test Framework | Comprehensive testing with coverage reporting |
| CI/CD integration | 8.4 CI/CD Test Integration | Automated coverage enforcement |

**Design Rationale:** Adequate coverage ensures code quality without perfectionism.

---

### 3.6 Portability Requirements

#### NFR-PORT1: Deploy to Any Static Host

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Hash-based routing | 4.2.1 SPA Shell | No server rewrites needed |
| Static bundle structure | 4.2 Read Path Components | Self-contained HTML/CSS/JS files |
| No environment assumptions | 4.1 Architectural Overview | Bundles are host-agnostic |

**Design Rationale:** Avoids vendor lock-in and enables cost optimization.

---

#### NFR-PORT2: Run Locally Offline

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| No external dependencies | 4.2.1 SPA Shell | All assets inline or relative paths |
| `file://` protocol support | 4.2.1 SPA Shell | Works without web server |

**Design Rationale:** Enables offline documentation and airgapped environments.

---

### 3.7 Operability Requirements

#### NFR-O1: Update/Redeploy Anytime

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Git push to deploy | 4.3.1 Content Source | No approval workflows |
| Automated CI/CD | 5.4 Zero-Downtime Update | No manual intervention required |
| No maintenance windows | 5.4 Zero-Downtime Update | Deployments possible 24/7 |

**Design Rationale:** Operational flexibility is critical for urgent updates.

---

#### NFR-O2: Automated Deployment

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Git webhooks | 4.3.1 Content Source | Push triggers CI/CD |
| CI/CD pipeline | 5.4 Zero-Downtime Update | Fully automated build and deploy |

**Design Rationale:** Automation reduces human error and deployment time.

---

#### NFR-O3: Rollback <5 Minutes

| Architectural Approach | SAD Section | Implementation Details |
|------------------------|-------------|------------------------|
| Versioned bundle directories | 5.4 Zero-Downtime Update | Previous versions retained |
| Rollback script | 5.4 Zero-Downtime Update | Symlink swap to previous version |
| Same atomic mechanism | 5.4.1 Atomic Deployment | Rollback is just another deployment |

**Design Rationale:** Fast rollback minimizes impact of bad deployments.

---

## 4. Use Case to NFR Traceability

### 4.1 Matrix: Use Cases → NFRs

| Use Case | Related NFRs | NFR Priority | Rationale |
|----------|-------------|--------------|-----------|
| UC-001: View Section | NFR-P1, NFR-SEC1, NFR-PORT2 | HIGH, CRITICAL, HIGH | Fast load, static security, offline capable |
| UC-002: Navigate | NFR-P1, NFR-U2 | HIGH, HIGH | Responsive navigation, intuitive UX |
| UC-003: Search | NFR-P3 | HIGH | Fast search is critical for usability |
| UC-004: Export | NFR-M1 | CRITICAL | Export must work offline (zero dependencies) |
| UC-005: Configure | NFR-M2, NFR-M4 | HIGH, MEDIUM | Simple config, well-documented |
| UC-006: Update Content | NFR-R2, NFR-R3, NFR-O1, NFR-O2 | CRITICAL, CRITICAL, CRITICAL, HIGH | Zero-downtime, anytime updates, automated |
| UC-007: Deploy | NFR-R2, NFR-R3, NFR-O3 | CRITICAL, CRITICAL, HIGH | Zero-downtime, fast rollback |
| UC-008: Remove/Disable | NFR-R2 | CRITICAL | No impact on other tenants |
| UC-009: Build | NFR-P2, NFR-S2, NFR-M1 | HIGH, HIGH, CRITICAL | Fast builds, large content support |
| UC-010: Test Routing | NFR-PORT2, NFR-S1 | HIGH, HIGH | Local testing, multi-tenant support |

### 4.2 Matrix: NFRs → Use Cases

| NFR ID | Validated By Use Cases | Test Strategy |
|--------|------------------------|---------------|
| NFR-P1 | UC-001, UC-002 | Lighthouse tests, network throttling |
| NFR-P2 | UC-009 | CI/CD build timing |
| NFR-P3 | UC-003 | Performance API timing tests |
| NFR-R1 | UC-001 | Uptime monitoring |
| NFR-R2 | UC-006, UC-007, UC-008 | Parallel request integration tests |
| NFR-R3 | UC-006, UC-007 | Continuous request tests during deployment |
| NFR-S1 | UC-010 | Load testing with 100 tenants |
| NFR-S2 | UC-009 | Synthetic large tenant tests |
| NFR-SEC1 | UC-001 | DAST security scanning |
| NFR-SEC2 | UC-001, UC-010 | Isolation verification tests |
| NFR-SEC3 | UC-001 | SSL Labs testing |
| NFR-M1 | UC-001, UC-004, UC-009 | Dependency audit |
| NFR-M2 | UC-005, UC-009 | Dependency audit |
| NFR-M3 | All UCs | Jest coverage reports |
| NFR-PORT1 | UC-009, UC-010 | Cross-platform deployment tests |
| NFR-PORT2 | UC-001, UC-010 | `file://` protocol tests |
| NFR-O1 | UC-006 | 24/7 deployment tests |
| NFR-O2 | UC-006 | CI/CD automation tests |
| NFR-O3 | UC-007 | Rollback timing tests |

---

## 5. Test Coverage Traceability

### 5.1 Use Case Test Coverage

| Use Case | Unit Tests | Integration Tests | E2E Tests | Manual Tests |
|----------|-----------|-------------------|-----------|--------------|
| UC-001: View Section | Router logic, Section templates | Full page load, Content rendering | Browser navigation | Cross-browser testing |
| UC-002: Navigate | Hash handler, Sidebar logic | Multi-section navigation | User navigation flow | Accessibility testing |
| UC-003: Search | Fuzzy matching algorithm | Search index loading | Command palette workflow | Large tenant search |
| UC-004: Export | Export assembly logic | Multi-section export | Print preview | Print to PDF |
| UC-005: Configure | Validation functions | Config file parsing | Full tenant creation | Documentation review |
| UC-006: Update Content | Build script logic | Git push to deploy | End-to-end deployment | Failure scenarios |
| UC-007: Deploy | Symlink operations | Health checks, Rollback | Zero-downtime verification | Multi-tenant impact |
| UC-008: Remove/Disable | Registry updates | Config regeneration | Graceful removal | Archive verification |
| UC-009: Build | Build functions, Markdown parser | Multi-tenant build | Watch mode | Performance profiling |
| UC-010: Test Routing | Caddy config generation | Docker Compose startup | Multi-tenant access | Domain resolution |

### 5.2 NFR Test Coverage

| NFR ID | Automated Tests | Manual Tests | Monitoring | Target Achievement |
|--------|----------------|--------------|------------|-------------------|
| NFR-P1 | Lighthouse CI | Network throttling tests | RUM (optional) | <2s on 3G |
| NFR-P2 | CI/CD build timing | Performance profiling | Build logs | <30s per tenant |
| NFR-P3 | Performance API tests | Large tenant testing | - | <100ms |
| NFR-R1 | Health check tests | - | Uptime monitoring | 99.9% uptime |
| NFR-R2 | Parallel request tests | Multi-tenant deployment | Caddy logs | Zero errors |
| NFR-R3 | Continuous request tests | Deployment observation | Deployment logs | <100ms |
| NFR-S1 | Load tests (100 tenants) | Manual scaling verification | Disk usage | 100+ tenants |
| NFR-S2 | Large tenant tests (1000 sections) | Performance profiling | - | <3min build |
| NFR-SEC1 | Bundle structure validation | DAST scanning | - | Static-only |
| NFR-SEC2 | Isolation tests | Cross-tenant access attempts | - | Zero leakage |
| NFR-SEC3 | SSL Labs automation | Certificate validation | SSL monitoring | A rating |
| NFR-M1 | Dependency audit | Code review | - | Zero runtime deps |
| NFR-M2 | Dependency audit | License review | - | <5 build deps |
| NFR-M3 | Jest coverage reports | - | CI/CD coverage | >70% |
| NFR-PORT1 | Cross-platform deploy | Manual deployment tests | - | 4+ platforms |
| NFR-PORT2 | `file://` protocol tests | Offline mode testing | - | Full functionality |
| NFR-O1 | CI/CD tests | 24/7 deployment tests | - | Anytime deployment |
| NFR-O2 | CI/CD pipeline tests | Webhook verification | CI/CD logs | Fully automated |
| NFR-O3 | Rollback tests | Timed rollback | Deployment logs | <5min |

---

## 6. Change Impact Analysis

### 6.1 Component Change Impact

This section helps assess the impact of changes to architectural components.

| Component | Related Use Cases | Related NFRs | Impact Level | Change Risk |
|-----------|------------------|--------------|--------------|-------------|
| SPA Shell (`app.js`) | UC-001, UC-002, UC-003, UC-004 | NFR-P1, NFR-P3, NFR-M1, NFR-SEC1 | HIGH | MEDIUM |
| Section Templates | UC-001, UC-004 | NFR-M3 | MEDIUM | LOW |
| Build Pipeline | UC-005, UC-006, UC-009 | NFR-P2, NFR-M1, NFR-M2 | HIGH | MEDIUM |
| Deployment Script | UC-006, UC-007, UC-008 | NFR-R2, NFR-R3, NFR-O1, NFR-O2, NFR-O3 | CRITICAL | HIGH |
| Caddy Configuration | UC-010 | NFR-R2, NFR-S1, NFR-SEC3 | HIGH | MEDIUM |
| Tenant Registry | UC-005, UC-008 | NFR-S1 | MEDIUM | LOW |

### 6.2 Requirement Change Impact

This section helps assess the impact of changing requirements.

| Requirement Type | Example Change | Affected Components | Affected Tests | Effort Estimate |
|-----------------|----------------|---------------------|----------------|-----------------|
| New Use Case | Add multi-language support | SPA Shell, Build Pipeline, Manifest | UC-001, UC-002, UC-009 | HIGH |
| Modified NFR | Change NFR-P2 to <15s | Build Pipeline, Terser config | UC-009 tests | MEDIUM |
| New NFR | Add NFR-A1 for accessibility | SPA Shell, Styles | UC-001, UC-002 tests | HIGH |
| Removed Use Case | Remove UC-004 export | SPA Shell (export logic) | UC-004 tests only | LOW |
| Architecture Change | Replace Caddy with nginx | Routing Layer, Config Generator | UC-007, UC-010 tests | HIGH |

### 6.3 Traceability Gap Analysis

This section identifies requirements without clear traceability.

| Gap Type | Description | Resolution Needed |
|----------|-------------|-------------------|
| Untested NFR | NFR-C1 (No PII) has no automated tests | Add privacy audit to CI/CD |
| Missing Use Case | No use case for tenant metrics/analytics | Create UC-011 or mark as future scope |
| Orphaned Component | `seo.js` not mapped to any use case | Verify usage or deprecate |
| Missing NFR | No NFR for browser compatibility | Add NFR-U4 for browser support |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-01 | Requirements Analyst Agent | Initial baseline |

---

**End of Document**
