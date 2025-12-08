# Requirements Specification: Tenant Public Assets Feature

**Document ID:** REQ-PUBLIC-ASSETS-001
**Version:** 1.0
**Status:** Draft
**Date:** 2025-12-07
**Author:** Requirements Analysis Team
**Project:** Pagenary Publisher

---

## Executive Summary

Tenants require the ability to include static assets (images, icons, logos, favicons) in their documentation that are automatically copied to the built output and can be reliably referenced in content pages. This feature introduces a `.public/` directory convention within tenant source directories that will be processed during the build pipeline and output to `dist/<tenant-id>/assets/`, with special handling for favicon files at the distribution root.

---

## Table of Contents

1. [Functional Requirements](#functional-requirements)
2. [Non-Functional Requirements](#non-functional-requirements)
3. [User Stories](#user-stories)
4. [Acceptance Criteria](#acceptance-criteria)
5. [Technical Specifications](#technical-specifications)
6. [Test Cases](#test-cases)
7. [Assumptions and Constraints](#assumptions-and-constraints)
8. [Risk Analysis](#risk-analysis)
9. [Implementation Estimate](#implementation-estimate)
10. [Open Questions](#open-questions)
11. [Next Steps](#next-steps)

---

## Functional Requirements

### FR-001: Public Directory Asset Copying

**Priority:** Critical
**Category:** Build Pipeline

**Description:**
The build system SHALL copy all contents of the `.public/` directory from tenant source to `dist/<tenant-id>/assets/` during the tenant build process.

**Acceptance Criteria:**
- [ ] Build script detects presence of `.public/` directory in tenant source
- [ ] All files within `.public/` are copied to `dist/<tenant-id>/assets/`
- [ ] Copy operation preserves file integrity (checksums match)
- [ ] Copy operation completes before content processing phase

**Dependencies:**
- Tenant build pipeline (`scripts/build-tenants.js`)
- File system operations (Node.js `fs/promises`)

**Edge Cases:**
- Empty `.public/` directory (should create empty `assets/` directory)
- Symlinks within `.public/` (should follow or skip based on security policy)
- Hidden files (`.DS_Store`, `.gitkeep`) handling policy

---

### FR-002: Favicon Special Handling

**Priority:** High
**Category:** Build Pipeline

**Description:**
Favicon files (`favicon.ico`, `favicon.png`, `apple-touch-icon.png`, `favicon-*.png`) located in `.public/` SHALL be copied to the distribution root (`dist/<tenant-id>/`) in addition to the assets directory.

**Acceptance Criteria:**
- [ ] `favicon.ico` copied to `dist/<tenant-id>/favicon.ico`
- [ ] `favicon.png` copied to `dist/<tenant-id>/favicon.png`
- [ ] `apple-touch-icon.png` copied to `dist/<tenant-id>/apple-touch-icon.png`
- [ ] Pattern `favicon-{size}.png` (e.g., `favicon-32x32.png`) copied to root
- [ ] All favicon files also remain in `dist/<tenant-id>/assets/`

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Build script favicon detection logic

**Edge Cases:**
- Multiple favicon variants present (all should be copied)
- Non-standard favicon names (should not trigger special handling)
- Favicon subdirectories (e.g., `.public/icons/favicon.ico` - should NOT be copied to root)

---

### FR-003: Asset URL Accessibility

**Priority:** Critical
**Category:** Runtime / Content Rendering

**Description:**
Static assets SHALL be accessible via relative URL pattern `./assets/<filename>` from any rendered content page within the tenant bundle.

**Acceptance Criteria:**
- [ ] Assets accessible at `<tenant-base-url>/assets/<filename>`
- [ ] Relative references (`./assets/logo.png`) resolve correctly from content pages
- [ ] Hash-based routing does not interfere with asset loading
- [ ] Assets served with correct MIME types (images as `image/*`)

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Publisher routing system (`src/app.js`)
- Web server configuration (Caddy, development server)

**Edge Cases:**
- Deep-linked pages (e.g., `#/guides/getting-started`) resolving `./assets/`
- Assets with query parameters (`./assets/image.png?v=2`)
- Asset names with special characters or spaces

---

### FR-004: Supported Image Formats

**Priority:** High
**Category:** Build Pipeline

**Description:**
The build system SHALL support copying the following common image formats without transformation: `.png`, `.jpg`, `.jpeg`, `.svg`, `.ico`, `.webp`, `.gif`, `.avif`, `.bmp`.

**Acceptance Criteria:**
- [ ] All listed image formats copied as binary files
- [ ] No image transformation or optimization applied (future enhancement)
- [ ] File extensions case-insensitive (`.PNG` treated same as `.png`)
- [ ] Non-image files in `.public/` also supported (e.g., `.pdf`, `.zip`)

**Dependencies:**
- FR-001 (Public Directory Asset Copying)

**Edge Cases:**
- Unknown file extensions (should still be copied)
- Files without extensions (should be copied)
- MIME type detection for serving (not build concern)

---

### FR-005: Subdirectory Structure Preservation

**Priority:** High
**Category:** Build Pipeline

**Description:**
The build system SHALL preserve subdirectory structure within `.public/` when copying to `dist/<tenant-id>/assets/`.

**Acceptance Criteria:**
- [ ] `.public/icons/logo.png` → `dist/<tenant-id>/assets/icons/logo.png`
- [ ] `.public/images/screenshots/demo.png` → `dist/<tenant-id>/assets/images/screenshots/demo.png`
- [ ] Empty subdirectories not created (only directories with files)
- [ ] Nested directory depth supported up to 10 levels

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- File system recursive copy utilities

**Edge Cases:**
- Very deep nesting (>10 levels) - should warn or fail gracefully
- Circular symlinks within `.public/` (should detect and skip)
- Directory names with special characters

---

### FR-006: Markdown Image Reference Support

**Priority:** Critical
**Category:** Content Rendering

**Description:**
Markdown content files SHALL support standard image syntax referencing assets via `![alt text](./assets/<filename>)` and have images render correctly in the browser.

**Acceptance Criteria:**
- [ ] Standard Markdown image syntax supported: `![Alt](./assets/image.png)`
- [ ] Images display in rendered HTML output
- [ ] Alt text preserved for accessibility
- [ ] Relative paths resolve correctly from any content page
- [ ] Image titles supported: `![Alt](./assets/image.png "Title")`

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- FR-003 (Asset URL Accessibility)
- Markdown parser (`src/utils/parseMarkdown.js` or equivalent)

**Edge Cases:**
- Images in nested content directories (e.g., `tenants/alpha/content/guides/page.md`)
- Images with absolute URLs (should pass through unchanged)
- Images with data URIs (should not process)
- Broken image references (should not break build)

---

### FR-007: HTML Image Reference Support

**Priority:** High
**Category:** Content Rendering

**Description:**
HTML content files (`.html`) and inline HTML within Markdown SHALL support `<img>` tags referencing assets via `src="./assets/<filename>"`.

**Acceptance Criteria:**
- [ ] `<img>` tags with relative asset paths render correctly
- [ ] `src` attribute supports `./assets/` prefix
- [ ] `alt`, `title`, `width`, `height` attributes preserved
- [ ] Responsive images (`srcset`, `sizes`) supported

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- FR-003 (Asset URL Accessibility)
- HTML content loader

**Edge Cases:**
- Inline SVG (not file references)
- Background images via inline `style` attributes
- `<picture>` elements with multiple sources

---

### FR-008: Optional .public/ Directory

**Priority:** Critical
**Category:** Build Pipeline

**Description:**
The absence of a `.public/` directory in a tenant source SHALL NOT cause build errors or warnings. The feature is optional.

**Acceptance Criteria:**
- [ ] Build succeeds when `.public/` directory is absent
- [ ] No errors or warnings logged for missing `.public/`
- [ ] `dist/<tenant-id>/assets/` directory not created if `.public/` absent
- [ ] Build behavior identical to pre-feature state when not used

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Build script conditional logic

**Edge Cases:**
- Empty `.public/` directory present (should create empty `assets/` or skip)
- `.public/` file (not directory) present (should warn and skip)

---

### FR-009: Git Source Tenant Support

**Priority:** High
**Category:** Build Pipeline / Git Integration

**Description:**
Tenants sourced from Git repositories SHALL have their `.public/` directories processed identically to local filesystem tenants.

**Acceptance Criteria:**
- [ ] `.public/` directory detected in Git-sourced tenant content
- [ ] Assets copied from Git cache to distribution directory
- [ ] Sparse checkout (if enabled) includes `.public/` directory
- [ ] Git clone depth does not affect asset availability

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Git source handling in `build-tenants.js`
- Git sparse checkout configuration

**Edge Cases:**
- `.public/` not present in specified Git ref (should silently skip)
- Large binary assets in Git (may impact clone time)
- Sparse checkout excluding `.public/` path (should warn or auto-include)

---

### FR-010: Asset Cache Invalidation

**Priority:** Medium
**Category:** Build Pipeline

**Description:**
When using incremental builds (`--incremental` flag), changes to files in `.public/` SHALL trigger asset recopy to distribution directory.

**Acceptance Criteria:**
- [ ] Asset file modifications detected via hash comparison
- [ ] Modified assets recopied to `dist/<tenant-id>/assets/`
- [ ] Deleted assets removed from distribution directory
- [ ] Added assets copied to distribution directory
- [ ] Unchanged assets not reprocessed

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Incremental build system (`--incremental` flag support)
- Content hash tracking mechanism

**Edge Cases:**
- Asset renamed (appears as delete + add)
- Asset moved between subdirectories
- Timestamp-only changes (should not trigger recopy if hash unchanged)

---

## Non-Functional Requirements

### NFR-001: Build Performance Impact

**Priority:** High
**Category:** Performance

**Description:**
Copying assets from `.public/` to distribution directory SHALL NOT significantly impact overall build time for typical asset sets.

**Acceptance Criteria:**
- [ ] Asset copying adds <100ms to build time for 10 assets (<1MB each)
- [ ] Asset copying adds <500ms for 50 assets (<5MB total)
- [ ] Asset copying adds <2 seconds for 200 assets (<20MB total)
- [ ] Parallel file copy used for >10 assets

**Measurement:**
- Measure build time with and without `.public/` directory
- Test with varying asset counts and sizes
- Profile using Node.js built-in profiling tools

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- File I/O performance characteristics

---

### NFR-002: Large Asset Warning

**Priority:** Medium
**Category:** Developer Experience

**Description:**
The build system SHALL generate console warnings when individual asset files exceed 1MB in size.

**Acceptance Criteria:**
- [ ] Warning logged to console for each file >1MB
- [ ] Warning includes filename and actual size
- [ ] Warning suggests optimization strategies (e.g., compression, CDN)
- [ ] Build continues despite warnings (non-blocking)
- [ ] Warning threshold configurable via environment variable `ASSET_SIZE_WARNING_MB`

**Rationale:**
- Large assets impact page load performance
- Early warning helps developers optimize before deployment
- Not enforced as hard limit to maintain flexibility

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Build logging system

---

### NFR-003: Total Asset Size Warning

**Priority:** Medium
**Category:** Developer Experience

**Description:**
The build system SHALL generate a console warning when total `.public/` directory size exceeds 10MB for a tenant.

**Acceptance Criteria:**
- [ ] Total size calculated before copying
- [ ] Warning logged once per tenant if threshold exceeded
- [ ] Warning includes total size and file count
- [ ] Build continues despite warning (non-blocking)
- [ ] Threshold configurable via `ASSET_TOTAL_SIZE_WARNING_MB`

**Rationale:**
- Prevents bloated tenant bundles
- Encourages use of CDN for large media libraries
- Maintains fast bundle distribution

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Build logging system

---

### NFR-004: Build Error Handling

**Priority:** Critical
**Category:** Reliability

**Description:**
Asset copying failures SHALL provide clear error messages and fail the build gracefully without corrupting the distribution directory.

**Acceptance Criteria:**
- [ ] File system errors (permissions, disk full) logged with context
- [ ] Partial copy operations rolled back on error
- [ ] Error messages include tenant ID and failing file path
- [ ] Build exits with non-zero status code on asset copy failure
- [ ] Stack traces included in verbose mode only

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Build error handling system

---

### NFR-005: Cross-Platform Compatibility

**Priority:** High
**Category:** Portability

**Description:**
Asset copying SHALL work identically on Linux, macOS, and Windows development environments.

**Acceptance Criteria:**
- [ ] Path separators handled correctly (use `path.join()`)
- [ ] File permissions preserved where applicable (Unix-like systems)
- [ ] Symlinks handled consistently or documented as unsupported
- [ ] Case sensitivity differences documented (macOS vs Linux)
- [ ] Binary file copying uses platform-agnostic methods

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Node.js `path` and `fs` modules

---

### NFR-006: Security: Path Traversal Prevention

**Priority:** Critical
**Category:** Security

**Description:**
Asset copying SHALL prevent path traversal attacks via malicious filenames or symlinks.

**Acceptance Criteria:**
- [ ] Filenames containing `../` or `..\\` rejected or sanitized
- [ ] Symlinks pointing outside `.public/` directory rejected
- [ ] Absolute paths in asset references rejected
- [ ] Security error logged with details (but no build failure)
- [ ] Test suite includes path traversal attack vectors

**Threat Model:**
- Malicious tenant content attempting to overwrite system files
- Symlink attacks to read sensitive files outside tenant directory
- Filename exploits to escape distribution sandbox

**Dependencies:**
- FR-001 (Public Directory Asset Copying)
- Path sanitization utilities

---

### NFR-007: Accessibility: Alt Text Validation

**Priority:** Low
**Category:** Accessibility (Future Enhancement)

**Description:**
Build system SHOULD (future) warn when Markdown images reference assets without alt text.

**Acceptance Criteria (Future):**
- [ ] Markdown parser detects `![](./assets/image.png)` (empty alt)
- [ ] Warning logged with content file and line number
- [ ] Warning non-blocking (accessibility best practice enforcement)
- [ ] Configurable via `--strict-accessibility` flag

**Rationale:**
- Improves documentation accessibility
- Aligns with WCAG 2.1 guidelines
- Educational for content authors

**Status:** Deferred to post-MVP

---

## User Stories

### US-001: Documentation Author Adds Logo

**As a** documentation author for Tenant Alpha
**I want to** include our company logo in the getting-started guide
**So that** readers see branded content consistent with our visual identity

**Acceptance Criteria:**
- Given I create `tenants/tenant-alpha/.public/logo.png`
- And I write `![Company Logo](./assets/logo.png)` in `content/getting-started.md`
- When the tenant bundle is built
- Then the logo displays correctly at the top of the getting-started page
- And the logo file is accessible at `dist/tenant-alpha/assets/logo.png`

**Priority:** Critical
**Effort:** 2 story points

**Technical Notes:**
- Tests with 100x100px PNG logo
- Verify in both dev server and production Caddy deployment
- Check browser network tab for 200 OK on asset load

---

### US-002: Developer Adds Favicon

**As a** tenant developer
**I want to** provide a custom favicon for our documentation site
**So that** users see our icon in browser tabs and bookmarks

**Acceptance Criteria:**
- Given I create `tenants/tenant-beta/.public/favicon.ico`
- When the tenant bundle is built
- Then `dist/tenant-beta/favicon.ico` exists at the root
- And browsers display the favicon when loading any documentation page
- And the favicon is also available at `dist/tenant-beta/assets/favicon.ico`

**Priority:** High
**Effort:** 1 story point

**Technical Notes:**
- Test with multiple favicon formats (`.ico`, `.png`, `apple-touch-icon.png`)
- Verify mobile Safari and Chrome behavior
- Check HTML `<link rel="icon">` tag injection (may need separate story)

---

### US-003: Content Author References Screenshots

**As a** technical writer
**I want to** include UI screenshots in tutorial content
**So that** users can follow visual step-by-step instructions

**Acceptance Criteria:**
- Given I organize screenshots in `tenants/default/.public/screenshots/`
- And I create `step-1.png`, `step-2.png`, `step-3.png`
- And I reference them in `content/tutorials/setup.md` as:
  ```markdown
  ![Step 1: Login Screen](./assets/screenshots/step-1.png)
  ![Step 2: Dashboard](./assets/screenshots/step-2.png)
  ```
- When the tutorial page renders
- Then all screenshots display in correct order
- And subdirectory structure preserved in `dist/default/assets/screenshots/`

**Priority:** High
**Effort:** 2 story points

**Technical Notes:**
- Tests subdirectory preservation (FR-005)
- Verify alt text accessibility
- Check responsive image behavior on mobile

---

### US-004: Tenant Migrated from Git Repository

**As a** DevOps engineer
**I want to** build tenant documentation from a Git repository containing `.public/` assets
**So that** our CI/CD pipeline can deploy documentation from version-controlled sources

**Acceptance Criteria:**
- Given a tenant defined in `tenants.json` with Git source:
  ```json
  {
    "id": "tenant-gamma",
    "source": {
      "type": "git",
      "url": "https://github.com/org/docs-gamma.git",
      "ref": "main",
      "path": "docs/"
    }
  }
  ```
- And the repository contains `docs/.public/logo.png`
- When I run `npm run build:tenants tenant-gamma`
- Then `dist/tenant-gamma/assets/logo.png` is created
- And the asset is identical to the Git repository version (checksum match)

**Priority:** High
**Effort:** 3 story points

**Technical Notes:**
- Tests Git source integration (FR-009)
- Verify sparse checkout includes `.public/`
- Check cache behavior with `--keep-cache`

---

### US-005: Developer Runs Incremental Build

**As a** developer iterating on documentation
**I want to** rebuild only changed assets during incremental builds
**So that** my edit-preview cycle is fast

**Acceptance Criteria:**
- Given I build tenant-alpha with `npm run build:tenants tenant-alpha`
- And I modify `.public/icon.png` (change file content)
- When I run `npm run build:tenants tenant-alpha --incremental`
- Then only `icon.png` is recopied to `dist/tenant-alpha/assets/`
- And unchanged assets are not reprocessed
- And build time is <200ms (vs ~1s for full rebuild)

**Priority:** Medium
**Effort:** 5 story points

**Technical Notes:**
- Tests incremental build support (FR-010)
- Requires content hash tracking implementation
- Measure performance improvement

---

### US-006: Tenant Without Assets

**As a** tenant administrator for a minimal documentation site
**I want to** build my tenant without providing a `.public/` directory
**So that** I'm not forced to include assets if I don't need them

**Acceptance Criteria:**
- Given `tenants/tenant-simple/` contains only `config.json`, `manifest.json`, and `content/`
- And there is no `.public/` directory
- When I run `npm run build:tenants tenant-simple`
- Then the build succeeds without errors or warnings
- And `dist/tenant-simple/assets/` is not created (or is empty)
- And documentation pages render correctly without asset references

**Priority:** Critical
**Effort:** 1 story point

**Technical Notes:**
- Tests optional `.public/` directory (FR-008)
- Validates backward compatibility
- Confirms no regression in existing tenant builds

---

## Acceptance Criteria

### Global Acceptance Criteria (applies to all features)

**GAC-1: Build Success**
- All tenant builds complete successfully with `.public/` directory present or absent
- Exit code 0 on successful build
- Exit code non-zero on asset copy errors

**GAC-2: Asset Integrity**
- Copied assets are byte-for-byte identical to source files
- File checksums (SHA-256) match between source and destination
- Binary files not corrupted during copy

**GAC-3: Browser Rendering**
- Referenced assets load with HTTP 200 status
- Images display correctly in Chrome, Firefox, Safari (latest versions)
- No console errors related to asset loading

**GAC-4: Documentation Updated**
- README.md or CLAUDE.md updated with `.public/` directory usage instructions
- Tenant setup guide includes asset examples
- Troubleshooting section covers common asset issues

**GAC-5: Test Coverage**
- Unit tests cover asset copying logic (>90% coverage)
- Integration tests verify end-to-end asset workflow
- Edge cases documented in test suite

---

## Technical Specifications

### Data Model

#### Tenant Configuration Schema Extension

**File:** `tenants.schema.json` (extension)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tenant Configuration Schema",
  "type": "object",
  "properties": {
    "publicDir": {
      "type": "string",
      "default": ".public",
      "description": "Directory name for static assets (relative to tenant source root)"
    },
    "assetsOutputDir": {
      "type": "string",
      "default": "assets",
      "description": "Output directory name for assets (relative to dist/<tenant-id>/)"
    },
    "copyFaviconsToRoot": {
      "type": "boolean",
      "default": true,
      "description": "Copy favicon files to distribution root in addition to assets directory"
    }
  }
}
```

**Note:** These are optional overrides. Defaults apply if not specified.

---

### File System Structure

#### Source (Tenant Directory)

```
tenants/tenant-alpha/
├── config.json
├── manifest.json
├── content/
│   ├── getting-started.md
│   └── guides/
│       └── installation.md
└── .public/                    # New directory
    ├── favicon.ico
    ├── favicon-32x32.png
    ├── apple-touch-icon.png
    ├── logo.png
    ├── logo.svg
    └── screenshots/
        ├── dashboard.png
        └── settings.png
```

#### Output (Distribution)

```
dist/tenant-alpha/
├── index.html
├── app.js
├── styles.css
├── favicon.ico                 # Copied from .public/
├── favicon-32x32.png           # Copied from .public/
├── apple-touch-icon.png        # Copied from .public/
├── manifest.js
├── sections/
│   └── (compiled content modules)
└── assets/                     # New directory
    ├── favicon.ico             # Also in root
    ├── favicon-32x32.png       # Also in root
    ├── apple-touch-icon.png    # Also in root
    ├── logo.png
    ├── logo.svg
    └── screenshots/
        ├── dashboard.png
        └── settings.png
```

---

### Build Pipeline Integration

#### Proposed Build Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Load Tenant Registry (tenants.json)                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. For each enabled tenant:                                 │
│    a. Resolve source (local or git clone)                   │
│    b. Parse config.json, manifest.json                      │
│    c. [NEW] Copy .public/ → dist/<tenant>/assets/           │
│    d. [NEW] Copy favicons → dist/<tenant>/ (root)           │
│    e. Process content/ (markdown, HTML, JS)                 │
│    f. Apply overrides/ (post-build replacements)            │
│    g. Generate manifest.js                                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Validate output (optional: npm run check:seo)            │
└─────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- Insert asset copying steps (2c, 2d) BEFORE content processing
- Ensures assets available for content link validation (future feature)

---

### Implementation Pseudocode

#### Asset Copying Function

**File:** `scripts/build-tenants.js` (new function)

```javascript
/**
 * Copy static assets from .public/ to distribution directory
 * @param {string} tenantSourcePath - Absolute path to tenant source
 * @param {string} tenantDistPath - Absolute path to tenant distribution
 * @param {object} config - Tenant configuration (for overrides)
 * @returns {Promise<{assetCount: number, totalSize: number}>}
 */
async function copyPublicAssets(tenantSourcePath, tenantDistPath, config = {}) {
  const publicDir = config.publicDir || '.public';
  const assetsOutputDir = config.assetsOutputDir || 'assets';
  const copyFaviconsToRoot = config.copyFaviconsToRoot !== false;

  const sourcePath = path.join(tenantSourcePath, publicDir);
  const targetPath = path.join(tenantDistPath, assetsOutputDir);

  // Check if .public/ exists
  if (!fs.existsSync(sourcePath)) {
    console.log(`[INFO] No ${publicDir} directory found, skipping assets`);
    return { assetCount: 0, totalSize: 0 };
  }

  // Ensure target directory exists
  await fsp.mkdir(targetPath, { recursive: true });

  // Recursively copy all files
  const files = await getFilesRecursive(sourcePath);
  let totalSize = 0;
  let assetCount = 0;

  for (const file of files) {
    const relativePath = path.relative(sourcePath, file);
    const targetFilePath = path.join(targetPath, relativePath);

    // Security: prevent path traversal
    if (!isPathSafe(targetFilePath, targetPath)) {
      console.warn(`[WARN] Skipping unsafe path: ${relativePath}`);
      continue;
    }

    // Copy file
    await fsp.mkdir(path.dirname(targetFilePath), { recursive: true });
    await fsp.copyFile(file, targetFilePath);

    const stats = await fsp.stat(file);
    totalSize += stats.size;
    assetCount++;

    // Warn on large files
    if (stats.size > 1024 * 1024) { // 1MB
      console.warn(`[WARN] Large asset: ${relativePath} (${formatBytes(stats.size)})`);
    }

    // Special handling for favicons
    if (copyFaviconsToRoot && isFavicon(relativePath)) {
      const rootPath = path.join(tenantDistPath, path.basename(relativePath));
      await fsp.copyFile(file, rootPath);
      console.log(`[INFO] Copied favicon to root: ${path.basename(relativePath)}`);
    }
  }

  // Warn on large total size
  const maxSize = parseInt(process.env.ASSET_TOTAL_SIZE_WARNING_MB || '10', 10) * 1024 * 1024;
  if (totalSize > maxSize) {
    console.warn(`[WARN] Total assets size: ${formatBytes(totalSize)} (exceeds ${formatBytes(maxSize)})`);
  }

  console.log(`[INFO] Copied ${assetCount} assets (${formatBytes(totalSize)})`);
  return { assetCount, totalSize };
}

/**
 * Check if relative path is a favicon file
 */
function isFavicon(relativePath) {
  const basename = path.basename(relativePath);
  const faviconPatterns = [
    'favicon.ico',
    'favicon.png',
    'apple-touch-icon.png',
    /^favicon-\d+x\d+\.png$/ // favicon-32x32.png, etc.
  ];

  return faviconPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return basename === pattern;
    } else {
      return pattern.test(basename);
    }
  });
}

/**
 * Security: Ensure target path doesn't escape destination directory
 */
function isPathSafe(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolved.startsWith(resolvedBase);
}
```

---

### API Contracts

**No external APIs involved.** All operations are file system-based.

---

### Integration Points

1. **Build Script (`scripts/build-tenants.js`)**
   - Insert `copyPublicAssets()` call in tenant build loop
   - Position: After source resolution, before content processing

2. **Markdown Parser**
   - No changes required (standard `![](./assets/file.png)` already supported)
   - Future: Add link validation to verify asset existence

3. **Development Server (Vite)**
   - Ensure `dist/` directory served statically
   - Verify `assets/` subdirectory accessible

4. **Caddy Configuration (`Caddyfile`)**
   - No changes required (already serves entire `dist/` tree)
   - Verify MIME types correctly set for image formats

5. **Git Source Handler**
   - Sparse checkout configuration: include `.public/` pattern
   - Ensure cache directory preserves `.public/` after clone

---

## Test Cases

### TC-001: Build Tenant with Multiple Image Types

**Objective:** Verify all common image formats are copied correctly

**Setup:**
1. Create `tenants/test-tc001/.public/` with files:
   - `image.png` (100KB, 200x200px)
   - `photo.jpg` (80KB, 150x150px)
   - `icon.svg` (5KB, vector)
   - `favicon.ico` (2KB, 16x16px multi-resolution)
   - `graphic.webp` (50KB, 300x300px)
   - `animation.gif` (200KB, 10 frames)

**Steps:**
1. Run `npm run build:tenants test-tc001`
2. Check `dist/test-tc001/assets/` for all files
3. Verify file sizes match source
4. Verify SHA-256 checksums match

**Expected Results:**
- All 6 files present in `dist/test-tc001/assets/`
- Checksums identical
- Build logs show "Copied 6 assets (437KB)" (approximate)

**Pass/Fail Criteria:**
- PASS: All files present and checksums match
- FAIL: Any file missing, corrupted, or wrong size

---

### TC-002: Build Tenant with Nested Subdirectories

**Objective:** Verify subdirectory structure is preserved

**Setup:**
1. Create `tenants/test-tc002/.public/` with structure:
   ```
   .public/
   ├── logos/
   │   ├── primary.png
   │   └── secondary.svg
   ├── icons/
   │   ├── 16x16/
   │   │   └── icon.png
   │   └── 32x32/
   │       └── icon.png
   └── screenshots/
       └── dashboard.png
   ```

**Steps:**
1. Run `npm run build:tenants test-tc002`
2. Verify `dist/test-tc002/assets/` mirrors source structure
3. Check all nested files accessible

**Expected Results:**
- `dist/test-tc002/assets/logos/primary.png` exists
- `dist/test-tc002/assets/icons/16x16/icon.png` exists
- All 5 files present with correct paths

**Pass/Fail Criteria:**
- PASS: All nested files present at correct paths
- FAIL: Files flattened or paths incorrect

---

### TC-003: Build Tenant with Favicon Files

**Objective:** Verify favicons copied to both root and assets

**Setup:**
1. Create `tenants/test-tc003/.public/` with:
   - `favicon.ico`
   - `favicon-32x32.png`
   - `apple-touch-icon.png`

**Steps:**
1. Run `npm run build:tenants test-tc003`
2. Check `dist/test-tc003/favicon.ico` (root)
3. Check `dist/test-tc003/favicon-32x32.png` (root)
4. Check `dist/test-tc003/apple-touch-icon.png` (root)
5. Check all three also in `dist/test-tc003/assets/`

**Expected Results:**
- 3 files at root
- 3 files in assets directory (6 files total)
- All checksums match source

**Pass/Fail Criteria:**
- PASS: All 6 copies present and correct
- FAIL: Root copies missing or assets duplicates missing

---

### TC-004: Build Tenant Without .public/ Directory

**Objective:** Verify build succeeds when .public/ is absent

**Setup:**
1. Create `tenants/test-tc004/` with only:
   - `config.json`
   - `manifest.json`
   - `content/index.md`

**Steps:**
1. Run `npm run build:tenants test-tc004`
2. Verify build exits with code 0
3. Check console for errors/warnings
4. Verify `dist/test-tc004/` created successfully

**Expected Results:**
- Build completes successfully
- Log message: "[INFO] No .public directory found, skipping assets"
- `dist/test-tc004/assets/` does not exist (or is empty)
- No errors or warnings logged

**Pass/Fail Criteria:**
- PASS: Build succeeds, no errors, no assets directory
- FAIL: Build errors, warnings, or creates empty assets directory

---

### TC-005: Render Markdown with Asset References

**Objective:** Verify images render correctly in browser

**Setup:**
1. Create `tenants/test-tc005/.public/logo.png`
2. Create `tenants/test-tc005/content/index.md`:
   ```markdown
   # Welcome
   ![Company Logo](./assets/logo.png)
   ```

**Steps:**
1. Run `npm run build:tenants test-tc005`
2. Start dev server: `npm run serve`
3. Navigate to `http://localhost:5173/test-tc005/#/index`
4. Open browser DevTools > Network tab
5. Verify `logo.png` loaded with HTTP 200

**Expected Results:**
- Image displays on page
- Network tab shows `GET /test-tc005/assets/logo.png` → 200 OK
- Alt text "Company Logo" present in HTML

**Pass/Fail Criteria:**
- PASS: Image visible, HTTP 200, alt text correct
- FAIL: Broken image, HTTP 404, or alt text missing

---

### TC-006: Large Asset Warning

**Objective:** Verify warning logged for files >1MB

**Setup:**
1. Create `tenants/test-tc006/.public/large-image.png` (2MB file)

**Steps:**
1. Run `npm run build:tenants test-tc006`
2. Capture console output

**Expected Results:**
- Build succeeds (warning is non-blocking)
- Console shows: "[WARN] Large asset: large-image.png (2.0 MB)"
- File still copied to `dist/test-tc006/assets/large-image.png`

**Pass/Fail Criteria:**
- PASS: Warning logged, file copied, build succeeds
- FAIL: No warning, file not copied, or build fails

---

### TC-007: Total Asset Size Warning

**Objective:** Verify warning when total .public/ exceeds 10MB

**Setup:**
1. Create `tenants/test-tc007/.public/` with 12 files, each 1MB (12MB total)

**Steps:**
1. Run `npm run build:tenants test-tc007`
2. Capture console output

**Expected Results:**
- Build succeeds
- Console shows: "[WARN] Total assets size: 12.0 MB (exceeds 10.0 MB)"
- All files copied successfully

**Pass/Fail Criteria:**
- PASS: Warning logged, all files copied, build succeeds
- FAIL: No warning, files missing, or build fails

---

### TC-008: Git Source Tenant with Assets

**Objective:** Verify Git-sourced tenants process .public/ correctly

**Setup:**
1. Create Git repository `test-repo-tc008` with:
   ```
   docs/
   ├── config.json
   ├── manifest.json
   ├── content/index.md
   └── .public/logo.png
   ```
2. Add tenant to `tenants.json`:
   ```json
   {
     "id": "test-tc008",
     "source": {
       "type": "git",
       "url": "file:///tmp/test-repo-tc008",
       "ref": "main",
       "path": "docs/"
     }
   }
   ```

**Steps:**
1. Run `npm run build:tenants test-tc008`
2. Verify `dist/test-tc008/assets/logo.png` exists
3. Verify checksum matches Git repository version

**Expected Results:**
- Asset copied from Git cache to distribution
- Checksum matches repository file
- Build log shows Git clone and asset copy operations

**Pass/Fail Criteria:**
- PASS: Asset present, checksum matches, build succeeds
- FAIL: Asset missing, checksum mismatch, or build fails

---

### TC-009: Incremental Build with Changed Asset

**Objective:** Verify incremental builds detect and recopy modified assets

**Setup:**
1. Create `tenants/test-tc009/.public/logo.png` (version 1)
2. Run initial build: `npm run build:tenants test-tc009`
3. Modify `logo.png` (change content, version 2)

**Steps:**
1. Run `npm run build:tenants test-tc009 --incremental`
2. Verify `dist/test-tc009/assets/logo.png` updated
3. Verify checksum matches version 2
4. Check build time (<500ms expected)

**Expected Results:**
- Asset updated in distribution
- Build log shows "Recopy: logo.png (hash changed)"
- Build faster than full rebuild

**Pass/Fail Criteria:**
- PASS: Asset updated, checksum correct, fast rebuild
- FAIL: Asset not updated, wrong checksum, or slow rebuild

**Note:** Requires incremental build implementation (FR-010)

---

### TC-010: Path Traversal Security Test

**Objective:** Verify build rejects malicious path traversal attempts

**Setup:**
1. Create `tenants/test-tc010/.public/` with malicious symlink:
   ```bash
   ln -s /etc/passwd .public/evil-link
   ```
2. Create file with path traversal name:
   ```bash
   touch .public/../../../etc-passwd-copy
   ```

**Steps:**
1. Run `npm run build:tenants test-tc010`
2. Check console for security warnings
3. Verify `dist/test-tc010/assets/` does NOT contain symlink target or escaped files
4. Verify `/etc/passwd` not copied anywhere

**Expected Results:**
- Build succeeds (warns but doesn't fail)
- Console shows: "[WARN] Skipping unsafe path: ../../../etc-passwd-copy"
- Symlinks skipped or followed only within `.public/`
- No files outside `dist/test-tc010/` created

**Pass/Fail Criteria:**
- PASS: Security warning logged, malicious files skipped
- FAIL: Files escape distribution directory or system files accessed

---

## Assumptions and Constraints

### Assumptions

1. **Tenant Source Accessibility**
   - Assumption: All tenant source directories (local or Git) are readable by build process
   - Impact if Invalid: Build fails with permission errors; requires file system permission troubleshooting
   - Mitigation: Document required permissions in README

2. **Asset File Sizes**
   - Assumption: Typical tenant will have <10MB of assets (<50 files)
   - Impact if Invalid: Build times may increase; warnings will fire frequently
   - Mitigation: Document CDN recommendations for large media libraries

3. **File System Case Sensitivity**
   - Assumption: Development on macOS/Windows (case-insensitive), production on Linux (case-sensitive)
   - Impact if Invalid: Asset references may break on Linux if case mismatched
   - Mitigation: Document case sensitivity in troubleshooting guide

4. **Node.js Version**
   - Assumption: Node.js >=16.0 (for `fs/promises` API)
   - Impact if Invalid: Build script errors on older Node versions
   - Mitigation: Specify `engines` in `package.json`

5. **Static Asset Hosting**
   - Assumption: Web server (Caddy, Nginx) serves static files from `dist/` without authentication
   - Impact if Invalid: Assets may require separate hosting or authentication bypass
   - Mitigation: Document web server configuration requirements

6. **No Server-Side Rendering**
   - Assumption: Pagenary publisher is client-side SPA (no SSR)
   - Impact if Invalid: Asset URL resolution logic may differ with SSR
   - Mitigation: Not applicable (SSR not planned)

---

### Constraints

#### Technical Constraints

1. **Build System: Node.js**
   - Constraint: Asset copying must use Node.js `fs` module (no external tools like `rsync`)
   - Reason: Cross-platform compatibility, no additional dependencies
   - Workaround: None required

2. **No Image Optimization**
   - Constraint: Assets copied as-is without compression or format conversion
   - Reason: Complexity of image processing, dependency bloat, build time impact
   - Workaround: Developers must optimize images before adding to `.public/`
   - Future Enhancement: Optional image optimization pipeline

3. **Single Assets Directory**
   - Constraint: All assets output to single `assets/` directory (not configurable per-file)
   - Reason: Simplifies URL structure, reduces configuration complexity
   - Workaround: Use subdirectories within `.public/` for organization

4. **No CDN Integration**
   - Constraint: Assets served from same origin as HTML/CSS/JS (no automatic CDN upload)
   - Reason: Out of scope for static site generator
   - Workaround: Post-build script to upload `assets/` to CDN if needed

#### Business Constraints

5. **Backward Compatibility**
   - Constraint: Feature must not break existing tenants without `.public/` directory
   - Reason: Pagenary already in use; migration cost must be zero
   - Workaround: Make `.public/` optional (FR-008)

6. **Zero Configuration**
   - Constraint: Feature must work with zero configuration (sensible defaults)
   - Reason: Aligns with Pagenary's philosophy of convention over configuration
   - Workaround: Advanced options available via tenant `config.json` overrides

#### Operational Constraints

7. **Git Bandwidth**
   - Constraint: Large binary assets in Git repositories increase clone time
   - Reason: Git not optimized for binary storage
   - Workaround: Document Git LFS for repositories with large assets

8. **Disk Space**
   - Constraint: Each tenant build creates full copy of assets (no deduplication)
   - Reason: Tenants isolated; shared assets complex to manage
   - Workaround: Clean old build artifacts regularly

---

## Risk Analysis

| Risk ID | Risk Description | Probability | Impact | Severity | Mitigation Strategy |
|---------|-----------------|-------------|--------|----------|---------------------|
| R-001 | Large assets significantly slow build times | Medium | High | **High** | Implement warnings (NFR-002, NFR-003); document CDN recommendations; consider async copy for >10 files |
| R-002 | Path traversal vulnerability allows file system escape | Low | Critical | **High** | Implement path sanitization (NFR-006); add security tests (TC-010); document security review findings |
| R-003 | Symlinks in `.public/` expose sensitive files | Low | High | **Medium** | Detect and skip symlinks; log warnings; document symlink policy in README |
| R-004 | Git-sourced tenants missing `.public/` in sparse checkout | Medium | Medium | **Medium** | Auto-include `.public/` in sparse patterns; validate in tests (TC-008); document sparse checkout behavior |
| R-005 | Case-sensitive filesystems break asset references | Medium | Medium | **Medium** | Document case sensitivity; add linter rule (future); test on Linux CI environment |
| R-006 | Incremental builds miss asset deletions | Low | Low | **Low** | Implement deletion detection in hash tracking; test in TC-009 extension |
| R-007 | Very deep subdirectories hit filesystem limits | Low | Low | **Low** | Enforce max depth 10 levels; warn and skip if exceeded; document in constraints |
| R-008 | Concurrent builds corrupt assets mid-copy | Low | Medium | **Medium** | Use atomic write operations (`fs.rename`); validate integrity after copy; add concurrency test |
| R-009 | Non-image files (PDF, ZIP) in `.public/` not handled | Low | Low | **Low** | Support all file types (FR-004 expanded); test with PDF, ZIP in TC-001 extension |
| R-010 | Favicon not detected in browsers due to missing HTML tag | Medium | Low | **Low** | Update `index.html` template to include `<link rel="icon">` (separate story); document manual HTML edits |

---

### Risk Mitigation Details

**R-001: Large Asset Build Performance**
- **Trigger:** Tenant includes >100 assets or >50MB total
- **Detection:** Automated warnings during build (NFR-002, NFR-003)
- **Mitigation Steps:**
  1. Implement parallel file copy for >10 assets (use `Promise.all()`)
  2. Document recommended asset optimization workflows
  3. Provide example post-build CDN upload script
  4. Future: Add `--skip-large-assets` flag for CI builds

**R-002: Path Traversal Attack**
- **Trigger:** Malicious tenant content with `../` in filenames or symlinks
- **Detection:** Path validation in `isPathSafe()` function
- **Mitigation Steps:**
  1. Resolve all paths with `path.resolve()` before copy
  2. Verify destination paths start with `dist/<tenant-id>/`
  3. Reject paths containing `..` segments
  4. Log security events to build output
  5. Add penetration test to CI pipeline (TC-010)

**R-004: Git Sparse Checkout Missing Assets**
- **Trigger:** Monorepo tenant with `path: "docs/"` but `.public/` at repo root
- **Detection:** Asset count mismatch warning
- **Mitigation Steps:**
  1. Automatically add `.public/` pattern to sparse checkout config
  2. Validate `.public/` exists in Git cache before copy
  3. Log warning if `.public/` outside specified `path`
  4. Document recommended monorepo structure

---

## Implementation Estimate

### Complexity Analysis

**Overall Complexity:** Medium

**Factors:**
- Well-defined requirements (low ambiguity)
- Moderate integration with existing build system
- Security considerations add complexity
- Incremental build feature (FR-010) is high complexity component

**Breakdown by Component:**

| Component | Complexity | Justification |
|-----------|-----------|---------------|
| Basic asset copying | **Low** | Standard file I/O operations, well-understood |
| Subdirectory preservation | **Low** | Recursive directory walk, standard pattern |
| Favicon special handling | **Low** | Pattern matching and duplicate copy |
| Path traversal prevention | **Medium** | Security-critical, requires careful testing |
| Git source integration | **Medium** | Interaction with existing Git logic |
| Incremental build support | **High** | Requires content hash tracking, change detection |
| Performance optimization | **Medium** | Parallel copy, benchmarking required |
| Documentation updates | **Low** | Straightforward technical writing |

---

### Effort Estimation

**Base Effort Calculation:**

- Feature Points: 15 (based on 10 functional requirements)
- Complexity Factor: 2.5 (medium complexity)
- Base Effort: 15 × 2.5 = **37.5 person-hours**

**Adjustments:**

- Risk Factor: +20% (security testing, edge cases)
- Integration Factor: +15% (Git source, incremental builds)
- Testing Factor: +30% (10 test cases, security tests)

**Adjusted Effort:** 37.5 × 1.65 = **61.9 person-hours**

**Buffer (30%):** 61.9 × 0.3 = **18.6 person-hours**

**Total Estimated Effort:** **80.5 person-hours** (~2 weeks for 1 developer)

---

### Breakdown by Phase

**Phase 1: Core Implementation (24 hours)**
- Implement `copyPublicAssets()` function
- Integrate into build pipeline
- Basic subdirectory and favicon handling
- Unit tests for core logic

**Phase 2: Security & Edge Cases (16 hours)**
- Path traversal prevention
- Symlink handling policy
- Large file warnings
- Security test cases (TC-010)

**Phase 3: Git Integration (12 hours)**
- Sparse checkout updates
- Git cache asset handling
- Test with Git-sourced tenant (TC-008)

**Phase 4: Incremental Build Support (16 hours)**
- Content hash tracking for assets
- Change detection logic
- Incremental rebuild tests (TC-009)

**Phase 5: Testing & Validation (20 hours)**
- Execute all 10 test cases
- Browser rendering verification (TC-005)
- Cross-platform testing (Windows, macOS, Linux)
- Performance benchmarking (NFR-001)

**Phase 6: Documentation (12 hours)**
- Update README.md with `.public/` usage
- Add troubleshooting guide
- Update tenant setup examples
- Document configuration overrides

---

### Recommended Team

**Team Size:** 1-2 developers

**Roles:**
- **Primary Developer:** Full-stack developer with Node.js experience
  - Implements core asset copying logic
  - Integrates with build pipeline
  - Writes unit and integration tests

- **Secondary Developer (Optional):** Frontend developer
  - Tests browser rendering (TC-005)
  - Validates Markdown image references
  - Documents usage examples

- **Reviewer:** Senior developer or tech lead
  - Reviews security implementation (path traversal)
  - Validates test coverage
  - Approves documentation

---

### Critical Dependencies

1. **Build System Access**
   - Requirement: Write access to `scripts/build-tenants.js`
   - Owner: Project maintainer
   - Status: Assumed available

2. **Test Tenant Setup**
   - Requirement: Ability to create temporary test tenants
   - Owner: Developer
   - Status: Can create in `tenants/test-*` directories

3. **Git Repository for Testing**
   - Requirement: Local Git repository for TC-008
   - Owner: Developer
   - Status: Can create temporary repo in `/tmp/`

4. **Documentation Review**
   - Requirement: Technical writer or maintainer approval
   - Owner: Project maintainer
   - Status: Assume 1-2 day review cycle

---

### Milestones

**M1: Core Implementation Complete (Week 1, Day 3)**
- `copyPublicAssets()` function merged
- Basic tests passing (TC-001, TC-002, TC-004)
- No incremental build support yet

**M2: Security & Edge Cases Complete (Week 1, Day 5)**
- Path traversal protection implemented
- Large file warnings working
- Security tests passing (TC-010)

**M3: Full Feature Complete (Week 2, Day 2)**
- Git integration tested (TC-008)
- Incremental build support implemented (TC-009)
- All functional requirements met

**M4: Release Ready (Week 2, Day 5)**
- All test cases passing
- Documentation complete
- Performance benchmarks validated
- Code review approved

---

## Open Questions

### Q-001: Image Optimization

**Question:** Should the build system automatically optimize images (compress, resize, format conversion)?

**Context:**
- Large unoptimized images slow page loads
- Manual optimization is error-prone
- Optimization increases build complexity and dependencies

**Options:**
1. **No optimization (current proposal):** Copy assets as-is, warn on large files
2. **Optional optimization:** Add `--optimize-assets` flag using `sharp` library
3. **Automatic optimization:** Always optimize, configurable thresholds

**Recommendation:** Start with Option 1 (no optimization), add Option 2 in future iteration
**Decision Needed By:** Before Phase 1 implementation
**Stakeholders:** Product owner, performance team

---

### Q-002: Symlink Handling Policy

**Question:** How should symlinks within `.public/` be handled?

**Context:**
- Symlinks useful for referencing shared assets across tenants
- Symlinks pose security risk (path traversal, sensitive file exposure)
- Following symlinks may copy unwanted files

**Options:**
1. **Reject all symlinks:** Skip symlinks entirely, log warning
2. **Follow symlinks within `.public/` only:** Resolve if target inside `.public/`
3. **Configurable policy:** Tenant config setting `followSymlinks: boolean`

**Recommendation:** Option 1 (reject all), document workaround (copy files, not link)
**Decision Needed By:** Before Phase 2 implementation (security)
**Stakeholders:** Security reviewer, DevOps team

---

### Q-003: Asset Versioning for Cache Busting

**Question:** Should asset filenames include content hashes for cache busting (e.g., `logo.a1b2c3d4.png`)?

**Context:**
- Browser caching of assets improves performance
- Asset updates may not be reflected due to cache
- Content hashing solves cache invalidation

**Options:**
1. **No hashing (current proposal):** Original filenames preserved
2. **Hash in query string:** Copy as `logo.png`, reference as `logo.png?v=a1b2c3d4`
3. **Hash in filename:** Rename to `logo.a1b2c3d4.png`, update references

**Recommendation:** Option 1 (no hashing), add Option 2 in future (requires content reference rewriting)
**Decision Needed By:** Before Phase 1 (affects file copying logic)
**Stakeholders:** Frontend team, performance team

---

### Q-004: Shared Assets Across Tenants

**Question:** Should there be a mechanism for sharing assets across multiple tenants (deduplication)?

**Context:**
- Multiple tenants may use same logo/icons (e.g., company-wide branding)
- Duplicating assets wastes disk space and bandwidth
- Shared assets complicate tenant isolation

**Options:**
1. **No sharing (current proposal):** Each tenant gets isolated copy
2. **Shared assets directory:** `dist/shared/assets/` with symlinks from tenant dirs
3. **CDN-based sharing:** Upload shared assets to CDN, reference via absolute URL

**Recommendation:** Option 1 (no sharing), document Option 3 as best practice
**Decision Needed By:** Before implementation (affects architecture)
**Stakeholders:** Product owner, infrastructure team

---

### Q-005: Non-Image Asset Support

**Question:** Should `.public/` support non-image files (PDFs, ZIP archives, fonts)?

**Context:**
- Documentation may include downloadable PDFs, datasets
- Fonts may be needed for custom branding
- Non-image files have different performance characteristics

**Options:**
1. **Support all file types:** No filtering, copy everything
2. **Allowlist by extension:** Only copy known types (images, fonts, PDFs)
3. **Blocklist by extension:** Copy everything except dangerous types (.exe, .sh)

**Recommendation:** Option 1 (support all), add file type warnings if >5MB
**Decision Needed By:** Before Phase 1 implementation
**Stakeholders:** Product owner, security reviewer

**Resolution:** Assumed Option 1 in current spec (FR-004 expanded scope)

---

### Q-006: Favicon HTML Tag Injection

**Question:** Should the build system automatically inject `<link rel="icon">` tags into `index.html`?

**Context:**
- Favicons at root (`/favicon.ico`) auto-discovered by browsers
- Explicit `<link>` tags improve reliability and support multiple formats
- Modifying HTML template adds complexity

**Options:**
1. **No HTML modification:** Rely on auto-discovery of `/favicon.ico`
2. **Automatic injection:** Parse and modify `index.html` template
3. **Manual documentation:** Instruct users to add `<link>` tags themselves

**Recommendation:** Option 1 for MVP, Option 2 as enhancement (separate story)
**Decision Needed By:** Before Phase 3 (affects scope)
**Stakeholders:** Frontend team, product owner

---

## Next Steps

### Immediate Actions (Before Implementation)

1. **Stakeholder Review (2 days)**
   - Share requirements document with product owner
   - Present to development team for technical feedback
   - Review with security team for path traversal mitigation approval
   - **Owner:** Requirements analyst

2. **Resolve Open Questions (3 days)**
   - Convene decision meeting for Q-001 through Q-006
   - Document decisions in ADR (Architecture Decision Record)
   - Update requirements spec with resolutions
   - **Owner:** Product owner + tech lead

3. **Create Implementation Stories (1 day)**
   - Break down phases into Jira/GitHub issues
   - Assign story points to each task
   - Prioritize based on dependencies
   - **Owner:** Scrum master or project manager

4. **Setup Test Environment (1 day)**
   - Create test tenant fixtures (`test-tc001` through `test-tc010`)
   - Prepare Git repository for TC-008
   - Configure CI environment (GitHub Actions or equivalent)
   - **Owner:** Primary developer

---

### Phase 1 Kickoff (Week 1)

5. **Implement Core Asset Copying (3 days)**
   - Write `copyPublicAssets()` function
   - Integrate into `scripts/build-tenants.js`
   - Unit tests for file copying and subdirectory preservation
   - **Owner:** Primary developer
   - **Deliverable:** PR for core implementation

6. **Implement Favicon Handling (1 day)**
   - Add `isFavicon()` detection function
   - Copy favicons to root and assets directory
   - Test with TC-003
   - **Owner:** Primary developer
   - **Deliverable:** PR extending core implementation

7. **Add Warnings and Logging (1 day)**
   - Implement large file warnings (NFR-002)
   - Implement total size warnings (NFR-003)
   - Test with TC-006, TC-007
   - **Owner:** Primary developer
   - **Deliverable:** PR for warnings

---

### Phase 2: Security & Edge Cases (Week 1-2)

8. **Implement Path Traversal Prevention (2 days)**
   - Write `isPathSafe()` validation function
   - Add symlink detection and rejection
   - Implement security tests (TC-010)
   - Security review with senior developer
   - **Owner:** Primary developer
   - **Deliverable:** PR for security features

9. **Test Optional .public/ Directory (0.5 days)**
   - Validate build with missing `.public/` (TC-004)
   - Ensure no errors or empty directory creation
   - **Owner:** Primary developer
   - **Deliverable:** Test results documented

---

### Phase 3: Git & Incremental Builds (Week 2)

10. **Git Source Integration (2 days)**
    - Update Git sparse checkout to include `.public/`
    - Test asset copying from Git cache (TC-008)
    - Document Git LFS recommendations
    - **Owner:** Primary developer
    - **Deliverable:** PR for Git integration

11. **Incremental Build Support (3 days)**
    - Implement content hash tracking for assets
    - Add change detection and selective recopy
    - Test with TC-009
    - Benchmark performance improvement
    - **Owner:** Primary developer (complex task)
    - **Deliverable:** PR for incremental builds

---

### Phase 4: Testing & Documentation (Week 2-3)

12. **Execute Full Test Suite (2 days)**
    - Run TC-001 through TC-010
    - Document results in test report
    - Fix any failing tests
    - **Owner:** Primary or secondary developer
    - **Deliverable:** Test execution report

13. **Browser Rendering Validation (1 day)**
    - Manual testing in Chrome, Firefox, Safari
    - Verify TC-005 (Markdown image references)
    - Screenshot and document results
    - **Owner:** Secondary developer or QA
    - **Deliverable:** Browser compatibility report

14. **Performance Benchmarking (1 day)**
    - Measure build time with 10, 50, 200 assets
    - Validate NFR-001 performance targets
    - Document results and optimization recommendations
    - **Owner:** Primary developer
    - **Deliverable:** Performance benchmark report

15. **Update Documentation (2 days)**
    - Update README.md with `.public/` usage section
    - Add troubleshooting guide (case sensitivity, symlinks)
    - Update tenant setup examples
    - Document configuration overrides
    - **Owner:** Primary developer or technical writer
    - **Deliverable:** Documentation PR

---

### Phase 5: Release Preparation (Week 3)

16. **Code Review (1 day)**
    - Senior developer reviews all PRs
    - Focus on security, error handling, test coverage
    - Address review feedback
    - **Owner:** Tech lead (reviewer) + primary developer
    - **Deliverable:** Approved PRs

17. **Merge and Deploy to Staging (0.5 days)**
    - Merge approved PRs to main branch
    - Deploy to staging environment
    - Smoke test on staging
    - **Owner:** DevOps or primary developer
    - **Deliverable:** Staging deployment

18. **Regression Testing (1 day)**
    - Test all existing tenants on staging
    - Verify no breaking changes
    - Document any migration notes
    - **Owner:** QA or primary developer
    - **Deliverable:** Regression test report

19. **Release Announcement (0.5 days)**
    - Write release notes
    - Notify stakeholders
    - Update changelog
    - **Owner:** Product owner or tech lead
    - **Deliverable:** Published release notes

---

## Appendices

### Appendix A: Glossary

- **Tenant:** An isolated documentation site with its own branding, content, and configuration
- **Manifest:** JSON file defining navigation structure and metadata for a tenant
- **Distribution Directory:** Output directory (`dist/<tenant-id>/`) containing built static site
- **Favicon:** Small icon representing a website in browser tabs and bookmarks
- **Path Traversal:** Security vulnerability where an attacker escapes intended directory via `../` sequences
- **Sparse Checkout:** Git feature allowing partial clone of repository (specific paths only)
- **Content Hash:** Cryptographic hash (e.g., SHA-256) of file contents for change detection
- **Incremental Build:** Build process that only rebuilds changed files (vs full rebuild)

---

### Appendix B: Acceptance Criteria Checklist (Summary)

Use this checklist to verify feature completeness before release:

**Functional Requirements:**
- [ ] FR-001: Assets copied from `.public/` to `dist/<tenant>/assets/`
- [ ] FR-002: Favicons copied to distribution root
- [ ] FR-003: Assets accessible via `./assets/<filename>` URL
- [ ] FR-004: Common image formats supported
- [ ] FR-005: Subdirectory structure preserved
- [ ] FR-006: Markdown image syntax supported
- [ ] FR-007: HTML `<img>` tags supported
- [ ] FR-008: Missing `.public/` does not cause errors
- [ ] FR-009: Git-sourced tenants supported
- [ ] FR-010: Incremental builds detect asset changes

**Non-Functional Requirements:**
- [ ] NFR-001: Build time impact <100ms for 10 assets
- [ ] NFR-002: Large file warnings (>1MB) logged
- [ ] NFR-003: Total size warnings (>10MB) logged
- [ ] NFR-004: Build errors provide clear messages
- [ ] NFR-005: Cross-platform compatibility (Linux, macOS, Windows)
- [ ] NFR-006: Path traversal prevention implemented
- [ ] NFR-007: Alt text validation (future, optional)

**Test Cases:**
- [ ] TC-001: Multiple image types copied correctly
- [ ] TC-002: Nested subdirectories preserved
- [ ] TC-003: Favicons copied to root and assets
- [ ] TC-004: Build succeeds without `.public/`
- [ ] TC-005: Markdown images render in browser
- [ ] TC-006: Large asset warning logged
- [ ] TC-007: Total size warning logged
- [ ] TC-008: Git-sourced tenant assets copied
- [ ] TC-009: Incremental build updates changed assets
- [ ] TC-010: Path traversal attacks rejected

**Documentation:**
- [ ] README.md updated with `.public/` usage
- [ ] Troubleshooting guide added
- [ ] Tenant setup examples updated
- [ ] Configuration overrides documented

---

### Appendix C: Related Documents

- **Architecture Decision Record:** ADR-XXX: Tenant Static Asset Management (to be created)
- **Security Review:** SEC-REVIEW-ASSETS (to be created after implementation)
- **Performance Benchmark Report:** PERF-ASSETS-BENCHMARK (to be created in Phase 4)
- **Pagenary Publisher Documentation:** `README.md`, `CLAUDE.md`
- **Tenant Registry Schema:** `tenants.schema.json`

---

### Appendix D: Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-07 | Requirements Team | Initial draft based on user request |

---

**END OF DOCUMENT**
