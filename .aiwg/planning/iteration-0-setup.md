# Iteration 0: Foundation Setup

**Project:** Pagenary
**Iteration:** 0 (Setup)
**Status:** IN PROGRESS
**Start Date:** 2025-12-01

---

## Objectives

Establish development infrastructure for Construction phase:
1. Test framework (Jest)
2. CI/CD pipeline (GitHub Actions)
3. Code quality tools (ESLint, Prettier)
4. Security scanning (npm audit, Dependabot)

---

## Backlog

### Must Have (P0)

| ID | Task | Status | Assignee |
|----|------|--------|----------|
| I0-01 | Install and configure Jest | ✅ DONE | Developer |
| I0-02 | Create test directory structure | ✅ DONE | Developer |
| I0-03 | Write tests for build.js | ✅ DONE | Test Engineer |
| I0-04 | Write tests for build-tenants.js | ✅ DONE | Test Engineer |
| I0-05 | Create GitHub Actions CI workflow | DEFERRED | DevOps |
| I0-06 | Add npm audit to CI | DEFERRED | DevOps |

### Should Have (P1)

| ID | Task | Status | Assignee |
|----|------|--------|----------|
| I0-07 | Configure ESLint | DEFERRED | Developer |
| I0-08 | Configure Prettier | DEFERRED | Developer |
| I0-09 | Add pre-commit hooks | DEFERRED | Developer |
| I0-10 | Enable Dependabot | DEFERRED | DevOps |

### Nice to Have (P2)

| ID | Task | Status | Assignee |
|----|------|--------|----------|
| I0-11 | Add test coverage reporting | DEFERRED | DevOps |
| I0-12 | Add badge to README | DEFERRED | Developer |

---

## Definition of Done

- [x] Jest installed and working (`npm test` runs)
- [x] At least 5 tests for build pipeline (24 tests created)
- [ ] Tests pass in CI (CI deferred)
- [ ] PR workflow blocks on test failure (CI deferred)
- [ ] npm audit runs in CI (CI deferred)
- [ ] 40% coverage milestone (integration tests via subprocess, coverage tracking deferred)

---

## Technical Notes

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
  collectCoverageFrom: ['scripts/**/*.js', 'src/**/*.js'],
  coverageThreshold: {
    global: { lines: 40 }
  }
};
```

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci
      - run: npm audit --audit-level=moderate
      - run: npm test -- --coverage
```

### Directory Structure

```
apps/publisher/
├── __tests__/
│   ├── scripts/
│   │   ├── build.test.js
│   │   └── build-tenants.test.js
│   ├── src/
│   │   └── manifest.test.js
│   └── fixtures/
│       └── test-tenant/
├── jest.config.js
└── ...
```

---

## Acceptance Criteria

1. **Test Framework**
   - `npm test` executes Jest test suite
   - Tests for build.js cover: file copying, minification toggle, output structure
   - Tests for build-tenants.js cover: manifest parsing, content conversion, output isolation

2. **CI/CD Pipeline**
   - Workflow triggers on push and PR
   - Runs npm audit (fails on moderate+ vulnerabilities)
   - Runs test suite with coverage
   - Blocks merge on failure

3. **Code Quality**
   - ESLint configured with reasonable defaults
   - Prettier configured for consistent formatting
   - Pre-commit hook runs lint + format check

---

## Dependencies

- Node.js 18+ (already required)
- Jest ^29.x (to be added)
- ESLint ^8.x (to be added)
- Prettier ^3.x (to be added)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Zero-dependency philosophy conflict | Jest is dev-only, doesn't affect runtime bundle |
| Test complexity for file I/O | Use temp directories and fixtures |
| CI minutes cost | GitHub free tier sufficient for solo project |

---

## Testing Constraints

**Domain Mapping:**
- Domain-based routing (e.g., `tenant-alpha.local`) requires `/etc/hosts` edits on **host machine** - manual setup by user
- Automated tests should use `localhost:<port>` for Caddy access within the instance
- Flag domain-specific tests for manual verification

**Caddy Testing Approach:**
- Test symlink swap and reload mechanisms via localhost
- Validate zero-downtime by checking response continuity during updates
- User manually verifies domain routing works from host browser

---

## Change History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-01 | 1.0 | Initial iteration plan |
| 2025-12-01 | 1.1 | Added testing constraints for domain mapping |
