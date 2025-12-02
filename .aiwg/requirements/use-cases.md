# Use Case Specifications

**Project:** Pagenary - Multi-Tenant Static Documentation Publisher
**Version:** 1.0
**Date:** 2025-12-01
**Status:** BASELINED

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Core Read Path Use Cases](#2-core-read-path-publisher)
3. [Tenant Management Use Cases](#3-tenant-management-control-path)
4. [Development Operations Use Cases](#4-developmentoperations)
5. [Traceability](#5-traceability)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the use cases for Pagenary, a multi-tenant static documentation publisher. Each use case describes a discrete interaction between actors and the system, detailing the steps, alternative flows, and acceptance criteria.

### 1.2 Scope

This document covers:
- Core read path interactions (viewing, navigating, searching documentation)
- Tenant management operations (configure, update, deploy, remove)
- Development and operations workflows (build, test, troubleshoot)

### 1.3 Actors

| Actor | Description | Responsibilities |
|-------|-------------|------------------|
| **End User** | Person viewing published documentation | Browse documentation, search content, export to print format |
| **Content Author** | Team member creating documentation content | Write content files, update manifests, preview changes |
| **Tenant Administrator** | Organization managing their documentation site | Configure branding, manage domain settings, deploy updates |
| **Platform Operator** | Technical team managing infrastructure | Deploy tenant bundles, configure routing, monitor system health |
| **Developer** | Engineer working on platform code | Build locally, run tests, troubleshoot issues |

### 1.4 Use Case Diagram

```
                            +------------------+
                            |    End User      |
                            +------------------+
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
            [UC-001: View]  [UC-002: Navigate] [UC-003: Search]
                                    |
                                    v
                            [UC-004: Export]

        +------------------+
        | Tenant Admin     |
        +------------------+
                |
        +-------+-------+-------+-------+
        |       |       |       |       |
        v       v       v       v       v
    [UC-005] [UC-006] [UC-007] [UC-008]
    Config   Update   Deploy   Remove

                +------------------+
                | Platform Operator|
                +------------------+
                        |
                +-------+-------+
                |       |       |
                v       v       v
            [UC-007] [UC-009] [UC-010]
            Deploy   Build    Test

                +------------------+
                |    Developer     |
                +------------------+
                        |
                +-------+-------+
                |               |
                v               v
            [UC-009]        [UC-010]
            Build           Test
```

---

## 2. Core Read Path (Publisher)

### UC-001: View Documentation Section

**Use Case ID:** UC-001
**Use Case Name:** View Documentation Section
**Priority:** Critical
**Complexity:** Low

#### Actors
- Primary: End User
- Secondary: None

#### Preconditions
1. Tenant documentation site is deployed and accessible
2. User has network connectivity to the hosting server/CDN
3. User's browser supports ES2020+ JavaScript

#### Main Flow

1. User navigates to tenant documentation URL (e.g., `https://tenant-alpha.example.com`)
2. Browser loads `index.html` and executes `app.js`
3. System reads hash fragment from URL or defaults to welcome section
4. System loads section metadata from embedded `manifest.js`
5. System fetches section content file (Markdown, HTML, or JS module)
6. System renders content using appropriate section template
7. System displays rendered content in canvas area
8. System updates browser title and meta tags for SEO

**Expected Result:** User sees fully rendered documentation section with correct styling, navigation sidebar, and top bar.

#### Alternative Flows

**AF-001a: Invalid Section ID**
- Step 3a: Hash fragment contains non-existent section ID
- Step 3b: System displays "Section not found" error message
- Step 3c: System redirects to default welcome section after 3 seconds

**AF-001b: Content File Missing**
- Step 5a: Content file referenced in manifest does not exist
- Step 5b: System displays "Content not available" message with section metadata
- Step 5c: System logs error to browser console for troubleshooting

**AF-001c: JavaScript Module Error**
- Step 6a: JavaScript module content fails to execute
- Step 6b: System catches error and displays fallback error content
- Step 6c: System logs detailed error to console

**AF-001d: Offline Access**
- Step 2a: User has no network connectivity but page is cached
- Step 2b: Browser loads page from service worker cache (if implemented)
- Step 2c: User can navigate previously viewed sections

#### Postconditions
- User is viewing requested documentation section
- Browser URL contains correct hash fragment
- Browser history includes navigation entry
- Document title reflects current section

#### Acceptance Criteria
- [ ] Page loads within 2 seconds on 3G connection (NFR-P1)
- [ ] All styling and layout elements render correctly
- [ ] Section content is properly formatted (headings, lists, code blocks)
- [ ] Navigation sidebar highlights current section
- [ ] Browser back/forward buttons work correctly with hash routing
- [ ] Console logs contain no JavaScript errors (except for known debug messages)
- [ ] Page is functional without network access if previously cached

#### Component Mapping
- **SPA Shell:** `apps/publisher/src/app.js` (router, navigation)
- **Section Templates:** `apps/publisher/src/sections/section-templates.js`
- **Routing Layer:** Caddy server with host-based routing
- **Content Files:** `tenants/<tenant-id>/content/`

---

### UC-002: Navigate Documentation

**Use Case ID:** UC-002
**Use Case Name:** Navigate Documentation (Sidebar, Hash Routing)
**Priority:** Critical
**Complexity:** Medium

#### Actors
- Primary: End User
- Secondary: None

#### Preconditions
1. User is viewing a documentation section (UC-001 completed)
2. Manifest file contains multiple sections with navigation structure

#### Main Flow

1. User clicks navigation link in sidebar
2. System updates URL hash fragment to target section ID
3. System highlights selected item in sidebar
4. System expands parent navigation group if target is nested
5. System fetches target section content
6. System renders target section in canvas area
7. System scrolls canvas to top
8. System updates browser title and history

**Expected Result:** User navigates to new section smoothly without page reload, sidebar reflects new location, URL is shareable.

#### Alternative Flows

**AF-002a: Navigate via Browser Back Button**
- Step 1a: User clicks browser back button
- Step 1b: Browser triggers hashchange event with previous section ID
- Step 1c: System navigates to previous section (steps 3-8)

**AF-002b: Navigate via Direct URL Entry**
- Step 1a: User manually types URL with hash fragment
- Step 1b: Browser loads page and triggers hashchange event
- Step 1c: System navigates to specified section (steps 3-8)

**AF-002c: Navigate to Nested Section**
- Step 4a: Target section is nested within collapsed group
- Step 4b: System expands all parent groups in navigation tree
- Step 4c: System scrolls sidebar to make target visible

**AF-002d: Navigate to Section with Anchor**
- Step 1a: URL contains hash with anchor (e.g., `#/section-id?anchor=heading`)
- Step 7a: After rendering content, system scrolls to anchor element
- Step 7b: If anchor not found, system scrolls to top

#### Postconditions
- User is viewing target documentation section
- Sidebar reflects current location with highlighting
- Navigation groups are expanded/collapsed appropriately
- URL hash matches current section ID
- Browser history contains navigation entry

#### Acceptance Criteria
- [ ] Navigation occurs without full page reload
- [ ] Transition between sections feels instant (<100ms perceived delay)
- [ ] Sidebar highlighting updates correctly
- [ ] Nested navigation groups expand/collapse as needed
- [ ] Browser back/forward buttons work correctly
- [ ] Direct URL navigation (copy/paste) works correctly
- [ ] Keyboard navigation (Tab, Enter) works for sidebar links
- [ ] Sidebar state (expanded groups) persists during session
- [ ] No console errors during navigation

#### Component Mapping
- **SPA Shell:** `apps/publisher/src/app.js` (router, hashchange handler)
- **Navigation Sidebar:** `apps/publisher/src/index.html` (nav element)
- **Manifest Data:** `tenants/<tenant-id>/manifest.json`
- **Local Storage:** Browser localStorage for sidebar state persistence

---

### UC-003: Search Documentation (Command Palette)

**Use Case ID:** UC-003
**Use Case Name:** Search Documentation via Command Palette
**Priority:** High
**Complexity:** Medium

#### Actors
- Primary: End User
- Secondary: None

#### Preconditions
1. User is viewing documentation site (UC-001 completed)
2. Search index is embedded in tenant bundle
3. Browser supports localStorage

#### Main Flow

1. User presses `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
2. System displays command palette overlay with search input focused
3. User types search query
4. System performs client-side fuzzy search against embedded index
5. System displays matching sections with titles and summaries
6. System highlights matching keywords in results
7. User clicks result or presses Enter
8. System navigates to selected section (UC-002)
9. System closes command palette

**Expected Result:** User finds relevant documentation section quickly, search is fast and responsive, results are relevant.

#### Alternative Flows

**AF-003a: No Search Results**
- Step 5a: Search query matches no sections
- Step 5b: System displays "No results found" message
- Step 5c: System suggests checking spelling or trying different keywords

**AF-003b: Close Without Selection**
- Step 7a: User presses `Esc` key or clicks outside overlay
- Step 7b: System closes command palette without navigation

**AF-003c: Keyboard Navigation of Results**
- Step 6a: User presses `ArrowDown` or `ArrowUp`
- Step 6b: System highlights next/previous result
- Step 6c: User presses `Enter` to select highlighted result

**AF-003d: Recent Search Caching**
- Step 1a: User has searched recently (within session)
- Step 2a: System displays recent searches below input field
- Step 2b: User can click recent search to repeat query

**AF-003e: First-Time Search (Cold Cache)**
- Step 4a: Search index not yet cached in localStorage
- Step 4b: System parses manifest and builds search index
- Step 4c: System caches index in localStorage for future searches
- Step 4d: Subsequent searches use cached index (fast path)

#### Postconditions
- User has navigated to relevant section OR closed palette
- Search query is saved to recent searches (if result selected)
- Search index is cached in localStorage for performance

#### Acceptance Criteria
- [ ] Command palette opens within 100ms of keyboard shortcut (NFR-P3)
- [ ] Search results appear as user types (no explicit search button)
- [ ] Search is fuzzy (tolerates typos, partial matches)
- [ ] Results are ranked by relevance (exact matches first, then partial)
- [ ] Keyboard shortcuts work (Ctrl/Cmd+K open, Esc close, arrows navigate)
- [ ] Command palette overlay is visually distinct and accessible
- [ ] Search works offline (uses cached bundle)
- [ ] Search index includes section titles, summaries, and keywords
- [ ] No performance degradation with large documentation sites (1000+ sections)

#### Component Mapping
- **Command Palette UI:** `apps/publisher/src/app.js` (overlay, input handler)
- **Search Index:** `apps/publisher/src/manifest.js` (embedded at build time)
- **Search Algorithm:** `apps/publisher/src/app.js` (fuzzy matching, Levenshtein distance)
- **Cache:** Browser localStorage for index and recent searches

---

### UC-004: Export Documentation (Print-Ready HTML)

**Use Case ID:** UC-004
**Use Case Name:** Export Documentation to Print-Ready Format
**Priority:** Medium
**Complexity:** Medium

#### Actors
- Primary: End User
- Secondary: None

#### Preconditions
1. User is viewing documentation site (UC-001 completed)
2. Tenant has multiple sections defined in manifest

#### Main Flow

1. User clicks "Export" button in top bar
2. System displays export modal with options (all sections, current group, etc.)
3. User selects export scope and confirms
4. System assembles all selected sections in order
5. System generates table of contents with section links
6. System renders all sections using their templates
7. System combines rendered content into single HTML document
8. System adds timestamp, metadata, and tenant branding
9. System opens print preview dialog
10. User prints to PDF or physical printer

**Expected Result:** User receives comprehensive print-ready document with all sections, formatted consistently, with table of contents.

#### Alternative Flows

**AF-004a: Export Current Section Only**
- Step 3a: User selects "Current section only" option
- Step 5a: System exports only active section (no TOC needed)

**AF-004b: Export Specific Group**
- Step 3a: User selects specific navigation group
- Step 5a: System exports only sections within that group

**AF-004c: Export Fails (Memory Limit)**
- Step 7a: Document is very large (>10MB content)
- Step 7b: Browser hits memory limit during rendering
- Step 7c: System displays error message suggesting exporting smaller groups
- Step 7d: System provides option to export section-by-section

**AF-004d: Cancel Export**
- Step 3a: User clicks "Cancel" in export modal
- Step 3b: System closes modal without exporting

**AF-004e: Download HTML Instead of Print**
- Step 9a: User clicks "Download HTML" option instead of print
- Step 9b: System triggers browser download of standalone HTML file
- Step 9c: Downloaded file includes all styles inline (no external dependencies)

#### Postconditions
- User has print preview open OR downloaded HTML file
- Exported document contains all selected sections
- Document formatting is print-optimized (page breaks, no navigation)

#### Acceptance Criteria
- [ ] Export includes all sections in manifest order
- [ ] Table of contents includes all section titles with page numbers (if printed)
- [ ] Exported document includes timestamp and tenant metadata
- [ ] Print layout is optimized (no broken elements across pages)
- [ ] Code blocks and tables format correctly in print
- [ ] Images scale appropriately for print
- [ ] External links are preserved as footnotes or inline URLs
- [ ] Exported HTML is self-contained (no external CSS/JS dependencies)
- [ ] Export process completes within 10 seconds for 100 sections
- [ ] Browser does not freeze during export process

#### Component Mapping
- **Export Logic:** `apps/publisher/src/app.js` (export handler, assembly)
- **Section Rendering:** `apps/publisher/src/sections/section-templates.js`
- **Print Styles:** `apps/publisher/src/styles.css` (@media print rules)
- **Manifest Data:** `tenants/<tenant-id>/manifest.json` (section order)

---

## 3. Tenant Management (Control Path)

### UC-005: Configure New Tenant

**Use Case ID:** UC-005
**Use Case Name:** Configure New Tenant
**Priority:** Critical
**Complexity:** Medium

#### Actors
- Primary: Tenant Administrator
- Secondary: Platform Operator

#### Preconditions
1. Platform operator has access to tenant configuration repository
2. Tenant administrator has provided branding requirements (colors, logo, domain)
3. Content files are prepared (Markdown, HTML, or JS modules)

#### Main Flow

1. Platform operator creates new tenant directory under `tenants/<tenant-id>/`
2. Operator creates `manifest.json` with navigation structure
3. Operator creates `config.json` with branding settings
4. Operator adds content files to `content/` subdirectory
5. Operator optionally adds override files to `overrides/` subdirectory
6. Operator validates tenant configuration using lint script
7. Operator commits tenant configuration to git repository
8. Operator updates `tenants.json` registry with new tenant entry
9. Operator commits registry update to git
10. System triggers build pipeline for new tenant (see UC-009)

**Expected Result:** New tenant is configured with branding, navigation, and content. Configuration is validated and version-controlled.

#### Alternative Flows

**AF-005a: Invalid Manifest Structure**
- Step 6a: Lint script detects invalid JSON or missing required fields
- Step 6b: System displays specific validation errors
- Step 6c: Operator corrects errors and re-runs validation

**AF-005b: Duplicate Tenant ID**
- Step 8a: Tenant ID already exists in `tenants.json`
- Step 8b: System rejects update with error message
- Step 8c: Operator chooses unique tenant ID and retries

**AF-005c: Missing Content Files**
- Step 6a: Manifest references content file that does not exist
- Step 6b: System warns about missing file
- Step 6c: Operator adds missing file or removes reference from manifest

**AF-005d: Use Tenant Template**
- Step 1a: Operator uses template tenant as starting point
- Step 1b: Operator copies template directory to new tenant ID
- Step 1c: Operator customizes configuration for new tenant

#### Postconditions
- New tenant configuration exists in repository
- Tenant is registered in `tenants.json`
- Configuration is validated and passes all linting checks
- Git history includes tenant creation

#### Acceptance Criteria
- [ ] Tenant directory structure follows standard layout
- [ ] `manifest.json` is valid JSON with required fields (default, sections)
- [ ] `config.json` contains all required branding fields
- [ ] All content files referenced in manifest exist
- [ ] Tenant ID is unique across platform
- [ ] Domain mapping is unique (no domain conflicts)
- [ ] Configuration passes content linting checks
- [ ] Configuration passes SEO validation checks
- [ ] Git commit includes descriptive message
- [ ] Tenant can be built successfully (UC-009)

#### Component Mapping
- **Tenant Directory:** `tenants/<tenant-id>/`
- **Registry:** `tenants.json` (proposed)
- **Lint Script:** `apps/publisher/scripts/lint-content.js`
- **SEO Validation:** `apps/publisher/scripts/seo-smoke.js`
- **Version Control:** Git repository

---

### UC-006: Update Tenant Content (Git Push to Deploy)

**Use Case ID:** UC-006
**Use Case Name:** Update Tenant Content via Git Push
**Priority:** Critical
**Complexity:** Medium

#### Actors
- Primary: Content Author
- Secondary: CI/CD System, Platform Operator

#### Preconditions
1. Tenant is already configured and deployed (UC-005, UC-007 completed)
2. Content author has git repository access
3. CI/CD pipeline is configured with webhook from git repository
4. Target deployment environment is accessible

#### Main Flow

1. Content author clones tenant content repository locally
2. Author edits content files (Markdown, HTML, or JS modules)
3. Author updates manifest if adding/removing sections
4. Author commits changes with descriptive message
5. Author pushes commit to git repository
6. Git webhook triggers CI/CD pipeline job
7. CI/CD job runs build script for affected tenant (UC-009)
8. CI/CD job runs content linting and validation
9. CI/CD job deploys updated tenant bundle (UC-007)
10. CI/CD job verifies deployment with smoke tests
11. System sends notification to content author (success/failure)

**Expected Result:** Updated content is live on tenant documentation site within build time SLA. Other tenants are unaffected.

#### Alternative Flows

**AF-006a: Build Fails (Invalid Content)**
- Step 8a: Content linting detects errors (invalid markdown, missing files)
- Step 8b: CI/CD job fails with detailed error log
- Step 8c: Author receives failure notification with error details
- Step 8d: Author corrects errors and pushes fix

**AF-006b: Deployment Fails (Infrastructure Issue)**
- Step 9a: Deployment script cannot connect to server
- Step 9b: CI/CD job retries deployment up to 3 times
- Step 9c: If all retries fail, job sends alert to platform operator
- Step 9d: Operator investigates and resolves infrastructure issue

**AF-006c: Smoke Test Fails**
- Step 10a: Deployed site returns 404 or 500 errors
- Step 10b: CI/CD job triggers rollback to previous version
- Step 10c: Operator is notified to investigate deployment issue

**AF-006d: Preview Before Production**
- Step 6a: Author pushes to staging branch instead of main
- Step 6b: CI/CD deploys to staging environment (e.g., `staging.tenant.com`)
- Step 6c: Author reviews changes in staging
- Step 6d: Author merges staging to main to trigger production deployment

**AF-006e: Multiple Authors (Concurrent Edits)**
- Step 5a: Git detects merge conflict with another author's changes
- Step 5b: Author resolves conflict locally
- Step 5c: Author pushes merged changes

#### Postconditions
- Updated content is deployed to tenant site
- Previous version is preserved for rollback
- Git history includes content change commit
- CI/CD logs include build and deployment records
- Other tenants remain unaffected (NFR-2)

#### Acceptance Criteria
- [ ] Build completes within 30 seconds (NFR-5)
- [ ] Deployment completes with <100ms downtime (NFR-3)
- [ ] Other tenants experience zero downtime (NFR-2)
- [ ] Failed builds do not deploy broken content
- [ ] Content author receives notification within 5 minutes
- [ ] Previous version is kept for rollback (at least 3 versions)
- [ ] Smoke tests verify site accessibility after deployment
- [ ] All linting checks pass before deployment
- [ ] Git commit message is included in deployment logs

#### Component Mapping
- **Content Repository:** Git repository with tenant configurations
- **CI/CD Pipeline:** GitHub Actions, GitLab CI, or similar
- **Build Scripts:** `apps/publisher/scripts/build-tenants.js`
- **Deployment Script:** `apps/publisher/scripts/deploy-tenant.js` (proposed)
- **Smoke Tests:** Automated HTTP checks for 200 OK responses
- **Notification System:** Email, Slack, or CI/CD native notifications

---

### UC-007: Deploy Tenant Bundle (Zero-Downtime)

**Use Case ID:** UC-007
**Use Case Name:** Deploy Tenant Bundle with Zero-Downtime
**Priority:** Critical
**Complexity:** High

#### Actors
- Primary: Platform Operator
- Secondary: CI/CD System

#### Preconditions
1. Tenant bundle is built and validated (UC-009 completed)
2. Target deployment server is accessible
3. Caddy server is running and configured for tenant
4. Sufficient disk space is available (build size + 3x for versions)

#### Main Flow

1. Operator initiates deployment script with tenant ID and bundle path
2. Script validates bundle structure (index.html, manifest.js present)
3. Script generates timestamped directory name (e.g., `tenant-alpha-1701234567`)
4. Script creates timestamped directory under `dist/`
5. Script copies bundle files to timestamped directory
6. Script verifies copy completed successfully (checksum validation)
7. Script creates temporary symlink pointing to new timestamped directory
8. Script performs atomic rename of temporary symlink to production path
9. Script verifies symlink points to correct directory
10. Script triggers health check on deployed bundle
11. Script cleans up old versions (keeps 3 most recent)
12. Script logs deployment to audit log

**Expected Result:** New tenant bundle is live with zero downtime for ongoing requests. Previous version is preserved for rollback.

#### Alternative Flows

**AF-007a: First-Time Tenant Deployment**
- Step 1a: Tenant has no existing deployment
- Step 3a: Script creates initial directory structure
- Step 8a: No existing symlink to replace (creates new symlink)
- Step 11a: No old versions to clean up

**AF-007b: Disk Space Insufficient**
- Step 5a: Copy operation fails with disk full error
- Step 5b: Script aborts deployment before creating symlink
- Step 5c: Script sends alert to operator
- Step 5d: Operator frees disk space and retries

**AF-007c: Copy Fails Midway**
- Step 6a: Checksum validation detects incomplete copy
- Step 6b: Script removes incomplete timestamped directory
- Step 6c: Script reports failure without modifying production symlink
- Step 6d: Operator investigates and retries

**AF-007d: Health Check Fails**
- Step 10a: Health check HTTP request returns non-200 status
- Step 10b: Script initiates immediate rollback to previous version
- Step 10c: Script updates symlink to previous timestamped directory
- Step 10d: Script sends alert with failure details

**AF-007e: Rollback to Previous Version**
- Step 1a: Operator initiates rollback command with tenant ID
- Step 7a: Script creates symlink pointing to previous timestamped directory
- Step 8a: Script performs atomic rename (same as forward deployment)

**AF-007f: New Tenant (First Deployment)**
- Step 1a: Tenant not yet in Caddy routing configuration
- Step 12a: Script updates `tenants.json` registry
- Step 12b: Script regenerates Caddyfile
- Step 12c: Script triggers Caddy graceful reload
- Step 12d: New tenant becomes accessible at configured domain

#### Postconditions
- New bundle is deployed and accessible via tenant domain
- Symlink points to new timestamped directory
- Previous versions are preserved for rollback
- Old versions beyond retention limit are deleted
- Deployment is logged for audit trail
- If new tenant, Caddy configuration includes routing entry

#### Acceptance Criteria
- [ ] Deployment completes with <100ms downtime (NFR-3, atomic symlink swap)
- [ ] In-flight requests to old version complete successfully
- [ ] New requests see new version immediately after deployment
- [ ] Other tenants experience zero downtime (NFR-2)
- [ ] Failed deployments do not modify production symlink
- [ ] Rollback can be performed within 5 minutes
- [ ] At least 3 previous versions are retained
- [ ] Deployment logs include timestamp, operator, and bundle hash
- [ ] Health check verifies site returns 200 OK
- [ ] Symlink integrity is verified after atomic swap
- [ ] Cleanup removes only old versions (not current or recent)

#### Component Mapping
- **Deployment Script:** `apps/publisher/scripts/deploy-tenant.js` (proposed)
- **File Operations:** Node.js `fs` module with atomic `fs.rename()`
- **Health Check:** Simple HTTP GET request via `fetch()` or `curl`
- **Caddy Config:** `apps/publisher/scripts/generate-caddyfile.js` (proposed)
- **Caddy Reload:** Caddy Admin API (`caddy reload --config`)
- **Audit Log:** Structured log file or syslog integration

---

### UC-008: Remove or Disable Tenant

**Use Case ID:** UC-008
**Use Case Name:** Remove or Disable Tenant
**Priority:** Medium
**Complexity:** Low

#### Actors
- Primary: Platform Operator
- Secondary: None

#### Preconditions
1. Tenant is currently active and deployed
2. Operator has confirmed removal/disable request
3. Operator has git repository access

#### Main Flow

**Disable Tenant (Soft Delete):**
1. Operator updates `tenants.json` to set `enabled: false` for tenant
2. Operator commits registry change to git
3. Operator regenerates Caddyfile (excludes disabled tenant)
4. Operator triggers Caddy graceful reload
5. Tenant domain returns 404 or redirect to notice page
6. Tenant files remain on disk for potential re-enable

**Remove Tenant (Hard Delete):**
1. Operator updates `tenants.json` to remove tenant entry
2. Operator commits registry change to git
3. Operator regenerates Caddyfile (excludes removed tenant)
4. Operator triggers Caddy graceful reload
5. Operator removes tenant directory from `tenants/<tenant-id>/`
6. Operator removes tenant bundles from `dist/tenant-<id>*`
7. Operator commits file deletions to git

**Expected Result:** Tenant is no longer accessible via configured domain. Resources are freed (hard delete) or preserved (soft delete).

#### Alternative Flows

**AF-008a: Re-enable Disabled Tenant**
- Step 1a: Operator updates `tenants.json` to set `enabled: true`
- Step 2a: Operator follows same regenerate and reload process
- Step 3a: Tenant becomes accessible again without rebuild

**AF-008b: Remove Tenant with Redirect**
- Step 5a: Instead of 404, operator configures Caddy to redirect to notice page
- Step 5b: Caddyfile includes `redir https://example.com/notice` for tenant domain

**AF-008c: Archive Tenant Before Removal**
- Step 1a: Operator creates archive of tenant files (tar.gz)
- Step 1b: Operator stores archive in backup location
- Step 1c: Operator proceeds with hard delete process

#### Postconditions
- Tenant domain is inaccessible or redirects to notice page
- Caddy routing configuration excludes tenant
- Tenant registry reflects disable/remove status
- Disk space is freed (if hard delete)
- Git history includes removal commit

#### Acceptance Criteria
- [ ] Disable operation completes within 30 seconds
- [ ] Remove operation completes within 2 minutes
- [ ] Other tenants experience zero downtime during operation (NFR-2)
- [ ] Caddy graceful reload succeeds
- [ ] Tenant domain returns expected response (404, redirect, or notice)
- [ ] Git history includes reason for removal/disable
- [ ] Archived backup exists before hard delete (if requested)
- [ ] No orphaned files remain after hard delete

#### Component Mapping
- **Registry:** `tenants.json`
- **Caddy Config:** `apps/publisher/scripts/generate-caddyfile.js`
- **Caddy Reload:** Caddy Admin API
- **File Operations:** Node.js `fs` module or shell commands

---

## 4. Development/Operations

### UC-009: Build Tenant Bundles (Local Development)

**Use Case ID:** UC-009
**Use Case Name:** Build Tenant Bundles Locally
**Priority:** Critical
**Complexity:** Medium

#### Actors
- Primary: Developer
- Secondary: Platform Operator, CI/CD System

#### Preconditions
1. Developer has repository cloned locally
2. Node.js 18+ is installed
3. Tenant configurations exist in `tenants/` directory
4. Dependencies are installed (`npm install`)

#### Main Flow

1. Developer runs build command: `npm run build:tenants [tenant-id]`
2. Build script reads `tenants/` directory or specified tenant
3. For each tenant:
   - Script reads `manifest.json` and `config.json`
   - Script validates configuration structure
   - Script creates output directory `dist/<tenant-id>/`
   - Script copies SPA shell files (index.html, app.js, styles.css)
   - Script processes content files:
     - Markdown files converted to HTML
     - HTML files copied as-is
     - JavaScript modules validated
   - Script applies tenant branding overrides
   - Script generates embedded manifest.js with navigation
   - Script optionally minifies JavaScript (if MINIFY=true)
   - Script validates output structure
4. Build script reports success and output paths
5. Developer verifies build output in `dist/` directory

**Expected Result:** Static tenant bundles are generated in `dist/` directory, ready for deployment or local testing.

#### Alternative Flows

**AF-009a: Build Single Tenant**
- Step 2a: Developer specifies tenant ID as argument
- Step 3a: Script builds only specified tenant

**AF-009b: Build Fails (Invalid Config)**
- Step 3a: Manifest validation detects invalid JSON or missing fields
- Step 3b: Script stops with detailed error message
- Step 3c: Developer corrects configuration and rebuilds

**AF-009c: Build Fails (Missing Content)**
- Step 3a: Content file referenced in manifest does not exist
- Step 3b: Script logs warning and continues (placeholder content)
- Step 3c: Build completes but developer is notified of missing files

**AF-009d: Build with Watch Mode**
- Step 1a: Developer runs `npm run dev` (includes watch mode)
- Step 2a: Build completes initial build
- Step 2b: Build script watches for file changes
- Step 2c: On change, script rebuilds affected tenant automatically

**AF-009e: Build with Minification Disabled**
- Step 1a: Developer sets environment variable `MINIFY=false`
- Step 3a: Script skips minification step for faster builds

**AF-009f: Build Fails (Disk Space)**
- Step 3a: Output directory creation fails due to disk full
- Step 3b: Script reports error with disk space details
- Step 3c: Developer frees space and retries

#### Postconditions
- Tenant bundles exist in `dist/` directory
- Each bundle is self-contained and deployable
- Build log includes success/failure status and timing
- If errors occurred, developer has actionable error messages

#### Acceptance Criteria
- [ ] Build completes within 30 seconds per tenant (NFR-5)
- [ ] Generated bundles are valid static sites (index.html present)
- [ ] All content files are processed correctly
- [ ] Manifest.js is embedded with correct navigation structure
- [ ] Branding overrides are applied correctly
- [ ] Minification reduces bundle size by >30% (when enabled)
- [ ] Build script exits with non-zero code on failure
- [ ] Build log includes per-tenant timing information
- [ ] Watch mode detects file changes within 1 second
- [ ] Parallel builds do not interfere with each other

#### Component Mapping
- **Build Script:** `apps/publisher/scripts/build-tenants.js`
- **Core Build:** `apps/publisher/scripts/build.js`
- **Content Lint:** `apps/publisher/scripts/lint-content.js`
- **Minification:** `terser` npm package
- **Output Directory:** `apps/publisher/dist/`

---

### UC-010: Test Multi-Tenant Routing (Local Caddy)

**Use Case ID:** UC-010
**Use Case Name:** Test Multi-Tenant Routing Locally
**Priority:** High
**Complexity:** Medium

#### Actors
- Primary: Developer
- Secondary: Platform Operator

#### Preconditions
1. Tenant bundles are built (UC-009 completed)
2. Docker is installed and running
3. `/etc/hosts` file includes tenant domain mappings
4. Port 80 (or configured port) is available

#### Main Flow

1. Developer adds tenant domains to `/etc/hosts`:
   ```
   127.0.0.1 tenant-alpha.local
   127.0.0.1 tenant-beta.local
   ```
2. Developer runs `npm run caddy:up`
3. Docker Compose starts Caddy container
4. Caddy loads Caddyfile with host-based routing
5. Developer opens browser to `http://tenant-alpha.local`
6. Browser resolves to localhost (127.0.0.1)
7. Caddy routes request to `dist/tenant-alpha/`
8. Browser displays tenant-alpha documentation
9. Developer tests navigation, search, and export features
10. Developer opens second browser tab to `http://tenant-beta.local`
11. Browser displays tenant-beta documentation (different content/branding)
12. Developer verifies tenant isolation (no shared state)
13. Developer runs `npm run caddy:down` to stop testing

**Expected Result:** Multiple tenants are accessible via local domains, routing works correctly, tenants are isolated.

#### Alternative Flows

**AF-010a: Port 80 Occupied**
- Step 3a: Docker Compose fails to bind port 80
- Step 3b: Developer sets `DOCS_TOOLKIT_PORT=8080` environment variable
- Step 3c: Developer retries with port 8080
- Step 3d: Developer accesses via `http://tenant-alpha.local:8080`

**AF-010b: Caddy Configuration Error**
- Step 4a: Caddy fails to parse Caddyfile
- Step 4b: Docker logs show specific syntax error
- Step 4c: Developer corrects Caddyfile and restarts

**AF-010c: Missing Host Entry**
- Step 6a: Browser cannot resolve `tenant-alpha.local`
- Step 6b: Developer realizes `/etc/hosts` entry is missing
- Step 6c: Developer adds entry and retries

**AF-010d: Hot Reload Configuration**
- Step 9a: Developer edits Caddyfile while Caddy is running
- Step 9b: Developer runs `npm run caddy:reload`
- Step 9c: Caddy reloads configuration without stopping
- Step 9d: Developer verifies updated routing

**AF-010e: Test Routing with New Tenant**
- Step 1a: Developer builds new tenant (UC-009)
- Step 1b: Developer adds new domain to `/etc/hosts`
- Step 1c: Developer updates Caddyfile with new tenant entry
- Step 1d: Developer reloads Caddy configuration
- Step 1e: Developer verifies new tenant is accessible

#### Postconditions
- Caddy container is running (or stopped if testing complete)
- Multiple tenant sites are accessible via local domains
- Developer has verified routing and tenant isolation
- `/etc/hosts` file includes tenant domain mappings

#### Acceptance Criteria
- [ ] Caddy container starts within 5 seconds
- [ ] Each tenant domain routes to correct bundle
- [ ] Tenant isolation is verified (no cross-tenant requests)
- [ ] Navigation within tenant site works correctly
- [ ] Command palette search works (per-tenant index)
- [ ] Export functionality works for each tenant
- [ ] Browser developer tools show no CORS errors
- [ ] Caddy logs show successful requests for each tenant
- [ ] Graceful reload updates routing without downtime
- [ ] Docker Compose down stops container cleanly

#### Component Mapping
- **Docker Compose:** `apps/publisher/docker-compose.yml`
- **Caddyfile:** `apps/publisher/Caddyfile`
- **Caddy Container:** Official Caddy Docker image
- **Tenant Bundles:** `apps/publisher/dist/`
- **Host Mapping:** `/etc/hosts` or equivalent

---

## 5. Traceability

### 5.1 Use Case to Component Mapping

| Use Case | Primary Components | Secondary Components |
|----------|-------------------|---------------------|
| UC-001: View Section | `app.js` (router), `section-templates.js` | `index.html`, `styles.css`, content files |
| UC-002: Navigate | `app.js` (hashchange handler), `index.html` (sidebar) | `manifest.json`, localStorage |
| UC-003: Search | `app.js` (command palette), `manifest.js` (search index) | localStorage |
| UC-004: Export | `app.js` (export handler), `section-templates.js` | `styles.css` (print rules) |
| UC-005: Configure | `tenants/` directory, `tenants.json` | `lint-content.js`, `seo-smoke.js` |
| UC-006: Update Content | Git repository, CI/CD pipeline | `build-tenants.js`, `deploy-tenant.js` |
| UC-007: Deploy | `deploy-tenant.js` (proposed), Caddy | `generate-caddyfile.js`, health checks |
| UC-008: Remove/Disable | `tenants.json`, `generate-caddyfile.js` | Caddy Admin API |
| UC-009: Build | `build-tenants.js`, `build.js` | `terser`, `lint-content.js` |
| UC-010: Test Routing | `docker-compose.yml`, `Caddyfile` | Docker, `/etc/hosts` |

### 5.2 Use Case to NFR Mapping

| Use Case | Related NFRs |
|----------|-------------|
| UC-001: View Section | NFR-P1 (page load <2s), NFR-SEC1 (no server-side execution) |
| UC-002: Navigate | NFR-P1 (responsive navigation) |
| UC-003: Search | NFR-P3 (search <100ms) |
| UC-004: Export | NFR-M1 (zero runtime dependencies) |
| UC-005: Configure | NFR-M2 (limited build dependencies) |
| UC-006: Update Content | NFR-O1 (update anytime), NFR-R2 (no downtime for others) |
| UC-007: Deploy | NFR-R2 (zero downtime for others), NFR-R3 (<100ms outage), NFR-O3 (rollback <5min) |
| UC-008: Remove/Disable | NFR-R2 (zero downtime for others) |
| UC-009: Build | NFR-P2 (build <30s), NFR-S2 (support 1000+ sections) |
| UC-010: Test Routing | NFR-PORT2 (run locally without network) |

### 5.3 Use Case Priority Matrix

| Priority | Use Cases |
|----------|-----------|
| **Critical** | UC-001, UC-002, UC-005, UC-006, UC-007, UC-009 |
| **High** | UC-003, UC-010 |
| **Medium** | UC-004, UC-008 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-01 | Requirements Analyst Agent | Initial baseline |

---

**End of Document**
