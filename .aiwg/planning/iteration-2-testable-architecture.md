# Iteration 2: Testable Architecture Refactoring

**Project:** Pagenary
**Iteration:** 2
**Status:** PLANNED
**Priority:** HIGH - Blocks reliable development
**Planned Start:** Next

---

## Objectives

Refactor source code to separate pure business logic from DOM manipulation, enabling direct testing without logic duplication.

**Reference:** ADR-006 - Testable Module Architecture

---

## Problem Statement

Iteration 1 created 135 tests that **duplicate** source code logic. This is technical debt:
- Source changes won't be reflected in tests
- Tests may pass while source is broken
- Maintenance burden doubles for any logic change

---

## Backlog

### Must Have (P0)

| ID | Task | Status | Assignee |
|----|------|--------|----------|
| I2-01 | Create `src/lib/` directory structure | TODO | Developer |
| I2-02 | Extract `lib/categories.js` from section-templates.js | TODO | Developer |
| I2-03 | Extract `lib/search.js` from app.js | TODO | Developer |
| I2-04 | Extract `lib/router.js` from app.js | TODO | Developer |
| I2-05 | Extract `lib/export.js` from app.js | TODO | Developer |
| I2-06 | Extract `lib/manifest-utils.js` from manifest.js | TODO | Developer |
| I2-07 | Configure Jest for ESM imports | TODO | Developer |
| I2-08 | Rewrite tests to import from lib/ | TODO | Test Engineer |
| I2-09 | Verify browser functionality unchanged | TODO | QA |

### Should Have (P1)

| ID | Task | Status | Assignee |
|----|------|--------|----------|
| I2-10 | Add lint rule to prevent DOM in lib/ | TODO | Developer |
| I2-11 | Document lib/ module boundaries | TODO | Developer |

---

## Definition of Done

- [ ] `src/lib/` directory exists with 5 modules
- [ ] `grep -r "document\|window\|localStorage" src/lib/` returns 0 matches
- [ ] All 159 tests pass (or equivalent coverage)
- [ ] Tests import actual source code (zero logic duplication)
- [ ] `npm run build` succeeds
- [ ] Manual smoke test in browser passes
- [ ] ADR-006 Definition of Done complete

---

## Extraction Plan

### lib/categories.js

Extract from `src/sections/section-templates.js`:

```javascript
// Exports:
export const WORD_OVERRIDES = { ... };
export const CATEGORY_RULES = [ ... ];
export function formatWord(word) { ... }
export function normalizeId(id) { ... }
export function inferCategory(id) { ... }
export function titleFromId(id) { ... }
```

### lib/search.js

Extract from `src/app.js`:

```javascript
// Exports:
export function escapeRegExp(value) { ... }
export function filterSections(manifest, query) { ... }
export function parseSearchTerms(query) { ... }
```

### lib/router.js

Extract from `src/app.js`:

```javascript
// Exports:
export function currentSectionId(hash, defaultSection) { ... }
export function resolveTarget(id, findSection) { ... }
export function resolveEntry(id, findSection) { ... }
```

### lib/export.js

Extract from `src/app.js`:

```javascript
// Exports:
export function composeExportDocument(chapters) { ... }
export function collectExportableSections(manifest) { ... }
```

### lib/manifest-utils.js

Extract from `src/manifest.js`:

```javascript
// Exports:
export function sectionEntry(input, getSectionMetadata) { ... }
export function groupEntry(config) { ... }
export function buildSectionIndex(manifest) { ... }
export function createFindSection(index) { ... }
```

---

## Test Rewrite Plan

### Before (duplicated logic)
```javascript
// __tests__/src/search.test.js
function escapeRegExp(value) {  // DUPLICATED!
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
test('escapes regex', () => {
  expect(escapeRegExp('.')).toBe('\\.');
});
```

### After (imports source)
```javascript
// __tests__/src/lib/search.test.js
import { escapeRegExp } from '../../../src/lib/search.js';

test('escapes regex', () => {
  expect(escapeRegExp('.')).toBe('\\.');  // Tests ACTUAL code
});
```

---

## Jest ESM Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
  testTimeout: 30000
};
```

```json
// package.json
{
  "type": "module",
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  }
}
```

---

## Verification Checklist

1. **No DOM in lib/**
   ```bash
   grep -rn "document\|window\|localStorage" src/lib/
   # Must return nothing
   ```

2. **Tests run without jsdom**
   ```bash
   npm test
   # All pass in Node environment
   ```

3. **Browser works**
   - `npm run build`
   - `npm run serve`
   - Navigate sections ✓
   - Search works ✓
   - Export works ✓

4. **No logic duplication**
   ```bash
   grep -rn "function escapeRegExp" __tests__/
   # Must return nothing (imported, not duplicated)
   ```

---

## Risks

| Risk | Mitigation |
|------|------------|
| ESM configuration issues | Fallback to babel transform |
| Circular dependencies in lib/ | Keep modules independent |
| Breaking browser functionality | Manual smoke test after each extraction |

---

## Success Criteria

When this iteration is complete:
1. Tests validate actual source code behavior
2. Changing source logic will cause test failures if broken
3. No test maintenance required when source logic unchanged
4. Clear separation enables confident refactoring

---

## Change History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-01 | 1.0 | Initial iteration plan |
