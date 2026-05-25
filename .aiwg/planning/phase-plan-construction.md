# Construction Phase Plan

**Project:** Pagenary - Multi-Tenant Static Documentation Publisher
**Phase:** Construction
**Status:** ACTIVE
**Start Date:** 2025-12-01
**Target End:** TBD (done when it's done)

---

## Phase Objectives

1. Implement test framework and achieve coverage targets
2. Set up CI/CD automation pipeline
3. Implement tenant routing solution (ADR-004)
4. Validate all use cases with tests
5. Prepare for Transition phase

---

## Iteration Plan

### Iteration 0: Foundation (Setup)

**Focus:** Development infrastructure setup

**Deliverables:**
- [ ] Jest test framework installed and configured
- [ ] Initial test suite for build pipeline (40% coverage milestone)
- [ ] GitHub Actions CI/CD workflow
- [ ] Security scanning (npm audit, Dependabot)
- [ ] ESLint/Prettier configuration

**Exit Criteria:**
- Tests run successfully in CI
- Build pipeline has basic test coverage
- PR workflow enforces tests

---

### Iteration 1: Core Read Path Validation ✅ COMPLETE

**Focus:** Validate existing publisher functionality with tests

**Use Cases:**
- UC-001: View documentation section
- UC-002: Navigate via sidebar
- UC-003: Search documentation
- UC-004: Export documentation

**Deliverables:**
- [x] Unit tests for section rendering (35 tests)
- [x] Unit tests for manifest parsing (19 tests)
- [x] Unit tests for router logic (24 tests)
- [x] Unit tests for search (30 tests)
- [x] Unit tests for export (27 tests)
- [ ] ~~E2E test for critical path~~ DEFERRED

**Exit Criteria:**
- [x] All read path use cases have test coverage
- [x] No regressions (159 tests passing)

**Issue Identified:** Tests duplicate source logic - maintenance risk. See ADR-006.

---

### Iteration 2: Testable Architecture Refactoring ✅ COMPLETE

**Focus:** Separate pure logic from DOM code to enable direct testing

**Reference:** ADR-006 - Testable Module Architecture

**Problem:** Iteration 1 tests re-implement source logic. This is technical debt:
- Source changes won't update tests
- Tests may pass while source is broken
- Double maintenance burden

**Deliverables:**
- [x] Create `src/lib/` directory with pure functions
- [x] Extract: categories.js, search.js, router.js, export.js, manifest-utils.js
- [x] Configure Jest for ESM imports
- [x] Rewrite tests to import from lib/ (zero duplication)
- [x] Verify browser functionality unchanged

**Additional Work Completed:**
- [x] Convert all scripts to ESM (build.js, build-tenants.js, serve.js, etc.)
- [x] Create `tenant-default` for base documentation site (ADR-007)
- [x] Fix serve.js trailing slash redirect for SPA routing
- [x] Enhanced build-tenants.js with CLI arguments (--target, --list, tenant selection)
- [x] Update Caddyfile for multi-tenant domain routing

**Exit Criteria:**
- [x] `grep -r "document\|window" src/lib/` returns 0 matches
- [x] Tests import actual source code
- [x] All tests pass (157 tests)
- [x] Browser smoke test passes (all tenants working)

**Completion Date:** 2025-12-02

---

### Iteration 3: Tenant Management - Configuration

**Focus:** Tenant configuration and build pipeline

**Use Cases:**
- UC-006: Configure new tenant
- UC-009: Build tenant bundle

**Deliverables:**
- [ ] Unit tests for tenant manifest parsing
- [ ] Unit tests for build-tenants.js
- [ ] Integration tests for multi-tenant builds
- [ ] Test fixtures for tenant configurations
- [ ] 70% overall coverage, 85% build pipeline coverage

**Exit Criteria:**
- Tenant configuration fully tested
- Build pipeline meets coverage target

---

### Iteration 3.5: External Tenant Sources (Inserted)

**Focus:** Support external tenant content sources and deployment targets

**Reference:** ADR-008 - External Tenant Sources

**Problem:** Tenant directories in `tenants/` are examples, not production content. Real deployments source content from external locations.

**Deliverables:**
- [x] ADR-008 documenting external source model
- [x] Tenant registry schema (`tenants.schema.json`)
- [x] Registry-aware `build-tenants.js` with source/target resolution
- [x] Fallback behavior when no registry (scan `tenants/` directory)
- [x] Environment variable expansion in paths
- [x] Example registry (`tenants.json.example`)

**New CLI Options:**
- `--registry, -r` - Path to tenant registry JSON file
- Source/target shown in `--list` output

**Exit Criteria:**
- [x] Registry-based builds work with external sources
- [x] Fallback to directory scan preserves existing behavior
- [x] All 157 tests still pass

**Completion Date:** 2025-12-02

---

### Iteration 4: Tenant Management - Routing

**Focus:** Implement tenant routing solution (ADR-004)

**Use Cases:**
- UC-007: Update tenant content
- UC-010: Route to tenant

**Deliverables:**
- [x] File-based tenant registry implementation (ADR-008)
- [ ] Atomic symlink deployment script
- [ ] Caddy configuration generator (from registry)
- [ ] Zero-downtime update tests
- [ ] Integration tests for routing

**NFR Validation:**
- NFR-R2: Zero downtime for other tenants
- NFR-R3: <100ms outage for updating tenant

**Exit Criteria:**
- Tenant routing operational
- Zero-downtime requirement validated

---

### Iteration 4.5: Git Source Integration ✅ COMPLETE

**Focus:** Implement git source type for tenant content (ADR-009)

**Reference:** ADR-009 - Git Source Type for Tenant Content

**NFRs:**
- NFR-B1: Git source cloning
- NFR-B2: Git authentication
- NFR-B3: Git clone caching
- NFR-B4: Git error handling

**Deliverables:**
- [x] Git source type implementation in build-tenants.js
- [x] SSH and HTTPS authentication support
- [x] Shallow clone with depth=1 (default)
- [x] Sparse checkout for monorepo subdirectories
- [x] Clone caching with configurable retention
- [x] Retry logic with exponential backoff
- [x] Update tenants.schema.json with git source properties
- [x] Incremental builds with change detection (--incremental)
- [x] Diff-only mode for CI validation (--diff-only)
- [x] Documentation in ADR-009

**New CLI Options:**
- `--cache-dir` - Git clone cache directory
- `--keep-cache` - Preserve cache after build
- `--clean-cache` - Force fresh clones
- `--git-depth` - Override clone depth
- `-i, --incremental` - Incremental builds (only changed content)
- `--diff-only` - Show changes without building

**Exit Criteria:**
- [x] Clone from public HTTPS repo works
- [x] Branch, tag, and commit refs supported
- [x] Subdirectory extraction works
- [x] Cache reuse reduces build time
- [x] Incremental builds process only changed files
- [x] All 157 existing tests still pass

**Completion Date:** 2025-12-02

---

### Iteration 5: Polish and Gate Preparation

**Focus:** Complete remaining use cases and prepare for Transition

**Use Cases:**
- UC-005: Customize appearance
- UC-008: Remove tenant
- Any deferred items

**Deliverables:**
- [ ] All use cases implemented and tested
- [ ] Security review completed
- [ ] Performance validation
- [ ] Documentation updates
- [ ] Construction gate review

**Exit Criteria:**
- All acceptance criteria met
- Test coverage targets achieved
- Ready for Transition gate check

---

## Quality Gates

### Per-Iteration Gates

| Check | Threshold | Enforcement |
|-------|-----------|-------------|
| Test coverage | Per iteration target | CI blocks merge |
| All tests pass | 100% | CI blocks merge |
| No HIGH/CRITICAL defects | 0 open | Manual review |
| Lint/format | Clean | CI blocks merge |

### Phase Exit Gate (Construction → Transition)

| Criterion | Target |
|-----------|--------|
| Overall test coverage | ≥70% |
| Build pipeline coverage | ≥85% |
| Open defects | 0 HIGH/CRITICAL |
| Use cases complete | 10/10 |
| NFRs validated | All MUST requirements |
| Security review | PASSED |

---

## Risk Monitoring

**Active Risks to Monitor:**

| Risk | Status | Trigger |
|------|--------|---------|
| R5: Test coverage gaps | OPEN | Track per iteration |
| R4: Zero-dependency maintainability | MONITORING | Feature blockers |
| R2: Build pipeline scalability | ACCEPTED | Tenant count > 15 |

**Risk Review:** End of each iteration

---

## Team Assignments

| Role | Agent/Person | Focus |
|------|--------------|-------|
| Developer | Human + AI | Implementation |
| Test Engineer | AI Agent | Test design, coverage |
| DevOps Engineer | AI Agent | CI/CD, deployment |
| Code Reviewer | AI Agent | PR reviews |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test coverage (overall) | 70% | ~60% (157 tests) |
| Test coverage (build pipeline) | 85% | ~70% (24+ tests) |
| Use cases complete | 10/10 | 6/10 tested (UC-001 to UC-004, UC-006, UC-009) |
| CI/CD operational | Yes | No (deferred) |
| Security scanning | Enabled | No |
| ADRs documented | - | 9 ADRs |
| Iterations complete | 5 | 3.5/5 (Iter 2, 3.5, 4.5 complete) |

---

## Change History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-01 | 1.0 | Initial Construction phase plan | Project Manager |
| 2025-12-01 | 1.1 | Iteration 1 complete; added Iteration 2 for testable architecture (ADR-006) | Project Manager |
| 2025-12-02 | 1.2 | Iteration 2 complete; ESM conversion, tenant-default, flexible builds (ADR-007) | Project Manager |
| 2025-12-02 | 1.3 | Added Iteration 3.5; external tenant sources, registry support (ADR-008) | Project Manager |
| 2025-12-02 | 1.4 | Added Iteration 4.5; git source integration planning (ADR-009) | Project Manager |
| 2025-12-02 | 1.5 | Iteration 4.5 complete; git source + incremental builds implemented | Project Manager |
