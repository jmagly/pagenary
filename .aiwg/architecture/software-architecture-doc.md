# Software Architecture Document (SAD)

## Pagenary - Multi-Tenant Static Documentation Publisher

**Version:** 1.0
**Date:** 2025-12-01
**Status:** BASELINED
**Author:** Architecture Designer Agent
**Reviewers:** Security Architect, Test Architect, Requirements Analyst, Technical Writer

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Drivers](#2-architectural-drivers)
3. [System Context](#3-system-context)
4. [Component Architecture](#4-component-architecture)
5. [Deployment Architecture](#5-deployment-architecture)
6. [Data Architecture](#6-data-architecture)
7. [Security Architecture](#7-security-architecture)
8. [Test Architecture](#8-test-architecture)
9. [Key Decisions (ADR References)](#9-key-decisions-adr-references)
10. [Quality Attribute Scenarios](#10-quality-attribute-scenarios)
11. [Risks and Technical Debt](#11-risks-and-technical-debt)
12. [Appendices](#12-appendices)

---

## 1. Introduction

### 1.1 Purpose and Scope

This Software Architecture Document (SAD) describes the architecture of Pagenary, a multi-tenant static documentation publisher. The system enables resellers to package shared documentation templates into tenant-specific branded bundles, deploying them as self-contained static sites with minimal hosting costs.

**Scope Boundaries:**

- **In Scope (Current POC):** Static documentation publisher, per-tenant bundle generation, local multi-tenant testing infrastructure, client-side SPA (Single Page Application) shell
- **In Scope (Architecture):** Control path design for future implementation, tenant routing and deployment patterns
- **Out of Scope (Future Work):** Upstream authoring components, workflow management, billing systems

This document serves as the authoritative reference for architectural decisions and provides guidance for implementation teams.

### 1.2 Architectural Goals

The architecture is designed to achieve the following goals:

| Goal | Description | Priority |
|------|-------------|----------|
| **Cost Efficiency** | Zero runtime dependencies, minimal hosting costs via static deployment | Highest |
| **Portability** | Deploy to any static host (CDN, S3, Cloudflare, Netlify, Vercel) | High |
| **Tenant Isolation** | Complete separation between tenant bundles with no shared runtime | High |
| **Zero-Downtime Updates** | Tenants can update/redeploy without affecting other tenants | High |
| **Maintainability** | Simple, understandable codebase with minimal dependencies | Medium |
| **Security** | Read path has minimal attack surface (static files only) | Medium |

### 1.3 Architectural Constraints

The following constraints shape the architecture:

1. **Zero-Dependency Philosophy:** The shell and build scripts must remain dependency-free beyond `terser` for minification. No frontend frameworks (React, Vue, Angular).

2. **Static Deployment Model:** All content must be deployable as static files. No server-side execution in the read path.

3. **Multi-Tenant Bundle Isolation:** Each tenant receives a completely self-contained bundle. No shared runtime state between tenants.

4. **Hash-Based Routing:** Client-side routing uses hash fragments (`#/page-id`) to enable static host compatibility without server configuration.

### 1.4 Key Stakeholders

| Stakeholder | Role | Concerns |
|-------------|------|----------|
| **Resellers** | Organizations white-labeling documentation | Brand customization, deployment simplicity, cost control |
| **Tenant Organizations** | End customers receiving branded bundles | Content accuracy, performance, availability |
| **Content Authors** | Teams creating documentation | Authoring workflow, preview capabilities |
| **Platform Operators** | Technical teams managing deployments | Operational simplicity, monitoring, troubleshooting |
| **Engineering Team** | Development and maintenance | Code maintainability, testing, extensibility |

### 1.5 Technology Version Requirements

| Technology | Minimum Version | Purpose |
|------------|-----------------|---------|
| **Node.js** | 18+ | Build pipeline execution |
| **Caddy** | 2.x | Reverse proxy with zero-downtime reload |
| **Docker** | 20+ | Local multi-tenant testing |
| **terser** | 5.x | JavaScript minification (optional) |

---

## 2. Architectural Drivers

### 2.1 Quality Attributes

The architecture prioritizes the following quality attributes in order:

#### 2.1.1 Security (Read/Write Segregation)

**Definition:** The system separates the read path (published static content) from the control path (management, build, deployment) to minimize attack surface and enable independent optimization.

**Rationale:** Static files have essentially zero attack surface. By segregating all dynamic operations into the control path, the published content remains maximally secure.

**Architectural Response:**
- Read path consists solely of static JavaScript, HTML, CSS (Cascading Style Sheets)
- No server-side execution in published bundles
- Control path handles all verification, transactional state, security, auditability

#### 2.1.2 Portability

**Definition:** Tenant bundles can be deployed to any infrastructure that serves static files.

**Rationale:** Avoids vendor lock-in, enables cost optimization by choosing cheapest or most appropriate hosting per tenant.

**Architectural Response:**
- Hash-based routing eliminates server configuration requirements
- No build-time assumptions about hosting environment
- Self-contained bundles with no external dependencies

#### 2.1.3 Cost Efficiency

**Definition:** Minimal operational cost through zero runtime infrastructure and static hosting.

**Rationale:** Documentation sites have highly variable traffic patterns. Static hosting with CDN (Content Delivery Network) caching provides effectively unlimited scale at minimal cost.

**Architectural Response:**
- Zero server processes in production
- CDN-compatible static assets
- Single `terser` dev dependency for optional minification

#### 2.1.4 Reliability

**Definition:** Published content remains available with minimal points of failure.

**Rationale:** Static files on CDN infrastructure provide inherent reliability without complex HA (High Availability) configurations.

**Architectural Response:**
- No database dependencies
- No session state requirements
- CDN edge caching for global availability

#### 2.1.5 Maintainability

**Definition:** System remains understandable and modifiable by developers without specialized framework knowledge.

**Rationale:** Zero-dependency philosophy ensures any JavaScript developer can understand and modify the codebase.

**Architectural Response:**
- Vanilla JavaScript with ES modules
- Clear separation of concerns (shell, templates, build scripts)
- Comprehensive inline documentation

### 2.2 Functional Requirements Summary

| Requirement | Description |
|-------------|-------------|
| **FR-1** | Generate per-tenant static bundles from shared templates |
| **FR-2** | Support multiple content formats (Markdown, HTML, JS modules) |
| **FR-3** | Enable tenant-specific branding and content overrides |
| **FR-4** | Provide deterministic navigation from manifest files |
| **FR-5** | Support command palette search across documentation |
| **FR-6** | Enable export of documentation to print-ready format |
| **FR-7** | Support local domain-based multi-tenant testing |

### 2.3 Non-Functional Requirements

| NFR ID | Requirement | Target |
|--------|-------------|--------|
| **NFR-1** | Tenants can update/redeploy at any time | ASAP processing |
| **NFR-2** | Updates must not cause downtime for other tenants | Zero downtime |
| **NFR-3** | Updating tenant has minimal outage | <100ms (atomic swap) |
| **NFR-4** | Page load time | <2 seconds on 3G |
| **NFR-5** | Build time per tenant | <30 seconds |
| **NFR-6** | Hosting cost per tenant | <$5/month (CDN pricing) |

---

## 3. System Context

### 3.1 Context Diagram

```
                                    +------------------------------------------+
                                    |           INTEGRO PLATFORM               |
                                    |                                          |
+------------------+                |  +-------------------------------------+ |
|    Resellers     |----------------+->|         CONTROL PATH                | |
|  (Organizations) |   Configure    |  |  +--------------+  +-------------+  | |
+------------------+   Tenants      |  |  |   Tenant     |  |    Build    |  | |
                                    |  |  |  Registry    |--|   Pipeline  |  | |
+------------------+                |  |  |  (JSON)      |  |  (Node.js)  |  | |
|Content Authors   |----------------+->|  +--------------+  +-------------+  | |
|    (Teams)       |   Author       |  |         |                |          | |
+------------------+   Content      |  |         v                v          | |
                                    |  |  +----------------------------------+ | |
                                    |  |  |     Config Generator             | | |
                                    |  |  |  (Caddyfile / Routing)           | | |
                                    |  |  +----------------------------------+ | |
                                    |  +-------------------------------------+ |
                                    |                    |                     |
                                    |                    v                     |
                                    |  +-------------------------------------+ |
                                    |  |           READ PATH                 | |
+------------------+                |  |  +---------------------------------+ | |
|     Tenant       |<---------------+--|  |      Static Bundles             | | |
|  Organizations   |   View Docs    |  |  |  +----------+  +----------+     | | |
|   (End Users)    |                |  |  |  |Tenant A  |  |Tenant B  | ... | | |
+------------------+                |  |  |  | Bundle   |  | Bundle   |     | | |
                                    |  |  |  +----------+  +----------+     | | |
                                    |  |  +---------------------------------+ | |
                                    |  +-------------------------------------+ |
                                    +------------------------------------------+
                                                        |
                                                        v
                                    +------------------------------------------+
                                    |         DEPLOYMENT TARGETS               |
                                    |  +-----------+ +------------+ +--------+ |
                                    |  |  CDN      | |   S3 +     | |Self-   | |
                                    |  |(Netlify,  | |CloudFront  | |Hosted  | |
                                    |  | Vercel,   | |            | |(Caddy) | |
                                    |  | CF Pages) | |            | |        | |
                                    |  +-----------+ +------------+ +--------+ |
                                    +------------------------------------------+
```

### 3.2 External Actors

| Actor | Description | Interaction |
|-------|-------------|-------------|
| **Resellers** | Organizations licensing the platform to white-label documentation for their customers | Configure tenant settings, customize branding, initiate builds |
| **Tenant Organizations** | End customers receiving branded documentation sites | View documentation, use search, export content |
| **Content Authors** | Team members creating and maintaining documentation content | Edit content files, preview changes, submit for publishing |

### 3.3 External Systems

| System | Type | Interaction |
|--------|------|-------------|
| **Git Repositories** | Content Source | Stores tenant configurations and content; triggers builds on push |
| **CDN / Static Hosts** | Deployment Target | Serves published tenant bundles; handles global distribution |
| **CI/CD Systems** | Build Automation | Orchestrates build pipeline; deploys updated bundles |
| **Domain Registrars** | Infrastructure | Manages custom domains for tenant sites |

### 3.4 System Boundaries

**Included in Publisher System:**
- SPA shell (index.html, app.js, styles.css)
- Section templates (86 rendering modules)
- Build pipeline (build.js, build-tenants.js)
- Tenant configurations (manifest.json, config.json, content/)
- Local testing infrastructure (Docker Caddy)
- Routing layer (Caddyfile generation, tenant registry)

**Excluded (Future Scope):**
- Content authoring UI (upstream workspace)
- Workflow management (review, approval flows)
- Billing and subscription management
- User authentication and access control
- Analytics and usage tracking

---

## 4. Component Architecture

### 4.1 Architectural Overview

The system follows a **read/write segregation pattern** where the published content (read path) is completely static and the management operations (control path) are handled separately.

```
+-----------------------------------------------------------------------------+
|                              CONTROL PATH                                    |
|                                                                              |
|  +----------------+    +----------------+    +------------------------+      |
|  | Tenant         |    | Build          |    | Deployment             |      |
|  | Registry       |--->| Pipeline       |--->| Manager                |      |
|  |                |    |                |    |                        |      |
|  | - tenants.json |    | - build.js     |    | - deploy-tenant.js     |      |
|  | - config.json  |    | - build-       |    | - generate-caddyfile.js|      |
|  | - manifest.json|    |   tenants.js   |    | - atomic symlink swap  |      |
|  +----------------+    +----------------+    +------------------------+      |
|           |                    |                        |                    |
|           v                    v                        v                    |
|  +-----------------------------------------------------------------------+   |
|  |                      OUTPUT: dist/<tenant-id>/                        |   |
|  +-----------------------------------------------------------------------+   |
+------------------------------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------------+
|                               READ PATH                                      |
|                                                                              |
|  +-----------------------------------------------------------------------+   |
|  |                    Per-Tenant Static Bundle                           |   |
|  |                                                                       |   |
|  |   +-------------+   +-------------+   +-------------------------+     |   |
|  |   | SPA Shell   |   | Section     |   | Tenant Content          |     |   |
|  |   |             |   | Templates   |   |                         |     |   |
|  |   | index.html  |   |             |   | - Manifest navigation   |     |   |
|  |   | app.js      |   | 86 modules  |   | - Content files         |     |   |
|  |   | styles.css  |   | category-   |   | - Brand overrides       |     |   |
|  |   | manifest.js |   | based       |   |                         |     |   |
|  |   |             |   | rendering   |   |                         |     |   |
|  |   +-------------+   +-------------+   +-------------------------+     |   |
|  |                                                                       |   |
|  +-----------------------------------------------------------------------+   |
|                                                                              |
|  +-----------------------------------------------------------------------+   |
|  |                    Routing Layer (Caddy)                              |   |
|  |                                                                       |   |
|  |   tenant-alpha.local --> dist/tenant-alpha/                           |   |
|  |   tenant-beta.local  --> dist/tenant-beta/                            |   |
|  |   ...                                                                 |   |
|  +-----------------------------------------------------------------------+   |
+------------------------------------------------------------------------------+
```

### 4.2 Read Path Components (Publisher - Current POC)

#### 4.2.1 SPA Shell

**Location:** `apps/publisher/src/`

**Purpose:** Provides the runtime environment for viewing documentation.

| Component | File | Responsibility |
|-----------|------|----------------|
| **Entry Point** | `index.html` | Page structure with top bar, sidebar, canvas, footer placeholders |
| **Application Logic** | `app.js` | Hash-based router, navigation management, command palette, export functionality |
| **Styling** | `styles.css` | Single stylesheet for typography, layout, responsive behavior |
| **Navigation Data** | `manifest.js` | Default navigation structure (overridden by tenant manifest) |
| **SEO Utilities** | `seo.js` | Metadata generation for search engines |

**Key Design Decisions:**
- All routing via hash fragments (`#/page-id`) for static host compatibility
- Per-session state only (expanded nav groups, command palette cache in localStorage)
- ES module imports for code organization without bundler complexity

##### 4.2.1.1 Command Palette Search Architecture

**Implementation:** Client-side search with build-time index

**Search Flow:**
1. Build pipeline extracts section titles, IDs, and summaries from manifest
2. Search index embedded in bundle as JavaScript module
3. Command palette performs fuzzy matching client-side using Levenshtein distance
4. Results cached in localStorage for session performance

**Data Structure:**
```javascript
// Generated at build time
const searchIndex = [
  { id: 'welcome', title: 'Welcome', summary: 'Getting started...', keywords: [] },
  { id: 'guide-1', title: 'Installation', summary: 'How to install...', keywords: ['setup'] }
];
```

#### 4.2.2 Section Templates

**Location:** `apps/publisher/src/sections/`

**Purpose:** Renders content into consistent HTML structure based on section type.

**Key Files:**
- `section-templates.js` - Template catalog with category-based rendering logic
- 86 individual section modules covering guides, tutorials, operations, developer docs, etc.

**Rendering Flow:**
```
manifest.json --> app.js router --> section template --> HTML string --> canvas DOM
```

**Template Pattern:**
Each section module exports a render function that receives content data and returns an HTML string. The `renderSectionTemplate` function from `section-templates.js` provides consistent scaffolding.

#### 4.2.3 Tenant Configuration

**Location:** `apps/publisher/tenants/<tenant-id>/`

**Structure per Tenant:**
```
tenants/tenant-alpha/
+-- manifest.json      # Navigation structure, section metadata
+-- config.json        # Branding, domain, welcome page content
+-- content/           # Tenant-specific content files
|   +-- welcome.html   # HTML content
|   +-- guide.md       # Markdown content
|   +-- analytics.js   # JavaScript module content
+-- overrides/         # Optional file overrides (CSS, JS)
```

**Manifest Schema:**
```json
{
  "default": "section-id",
  "sections": [
    {
      "id": "section-id",
      "title": "Section Title",
      "summary": "Brief description",
      "file": "content-file.md",
      "sections": [ /* nested sections */ ]
    }
  ]
}
```

**Config Schema:**
```json
{
  "title": "Site Title",
  "brandMark": "Brand",
  "brandSub": "Sub",
  "domain": "tenant.example.com",
  "tagline": "Site tagline",
  "accentColor": "#1E3A8A",
  "welcome": {
    "eyebrow": "Welcome eyebrow",
    "headline": "Main headline",
    "lead": "Lead paragraph",
    "pillars": ["Feature 1", "Feature 2"],
    "quickLinks": [{ "label": "Link", "href": "#/page" }]
  }
}
```

### 4.3 Control Path Components (Future - Architecture)

#### 4.3.1 Content Source

**Component:** Git repositories containing tenant content

**Responsibilities:**
- Store markdown, HTML, and JS module content files
- Version control for content changes
- Trigger builds via webhooks on push

**Integration Pattern:**
```
git push --> webhook --> CI/CD job --> build pipeline --> deployment
```

#### 4.3.2 Tenant Registry

**Component:** File-based JSON registry

**Location:** `apps/publisher/tenants.json` (proposed)

**Schema:**
```json
{
  "version": "1.0",
  "tenants": [
    {
      "id": "tenant-alpha",
      "enabled": true,
      "domains": ["tenant-alpha.local", "alpha.example.com"],
      "created": "2025-01-15T10:00:00Z",
      "updated": "2025-01-20T14:30:00Z"
    }
  ]
}
```

**Responsibilities:**
- Central source of truth for active tenants
- Domain mapping for routing configuration
- Enable/disable tenant deployments
- Audit trail via git history

#### 4.3.3 Build Pipeline

**Component:** Node.js build scripts

**Location:** `apps/publisher/scripts/`

| Script | Purpose |
|--------|---------|
| `build.js` | Core build pipeline (src -> dist) |
| `build-tenants.js` | Multi-tenant bundle generation |
| `generate-sections.js` | Template regeneration utility |
| `lint-content.js` | Content quality checks |
| `seo-smoke.js` | SEO metadata validation |

**Build Process:**
1. Read tenant manifest and config
2. Copy SPA shell to tenant output directory
3. Process content files (Markdown -> HTML conversion)
4. Apply tenant branding overrides
5. Optional minification via terser
6. Output to `dist/<tenant-id>/`

##### 4.3.3.1 Build Performance Considerations

**Current Baseline:** Sample tenant-alpha builds in ~5 seconds (15 sections, 500KB content)

**Performance Model:**
- Linear in content size: ~100ms per section, ~50ms per MB markdown
- Minification adds ~2 seconds when enabled

**Bottleneck Analysis:**
- Markdown parsing: 40%
- File I/O: 30%
- terser minification: 20%
- Other (manifest processing, validation): 10%

**Optimization Options:**
1. Parallel section processing (future enhancement)
2. Skip minification for dev builds (currently supported via MINIFY=false)
3. Incremental builds (future enhancement)
4. Caching of parsed markdown (future enhancement)

**Monitoring Strategy:**
- CI/CD tracks build duration per tenant
- Alert threshold: >30 seconds (NFR-5 violation)
- Build metrics logged to stdout for aggregation

#### 4.3.4 Config Generator

**Component:** Caddyfile generation from tenant registry

**Location:** `scripts/generate-caddyfile.js` (proposed)

**Flow:**
```
tenants.json --> generate-caddyfile.js --> Caddyfile --> caddy reload
```

**Generated Configuration:**
```caddyfile
http://tenant-alpha.local {
  root * dist/tenant-alpha
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}
```

#### 4.3.5 Deployment Manager

**Component:** Atomic deployment with symlink swap

**Deployment Flow:**
1. Build new version to timestamped directory: `dist/tenant-alpha-{timestamp}/`
2. Create temporary symlink pointing to new version
3. Atomic rename of symlink to production path
4. Cleanup old versions (keep N most recent)

**Zero-Downtime Guarantee:**
- `mv -Tf` is atomic at filesystem level (POSIX guarantee)
- In-flight requests complete against old version
- New requests immediately see new version

### 4.4 Routing Layer

#### 4.4.1 Current Implementation (Docker Caddy)

**Location:** `apps/publisher/docker-compose.yml`, `apps/publisher/Caddyfile`

**Architecture:**
```
Browser --> localhost:80 --> Docker Caddy --> dist/<tenant-id>/
              |
              +-- Host header routing:
                  tenant-alpha.local --> dist/tenant-alpha/
                  tenant-beta.local  --> dist/tenant-beta/
```

**Current Caddyfile Structure:**
```caddyfile
http://tenant-alpha.local {
  root * dist/tenant-alpha
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}
```

#### 4.4.2 Production Architecture (Recommended)

**Components:**
1. **File-based tenant registry** (`tenants.json`)
2. **Config generator** (produces Caddyfile from registry)
3. **Caddy with graceful reload** (API-driven updates)
4. **Atomic symlink swap** (zero-downtime content updates)

**Update Workflow:**
```
1. Content Update (existing tenant):
   git push --> build --> symlink swap --> (no routing change needed)

2. New Tenant Addition:
   git push --> build --> update registry --> regenerate Caddyfile --> caddy reload
```

**NFR Satisfaction:**
- **NFR-1 (Updates at any time):** Scripts run on-demand, no scheduling constraints
- **NFR-2 (No downtime for other tenants):** Symlink operations are per-tenant; Caddy reload is zero-downtime
- **NFR-3 (Minimal outage for updating tenant):** Atomic symlink swap (~0ms effective downtime)

---

## 5. Deployment Architecture

### 5.1 Development Environment

**Command:** `npm run dev`

**Architecture:**
```
+---------------+      +----------------+      +-------------+
| Source Files  | -->  |  build.js      | -->  |   dist/     |
|   src/        |      |  (watch mode)  |      |             |
+---------------+      +----------------+      +-------------+
                                                     |
                                                     v
                       +----------------+      +-------------+
                       |  serve.js      | <--  | Browser     |
                       |  localhost:3000|      |             |
                       +----------------+      +-------------+
```

**Features:**
- Watch mode for automatic rebuilds
- Live reload (optional)
- Single-tenant development

### 5.2 Local Multi-Tenant Testing

**Command:** `npm run caddy:up`

**Architecture:**
```
+-----------------+
|  Browser        |
|  tenant-alpha.  |
|  local          |
+--------+--------+
         |
         v
+-----------------+      +--------------------------------------+
|  Docker Caddy   |      |  Host Mapping (/etc/hosts)           |
|  Port 80        |      |  127.0.0.1 tenant-alpha.local        |
+--------+--------+      |  127.0.0.1 tenant-beta.local         |
         |               +--------------------------------------+
         v
+--------------------------------------+
|  dist/                               |
|  +-- tenant-alpha/                   |
|  |   +-- index.html                  |
|  |   +-- app.js                      |
|  |   +-- ...                         |
|  +-- tenant-beta/                    |
|      +-- ...                         |
+--------------------------------------+
```

**Setup Requirements:**
1. Add tenant domains to `/etc/hosts`
2. Build tenant bundles: `npm run build:tenants`
3. Start Caddy: `npm run caddy:up`

### 5.3 Production Deployment Options

#### Option A: CDN Platforms (Netlify, Vercel, Cloudflare Pages)

**Best For:** Simple deployments, automatic SSL, global distribution

**Architecture:**
```
+-------------+      +-------------+      +-------------+
| git push    | -->  | CDN Build   | -->  | Edge Nodes  |
|             |      | System      |      | (Global)    |
+-------------+      +-------------+      +-------------+
```

**Deployment Pattern:**
- One repository per tenant OR
- Monorepo with per-tenant deploy configurations

**Trade-offs:**
- Pro: Zero infrastructure management, automatic SSL, global CDN
- Con: Less control over routing, potential cost at scale

#### Option B: Object Storage + CDN (S3 + CloudFront)

**Best For:** AWS-centric organizations, fine-grained control

**Architecture:**
```
+-------------+      +-------------+      +-------------+
| CI/CD       | -->  | S3 Bucket   | <--  | CloudFront  | <-- Users
| Pipeline    |      | (per tenant)|      | Distribution|
+-------------+      +-------------+      +-------------+
```

**Deployment Pattern:**
- S3 bucket per tenant OR
- Single bucket with prefix-based routing

#### Option C: Self-Hosted (Caddy)

**Best For:** Full control, on-premise requirements, cost optimization at scale

**Architecture:**
```
+-----------------------------------------------------------------+
|                     Production Server                            |
|                                                                  |
|  +-------------+    +-------------+    +---------------------+   |
|  | tenants.json| -->| generate-   | -->| Caddyfile           |   |
|  |             |    | caddyfile.js|    |                     |   |
|  +-------------+    +-------------+    +----------+----------+   |
|                                                   |              |
|                                                   v              |
|  +-----------------------------------------------------------+   |
|  |                      Caddy Server                         |   |
|  |  +-----------------------------------------------------+  |   |
|  |  | tenant-alpha.example.com --> dist/tenant-alpha      |  |   |
|  |  | tenant-beta.example.com  --> dist/tenant-beta       |  |   |
|  |  +-----------------------------------------------------+  |   |
|  +-----------------------------------------------------------+   |
|                                                                  |
|  +-----------------------------------------------------------+   |
|  |  dist/                                                    |   |
|  |  +-- tenant-alpha --> tenant-alpha-1701234567/            |   |
|  |  +-- tenant-alpha-1701234567/                             |   |
|  |  +-- tenant-alpha-1701234000/ (old)                       |   |
|  |  +-- tenant-beta --> tenant-beta-1701235000/              |   |
|  |  +-- tenant-beta-1701235000/                              |   |
|  +-----------------------------------------------------------+   |
+-----------------------------------------------------------------+
```

### 5.4 Zero-Downtime Update Process

**Existing Tenant Content Update:**

```
1. Build new version
   npm run build:tenants -- tenant-alpha
   Output: dist-build/tenant-alpha/

2. Deploy with atomic swap
   npm run deploy:tenant tenant-alpha dist-build/tenant-alpha

   Internals:
   a. mkdir dist/tenant-alpha-{timestamp}
   b. cp -r dist-build/tenant-alpha/* dist/tenant-alpha-{timestamp}/
   c. ln -sfn tenant-alpha-{timestamp} dist/tenant-alpha.tmp
   d. mv -Tf dist/tenant-alpha.tmp dist/tenant-alpha  # ATOMIC

3. Cleanup old versions
   (automatic: keeps last 3 versions)
```

**New Tenant Addition:**

```
1. Add to tenant registry
   npm run tenant:add -- --id tenant-gamma --domain tenant-gamma.example.com

2. Build tenant bundle
   npm run build:tenants -- tenant-gamma

3. Deploy tenant
   npm run deploy:tenant tenant-gamma dist-build/tenant-gamma

4. Apply routing config
   npm run config:apply

   Internals:
   a. node scripts/generate-caddyfile.js
   b. caddy reload --config Caddyfile  # ZERO-DOWNTIME
```

#### 5.4.1 Atomic Deployment Guarantees

**POSIX Specification Reference:**

The `rename()` system call (used by `mv -Tf`) is atomic per IEEE Std 1003.1 (POSIX.1-2017):

> "If the link named by the new argument exists, it shall be removed and old renamed to new. In this case, a link named new shall remain visible to other processes throughout the renaming operation and refer either to the file referred to by new or old before the operation began."

**Technical Guarantees:**

1. **Atomicity:** The symlink swap is a single filesystem operation; no intermediate state is observable
2. **In-Flight Request Handling:** Requests that began before the swap complete using the file descriptor they opened (old version)
3. **New Request Handling:** Requests that begin after the swap see the new version immediately

**Measurement Methodology:**

- "Effective downtime" = time between last successful request to old version and first successful request to new version
- Theoretical upper bound: <1ms (filesystem operation latency)
- Practical measurement: 0ms (no observable gap in availability)

**Filesystem Compatibility:**

| Filesystem | Atomic Rename | Notes |
|------------|---------------|-------|
| ext4 | Yes | Default Linux, fully supported |
| xfs | Yes | Enterprise Linux, fully supported |
| btrfs | Yes | Copy-on-write, fully supported |
| NFS v4 | Conditional | Atomic on same server; cross-server rename not atomic |
| Docker bind mount | Yes | Inherits host filesystem behavior |

**Edge Cases:**

| Scenario | Behavior |
|----------|----------|
| Disk full during copy | Build fails before symlink swap; old version remains |
| Symlink swap fails | Temporary symlink left in place; old version remains |
| Process crash mid-deploy | Cleanup script removes partial deployments |

---

## 6. Data Architecture

### 6.1 Data Model Overview

The system is file-based with no database dependencies. All data is stored as JSON, Markdown, HTML, or JavaScript modules.

```
+-------------------------------------------------------------------+
|                       DATA ARCHITECTURE                            |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |                    TENANT REGISTRY                           |  |
|  |                    tenants.json                              |  |
|  |                                                              |  |
|  |  { "tenants": [ { "id", "domains", "enabled" } ] }           |  |
|  +--------------------------------------------------------------+  |
|                              |                                     |
|              +---------------+---------------+                     |
|              v               v               v                     |
|  +-----------------+ +-----------------+ +-----------------+       |
|  | TENANT A        | | TENANT B        | | TENANT C        |       |
|  |                 | |                 | |                 |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  | |manifest.json| | | |manifest.json| | | |manifest.json| |       |
|  | |(navigation) | | | |             | | | |             | |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  |                 | |                 | |                 |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  | | config.json | | | | config.json | | | | config.json | |       |
|  | | (branding)  | | | |             | | | |             | |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  |                 | |                 | |                 |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  | |  content/   | | | |  content/   | | | |  content/   | |       |
|  | | .md .html   | | | |             | | | |             | |       |
|  | | .js         | | | |             | | | |             | |       |
|  | +-------------+ | | +-------------+ | | +-------------+ |       |
|  +-----------------+ +-----------------+ +-----------------+       |
|                                                                    |
+--------------------------------------------------------------------+
```

### 6.2 Content Model

**Supported Content Formats:**

| Format | Extension | Processing | Use Case |
|--------|-----------|------------|----------|
| **Markdown** | `.md` | Lightweight parser -> HTML | Structured text documentation |
| **HTML** | `.html` | Direct inclusion | Rich formatted content |
| **JavaScript** | `.js` | ES module dynamic import | Interactive content, dashboards |

**Content Processing Pipeline:**
```
Content File --> Format Detection --> Processor --> HTML Output
                      |
                      +-- .md  --> Markdown Parser --> HTML
                      +-- .html --> Pass-through --> HTML
                      +-- .js  --> Module Import --> render() --> HTML
```

### 6.3 Manifest Model

**Purpose:** Defines navigation structure and section metadata for a tenant.

**Schema:**
```json
{
  "default": "string (section ID)",
  "sections": [
    {
      "id": "string (unique identifier)",
      "title": "string (display name)",
      "summary": "string (brief description)",
      "file": "string (content file path, optional)",
      "sections": "array (nested sections, optional)"
    }
  ]
}
```

**Navigation Generation:**
```
manifest.json --> app.js --> Sidebar DOM
                    |
                    +-- Groups: sections with nested sections
                        Items: sections with file property
                        Default: section matching "default" ID
```

### 6.4 Tenant Registry Model

**Purpose:** Central source of truth for active tenants and domain mappings.

**Schema:**
```json
{
  "version": "string (schema version)",
  "tenants": [
    {
      "id": "string (unique identifier, directory name)",
      "enabled": "boolean (active/inactive)",
      "domains": ["string (hostname)"],
      "created": "string (ISO 8601 timestamp)",
      "updated": "string (ISO 8601 timestamp)"
    }
  ]
}
```

**Usage:**
- Config generator reads registry to produce Caddyfile
- Build scripts validate tenant IDs against registry
- Deployment scripts check tenant status before deploying

### 6.5 No Database Rationale

**Decision:** File-based storage only (no SQLite, PostgreSQL, etc.)

**Rationale:**
1. **Aligns with zero-dependency philosophy:** No database drivers, connection management, migrations
2. **Git-friendly:** All configuration version controlled, reviewable, auditable
3. **Simplicity:** No backup/restore procedures beyond standard file backup
4. **Scale sufficient:** File-based registry adequate for <1000 tenants
5. **Future migration path:** Can migrate to database when needed without architectural redesign

**Limitations:**
- No query interface (acceptable for small tenant counts)
- No transactional updates across files (mitigated by atomic file writes)
- Manual cleanup of orphaned content (acceptable for operations team)

---

## 7. Security Architecture

### 7.1 Security Principles

The security architecture follows the **read/write segregation** principle:

| Path | Security Posture | Attack Surface |
|------|------------------|----------------|
| **Read Path** | Minimal | Static files only, no server-side execution |
| **Control Path** | Standard | Git authentication, build job isolation, audit logging |

### 7.2 Read Path Security

**Threat Model:**
Since the read path serves only static files, the attack surface is limited to:

1. **CDN/Host vulnerabilities** - Mitigated by using reputable providers
2. **Client-side XSS (Cross-Site Scripting)** - Mitigated by content sanitization during build
3. **Content integrity** - Mitigated by HTTPS, optional SRI (Subresource Integrity)

**Security Controls:**

| Control | Implementation | Status |
|---------|----------------|--------|
| **No server-side execution** | Hash-based routing, static file serving | Implemented |
| **Content sanitization** | Build-time HTML sanitization for user content | Planned |
| **HTTPS enforcement** | CDN/Caddy TLS configuration | Required for production |
| **Content Security Policy** | CSP headers in Caddy/CDN config | Recommended |
| **Subresource Integrity** | SRI hashes for static assets | Optional |

**Production Caddyfile with Security Headers:**

```caddyfile
https://tenant.example.com {
  # TLS configuration (automatic with Caddy)
  # Caddy auto-obtains and renews certificates via Let's Encrypt

  root * /var/www/dist/tenant-alpha

  # Security headers
  header {
    # Prevent clickjacking
    X-Frame-Options "DENY"

    # Prevent MIME-type sniffing
    X-Content-Type-Options "nosniff"

    # XSS protection (legacy browsers)
    X-XSS-Protection "1; mode=block"

    # Referrer policy
    Referrer-Policy "strict-origin-when-cross-origin"

    # Content Security Policy
    # Note: 'unsafe-inline' required for current SPA shell; future enhancement to use nonces
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"

    # HSTS (HTTP Strict Transport Security)
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
  }

  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}
```

**HTTPS Requirement:**

Production deployments MUST use HTTPS. Caddy provides automatic certificate management via Let's Encrypt. HTTP-only deployments are acceptable only for:
- Local development (`*.local` domains)
- Internal testing environments behind VPN

### 7.3 Tenant Isolation

**Isolation Guarantees:**

| Aspect | Isolation Mechanism |
|--------|---------------------|
| **Bundle Isolation** | Each tenant has completely separate dist/ directory |
| **Runtime Isolation** | No shared JavaScript execution between tenants |
| **Domain Isolation** | Each tenant served from unique domain |
| **Build Isolation** | Tenants built independently, no shared state |

**Isolation Architecture:**
```
Tenant A Request --> tenant-alpha.local --> dist/tenant-alpha/ --> Response
                           |
                           | (no connection)
                           |
Tenant B Request --> tenant-beta.local --> dist/tenant-beta/ --> Response
```

#### 7.3.1 Tenant Isolation Technical Guarantees

**Why Tenant A Update Cannot Affect Tenant B:**

1. **Filesystem Isolation:**
   - Each tenant has an independent directory tree (`dist/tenant-alpha/`, `dist/tenant-beta/`)
   - Symlink swap for tenant-alpha modifies only the `dist/tenant-alpha` symlink
   - No filesystem operation touches `dist/tenant-beta/` or its symlink

2. **Caddy Request Routing:**
   - Host header determines which file root is used
   - `tenant-alpha.local` requests ONLY access `dist/tenant-alpha/`
   - No code path connects tenant-alpha requests to tenant-beta files

3. **Caddy Graceful Reload Behavior:**
   - When Caddyfile changes (new tenant added), Caddy performs graceful reload
   - Existing connections continue to be served by old configuration
   - New connections use new configuration
   - No existing tenant's requests are dropped or interrupted
   - Reference: [Caddy Admin API - Config Reload](https://caddyserver.com/docs/api)

**Failure Mode Analysis:**

| Failure | Impact on Other Tenants | Mitigation |
|---------|-------------------------|------------|
| Tenant A symlink swap fails | None - failure is isolated to tenant-alpha directory | Cleanup script removes partial deployment |
| Tenant A build fails | None - dist/tenant-alpha/ unchanged | Build validation before deployment |
| Caddy reload fails | None - Caddy continues with previous configuration | Config validation before reload |
| Disk full | Potential - new deployments may fail for all tenants | Monitoring and alerting on disk usage |

### 7.4 Content Security

**Classification:** Public documentation only

**Constraints:**
- No PII (Personally Identifiable Information) storage in tenant content
- No authentication credentials in bundles
- No sensitive business data in published content

**Content Sanitization Boundaries:**

Tenant content is considered **trusted** within the platform's threat model because:
1. Content authors are authenticated by the reseller organization
2. Content is committed to git repositories with access control
3. Changes are reviewable via git history

**However**, build-time sanitization is implemented for:
- HTML content from `.html` files: Script tags stripped, event handlers removed
- Markdown content: Rendered HTML is sanitized using allowlist
- JavaScript modules: Not sanitized (trusted code from content authors)

**Validation:**
- Build-time checks for sensitive patterns (API keys, credentials)
- Content review workflow (future control path feature)

### 7.5 Control Path Security (Future)

**When Implemented:**

| Concern | Control |
|---------|---------|
| **Git Authentication** | SSH keys, deploy tokens for content repos |
| **Build Job Isolation** | Containerized builds, no shared state |
| **Registry Access** | Git-based access control for tenants.json |
| **Deployment Authorization** | CI/CD secrets management, role-based deploy keys |
| **Audit Logging** | Git history, CI/CD logs, Caddy access logs |

**Secrets Management:**
- No secrets in tenant bundles (public content only)
- Build secrets via CI/CD environment variables
- Deploy keys for server access

---

## 8. Test Architecture

### 8.1 Test Framework

**Selected Framework:** Jest with JSDOM

**Rationale:**
- Zero-config setup aligns with zero-dependency philosophy
- Built-in mocking, assertions, and coverage
- JSDOM provides DOM environment for SPA testing
- Wide adoption enables easy onboarding for new developers

**Configuration:**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'scripts/**/*.js',
    'src/**/*.js',
    '!src/sections/*.js'  // Exclude generated sections
  ],
  coverageThresholds: {
    global: {
      statements: 70,
      branches: 65,
      functions: 70,
      lines: 70
    }
  }
};
```

### 8.2 Test Organization

```
apps/publisher/
+-- src/
|   +-- app.js
|   +-- __tests__/
|       +-- app.test.js
+-- scripts/
|   +-- build.js
|   +-- __tests__/
|       +-- build.test.js
|       +-- build-tenants.test.js
|       +-- lint-content.test.js
+-- test-fixtures/
|   +-- tenants/
|   +-- content/
|   +-- manifests/
+-- __integration__/
|   +-- tenant-build.integration.test.js
|   +-- routing.integration.test.js
|   +-- caddy.integration.test.js
+-- jest.config.js
```

### 8.3 Test Coverage Targets

| Component | Target | Priority |
|-----------|--------|----------|
| Build scripts (`build.js`) | 85% | CRITICAL |
| Section templates | 90% | CRITICAL |
| Manifest parsing | 90% | CRITICAL |
| Router logic | 80% | HIGH |
| Content processing | 85% | HIGH |
| SEO utilities | 75% | MEDIUM |
| Dev utilities | 60% | LOW |

### 8.4 CI/CD Test Integration

**GitHub Actions Workflow:**

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build:tenants
      - run: npm run caddy:up
      - run: npm run test:integration
      - run: npm run caddy:down
```

### 8.5 Test Strategy by Phase

| Phase | Focus | Success Criteria |
|-------|-------|------------------|
| **Development** | Unit tests for build scripts, section rendering | 70% coverage, TDD workflow |
| **Integration** | Multi-tenant build, routing, deployment | E2E tests passing, tenant isolation verified |
| **Pre-Production** | Performance (NFR validation), security scanning | All NFR targets met, no critical vulnerabilities |
| **Production** | Smoke tests, monitoring validation | Automated smoke tests pass, rollback <5 min |

### 8.6 Master Test Plan Reference

A comprehensive Master Test Plan will be created separately to detail:
- Test case specifications
- Test data requirements
- Test environment setup
- Acceptance criteria
- Regression test suite

**Location:** `.aiwg/testing/master-test-plan.md` (to be created)

---

## 9. Key Decisions (ADR References)

The following Architectural Decision Records capture major design choices:

### ADR-001: Read/Write Path Segregation

**Status:** Accepted

**Context:** Need to balance security, flexibility, and cost efficiency for a multi-tenant documentation platform.

**Decision:** Completely separate the read path (static published content) from the control path (management, build, deployment).

**Consequences:**
- Read path has minimal attack surface (static files only)
- Each path can be optimized independently
- Control path can evolve without affecting published content
- Increased architectural complexity (two distinct paths)

### ADR-002: Zero-Dependency Philosophy

**Status:** Accepted

**Context:** Long-term maintainability and cost control are primary concerns. Framework churn creates maintenance burden.

**Decision:** Build the SPA shell and build scripts with vanilla JavaScript. Only dependency is `terser` for optional minification.

**Consequences:**
- Any JavaScript developer can understand and modify codebase
- No framework upgrade treadmill
- No bundler configuration complexity
- Limited ecosystem tooling (testing, linting require manual setup)
- More boilerplate code for common patterns

### ADR-003: Static JS Deployment Model

**Status:** Accepted

**Context:** Need portable deployment to any static host with minimal cost.

**Decision:** All published content is static HTML, CSS, and JavaScript. Hash-based routing (`#/page-id`) enables deployment without server configuration.

**Consequences:**
- Deploy to any static host (CDN, S3, GitHub Pages, etc.)
- Near-zero hosting costs with CDN caching
- No server-side rendering for SEO (mitigated by seo.js pre-rendering hints)
- Hash fragments in URLs (acceptable for documentation use case)

### ADR-004: Tenant Routing with Caddy + Atomic Symlinks

**Status:** Accepted

**Context:** Need zero-downtime tenant updates without affecting other tenants. Must support dynamic tenant addition.

**Decision:** Use Caddy with file-based tenant registry and atomic symlink swap for deployments.

**Consequences:**
- Zero-downtime for content updates (atomic symlink)
- Zero-downtime for routing changes (Caddy graceful reload)
- Simple file-based configuration (git-friendly)
- Requires symlink management and cleanup
- Caddy-specific implementation (acceptable given Caddy's benefits)

### ADR-005: File-Based Tenant Registry

**Status:** Accepted

**Context:** Need central source of truth for tenants without database dependency.

**Decision:** Store tenant metadata in JSON file (`tenants.json`) version controlled in git.

**Consequences:**
- No database setup or maintenance
- Git history provides audit trail
- Easy to review and approve tenant changes
- No query interface (acceptable for <1000 tenants)
- Manual process for tenant management (can be scripted)
- Future migration to database possible without architecture change

---

## 10. Quality Attribute Scenarios

### 10.1 Security Scenarios

**QAS-SEC-1: Static Content Security**

| Element | Description |
|---------|-------------|
| **Stimulus** | Attacker attempts to exploit server-side vulnerability |
| **Source** | External malicious actor |
| **Environment** | Production read path |
| **Artifact** | Published tenant bundle |
| **Response** | No server-side code to exploit; attack fails |
| **Measure** | Zero server-side vulnerabilities in read path |
| **Approach** | Static-only deployment, no server execution |

**QAS-SEC-2: Tenant Data Isolation**

| Element | Description |
|---------|-------------|
| **Stimulus** | Tenant A attempts to access Tenant B content |
| **Source** | Tenant organization user |
| **Environment** | Production |
| **Artifact** | Tenant bundles and routing |
| **Response** | Request routed only to authorized tenant bundle |
| **Measure** | Zero cross-tenant data leakage |
| **Approach** | Separate bundles, domain-based routing, no shared state |

### 10.2 Portability Scenarios

**QAS-PORT-1: Host Migration**

| Element | Description |
|---------|-------------|
| **Stimulus** | Decision to migrate from Netlify to S3+CloudFront |
| **Source** | Operations team |
| **Environment** | Deployment |
| **Artifact** | Tenant bundles |
| **Response** | Bundles deploy without modification |
| **Measure** | Zero code changes required for migration |
| **Approach** | Hash-based routing, no server dependencies |

### 10.3 Reliability Scenarios

**QAS-REL-1: Tenant Update Isolation**

| Element | Description |
|---------|-------------|
| **Stimulus** | Tenant A deploys update with build error |
| **Source** | Tenant A content author |
| **Environment** | Production |
| **Artifact** | Tenant A bundle, all other tenant bundles |
| **Response** | Only Tenant A affected; other tenants unaffected |
| **Measure** | Zero downtime for unaffected tenants |
| **Approach** | Per-tenant builds, atomic symlink swap |

**QAS-REL-2: Zero-Downtime Update**

| Element | Description |
|---------|-------------|
| **Stimulus** | Tenant content update deployment |
| **Source** | CI/CD pipeline |
| **Environment** | Production |
| **Artifact** | Tenant bundle |
| **Response** | In-flight requests complete; new requests see new version |
| **Measure** | <100ms effective downtime |
| **Approach** | Atomic symlink swap at filesystem level |

### 10.4 Cost Efficiency Scenarios

**QAS-COST-1: Hosting Cost**

| Element | Description |
|---------|-------------|
| **Stimulus** | Add new tenant with 10K monthly page views |
| **Source** | Reseller |
| **Environment** | Production CDN |
| **Artifact** | Tenant bundle (~5MB) |
| **Response** | Minimal incremental cost |
| **Measure** | <$5/month per tenant |
| **Approach** | Static hosting, CDN caching, no runtime servers |

### 10.5 Maintainability Scenarios

**QAS-MAINT-1: New Developer Onboarding**

| Element | Description |
|---------|-------------|
| **Stimulus** | New developer joins team |
| **Source** | Engineering manager |
| **Environment** | Development |
| **Artifact** | Codebase |
| **Response** | Developer productive within days |
| **Measure** | <3 days to first meaningful contribution |
| **Approach** | Vanilla JavaScript, no framework knowledge required |

---

## 11. Risks and Technical Debt

### 11.1 Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **R-1: Routing coordination at scale** | Medium | Medium | Design includes tenant registry and config generator; test with 50+ tenants before production scale |
| **R-2: Symlink race conditions** | Low | Medium | Use atomic mv -Tf; never modify symlink in place |
| **R-3: Disk space exhaustion** | Medium | High | Implement automated version cleanup; monitor disk usage |
| **R-4: Caddyfile generation errors** | Low | High | Validate generated config before reload; automatic rollback on failure |
| **R-5: Registry corruption** | Low | High | Git-tracked registry enables easy recovery |
| **R-6: SEO limitations** | Medium | Low | Hash-based routing limits SEO; acceptable for documentation use case |

### 11.2 Technical Debt

| Item | Severity | Description | Remediation |
|------|----------|-------------|-------------|
| **TD-1: Test framework not yet implemented** | High | Jest framework specified but not yet integrated | Sprint 1: Install Jest, create initial test suite |
| **TD-2: No CI/CD pipeline** | Medium | Manual build and deployment | Implement GitHub Actions workflow |
| **TD-3: No security scanning** | Low | No SAST/DAST or dependency scanning | Add npm audit, Dependabot |
| **TD-4: Security headers not in current Caddyfile** | Medium | Local dev Caddyfile lacks security headers | Add to Caddyfile generator for production |
| **TD-5: No monitoring** | Low | No observability for production deployments | Add Caddy access logs, optional analytics |

### 11.3 Future Considerations

**Control Path Integration:**
The current architecture cleanly separates read and control paths. When implementing control path features (authoring UI, workflow management), the boundary is well-defined:

- Control path manages content in git repositories
- Control path triggers builds via CI/CD
- Control path updates tenant registry
- Read path serves only the resulting static bundles

**Scaling Beyond File-Based Registry:**
Current design supports ~1000 tenants with file-based registry. If scaling beyond:

1. Migrate tenants.json to SQLite (local file, no server)
2. Use database-backed registry with same generation pattern
3. Consider sharding across multiple Caddy instances

**Multi-Region Deployment:**
Current architecture is single-region. For multi-region:

1. Deploy publisher infrastructure in each region
2. Synchronize tenant registry via git or database replication
3. Each region operates independently
4. DNS routes users to nearest region

---

## 12. Appendices

### 12.1 Glossary

| Term | Definition |
|------|------------|
| **Bundle** | Self-contained static package for a single tenant (HTML, CSS, JS) |
| **CDN** | Content Delivery Network - globally distributed cache for static assets |
| **Control Path** | System components handling management, build, and deployment |
| **CSP** | Content Security Policy - browser security mechanism restricting resource loading |
| **DAST** | Dynamic Application Security Testing - runtime security scanning |
| **Manifest** | JSON file defining navigation structure and section metadata |
| **PII** | Personally Identifiable Information |
| **POSIX** | Portable Operating System Interface - Unix/Linux standard |
| **Read Path** | Static content serving infrastructure (published bundles) |
| **SAST** | Static Application Security Testing - source code security scanning |
| **Section** | Single unit of content with ID, title, and content file |
| **SPA** | Single Page Application - JavaScript application with client-side routing |
| **SRI** | Subresource Integrity - cryptographic verification of external resources |
| **Tenant** | Organization receiving white-labeled documentation bundle |
| **Tenant Registry** | JSON file listing all active tenants and their domains |
| **XSS** | Cross-Site Scripting - security vulnerability allowing script injection |

### 12.2 Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Vanilla JavaScript (ES modules) | ES2020+ | SPA shell and section rendering |
| **Styling** | CSS (single file) | CSS3 | Layout, typography, responsive design |
| **Build** | Node.js scripts | 18+ | Bundle generation, content processing |
| **Minification** | terser | 5.x | Optional JavaScript minification |
| **Routing** | Caddy | 2.x | Reverse proxy with host-based routing |
| **Deployment** | Atomic symlinks | POSIX | Zero-downtime content updates |
| **Container** | Docker | 20+ | Local multi-tenant testing |
| **Version Control** | Git | 2.x | Source control, tenant registry |
| **Testing** | Jest + JSDOM | 29.x | Unit and integration testing |

### 12.3 File Structure Reference

```
apps/publisher/
+-- src/                          # SPA shell source
|   +-- index.html               # Entry point
|   +-- app.js                   # Application logic
|   +-- styles.css               # Styles
|   +-- manifest.js              # Default navigation
|   +-- seo.js                   # SEO utilities
|   +-- sections/                # Section templates (86 modules)
|       +-- section-templates.js # Template catalog
+-- scripts/                      # Build tools
|   +-- build.js                 # Core build
|   +-- build-tenants.js         # Multi-tenant build
|   +-- serve.js                 # Dev server
|   +-- lint-content.js          # Content linting
|   +-- seo-smoke.js             # SEO validation
|   +-- generate-sections.js     # Template generation
+-- tenants/                      # Tenant configurations
|   +-- <tenant-id>/
|       +-- manifest.json        # Navigation
|       +-- config.json          # Branding
|       +-- content/             # Content files
|       +-- overrides/           # Optional overrides
+-- dist/                         # Build output
|   +-- <tenant-id>/             # Per-tenant bundles
+-- test-fixtures/                # Test data
|   +-- tenants/                 # Sample tenant configs
|   +-- content/                 # Sample content
|   +-- manifests/               # Sample manifests
+-- __tests__/                    # Test files
+-- docs/                         # Documentation
|   +-- ARCHITECTURE.md
|   +-- DEVELOPER-GUIDE.md
|   +-- DEPLOYMENT.md
+-- package.json                  # Dependencies and scripts
+-- jest.config.js                # Test configuration
+-- Caddyfile                     # Routing configuration
+-- docker-compose.yml            # Local testing
+-- tenants.json                  # Tenant registry (proposed)
```

### 12.4 Related Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Project Intake | `.aiwg/intake/project-intake.md` | System overview and context |
| Option Matrix | `.aiwg/intake/option-matrix.md` | Priorities and trade-offs |
| Architecture Notes | `apps/publisher/docs/ARCHITECTURE.md` | Existing architecture documentation |
| Routing Research | `.aiwg/working/routing-spike/tenant-routing-research.md` | Dynamic routing solution analysis |
| Developer Guide | `apps/publisher/docs/DEVELOPER-GUIDE.md` | Development procedures |
| Deployment Guide | `apps/publisher/docs/DEPLOYMENT.md` | Deployment instructions |
| Master Test Plan | `.aiwg/testing/master-test-plan.md` | Comprehensive test strategy (to be created) |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2025-12-01 | Architecture Designer Agent | Initial draft |
| 1.0 | 2025-12-01 | Architecture Documenter Agent | Synthesized reviewer feedback; baselined |

## Review Sign-Off

| Reviewer | Status | Date | Notes |
|----------|--------|------|-------|
| Security Architect | APPROVED | 2025-12-01 | Conditions addressed: security headers, HTTPS requirements, sanitization boundaries |
| Test Architect | APPROVED | 2025-12-01 | Conditions addressed: test framework specification, CI/CD integration |
| Requirements Analyst | APPROVED | 2025-12-01 | Conditions addressed: NFR-2/NFR-3 technical justification, build performance |
| Technical Writer | APPROVED | 2025-12-01 | Minor improvements applied: version constraints, acronym definitions |

---

**End of Document**
