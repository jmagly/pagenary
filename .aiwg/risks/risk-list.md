# Risk List

**Project:** Pagenary - Multi-Tenant Static Documentation Publisher
**Version:** 1.0
**Date:** 2025-12-01
**Status:** BASELINED (Elaboration)

---

## Risk Summary

| ID | Risk | Impact | Probability | Priority | Status | Owner |
|----|------|--------|-------------|----------|--------|-------|
| R1 | Tenant routing coordination | HIGH | MEDIUM | HIGH | RETIRED | Architecture |
| R2 | Build pipeline scalability | MEDIUM | LOW | LOW | ACCEPTED | Engineering |
| R3 | Multi-tenant isolation | HIGH | LOW | MEDIUM | MITIGATED | Architecture |
| R4 | Zero-dependency maintainability | MEDIUM | LOW | LOW | MONITORING | Engineering |
| R5 | Test coverage gaps | MEDIUM | LOW | MEDIUM | MITIGATED | Test Engineer |

---

## Risk Details

### R1: Tenant Routing Coordination

**Status:** ✅ RETIRED

**Description:** How to manage Caddy configuration for zero-downtime updates when tenants can update/redeploy at any time.

**Impact:** HIGH - Without solution, tenant updates could cause system-wide disruption or require scheduled maintenance windows.

**Probability:** MEDIUM - Core architectural concern for multi-tenant platform.

**Mitigation Strategy:**
- Conducted design spike (`.aiwg/working/routing-spike/`)
- Selected Caddy + File Registry + Atomic Symlinks approach
- Documented in ADR-004

**Resolution:**
- Design spike completed 2025-12-01
- Architecture decision documented (ADR-004-tenant-routing-caddy-symlinks.md)
- Solution validates NFR-R2 (zero downtime for other tenants) and NFR-R3 (<100ms outage for updating tenant)

**Retirement Date:** 2025-12-01

---

### R2: Build Pipeline Scalability

**Status:** ✅ ACCEPTED (Low Priority)

**Description:** As tenant count grows, build times may increase significantly.

**Impact:** MEDIUM - Longer build times reduce developer productivity and delay deployments.

**Probability:** LOW - Current architecture (Node.js scripts) supports parallelization.

**Mitigation Strategy:**
- Node.js build scripts are inherently parallelizable
- Per-tenant builds are independent (no cross-tenant dependencies)
- Can implement parallel builds when tenant count exceeds 10

**Acceptance Rationale:**
- Current tenant count: 2 (sample tenants)
- Projected tenant count at launch: 3-5
- Risk becomes relevant only at 20+ tenants
- Low-cost mitigation available when needed

**Review Trigger:** Re-evaluate when tenant count exceeds 15

---

### R3: Multi-Tenant Isolation

**Status:** ✅ MITIGATED

**Description:** Ensuring complete separation between tenant bundles with no data leakage or cross-tenant interference.

**Impact:** HIGH - Isolation failure could expose tenant content to competitors or cause data integrity issues.

**Probability:** LOW - Architecture designed with isolation as core principle.

**Mitigation Strategy:**
- Each tenant receives completely self-contained bundle (ADR-001)
- No shared runtime state between tenants
- Separate distribution directories (`dist/<tenant-id>/`)
- Domain-based routing with Caddy (ADR-004)
- Static file serving eliminates runtime cross-contamination

**Validation:**
- Architecture reviewed by Security Architect
- Isolation validated in SAD section 7 (Security Architecture)
- Test plan includes tenant isolation test cases

**Residual Risk:** LOW - Misconfiguration during deployment could theoretically cause issues; mitigated by deployment runbook (to be created).

---

### R4: Zero-Dependency Philosophy Maintainability

**Status:** 📊 MONITORING

**Description:** As platform evolves (upstream authoring, workflow, billing), zero-dependency approach may become constraining.

**Impact:** MEDIUM - Could slow feature development or require architectural pivot.

**Probability:** LOW - Current scope (publisher) well-suited to zero-dependency approach.

**Mitigation Strategy:**
- Document philosophy rationale (ADR-002)
- Allow minimal build dependencies (terser for minification)
- Plan for separate workspaces with different dependency profiles
- Upstream workspaces may adopt frameworks while publisher remains dependency-free

**Monitoring Triggers:**
- Feature request requiring framework capabilities
- Developer productivity significantly impacted
- Security vulnerability in hand-rolled code

**Review Cadence:** Quarterly or when upstream workspaces begin development

---

### R5: Test Coverage Gaps

**Status:** ✅ MITIGATED

**Description:** Test coverage was 0% at Construction start. Master Test Plan targets 70%+ coverage, with 85%+ for build pipeline.

**Impact:** MEDIUM - Low coverage increases regression risk and reduces confidence in changes.

**Probability:** LOW - Significant progress made in Iterations 1 and 2.

**Mitigation Strategy:**
- Master Test Plan defines comprehensive test strategy
- TDD approach (red/green/refactor) for new code
- Priority testing targets:
  1. Build scripts (build.js, build-tenants.js) - 85%+ target
  2. Section rendering (section-templates.js) - 80%+ target
  3. Markdown conversion - 80%+ target
  4. Manifest parsing - 90%+ target

**Progress (as of 2025-12-02):**
1. [x] Install Jest test framework (Iteration 0)
2. [x] Create test directory structure
3. [x] Write initial tests for build pipeline (24+ tests)
4. [ ] Integrate tests into CI/CD (deferred)
5. [x] Achieve 40% coverage milestone - **EXCEEDED: 157 tests, ~60% coverage**

**Current Test Suite:**
- `build.test.js` - 11 tests (build pipeline)
- `build-tenants.test.js` - 13 tests (tenant builds)
- `router.test.js` - Router logic tests
- `search.test.js` - Search functionality tests
- `categories.test.js` - Category inference tests
- `export.test.js` - Export functionality tests
- `manifest-utils.test.js` - Manifest utilities tests

**Residual Risk:** CI/CD integration pending. Tests run locally but not enforced on PRs.

**Resolution Date:** 2025-12-02 (mitigated, monitoring continues)

---

## Risk Metrics

**Total Risks:** 5
**Retired:** 1 (20%)
**Mitigated:** 2 (40%)
**Accepted:** 1 (20%)
**Monitoring:** 1 (20%)
**Open:** 0 (0%)

**HIGH Priority:** 1 (Retired)
**MEDIUM Priority:** 2 (Both Mitigated)
**LOW Priority:** 2 (1 Accepted, 1 Monitoring)

---

## Risk Review Schedule

| Phase | Review Cadence | Next Review |
|-------|---------------|-------------|
| Construction | Per iteration | Iteration 1 kickoff |
| Transition | Weekly | Before deployment |
| Production | Monthly | Post-launch + 30 days |

---

## Change History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-01 | 1.0 | Initial baseline from LOM/ABM findings | Architecture Team |
