# Test Architect Review - Software Architecture Document v0.1

**Reviewer:** Test Architect Agent
**Date:** 2025-12-01
**SAD Version:** 0.1 (Primary Draft)
**Review Focus:** Testability, Test Strategy Alignment, TDD Support

---

## Executive Summary

**Status:** CONDITIONAL APPROVAL

The architecture demonstrates strong testability characteristics with clear component boundaries and separation of concerns. The zero-dependency philosophy and functional design create excellent opportunities for unit testing. However, the absence of a formal test infrastructure and strategy creates immediate technical debt that must be addressed before production deployment.

**Key Strengths:**
- Clear component boundaries enable isolated unit testing
- Build scripts are pure functions, ideal for TDD
- File-based architecture simplifies test data management
- Read/write path segregation reduces integration test complexity

**Critical Gaps:**
- No test framework or infrastructure specified
- No test strategy aligned to quality attributes
- Unclear how to test hash-based routing in isolation
- No performance testing baseline despite NFR targets

---

## 1. Component Testability Analysis

### 1.1 Build Pipeline Components (HIGH TESTABILITY)

**Scripts Analyzed:**
- `build.js` - Core build logic
- `build-tenants.js` - Multi-tenant generation
- `lint-content.js` - Content validation
- `seo-smoke.js` - SEO checks

**Testability Strengths:**
- Pure functions with clear input/output contracts
- File system operations are mockable
- No external service dependencies
- Configuration via environment variables supports test isolation

**Test Coverage Recommendations:**

| Component | Test Level | Priority | Coverage Target |
|-----------|-----------|----------|-----------------|
| `build.js` | Unit | CRITICAL | 90% |
| `build-tenants.js` | Unit + Integration | CRITICAL | 85% |
| `lint-content.js` | Unit | HIGH | 80% |
| `seo-smoke.js` | Unit | MEDIUM | 75% |
| `generate-sections.js` | Unit | MEDIUM | 70% |

**Recommended Test Cases:**

```javascript
// Example test structure (Jest)
describe('build.js', () => {
  describe('copyEntry', () => {
    it('should copy files preserving content');
    it('should minify JavaScript when MINIFY=true');
    it('should inject build timestamp into index.html');
    it('should handle nested directory structures');
    it('should preserve file permissions');
    it('should fail gracefully on read errors');
  });

  describe('minification', () => {
    it('should apply terser to .js files in production mode');
    it('should preserve reserved function names in sections');
    it('should skip minification in development mode');
    it('should handle minification errors without failing build');
  });

  describe('edge cases', () => {
    it('should handle empty source directory');
    it('should handle missing build.config.json');
    it('should handle special characters in filenames');
  });
});
```

### 1.2 SPA Shell Components (MEDIUM TESTABILITY)

**Components Analyzed:**
- `app.js` - Router and navigation logic
- `section-templates.js` - Template rendering
- `manifest.js` - Navigation data
- `seo.js` - Metadata generation

**Testability Challenges:**
- Hash-based routing requires DOM environment
- localStorage dependencies complicate isolation
- Dynamic module imports need proper mocking
- Canvas rendering requires JSDOM or browser environment

**Testability Improvements Required:**

1. **Separate Business Logic from DOM Manipulation:**
   ```javascript
   // Current: tightly coupled
   function navigateTo(sectionId) {
     const section = findSection(sectionId);
     renderToCanvas(section);
     updateNavState();
   }

   // Better: testable business logic
   function getSectionData(sectionId) { /* pure function */ }
   function renderSection(data) { /* pure function returning HTML */ }
   function applyToDOM(html) { /* DOM-only */ }
   ```

2. **Abstract Browser APIs:**
   - Create `StorageAdapter` interface for localStorage
   - Create `RouterAdapter` for hash-based navigation
   - Create `DOMAdapter` for canvas manipulation

**Test Coverage Recommendations:**

| Component | Test Level | Priority | Coverage Target |
|-----------|-----------|----------|-----------------|
| `app.js` routing logic | Unit | HIGH | 80% |
| `section-templates.js` | Unit | CRITICAL | 90% |
| `manifest.js` | Unit | HIGH | 85% |
| `seo.js` | Unit | HIGH | 80% |
| Hash navigation | Integration | MEDIUM | 60% |
| Command palette | Integration | LOW | 50% |

### 1.3 Section Rendering Components (HIGH TESTABILITY)

**Components Analyzed:**
- 86 section template modules
- Category-based rendering logic
- Template catalog system

**Testability Strengths:**
- Pure render functions with predictable outputs
- Clear input schema (section data)
- No side effects in rendering
- Easy to test in isolation

**Test Strategy:**

```javascript
describe('section rendering', () => {
  // Test template catalog
  it('should categorize sections by ID prefix');
  it('should apply correct template for each category');

  // Test individual templates
  const templates = [
    'welcome', 'guide', 'reference', 'tutorial',
    'developer', 'operations', 'security'
  ];

  templates.forEach(category => {
    describe(`${category} template`, () => {
      it('should render valid HTML');
      it('should include all required semantic elements');
      it('should escape user-provided content');
      it('should handle missing optional fields');
      it('should handle special characters');
    });
  });
});
```

**Test Data Requirements:**
- Sample content for each section type
- Edge cases: empty strings, very long titles, special characters
- Invalid data: missing required fields, wrong types

### 1.4 Tenant Configuration (HIGH TESTABILITY)

**Components Analyzed:**
- `manifest.json` structure
- `config.json` structure
- Content file processing (Markdown, HTML, JS)

**Testability Strengths:**
- Declarative JSON schemas
- File-based data enables snapshot testing
- Clear validation rules

**Test Coverage Recommendations:**

| Component | Test Level | Priority | Coverage Target |
|-----------|-----------|----------|-----------------|
| Manifest parsing | Unit | CRITICAL | 95% |
| Config validation | Unit | HIGH | 90% |
| Markdown processing | Unit | HIGH | 85% |
| Content type detection | Unit | HIGH | 90% |

**Recommended Test Suite:**

```javascript
describe('tenant configuration', () => {
  describe('manifest validation', () => {
    it('should accept valid manifest structure');
    it('should reject missing default section');
    it('should reject duplicate section IDs');
    it('should reject circular section references');
    it('should validate nested section depth');
    it('should validate file paths exist');
  });

  describe('content processing', () => {
    it('should process .md files to HTML');
    it('should pass through .html files unchanged');
    it('should dynamically import .js modules');
    it('should handle missing content files gracefully');
    it('should preserve relative links in Markdown');
  });

  describe('config validation', () => {
    it('should validate required branding fields');
    it('should validate color format');
    it('should validate domain format');
    it('should handle missing optional fields');
  });
});
```

---

## 2. Integration Testing Strategy

### 2.1 Tenant Bundle Generation (CRITICAL)

**Test Scope:** End-to-end tenant build process

**Integration Points:**
1. Tenant configuration → Build pipeline
2. Content files → Template renderer
3. Build output → File system
4. Manifest → Navigation generation

**Recommended Tests:**

```javascript
describe('tenant bundle generation', () => {
  beforeEach(() => {
    // Create test tenant directory structure
    setupTestTenant('test-tenant-001');
  });

  it('should generate complete bundle from tenant config', async () => {
    await buildTenant('test-tenant-001');

    // Verify output structure
    expect(fs.existsSync('dist/test-tenant-001/index.html')).toBe(true);
    expect(fs.existsSync('dist/test-tenant-001/app.js')).toBe(true);
    expect(fs.existsSync('dist/test-tenant-001/styles.css')).toBe(true);

    // Verify content integration
    const indexHtml = fs.readFileSync('dist/test-tenant-001/index.html', 'utf8');
    expect(indexHtml).toContain('test-tenant-001'); // Branding applied

    // Verify manifest embedded correctly
    const appJs = fs.readFileSync('dist/test-tenant-001/app.js', 'utf8');
    expect(appJs).toContain('test-tenant-001-welcome'); // Section IDs present
  });

  it('should handle multiple content formats', async () => {
    // Test Markdown, HTML, and JS content files
  });

  it('should apply tenant-specific overrides', async () => {
    // Test CSS/JS overrides
  });

  it('should fail gracefully on invalid manifests', async () => {
    // Test error handling
  });

  afterEach(() => {
    cleanupTestTenant('test-tenant-001');
  });
});
```

### 2.2 Multi-Tenant Routing (MEDIUM-HIGH)

**Test Scope:** Caddy configuration generation and routing

**Integration Points:**
1. Tenant registry → Caddyfile generation
2. Caddyfile → Caddy server
3. HTTP requests → Tenant bundles

**Testability Gap:** No scripting for Caddyfile generation yet (future work)

**Recommended Tests (When Implemented):**

```javascript
describe('routing configuration', () => {
  it('should generate Caddyfile from tenant registry', () => {
    const registry = {
      tenants: [
        { id: 'tenant-alpha', domains: ['alpha.local', 'alpha.example.com'] },
        { id: 'tenant-beta', domains: ['beta.local'] }
      ]
    };

    const caddyfile = generateCaddyfile(registry);

    expect(caddyfile).toContain('http://alpha.local');
    expect(caddyfile).toContain('root * dist/tenant-alpha');
    expect(caddyfile).toContain('http://beta.local');
  });

  it('should validate tenant registry schema', () => {
    // Test invalid registry structures
  });

  it('should handle tenant enable/disable', () => {
    // Test enabled: false flag
  });
});
```

### 2.3 Local Multi-Tenant Environment (MEDIUM)

**Test Scope:** Docker Caddy setup with multiple tenants

**Current State:** Manual testing via `npm run caddy:up`

**Testing Needs:**
- Automated validation of multi-tenant routing
- Verification of host header routing
- Testing of atomic symlink updates

**Recommended Approach:**

```javascript
describe('local multi-tenant environment', () => {
  beforeAll(async () => {
    // Start Docker Caddy
    await exec('npm run caddy:up');
    await waitForCaddyReady();
  });

  it('should route tenant-alpha.local to tenant-alpha bundle', async () => {
    const response = await fetch('http://localhost:80', {
      headers: { 'Host': 'tenant-alpha.local' }
    });
    const html = await response.text();
    expect(html).toContain('Atlas Edge Overview'); // tenant-alpha content
  });

  it('should route tenant-beta.local to tenant-beta bundle', async () => {
    const response = await fetch('http://localhost:80', {
      headers: { 'Host': 'tenant-beta.local' }
    });
    const html = await response.text();
    expect(html).toContain('Beta Platform'); // tenant-beta content
  });

  it('should isolate tenant bundles', async () => {
    // Verify no cross-tenant data leakage
  });

  afterAll(async () => {
    await exec('npm run caddy:down');
  });
});
```

---

## 3. Test Environment Support

### 3.1 Development Environment (EXCELLENT)

**Current Support:**
- `npm run dev` for single-tenant development
- `npm run build:dev` for unminified builds
- `npm run serve:dev` for local server
- File watching capabilities

**Test Compatibility:**
- Build scripts support environment variable overrides
- Output directory configurable via `BUILD_OUTPUT` env var
- Development mode disables minification for easier debugging

**Recommendations:**
1. Add `npm run test` script to package.json
2. Add `npm run test:watch` for TDD workflow
3. Create test-specific build configuration

### 3.2 Test Data Management (GOOD)

**Current State:**
- Two sample tenants (tenant-alpha, tenant-beta)
- Diverse content types (HTML, Markdown, JS)
- Realistic manifest structures

**Test Data Strengths:**
- File-based data is easy to version control
- Tenant directories can be copied for test isolation
- JSON schemas enable automated test data generation

**Recommended Test Data Strategy:**

```
apps/publisher/test-fixtures/
├── tenants/
│   ├── minimal-tenant/          # Bare minimum valid config
│   ├── maximal-tenant/          # Every optional feature
│   ├── edge-case-tenant/        # Special characters, unicode
│   └── invalid-tenant/          # Various invalid configurations
├── content/
│   ├── sample.md               # Standard Markdown
│   ├── complex.md              # Tables, code blocks, links
│   ├── empty.html              # Edge case
│   └── large.md                # Performance testing
└── manifests/
    ├── simple.json             # Single section
    ├── nested.json             # Deep nesting
    ├── invalid-missing-id.json # Validation tests
    └── invalid-circular.json   # Error handling
```

### 3.3 Test Isolation (MEDIUM)

**Current Challenges:**
- Build scripts operate on shared `dist/` directory
- No test-specific output isolation
- Risk of test pollution across test runs

**Recommendations:**

1. **Test-Specific Output Directories:**
   ```javascript
   // In test setup
   process.env.BUILD_OUTPUT = `dist-test-${Date.now()}`;
   ```

2. **Cleanup Hooks:**
   ```javascript
   afterEach(async () => {
     await rimraf(process.env.BUILD_OUTPUT);
   });
   ```

3. **Parallel Test Execution:**
   - Use unique output directories per test worker
   - Avoid shared state in test fixtures

### 3.4 CI/CD Integration (MISSING - CRITICAL GAP)

**Current State:**
- `npm run ci` script exists but only runs linting
- No automated test execution
- No test reporting

**Required for Production:**

1. **GitHub Actions Workflow:**
   ```yaml
   name: Test
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - run: npm install
         - run: npm test
         - run: npm run build:tenants
         - run: npm run caddy:up
         - run: npm run test:integration
         - run: npm run caddy:down
   ```

2. **Test Result Reporting:**
   - JUnit XML output for test results
   - Code coverage reports
   - Failed test artifact collection

---

## 4. TDD Support Analysis

### 4.1 Red/Green/Refactor Compatibility (GOOD)

**Current Architecture Strengths:**
- Pure functions enable test-first development
- Clear component boundaries support incremental development
- No complex framework setup required for testing

**TDD Workflow Support:**

| Phase | Support Level | Details |
|-------|--------------|---------|
| **Red** (Write Failing Test) | EXCELLENT | Pure functions with predictable interfaces |
| **Green** (Make Test Pass) | GOOD | No complex mocking required for most units |
| **Refactor** | EXCELLENT | Tests can run in sub-second time |

### 4.2 Fast Feedback Loop (MEDIUM)

**Test Execution Speed Requirements:**
- Unit tests: <1 second for sub-second feedback
- Integration tests: <10 seconds for reasonable iteration
- Full test suite: <60 seconds for CI/CD gates

**Current Architecture Impact:**
- File system operations may slow unit tests
- Build pipeline tests require temp directory setup/cleanup
- No database dependencies = faster tests

**Recommendations for Speed:**

1. **In-Memory File System for Unit Tests:**
   ```javascript
   const memfs = require('memfs');
   jest.mock('fs', () => memfs.fs);
   ```

2. **Test Parallelization:**
   - Jest worker threads for unit tests
   - Separate test workers for integration tests

3. **Selective Test Execution:**
   ```bash
   npm test -- --testPathPattern=build  # Only build tests
   npm test -- --watch                  # TDD watch mode
   ```

### 4.3 Test Granularity (EXCELLENT)

**Component-Level Testability:**
- Build pipeline: Testable as pure functions
- Section rendering: Testable in isolation
- Manifest parsing: Testable with fixture data
- Routing logic: Testable with mocked browser APIs

**Example TDD Workflow:**

```javascript
// RED: Write failing test
describe('manifest parser', () => {
  it('should extract default section ID', () => {
    const manifest = { default: 'welcome', sections: [] };
    expect(parseManifest(manifest).defaultSection).toBe('welcome');
  });
});

// GREEN: Implement minimal code
function parseManifest(manifest) {
  return { defaultSection: manifest.default };
}

// REFACTOR: Add validation
function parseManifest(manifest) {
  if (!manifest.default) throw new Error('Missing default section');
  return { defaultSection: manifest.default };
}
```

---

## 5. Test Data Strategy

### 5.1 Tenant Test Fixtures (GOOD)

**Current State:**
- tenant-alpha: Realistic "Atlas Edge" configuration
- tenant-beta: Alternative branding example

**Test Data Coverage:**

| Content Type | Example | Test Coverage |
|--------------|---------|---------------|
| HTML | `welcome.html` | Basic HTML rendering |
| Markdown | `launch-checklist.md` | Markdown conversion |
| JavaScript Module | `telemetry.js` | Dynamic module loading |

**Additional Test Data Needed:**

1. **Edge Cases:**
   - Empty content files
   - Very large files (performance testing)
   - Special characters in filenames
   - Unicode content (international support)
   - Malformed Markdown
   - Invalid HTML

2. **Error Scenarios:**
   - Missing content files
   - Invalid manifest structure
   - Circular section references
   - Duplicate section IDs

3. **Performance Test Data:**
   - Large manifests (100+ sections)
   - Deep nesting (10+ levels)
   - Large content files (1MB+ Markdown)

### 5.2 Sample Tenant Configurations (GOOD)

**Recommendation: Expand Test Tenant Coverage**

```
test-fixtures/tenants/
├── minimal/                    # Absolute minimum valid config
│   ├── manifest.json          # 1 section, no nesting
│   ├── config.json            # Required fields only
│   └── content/welcome.html   # Simple HTML
│
├── comprehensive/              # All features enabled
│   ├── manifest.json          # Deep nesting, all section types
│   ├── config.json            # All optional fields
│   ├── content/               # All content formats
│   └── overrides/             # Custom CSS/JS
│
├── edge-cases/
│   ├── unicode-tenant/        # Chinese, Arabic, emoji in content
│   ├── special-chars/         # Spaces, symbols in IDs
│   └── large-scale/           # 100+ sections for performance
│
└── invalid/
    ├── missing-default/       # Invalid manifest
    ├── duplicate-ids/         # Duplicate section IDs
    └── circular-refs/         # Circular section references
```

### 5.3 Content Type Test Matrix

| Content Format | Test Case | Expected Behavior |
|----------------|-----------|-------------------|
| Markdown | Standard | Convert to HTML, preserve headings |
| Markdown | Code blocks | Preserve syntax, handle backticks |
| Markdown | Tables | Convert to HTML table structure |
| Markdown | Links | Preserve relative links |
| HTML | Valid | Pass through unchanged |
| HTML | With scripts | Sanitize or allow (policy decision needed) |
| JavaScript | ES module | Dynamic import, execute render() |
| JavaScript | Syntax error | Graceful error handling |

---

## 6. Testability Gaps and Recommendations

### 6.1 Critical Gaps

#### GAP-1: No Test Framework (CRITICAL)

**Issue:** No testing infrastructure specified in architecture or package.json

**Impact:**
- Cannot implement TDD workflow
- No automated regression testing
- Quality assurance depends on manual testing

**Recommendation:**
```json
// package.json additions
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^22.0.0"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Jest Configuration:**
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

#### GAP-2: Hash-Based Routing Testing (HIGH)

**Issue:** No clear strategy for testing client-side hash routing without browser

**Impact:**
- Cannot verify navigation logic in unit tests
- Integration tests require full browser environment
- Slow feedback loop for routing changes

**Recommendation:**

1. **Abstract Routing Logic:**
   ```javascript
   // src/router.js (new file - testable)
   export function parseHash(hash) {
     return hash.replace(/^#\/?/, '');
   }

   export function findSectionById(sections, id) {
     // Pure function - easily testable
   }

   export function validateSectionId(id) {
     // Pure function - easily testable
   }
   ```

2. **Test Without DOM:**
   ```javascript
   describe('router', () => {
     it('should parse hash to section ID', () => {
       expect(parseHash('#/welcome')).toBe('welcome');
       expect(parseHash('#!/section-id')).toBe('section-id');
       expect(parseHash('#')).toBe('');
     });
   });
   ```

3. **Integration Tests with JSDOM:**
   ```javascript
   describe('navigation integration', () => {
     beforeEach(() => {
       document.body.innerHTML = '<div id="canvas"></div>';
       window.location.hash = '#/welcome';
     });

     it('should render correct section on hash change', () => {
       // Integration test
     });
   });
   ```

#### GAP-3: No Performance Testing Baseline (MEDIUM)

**Issue:** NFR targets specified but no testing strategy

**NFR Targets:**
- NFR-4: Page load <2s on 3G
- NFR-5: Build time <30s per tenant
- NFR-6: Hosting cost <$5/month

**Recommendation:**

1. **Build Performance Tests:**
   ```javascript
   describe('build performance', () => {
     it('should build single tenant in <30 seconds', async () => {
       const startTime = Date.now();
       await buildTenant('tenant-alpha');
       const duration = Date.now() - startTime;
       expect(duration).toBeLessThan(30000);
     });

     it('should build 10 tenants in <5 minutes', async () => {
       // Parallel build performance
     });
   });
   ```

2. **Bundle Size Tests:**
   ```javascript
   describe('bundle size', () => {
     it('should generate bundle <5MB uncompressed', async () => {
       await buildTenant('tenant-alpha');
       const size = await getBundleSize('dist/tenant-alpha');
       expect(size).toBeLessThan(5 * 1024 * 1024);
     });

     it('should generate gzipped bundle <1MB', async () => {
       // Compression ratio test
     });
   });
   ```

3. **Lighthouse CI Integration:**
   ```yaml
   # .github/workflows/lighthouse.yml
   - name: Lighthouse CI
     uses: treosh/lighthouse-ci-action@v9
     with:
       urls: |
         http://tenant-alpha.local
         http://tenant-beta.local
       uploadArtifacts: true
   ```

#### GAP-4: No Atomic Symlink Testing (MEDIUM)

**Issue:** Critical zero-downtime deployment mechanism not testable

**Impact:**
- Cannot verify NFR-2 (zero downtime for other tenants)
- Cannot verify NFR-3 (<100ms downtime for updating tenant)
- Risk of race conditions in production

**Recommendation:**

1. **Unit Tests for Symlink Logic:**
   ```javascript
   describe('atomic deployment', () => {
     it('should create timestamped directory', async () => {
       const deployPath = await createTimestampedDeploy('tenant-alpha', 'dist-build/tenant-alpha');
       expect(deployPath).toMatch(/tenant-alpha-\d{13}/);
     });

     it('should perform atomic symlink swap', async () => {
       // Test mv -Tf atomicity
     });

     it('should cleanup old versions', async () => {
       // Test version retention policy
     });
   });
   ```

2. **Integration Tests with Concurrent Requests:**
   ```javascript
   describe('zero-downtime deployment', () => {
     it('should serve content during deployment', async () => {
       // Start continuous requests
       const requests = startContinuousRequests('tenant-alpha');

       // Deploy new version
       await deployTenant('tenant-alpha', 'new-version');

       // Verify no request failures
       const results = await requests.stop();
       expect(results.failures).toBe(0);
     });
   });
   ```

### 6.2 Medium Priority Gaps

#### GAP-5: No Content Sanitization Testing (MEDIUM)

**Issue:** Security control mentioned but not testable

**From SAD Section 7.2:**
> "Client-side XSS - Mitigated by content sanitization during build"

**Recommendation:**

```javascript
describe('content sanitization', () => {
  it('should sanitize script tags in HTML content', () => {
    const malicious = '<script>alert("xss")</script><p>Content</p>';
    const sanitized = sanitizeContent(malicious);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('<p>Content</p>');
  });

  it('should sanitize event handlers in HTML', () => {
    const malicious = '<div onclick="alert(1)">Click</div>';
    const sanitized = sanitizeContent(malicious);
    expect(sanitized).not.toContain('onclick');
  });

  it('should allow safe HTML tags', () => {
    const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
    const sanitized = sanitizeContent(safe);
    expect(sanitized).toBe(safe);
  });
});
```

#### GAP-6: No Tenant Registry Validation (MEDIUM)

**Issue:** Future component specified but no test strategy

**From SAD Section 4.3.2:**
> File-based JSON registry (tenants.json)

**Recommendation:**

```javascript
describe('tenant registry', () => {
  it('should validate tenant registry schema', () => {
    const valid = {
      version: '1.0',
      tenants: [
        { id: 'alpha', enabled: true, domains: ['alpha.local'] }
      ]
    };
    expect(validateRegistry(valid)).toBe(true);
  });

  it('should reject duplicate tenant IDs', () => {
    const invalid = {
      tenants: [
        { id: 'alpha', domains: ['a.local'] },
        { id: 'alpha', domains: ['b.local'] }  // Duplicate
      ]
    };
    expect(() => validateRegistry(invalid)).toThrow('Duplicate tenant ID');
  });

  it('should reject duplicate domains', () => {
    const invalid = {
      tenants: [
        { id: 'alpha', domains: ['same.local'] },
        { id: 'beta', domains: ['same.local'] }  // Conflict
      ]
    };
    expect(() => validateRegistry(invalid)).toThrow('Duplicate domain');
  });
});
```

### 6.3 Low Priority Gaps

#### GAP-7: No Visual Regression Testing (LOW)

**Issue:** UI changes could break layout without detection

**Recommendation:** Implement visual regression testing with Percy or Chromatic after MVP

#### GAP-8: No Accessibility Testing (LOW)

**Issue:** No a11y testing strategy specified

**Recommendation:** Add jest-axe for automated accessibility testing

---

## 7. Quality Attribute Test Mapping

### 7.1 Security Testing (QAS-SEC-1, QAS-SEC-2)

**Quality Attribute:** Read path has minimal attack surface

**Test Strategy:**

| Test Type | Scope | Frequency |
|-----------|-------|-----------|
| Static Analysis | Content sanitization | Every build |
| Dependency Audit | npm audit | Weekly |
| CSP Validation | Security headers | Every deployment |
| Tenant Isolation | Cross-tenant requests | Every release |

**Example Tests:**

```javascript
describe('security - read path', () => {
  it('should serve only static files', async () => {
    const bundle = await analyzeBundleContents('dist/tenant-alpha');
    expect(bundle.serverSideCode).toHaveLength(0);
  });

  it('should include CSP headers in Caddyfile', () => {
    const caddyfile = fs.readFileSync('Caddyfile', 'utf8');
    expect(caddyfile).toContain('Content-Security-Policy');
  });
});

describe('security - tenant isolation', () => {
  it('should prevent cross-tenant resource access', async () => {
    // Request tenant-alpha content with tenant-beta host header
    const response = await fetch('http://localhost/tenant-beta-secret.html', {
      headers: { 'Host': 'tenant-alpha.local' }
    });
    expect(response.status).toBe(404);
  });
});
```

### 7.2 Portability Testing (QAS-PORT-1)

**Quality Attribute:** Bundles deploy without modification to any host

**Test Strategy:**

```javascript
describe('portability', () => {
  it('should generate host-agnostic bundles', async () => {
    await buildTenant('tenant-alpha');

    const bundle = await analyzeBundleContents('dist/tenant-alpha');

    // No absolute URLs
    expect(bundle.absoluteUrls).toHaveLength(0);

    // No server-specific config
    expect(bundle.serverConfig).toHaveLength(0);

    // Hash-based routing only
    expect(bundle.routingMechanism).toBe('hash');
  });

  it('should work with different base paths', async () => {
    // Test /docs/ subdirectory deployment
    // Test /tenant-alpha/ subdirectory deployment
  });
});
```

### 7.3 Reliability Testing (QAS-REL-1, QAS-REL-2)

**Quality Attribute:** Zero-downtime updates, tenant isolation

**Test Strategy:**

```javascript
describe('reliability - zero downtime', () => {
  it('should complete in-flight requests during deployment', async () => {
    // Start long-running request
    const slowRequest = fetch('http://tenant-alpha.local/large-page.html');

    // Deploy new version mid-request
    await deployTenant('tenant-alpha', 'new-version');

    // Verify request completes successfully
    const response = await slowRequest;
    expect(response.ok).toBe(true);
  });

  it('should measure effective downtime <100ms', async () => {
    const downtimeMetrics = await measureDeploymentDowntime('tenant-alpha');
    expect(downtimeMetrics.effectiveDowntime).toBeLessThan(100);
  });
});

describe('reliability - tenant isolation', () => {
  it('should not affect other tenants during build failure', async () => {
    // Introduce build error in tenant-alpha
    const alphaBuild = buildTenant('tenant-alpha').catch(err => err);

    // Verify tenant-beta still works
    const betaResponse = await fetch('http://tenant-beta.local');
    expect(betaResponse.ok).toBe(true);

    await expect(alphaBuild).rejects.toThrow();
  });
});
```

### 7.4 Cost Efficiency Testing (QAS-COST-1)

**Quality Attribute:** <$5/month per tenant hosting cost

**Test Strategy:**

```javascript
describe('cost efficiency', () => {
  it('should generate bundle <5MB for CDN cost optimization', async () => {
    await buildTenant('tenant-alpha');

    const bundleSize = await getBundleSize('dist/tenant-alpha');
    const gzippedSize = await getGzippedSize('dist/tenant-alpha');

    expect(bundleSize).toBeLessThan(5 * 1024 * 1024);
    expect(gzippedSize).toBeLessThan(1 * 1024 * 1024);
  });

  it('should generate cacheable static assets', async () => {
    const bundle = await analyzeBundleContents('dist/tenant-alpha');

    // All files should be static
    expect(bundle.dynamicAssets).toHaveLength(0);

    // Long cache headers recommended
    expect(bundle.cacheability).toBe('max');
  });
});
```

### 7.5 Maintainability Testing (QAS-MAINT-1)

**Quality Attribute:** New developer productive within 3 days

**Test Strategy:**

```javascript
describe('maintainability', () => {
  it('should have comprehensive test examples', () => {
    // Meta-test: verify test coverage exists
    const testFiles = findTestFiles('**/__tests__/**/*.js');
    expect(testFiles.length).toBeGreaterThan(10);
  });

  it('should have clear test documentation', () => {
    expect(fs.existsSync('docs/TESTING.md')).toBe(true);
  });

  it('should support fast test execution for TDD', async () => {
    const startTime = Date.now();
    await runTestSuite('unit');
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000); // <10s for unit tests
  });
});
```

---

## 8. Test Infrastructure Recommendations

### 8.1 Test Framework Selection

**Recommended:** Jest with JSDOM

**Rationale:**
- Zero-config setup aligns with zero-dependency philosophy
- Built-in mocking, assertions, and coverage
- JSDOM provides DOM environment for SPA testing
- Wide adoption = easy onboarding for new developers

**Alternative Considered:** Vitest
- Faster execution but newer ecosystem
- Consider for future migration if Jest becomes bottleneck

### 8.2 Test Organization Structure

```
apps/publisher/
├── src/
│   ├── app.js
│   └── __tests__/
│       └── app.test.js
├── scripts/
│   ├── build.js
│   └── __tests__/
│       ├── build.test.js
│       ├── build-tenants.test.js
│       └── lint-content.test.js
├── test-fixtures/
│   ├── tenants/
│   ├── content/
│   └── manifests/
├── __integration__/
│   ├── tenant-build.integration.test.js
│   ├── routing.integration.test.js
│   └── caddy.integration.test.js
└── jest.config.js
```

### 8.3 Test Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathIgnorePatterns=integration",
    "test:integration": "jest --testPathPattern=integration",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

### 8.4 Continuous Integration

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
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build:tenants
      - run: npm run caddy:up
      - run: npm run test:integration
      - run: npm run caddy:down
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-artifacts
          path: |
            dist/
            test-results/
```

### 8.5 Coverage Targets

| Component | Target | Priority |
|-----------|--------|----------|
| Build scripts | 85% | CRITICAL |
| Section templates | 90% | CRITICAL |
| Manifest parsing | 90% | CRITICAL |
| Router logic | 80% | HIGH |
| Content processing | 85% | HIGH |
| SEO utilities | 75% | MEDIUM |
| Dev utilities | 60% | LOW |

**Coverage Enforcement:**

```javascript
// jest.config.js
module.exports = {
  coverageThresholds: {
    global: {
      statements: 75,
      branches: 70,
      functions: 75,
      lines: 75
    },
    './scripts/build.js': {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85
    }
  }
};
```

---

## 9. Test Strategy Alignment with Lifecycle

### 9.1 Development Phase (Current)

**Test Focus:**
- Unit tests for build scripts
- Section template rendering tests
- Manifest validation tests

**Success Criteria:**
- 70% unit test coverage
- All critical paths tested
- TDD workflow established

### 9.2 Integration Phase (Future)

**Test Focus:**
- Multi-tenant build pipeline
- Routing configuration generation
- Caddy integration tests

**Success Criteria:**
- End-to-end tenant build tests passing
- Zero-downtime deployment verified
- Tenant isolation verified

### 9.3 Pre-Production Phase (Future)

**Test Focus:**
- Performance testing (NFR validation)
- Security scanning (dependency audit)
- Load testing (concurrent tenant builds)

**Success Criteria:**
- All NFR targets met
- No critical security vulnerabilities
- Deployment automation tested

### 9.4 Production Phase (Future)

**Test Focus:**
- Smoke tests after deployment
- Monitoring and alerting validation
- Rollback procedure testing

**Success Criteria:**
- Automated smoke tests pass
- Monitoring detects issues
- Rollback completes in <5 minutes

---

## 10. Risks and Mitigation

### 10.1 Testing Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Slow test execution breaks TDD workflow** | MEDIUM | HIGH | Use in-memory fs, optimize fixtures, parallelize tests |
| **Integration tests flaky on CI** | HIGH | MEDIUM | Use Docker for consistent environment, add retries |
| **Coverage targets slow development** | LOW | MEDIUM | Start with 60% target, increase incrementally |
| **No one maintains test suite** | MEDIUM | HIGH | Assign test ownership, make tests required for PR merge |

### 10.2 Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Regression bugs without test coverage** | HIGH | HIGH | Implement test suite before adding features |
| **Security vulnerabilities undetected** | MEDIUM | CRITICAL | Add npm audit to CI, implement content sanitization tests |
| **Performance degradation unnoticed** | MEDIUM | MEDIUM | Add performance benchmarks to test suite |

---

## 11. Conditional Approval Requirements

### 11.1 Must Address Before Production (CRITICAL)

1. **Implement Test Framework**
   - Add Jest to devDependencies
   - Create jest.config.js
   - Add test scripts to package.json
   - Target: Within 1 sprint

2. **Establish Core Test Suite**
   - Unit tests for build.js (85% coverage)
   - Unit tests for build-tenants.js (80% coverage)
   - Manifest validation tests
   - Section rendering smoke tests
   - Target: Within 2 sprints

3. **Add CI/CD Test Automation**
   - GitHub Actions workflow for tests
   - Test execution on PR
   - Coverage reporting
   - Target: Within 1 sprint

### 11.2 Should Address Before Scale (HIGH)

4. **Integration Test Suite**
   - End-to-end tenant build tests
   - Multi-tenant routing tests
   - Zero-downtime deployment tests
   - Target: Before 10+ tenant deployments

5. **Performance Test Baseline**
   - Build time benchmarks
   - Bundle size tests
   - Page load simulation
   - Target: Before production launch

6. **Test Data Strategy**
   - Comprehensive test fixtures
   - Edge case coverage
   - Invalid input tests
   - Target: Within 3 sprints

### 11.3 Nice to Have (MEDIUM)

7. **Advanced Testing**
   - Visual regression tests
   - Accessibility tests
   - Cross-browser tests
   - Target: Post-MVP

---

## 12. Summary and Recommendation

### 12.1 Testability Score

| Category | Score | Weight | Weighted Score |
|----------|-------|--------|----------------|
| Component Boundaries | 9/10 | 25% | 2.25 |
| Build Script Testability | 10/10 | 20% | 2.00 |
| SPA Testability | 7/10 | 15% | 1.05 |
| Test Data Management | 8/10 | 15% | 1.20 |
| Test Infrastructure | 2/10 | 15% | 0.30 |
| TDD Support | 8/10 | 10% | 0.80 |
| **Total** | | | **7.6/10** |

### 12.2 Verdict

**STATUS: CONDITIONAL APPROVAL**

The architecture demonstrates excellent testability characteristics at the component level. The zero-dependency philosophy, clear separation of concerns, and functional design create ideal conditions for test-driven development. Build scripts are testable as pure functions, section rendering is isolated, and tenant configuration is declarative.

However, the complete absence of test infrastructure creates critical technical debt. The architecture document correctly identifies this as TD-1 (No test framework) but underestimates its severity as "Medium." Without a test framework and strategy, the team cannot effectively practice TDD, verify NFRs, or prevent regressions.

### 12.3 Conditions for Full Approval

**Required within 2 sprints:**
1. Jest framework integrated with basic configuration
2. Core test suite for build scripts (70%+ coverage)
3. GitHub Actions CI workflow with automated testing
4. Test documentation (TESTING.md)

**Recommended within 4 sprints:**
5. Integration test suite for multi-tenant scenarios
6. Performance test baseline for NFR validation
7. Comprehensive test fixture library

### 12.4 Next Steps

1. **Immediate (Sprint 1):**
   - Install Jest and configure
   - Write test suite for build.js
   - Add `npm test` to CI script
   - Document test execution in DEVELOPER-GUIDE.md

2. **Short-term (Sprint 2-3):**
   - Complete unit test coverage for scripts/
   - Add integration tests for tenant builds
   - Create test fixture library
   - Establish coverage thresholds

3. **Medium-term (Sprint 4-6):**
   - Add performance benchmarks
   - Implement routing tests
   - Add security validation tests
   - Achieve 75% overall coverage

---

## Appendix A: Test Template Examples

### A.1 Build Script Unit Test Template

```javascript
const { buildTenant } = require('../build-tenants');
const fs = require('fs');
const path = require('path');

describe('build-tenants', () => {
  const testOutputDir = path.join(__dirname, '../../dist-test');

  beforeEach(() => {
    process.env.BUILD_OUTPUT = testOutputDir;
  });

  afterEach(async () => {
    await fs.promises.rm(testOutputDir, { recursive: true, force: true });
  });

  it('should generate complete tenant bundle', async () => {
    await buildTenant('tenant-alpha');

    const bundlePath = path.join(testOutputDir, 'tenant-alpha');
    expect(fs.existsSync(bundlePath)).toBe(true);
    expect(fs.existsSync(path.join(bundlePath, 'index.html'))).toBe(true);
  });
});
```

### A.2 Section Rendering Test Template

```javascript
const { renderSectionTemplate } = require('../section-templates');

describe('section templates', () => {
  it('should render welcome template with valid HTML', () => {
    const sectionData = {
      id: 'welcome',
      title: 'Welcome',
      content: '<p>Test content</p>'
    };

    const html = renderSectionTemplate('welcome', sectionData);

    expect(html).toContain('<h1>Welcome</h1>');
    expect(html).toContain('<p>Test content</p>');
    expect(html).toMatch(/<section.*data-template="welcome"/);
  });
});
```

### A.3 Integration Test Template

```javascript
describe('tenant build integration', () => {
  it('should build and deploy tenant end-to-end', async () => {
    // Build tenant
    await buildTenant('test-tenant');

    // Start Caddy
    await exec('npm run caddy:up');

    // Request content
    const response = await fetch('http://localhost:80', {
      headers: { 'Host': 'test-tenant.local' }
    });

    expect(response.ok).toBe(true);

    const html = await response.text();
    expect(html).toContain('test-tenant');

    // Cleanup
    await exec('npm run caddy:down');
  });
});
```

---

## Appendix B: Test Coverage Roadmap

### Phase 1: Foundation (Sprint 1-2)

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| build.js | 15 tests | 85% |
| build-tenants.js | 20 tests | 80% |
| manifest validation | 10 tests | 90% |

**Deliverable:** Working TDD workflow, CI integration

### Phase 2: Core Features (Sprint 3-4)

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Section rendering | 25 tests | 85% |
| Content processing | 15 tests | 80% |
| Router logic | 12 tests | 75% |

**Deliverable:** 70% overall coverage, comprehensive unit tests

### Phase 3: Integration (Sprint 5-6)

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Tenant build E2E | 8 tests | N/A |
| Multi-tenant routing | 6 tests | N/A |
| Deployment workflow | 5 tests | N/A |

**Deliverable:** Integration test suite, deployment verification

### Phase 4: Quality Assurance (Sprint 7-8)

| Component | Tests | Coverage Target |
|-----------|-------|-----------------|
| Performance benchmarks | 5 tests | N/A |
| Security validation | 8 tests | N/A |
| Tenant isolation | 6 tests | N/A |

**Deliverable:** NFR validation, production-ready quality gates

---

**END OF REVIEW**

---

## Document Metadata

**Reviewer:** Test Architect Agent
**Review Date:** 2025-12-01
**Document Reviewed:** Software Architecture Document v0.1
**Review Type:** Testability and Test Strategy
**Status:** CONDITIONAL APPROVAL
**Next Review:** After test framework implementation (Sprint 2)
