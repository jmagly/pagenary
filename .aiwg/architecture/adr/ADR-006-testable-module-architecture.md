# ADR-006: Testable Module Architecture

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team
**Priority**: HIGH - Blocks reliable development

---

## Context

During Iteration 1 (Core Read Path Validation), we discovered a fundamental testability problem with the current source code architecture.

### Current State

The `apps/publisher/src/` code mixes **pure business logic** with **DOM manipulation** in the same modules:

```javascript
// app.js - Currently mixes everything together
import { MANIFEST } from './manifest.js';

const app = document.getElementById('app');  // DOM coupling at module load
const nav = document.getElementById('nav');

function filterSections(query) {           // Pure logic - testable
  return MANIFEST.filter(s => s.title.includes(query));
}

function renderNav() {                      // DOM manipulation - needs browser
  nav.innerHTML = MANIFEST.map(...).join('');
}
```

### Problem

1. **Modules execute DOM operations at import time** - Cannot import in Node.js without DOM mocking
2. **Pure functions are trapped inside DOM-coupled modules** - Cannot test business logic in isolation
3. **Testing requires logic duplication** - Iteration 1 tests re-implemented source logic, creating maintenance burden
4. **Drift risk** - Duplicated logic in tests will diverge from source over time

### Evidence from Iteration 1

Created 135 tests that **duplicated** logic from:
- `section-templates.js`: `titleFromId`, `inferCategory`, `formatWord`
- `app.js`: `filterSections`, `escapeRegExp`, `resolveTarget`, `composeExportDocument`
- `manifest.js`: `sectionEntry`, `groupEntry`, `findSection`

This is **technical debt** - when source changes, tests become stale or wrong silently.

---

## Decision

**Separate pure business logic into a `lib/` directory that can be imported and tested directly in Node.js.**

### New Structure

```
apps/publisher/src/
├── lib/                              # Pure functions - zero DOM dependencies
│   ├── categories.js                 # Category inference, title formatting
│   ├── search.js                     # Search filtering, regex escaping
│   ├── router.js                     # Route resolution logic
│   ├── export.js                     # Document composition
│   └── manifest-utils.js             # Section entry builders, index helpers
│
├── app.js                            # DOM orchestration only
├── manifest.js                       # Data definition + uses lib/manifest-utils.js
├── seo.js                            # DOM meta tag updates
└── sections/
    └── section-templates.js          # Uses lib/categories.js + render templates
```

### Separation Rules

| Type | Location | Characteristics |
|------|----------|-----------------|
| Pure Logic | `src/lib/*.js` | No `document`, `window`, `localStorage` references. Pure functions only. |
| DOM Code | `src/*.js` | Imports from `lib/`, handles all browser API interactions |
| Templates | `src/sections/*.js` | HTML generation (pure), uses `lib/categories.js` |

### Module Format

All modules use ES modules (`export`/`import`) for browser compatibility. Jest will use experimental ESM support or babel transform.

```javascript
// src/lib/search.js - Pure, testable
export function filterSections(manifest, query) {
  const q = query.trim().toLowerCase();
  if (!q) return manifest;
  return manifest.filter((section) => {
    const haystack = `${section.title} ${section.summary}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

```javascript
// src/app.js - DOM orchestration, imports pure logic
import { filterSections, escapeRegExp } from './lib/search.js';
import { resolveTarget, resolveEntry } from './lib/router.js';

const commandInput = document.getElementById('commandInput');
// ... DOM code uses imported pure functions
```

```javascript
// __tests__/src/lib/search.test.js - Tests actual code
import { filterSections, escapeRegExp } from '../../../src/lib/search.js';

describe('filterSections', () => {
  test('filters by title', () => {
    const result = filterSections(TEST_MANIFEST, 'welcome');
    expect(result).toHaveLength(1);
  });
});
```

---

## Consequences

### Positive

1. **Tests import actual source code** - No duplication, no drift
2. **Pure functions testable in Node.js** - No jsdom required for business logic
3. **Clear architectural boundary** - Easy to enforce via code review
4. **Easier refactoring** - Change logic in one place, tests validate
5. **Better code organization** - Separation of concerns by nature
6. **Enables code reuse** - `lib/` functions usable in build scripts if needed

### Negative

1. **Refactoring effort** - Must extract logic from existing modules
2. **More files** - `lib/` directory adds file count
3. **Import paths longer** - `./lib/search.js` vs inline
4. **Jest ESM configuration** - May need `--experimental-vm-modules` or babel

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incomplete extraction leaves DOM coupling | Medium | Medium | Review checklist, grep for `document`/`window` in lib/ |
| Circular dependencies between lib modules | Low | Low | Keep lib modules independent, lint for cycles |
| Jest ESM issues | Medium | Low | Fallback to babel transform if needed |

---

## Implementation Plan

### Phase 1: Extract Pure Functions (Iteration 2)

1. Create `src/lib/` directory
2. Extract from `section-templates.js`:
   - `WORD_OVERRIDES` → `lib/categories.js`
   - `CATEGORY_RULES` → `lib/categories.js`
   - `formatWord()` → `lib/categories.js`
   - `normalizeId()` → `lib/categories.js`
   - `inferCategory()` → `lib/categories.js`
   - `titleFromId()` → `lib/categories.js`
3. Extract from `app.js`:
   - `escapeRegExp()` → `lib/search.js`
   - `filterSections()` logic → `lib/search.js`
   - `resolveTarget()` → `lib/router.js`
   - `resolveEntry()` → `lib/router.js`
   - `currentSectionId()` → `lib/router.js`
   - `composeExportDocument()` → `lib/export.js`
4. Extract from `manifest.js`:
   - `sectionEntry()` → `lib/manifest-utils.js`
   - `groupEntry()` → `lib/manifest-utils.js`
   - Index building logic → `lib/manifest-utils.js`

### Phase 2: Update Tests (Iteration 2)

1. Configure Jest for ESM (`--experimental-vm-modules`)
2. Rewrite tests to import from `lib/` directly
3. Delete duplicated logic from test files
4. Verify all 159 tests still pass

### Phase 3: Validation

1. Grep `src/lib/` for DOM references - must be zero
2. Run tests in Node without jsdom
3. Build and verify browser functionality unchanged

---

## Jest Configuration for ESM

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  // For ES modules support
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/__tests__/**/*.test.js'],
  // Alternatively, use experimental VM modules:
  // Run with: node --experimental-vm-modules node_modules/jest/bin/jest.js
};
```

```json
// package.json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  }
}
```

---

## Alternatives Considered

### Alternative 1: jsdom for All Tests

**Description**: Use jsdom to simulate browser environment in all tests.

**Rejected Because**:
- Heavyweight dependency for testing pure logic
- Tests run slower
- Still testing through DOM layer unnecessarily
- Masks the architectural problem instead of solving it

### Alternative 2: Separate Test Utilities Package

**Description**: Create a shared test utilities package that mirrors source logic.

**Rejected Because**:
- Still duplicates logic (just in a different location)
- Drift problem remains
- Additional package to maintain

### Alternative 3: Transpile to CommonJS for Tests

**Description**: Use babel to transpile ES modules to CommonJS for Jest.

**Evaluation**:
- Pro: Works with current Jest setup
- Pro: No code restructuring needed
- Con: Still can't import DOM-coupled modules
- Con: Doesn't solve the architectural problem

**Partially Applicable**: May use babel for ESM→CJS transform, but still need lib/ separation.

### Alternative 4: Current Choice - lib/ Directory Separation

**Accepted Because**:
- Solves root cause (mixed concerns)
- Tests import actual source code
- Clear, enforceable boundary
- Enables future code reuse
- Aligns with clean architecture principles

---

## Related Decisions

- **ADR-002**: Zero-Dependency Philosophy (lib/ must remain dependency-free)
- **ADR-003**: Static JS Deployment Model (lib/ bundled into static output)

---

## Files Affected

### New Files
- `src/lib/categories.js`
- `src/lib/search.js`
- `src/lib/router.js`
- `src/lib/export.js`
- `src/lib/manifest-utils.js`

### Modified Files
- `src/app.js` - Remove extracted functions, add imports
- `src/manifest.js` - Use lib/manifest-utils.js
- `src/sections/section-templates.js` - Use lib/categories.js
- `jest.config.js` - ESM configuration
- `package.json` - Update test script

### Test Files (Rewrite)
- `__tests__/src/section-templates.test.js` → `__tests__/src/lib/categories.test.js`
- `__tests__/src/manifest.test.js` → `__tests__/src/lib/manifest-utils.test.js`
- `__tests__/src/router.test.js` → `__tests__/src/lib/router.test.js`
- `__tests__/src/search.test.js` → `__tests__/src/lib/search.test.js`
- `__tests__/src/export.test.js` → `__tests__/src/lib/export.test.js`

---

## Definition of Done

- [ ] `src/lib/` directory exists with all extracted modules
- [ ] `grep -r "document\|window\|localStorage" src/lib/` returns no matches
- [ ] All existing tests pass
- [ ] Tests import from `src/lib/` directly (no logic duplication)
- [ ] Browser functionality verified manually
- [ ] Build pipeline still works

---

## Decision Log

| Date | Author | Action |
|------|--------|--------|
| 2025-12-01 | Architecture Team | Initial decision documented |
| 2025-12-01 | Architecture Team | Status: Accepted, Priority: HIGH |
