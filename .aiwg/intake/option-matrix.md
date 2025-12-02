# Option Matrix (Project Context & Intent)

**Purpose**: Capture what this project IS - its nature, audience, constraints, and intent - to determine appropriate SDLC framework application (templates, commands, agents, rigor levels).

**Generated**: 2025-12-01 (from codebase analysis)

---

## Step 1: Project Reality

### What IS This Project?

**Project Description** (in natural language):

```
Multi-tenant static documentation publishing platform for resellers to white-label shared
documentation templates into tenant-specific branded bundles. Built with zero-dependency
philosophy (vanilla JavaScript, no frameworks), designed for ultra-low-cost deployment
(any static host). Currently pre-production (1 solo developer, comprehensive architecture,
0 deployed tenants, 2 sample tenant configs). Monorepo structure anticipates future
expansion (upstream authoring, workflow, billing workspaces). 232 files (86% JavaScript),
86 section modules, Docker Caddy for local multi-tenant domain testing.
```

### Audience & Scale

**Who uses this?** (from codebase analysis):

- [x] **Small team (2-10 people, known individuals)** - Resellers managing tenant configurations
- [x] **External customers (100-10k users, paying or free)** - Tenant organizations receiving branded docs
- [ ] Just me (personal project)
- [ ] Department (10-100 people, organization-internal)
- [ ] Large scale (10k-100k+ users, public-facing)

**Audience Characteristics**:
- **Technical sophistication**: Mixed (resellers technical, end-users may be non-technical)
- **User risk tolerance**: Expects stability (documentation is business-critical for tenants)
- **Support expectations**: Best-effort initially, SLA as tenants scale (estimated)

**Usage Scale** (estimated/projected):
- **Active users**: 0 current, projected 3-5 tenants at launch, 10-20 tenants within 12 months
- **Request volume**: N/A (static site, CDN-served)
- **Data volume**: <1 GB (static documentation bundles)
- **Geographic distribution**: Regional initially (US), potentially Global (CDN supports multi-region)

### Deployment & Infrastructure

**Expected Deployment Model** (inferred from codebase):

- [x] **Static site (HTML/CSS/JS, no backend, hosted files)** - Primary deployment model
  - **Evidence**: Hash-based routing, zero server-side rendering, build outputs to dist/
  - **Target hosts**: Netlify, Vercel, Cloudflare Pages, S3+CloudFront, GitHub Pages

- [x] **Full-stack application (frontend + backend + database + supporting services)** - Future evolution
  - **Evidence**: Monorepo structure with `apps/` directory, README mentions "upstream authoring, workflow, billing"
  - **Current state**: Only publisher app implemented, others planned

- [ ] Client-only (desktop app, mobile app, CLI tool)
- [ ] Client-server (SPA + API backend)
- [ ] Multi-system (microservices, service mesh)
- [ ] Distributed application (edge, P2P, blockchain)
- [ ] Embedded/IoT
- [ ] Hybrid

**Where does this run?** (from infrastructure analysis):

- [x] **Cloud platform (AWS, GCP, Azure, Vercel, Netlify, GitHub Pages)** - Target deployment
  - **Evidence**: DEPLOYMENT.md mentions S3+CloudFront, Netlify, Vercel, Render

- [x] **Local only (laptop, desktop, not deployed)** - Current state
  - **Evidence**: Docker Caddy for local testing, no production deployment detected

- [ ] Personal hosting (VPS, shared hosting)
- [ ] On-premise (company servers)
- [ ] Hybrid (cloud + on-premise)
- [ ] Edge/CDN (distributed globally)
- [ ] Mobile (iOS, Android)
- [ ] Desktop (Windows, macOS, Linux)
- [ ] Browser (extension, PWA)

**Infrastructure Complexity**:
- **Deployment type**: Static site (current), Multi-tier (future with upstream workspaces)
- **Data persistence**: File system (build-time content), Future: Database for authoring/workflow
- **External dependencies**: 0 (zero-dependency philosophy)
- **Network topology**: Standalone (static site), Future: Multi-tier (when backend workspaces added)

### Technical Complexity

**Codebase Characteristics** (from analysis):
- **Size**: 1k-10k LoC (232 files, predominantly JavaScript)
- **Languages**: JavaScript (primary), Markdown/HTML/CSS (secondary)
- **Architecture**: Modular (86 section modules, clear separation: shell, templates, build scripts, tenants)
- **Team familiarity**: Greenfield (initial commit 2025-09-26, solo developer)

**Technical Risk Factors** (from codebase):

- [ ] Performance-sensitive (latency, throughput critical)
  - **Note**: Static site architecture makes performance trivial (CDN handles scale)

- [ ] Security-sensitive (PII, payments, authentication)
  - **Note**: Public documentation only, no authentication, no sensitive data

- [ ] Data integrity-critical (financial, medical, legal records)
  - **Note**: Documentation content, not business-critical data

- [x] **Complex business logic (many edge cases, domain rules)** - Moderate complexity
  - **Evidence**: Multi-tenant configuration, content type handling (Markdown, HTML, JS modules), manifest parsing, tenant overrides

- [ ] High concurrency (many simultaneous users/processes)
  - **Note**: Static site, CDN handles concurrency

- [ ] Integration-heavy (many external systems, APIs, protocols)
  - **Note**: Zero external integrations detected

---

## Step 2: Constraints & Context

### Resources

**Team** (from git analysis):
- **Size**: 1 developer (solo), potentially expanding to 2-3 for upstream workspaces
- **Experience**: Senior (inferred from architecture quality, zero-dependency philosophy, comprehensive documentation)
- **Availability**: Unknown (assumed part-time or side project based on single initial commit)

**Budget** (inferred):
- **Development**: Zero/minimal (solo developer, no paid tools detected)
- **Infrastructure**: Free tier initially (static hosting has generous free tiers), <$50/month at scale (CDN + domain costs)
- **Timeline**: No explicit deadline (greenfield, no urgency indicators)

### Regulatory & Compliance

**Data Sensitivity** (from security analysis):

- [x] **Public data only (no privacy concerns)** - Primary data type
  - **Evidence**: Documentation content, no authentication, no user accounts

- [ ] User-provided content (email, profile, preferences)
- [ ] Personally Identifiable Information (PII)
- [ ] Payment information (credit cards)
- [ ] Protected Health Information (PHI)
- [ ] Sensitive business data

**Regulatory Requirements** (from compliance analysis):

- [x] **None (no specific regulations)** - Current state
  - **Note**: May change if future "billing workspace" handles payments (PCI-DSS) or if EU customers require GDPR

- [ ] GDPR (EU users)
- [ ] CCPA (California users)
- [ ] HIPAA (healthcare)
- [ ] PCI-DSS (payments)
- [ ] SOX (financial reporting)
- [ ] FedRAMP (US government)
- [ ] ISO27001
- [ ] SOC2

**Contractual Obligations** (inferred):

- [x] **None (no contracts)** - Current state (pre-revenue)

- [ ] SLA commitments
- [ ] Security requirements
- [ ] Compliance certifications
- [ ] Data residency
- [ ] Right to audit

**Note**: If platform becomes commercial (billing workspace), may require SLA and security commitments to enterprise customers.

### Technical Context

**Current State** (for existing projects):
- **Current stage**: Prototype → MVP (comprehensive architecture, limited testing/CI/CD, pre-production)
- **Test coverage**: Minimal (57 test-related code snippets, no formal test framework, 0% automated coverage)
- **Documentation**: Comprehensive (README, 6 detailed docs/ guides, CLAUDE.md, inline comments)
- **Deployment automation**: Manual (no CI/CD, Docker Caddy for local testing only)

**Technical Debt** (for existing projects):
- **Severity**: Minor (pre-production, no production debt accumulated)
- **Type**: Testing (no test framework), CI/CD (no automation), Versioning (no git tags/releases)
- **Priority**: Should address before production launch (testing + CI/CD critical for reliability)

---

## Step 3: Priorities & Trade-offs

### What Matters Most?

**Inferred Priorities** (based on codebase analysis, no user interview):

1. **Cost efficiency** (highest priority)
   - **Evidence**: Zero-dependency philosophy, static site architecture, "minimal hosting costs" in README
   - **Weight**: 0.40

2. **Quality & security** (high priority)
   - **Evidence**: Comprehensive documentation, modular architecture, clear separation of concerns
   - **Weight**: 0.30

3. **Reliability & scale** (medium priority)
   - **Evidence**: Static site architecture inherently reliable and scalable, CDN deployment model
   - **Weight**: 0.20

4. **Speed to delivery** (lower priority)
   - **Evidence**: Single commit (not rapid iteration), comprehensive upfront architecture
   - **Weight**: 0.10

**Priority Weights** (must sum to 1.0):

| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| **Delivery speed** | 0.10 | Pre-production project, no urgency indicators, thorough upfront design suggests deliberate over fast |
| **Cost efficiency** | 0.40 | Zero-dependency philosophy, static site architecture, designed for "inexpensive hosting" (per README) |
| **Quality/security** | 0.30 | Comprehensive documentation, modular architecture, clean code patterns |
| **Reliability/scale** | 0.20 | Static site architecture makes this "free" (CDN handles scale), but still valued |
| **TOTAL** | **1.00** |

**Note**: These are inferred from codebase. Interactive questions would refine these weights based on actual user priorities.

### Trade-off Context

**What are you optimizing for?** (inferred from codebase):

```
Ultra-low operational cost combined with architectural quality. The zero-dependency
philosophy and static site architecture suggest optimizing for long-term maintainability
and minimal ongoing costs over rapid feature delivery. Comprehensive upfront documentation
indicates preference for "doing it right" over "shipping fast and iterating."

Key insight: The monorepo structure (apps/) anticipates future expansion while keeping
current deployment simple (static files). This is "build for the future, ship simple now."
```

**What are you willing to sacrifice?** (inferred from gaps):

```
1. Automated testing (57 test snippets but no test framework - trading test coverage for development speed initially)
2. CI/CD automation (manual deployment - trading automation for simplicity in early stages)
3. Rapid iteration (single commit suggests thorough upfront design over continuous deployment)
4. Framework dependencies (zero-dependency philosophy trades ecosystem tooling for long-term control)
```

**What is non-negotiable?** (inferred from architecture):

```
1. Zero dependencies (terser is only dev dependency - maintainability and cost are core values)
2. Static site deployment (no server-side complexity - simplicity and portability non-negotiable)
3. Multi-tenant architecture (core business model - tenant isolation and branding critical)
4. Documentation quality (6 detailed guides suggest documentation is first-class concern)
```

---

## Step 4: Intent & Decision Context

### Why This Intake Now?

**What triggered this intake?** (inferred from context):

- [x] **Starting new project (need to plan approach)** - Primary trigger
  - **Evidence**: Greenfield project (initial commit September 2025), AIWG setup initiated December 2025

- [x] **Documenting existing project (never had formal intake)** - Secondary trigger
  - **Evidence**: Comprehensive architecture exists, intake documents will formalize for SDLC adoption

- [x] **Preparing for scale/growth (need more structure)** - Future consideration
  - **Evidence**: Monorepo structure anticipates "upstream authoring, workflow, billing" workspaces

- [ ] Compliance requirement
- [ ] Team expansion (immediate)
- [ ] Technical pivot
- [ ] Handoff/transition
- [ ] Funding/business milestone

**What decisions need making?** (inferred from analysis gaps):

```
1. **Testing strategy**: What test coverage is "enough" for a static site generator?
   - Current: 0% automated
   - Options: 40% (MVP baseline), 60% (Production standard), 80%+ (Enterprise)
   - Decision driver: Solo developer constraints vs. multi-tenant reliability needs

2. **CI/CD investment timing**: When to automate deployment?
   - Current: Manual deployment
   - Options: Before first tenant, after 3-5 tenants validate model, when team expands
   - Decision driver: Solo developer time vs. operational risk

3. **Hosting selection**: Which static host for production?
   - Options: Netlify (simplest), Vercel (Next.js future-compatible), Cloudflare Pages (global), S3+CloudFront (most control)
   - Decision driver: Cost, features, multi-tenant domain handling

4. **Upstream workspace priority**: When to build authoring/workflow/billing?
   - Current: Publisher only
   - Options: Validate publisher with tenants first, build authoring for better UX, build billing for revenue
   - Decision driver: Product-market fit validation vs. feature completeness
```

**What's uncertain or controversial?** (inferred from architecture):

```
1. **Zero-dependency philosophy scalability**: As upstream workspaces (authoring, workflow, billing)
   are added, will zero-dependency approach remain viable? Authentication, databases, and business
   logic may require frameworks.

2. **Monolith vs. Microservices**: Monorepo structure suggests keeping workspaces together, but
   future billing/workflow may benefit from separate deployments. When to split?

3. **Static vs. Dynamic**: Current publisher is static, but "upstream authoring" suggests dynamic
   content management. How to preserve static deployment simplicity while adding dynamic editing?
```

**Success criteria for this intake process** (inferred goals):

```
1. Clear SDLC framework application: Which templates, commands, agents are relevant for this project type
2. Production readiness roadmap: What needs to happen before first tenant deployment
3. Testing and CI/CD strategy: Minimum viable automation for solo developer
4. Upstream workspace prioritization: Which to build first, when to expand
5. Profile evolution path: Prototype → MVP → Production → Enterprise migration plan
```

---

## Step 5: Framework Application

### Relevant SDLC Components

Based on project reality (static site, multi-tenant, solo developer, pre-production) and priorities (cost efficiency, quality):

**Templates** (applicable components):

- [x] **Intake** (project-intake, solution-profile, option-matrix) - **Currently using**
- [x] **Architecture** (SAD, ADRs, API contracts) - **Recommended**
  - **Rationale**: Multi-tenant architecture and monorepo expansion benefit from formal architecture docs
  - **Priority**: High (document design decisions before they're forgotten, especially zero-dependency philosophy)

- [x] **Test** (test-strategy, test-plan, test-cases) - **Recommended**
  - **Rationale**: Multi-tenant reliability requires testing, even for static site
  - **Priority**: High (before production launch)

- [x] **Deployment** (deployment-plan, runbook, ORR) - **Recommended**
  - **Rationale**: Multi-tenant deployment complexity (domain mapping, SSL, CDN config) benefits from runbook
  - **Priority**: Medium (before scaling beyond 3-5 tenants)

- [ ] **Requirements** (user-stories, use-cases, NFRs) - **Optional/Deferred**
  - **Rationale**: Solo developer with clear vision doesn't need heavy requirements docs
  - **Defer until**: Team expands or unclear feature requests emerge

- [ ] **Security** (threat-model, security-requirements) - **Deferred**
  - **Rationale**: Public documentation, no authentication, minimal attack surface
  - **Defer until**: Upstream workspaces add authentication or handle sensitive data

- [ ] **Governance** (decision-log, CCB-minutes, RACI) - **Not applicable**
  - **Rationale**: Solo developer doesn't need coordination overhead
  - **Add when**: Team size ≥ 3

**Commands** (applicable for workflows):

- [x] **Intake commands** (intake-wizard, intake-from-codebase, intake-start) - **Currently using**

- [x] **Flow commands** (iteration, discovery, delivery) - **Recommended**
  - **Relevant**: `/flow-iteration-dual-track` for feature development
  - **Rationale**: Even solo developer benefits from Discovery (plan) + Delivery (build) separation
  - **Priority**: Medium (adopt for upstream workspace development)

- [x] **Specialized** (build-poc, pr-review, troubleshooting-guide) - **Selective use**
  - **Relevant**: `/build-poc` for upstream workspace prototypes
  - **Relevant**: `/pr-review` when team expands
  - **Relevant**: `/troubleshooting-guide` for operational documentation
  - **Priority**: Low-Medium (as needed basis)

- [ ] **Quality gates** (security-gate, gate-check, traceability) - **Not applicable initially**
  - **Defer until**: Production profile with multiple tenants
  - **Add when**: Formal release process established

**Agents** (applicable specialists):

- [x] **Core SDLC agents** - **Selective use**
  - **Relevant**: Architecture Designer (for SAD creation)
  - **Relevant**: Test Engineer (for test strategy/plan)
  - **Relevant**: DevOps Engineer (for CI/CD setup)
  - **Relevant**: Code Reviewer (for pre-commit review, even solo)

- [ ] **Security specialists** - **Deferred**
  - **Defer until**: Authentication added or sensitive data handled

- [ ] **Operations specialists** - **Deferred**
  - **Defer until**: Production deployment with SLA

- [ ] **Enterprise specialists** - **Not applicable**
  - **Defer until**: Regulatory requirements emerge

**Process Rigor Level** (selected):

- [ ] **Minimal** (README, lightweight notes, ad-hoc) - **Too light for multi-tenant**
- [x] **Moderate** (user stories, basic architecture, test plan, runbook) - **SELECTED**
  - **Rationale**: Solo developer needs efficiency, but multi-tenant architecture demands documentation
  - **Focus**: Architecture docs, test plan, runbook, CI/CD automation
  - **Skip**: Heavy requirements docs, extensive governance, compliance artifacts

- [ ] **Full** (comprehensive docs, traceability, gates) - **Too heavy for current team**
- [ ] **Enterprise** (audit trails, compliance evidence, change control) - **Not needed**

### Rationale for Framework Choices

**Why this subset of framework?**

```
Multi-tenant static site generator (solo developer, pre-production) needs "just enough" process:

INCLUDE:
- Intake (✓ using now) - Establish baseline for SDLC adoption
- Architecture (SAD + ADRs) - Document multi-tenant design and zero-dependency philosophy
- Test strategy/plan - Define 40% coverage target, prioritize build pipeline tests
- Deployment runbook - Multi-tenant domain mapping, SSL config, CDN setup critical
- CI/CD automation - Solo developer efficiency (GitHub Actions for build + test + deploy)
- Iteration workflow - Discovery + Delivery separation for upstream workspace development

DEFER:
- Requirements templates - Solo developer with clear vision doesn't need formality
- Security templates - Public docs, no auth, minimal attack surface (add when upstream adds auth)
- Governance templates - No team coordination overhead needed yet

KEY INSIGHT: Architecture complexity (multi-tenant) demands documentation, but team size (solo)
demands efficiency. Focus on automation (CI/CD, tests) and documentation (SAD, runbook) over
process overhead (requirements, governance).
```

**What we're skipping and why**

```
Skipping heavy SDLC components because:

1. NO REQUIREMENTS TEMPLATES
   - Solo developer has clear vision (comprehensive README/docs)
   - No stakeholders to coordinate
   - Will add if team expands or customer feature requests become unclear

2. NO SECURITY TEMPLATES
   - Public documentation only (no PII, payments, authentication)
   - Minimal attack surface (static site, no server-side execution)
   - Will add when upstream workspaces introduce authentication/sensitive data

3. NO GOVERNANCE TEMPLATES
   - Solo developer (no CCB, no RACI, no decision coordination needed)
   - Will add when team ≥ 3 people

4. NO QUALITY GATES (initially)
   - Pre-production (no release process yet)
   - Will add when formal release versioning and tenant deployment coordination required

5. NO OPERATIONS SPECIALISTS (initially)
   - Static site (no complex incident response, no on-call rotation)
   - CDN handles scale (no capacity planning, no performance tuning)
   - Will add if upstream workspaces introduce backend complexity

Will revisit when:
- Team expands beyond solo developer
- Upstream workspaces add authentication, databases, business logic
- Enterprise customers require compliance (SOC2, ISO27001)
- Revenue/contracts create SLA obligations
```

---

## Step 6: Evolution & Adaptation

### Expected Changes

**How might this project evolve?** (from architecture and README):

- [x] **Feature expansion** - **High likelihood**
  - **When**: 3-6 months (after publisher validated with tenants)
  - **Trigger**: Tenant feedback, demand for self-service authoring
  - **Impact**: Add "upstream authoring" workspace (content management UI)

- [x] **Technical pivot** - **Planned evolution**
  - **When**: 6-12 months
  - **Trigger**: Upstream workspaces require backend (auth, database, workflows)
  - **Impact**: Static site (current) + API backend (future) hybrid architecture

- [x] **Team expansion** - **Medium likelihood**
  - **When**: 6-12 months (when upstream workspaces development starts)
  - **Trigger**: Feature velocity needs or funding for second developer
  - **Impact**: From solo (current) to 2-3 developers, add PR review process

- [x] **Commercial/monetization** - **Possible**
  - **When**: 12+ months
  - **Trigger**: Validated product-market fit, sustainable tenant base
  - **Impact**: Add "billing workspace" for tenant subscriptions, introduce PCI-DSS requirements

- [ ] **User base growth** - Not primary driver (multi-tenant architecture already designed for scale)
- [ ] **Compliance requirements** - Only if monetization happens (PCI-DSS for billing, SOC2 for enterprise)

### Adaptation Triggers

**When to revisit framework application** (explicit triggers):

```
ADD REQUIREMENTS TEMPLATES when:
- Second developer joins (need shared understanding of feature scope)
- Customer feature requests become unclear or contradictory
- Upstream workspace features require stakeholder alignment

ADD SECURITY TEMPLATES when:
- Upstream authoring workspace adds user authentication
- Billing workspace handles payment information (PCI-DSS)
- Enterprise customers request security documentation (SOC2, ISO27001)

ADD GOVERNANCE TEMPLATES when:
- Team size ≥ 3 developers (coordination overhead emerges)
- Decision-making becomes contentious (need CCB process)
- Multiple stakeholders require RACI clarity

UPGRADE TO FULL RIGOR when:
- Enterprise customers demand compliance certifications
- Team size ≥ 5 developers (requires formal process)
- Regulatory requirements emerge (HIPAA, SOX, FedRAMP)

UPGRADE TO ENTERPRISE RIGOR when:
- SOC2/ISO27001 certification needed
- Financial audit requirements (SOX)
- Government contracts (FedRAMP)
```

### Planned Framework Evolution

**Current (MVP - pre-production)**:
- Intake documents (project-intake, solution-profile, option-matrix)
- Architecture docs (SAD, ADRs) - planned
- Test plan (40% coverage target) - planned
- CI/CD automation (GitHub Actions) - planned
- Deployment runbook - planned

**3 months (Production - first tenants deployed)**:
- ADD: Iteration workflow (dual-track Discovery + Delivery)
- ADD: Performance monitoring (CDN analytics, optional usage tracking)
- ADD: Incident response runbook (troubleshooting, escalation)
- UPGRADE: Test coverage to 60%

**6 months (Production - 3-5 tenants, upstream development starts)**:
- ADD: Requirements templates (if team expands to 2+ developers)
- ADD: Architecture evolution workflow (for upstream workspace design)
- ADD: Security templates (if authoring workspace adds authentication)
- UPGRADE: CI/CD to multi-workspace builds

**12 months (Enterprise - 10+ tenants, multi-workspace monorepo)**:
- ADD: Governance templates (if team ≥ 3 developers)
- ADD: Compliance templates (if billing workspace adds payments)
- ADD: Traceability (if enterprise customers demand it)
- UPGRADE: Full SDLC rigor (requirements → code → tests → deployment traceability)

---

## Summary

### Project Classification

**What IS this project?**
- Multi-tenant static documentation platform (current: publisher only, future: authoring + workflow + billing)
- Solo developer, pre-production, zero-dependency philosophy
- Designed for ultra-low-cost deployment (static hosting)
- Moderate technical complexity (multi-tenant config, content type handling)

**Current Profile**: MVP (transitioning from Prototype)

**Target Profile**: Production (1-2 months, first tenant deployed)

**Long-term Profile**: Enterprise (12+ months, multi-workspace, compliance, team)

### Framework Application

**USING NOW**:
- Intake documents (project-intake, solution-profile, option-matrix)
- AIWG framework setup (CLAUDE.md updated, .aiwg/ directory created)

**RECOMMENDED (Pre-Launch - 1-2 months)**:
- Architecture documents (SAD, ADRs)
- Test strategy and plan (40% coverage target)
- CI/CD pipeline (GitHub Actions)
- Deployment runbook (multi-tenant domain/SSL setup)

**DEFERRED (Post-Launch or when team expands)**:
- Requirements templates (add when team ≥ 2 or features unclear)
- Security templates (add when auth/payments introduced)
- Governance templates (add when team ≥ 3)
- Quality gates (add when formal release process needed)

### Next Steps

**Immediate (Pre-Launch)**:
1. Create Software Architecture Document (SAD) using Architecture Designer agent
2. Create Test Strategy and Plan using Test Architect/Engineer agents
3. Set up GitHub Actions CI/CD using DevOps Engineer agent
4. Create Deployment Runbook using Deployment Manager agent

**Commands to Run**:
```bash
# Natural language (preferred)
User: "Create architecture baseline for multi-tenant static site"
User: "Create test plan targeting 40% coverage for build pipeline"
User: "Set up GitHub Actions for build, test, deploy"
User: "Create deployment runbook for multi-tenant CDN setup"

# Or explicit commands
/flow-inception-to-elaboration  # Generate SAD, ADRs, test plan
# Then use specialized agents for CI/CD and runbook
```

**Success Criteria**: Ready for first tenant deployment when:
- ✓ Architecture documented (SAD + ADRs)
- ✓ Test coverage ≥ 40% (build pipeline + rendering)
- ✓ CI/CD operational (GitHub Actions)
- ✓ Deployment runbook complete
- ✓ Security scanning enabled (npm audit + Dependabot)
