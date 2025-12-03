# Implementation Plan: ADR-010 Nested Content Directories

**Status**: Ready for Implementation
**Created**: 2025-12-03
**ADR Reference**: `.aiwg/architecture/adr/ADR-010-nested-content-directories.md`

## Summary

This plan implements support for nested/hierarchical content directories in the Pagenary publisher, allowing tenants to organize documentation in filesystem hierarchies that mirror their taxonomy.

## Current State

The `build-tenants.js` has these key functions:
- `processTenantManifest()` (lines 1083-1129): Processes flat `content/` directory
- `processManifestEntries()` (lines 1018-1042): Recursively processes manifest sections
- `materializeSectionModule()` (lines 1044-1075): Creates JS modules from content files

## Phase 1: Core Scanning Functions (New)

### 1.1 `findContentRoot(tenantDir)`

**Purpose**: Detect tenant content structure type.

**Returns**: `{ type: 'nested' | 'flat' | 'root', basePath: string }`

**Logic**:
1. Check for content files directly in tenantDir root
2. Check for `content/` subdirectory (legacy flat)
3. Check for directories containing content (nested)

### 1.2 `scanContentDirectory(dirPath, parentId, options)`

**Purpose**: Recursively scan directory for content and subdirectories.

**Parameters**:
- `dirPath` - Directory to scan
- `parentId` - Parent section ID (null for root)
- `options.contentRoot` - Base content directory for relative paths

**Logic**:
1. Load optional `_manifest.json` from directory
2. Collect content files (*.md, *.html, *.js) excluding `_` and `.` prefixed
3. Collect subdirectories excluding `_` and `.` prefixed, and `overrides`
4. For each file: derive section ID, get title from manifest or humanize
5. For each subdirectory: recursively scan, create group entry
6. Apply ordering from `_manifest.json` or alphabetical fallback
7. Return array of section entries

### 1.3 `deriveSectionId(parentId, name, isIndex)`

**Purpose**: Generate section ID from filesystem path.

**Rules**:
| Path | Section ID |
|------|------------|
| `getting-started/index.md` | `getting-started` |
| `getting-started/quick-start.md` | `getting-started/quick-start` |
| `core-tech/temporal/ocp-tap.md` | `core-tech/temporal/ocp-tap` |

### 1.4 `loadDirectoryManifest(dirPath)`

**Purpose**: Load optional `_manifest.json`.

**Returns**: `{ title?, summary?, order?, sections?, exclude?, index? } | null`

### 1.5 `humanizeTitle(filename)`

**Purpose**: Convert filename to human-readable title.

**Logic**:
- Strip extension
- Replace hyphens/underscores with spaces
- Title case words
- Handle abbreviations (API, SDK, OCP, IEEE, etc.)

### 1.6 `encodePathForFilename(sectionId)`

**Purpose**: Convert section ID to safe output filename.

**Example**: `getting-started/quick-start` → `getting-started--quick-start`

## Phase 2: Modify Existing Functions

### 2.1 `processTenantManifest()` - MODIFY

**Changes**:
1. Call `findContentRoot()` at start
2. If root manifest has `type: "directory"` entries, delegate to directory scanning
3. Support hybrid mode (explicit files + directory references)
4. Preserve existing behavior for flat manifests

**New Flow**:
```
1. contentRoot = findContentRoot(sourceDir)
2. Load root manifest.json if exists
3. If nested/hybrid structure:
   a. For directory entries: scanContentDirectory()
   b. For file entries: materializeSectionModule()
4. Else (legacy flat): existing processManifestEntries()
5. Build unified manifest
```

### 2.2 `processManifestEntries()` - MODIFY

**Changes**:
1. Handle `type: "directory"` entries → call `scanContentDirectory()`
2. Support `path` property to override directory lookup
3. Accept nested content paths in `file` property

### 2.3 `materializeSectionModule()` - MODIFY

**Changes**:
1. Accept nested content path (e.g., `getting-started/quick-start.md`)
2. Use `encodePathForFilename()` for output when ID contains `/`
3. Resolve source path relative to content root

**Example**:
- Input: `{ id: "getting-started/quick-start", file: "getting-started/quick-start.md" }`
- Source: `contentRoot/getting-started/quick-start.md`
- Output: `sectionsDir/getting-started--quick-start.js`

### 2.4 `buildManifestModuleSource()` - MODIFY

**Changes**:
- Module path uses encoded filename: `./sections/${encodePathForFilename(id)}.js`

### 2.5 `processIncrementalManifest()` - MODIFY

**Changes**:
- Handle nested file paths in change detection
- Use `buildFileToSectionMap()` with nested path support
- Apply `encodePathForFilename()` for output filenames

## Phase 3: Router Compatibility

### 3.1 Verify Hash Routing

Test that `#getting-started/quick-start` routes correctly:
- `currentSectionId()` in `app.js` uses `location.hash.replace('#', '')`
- `findSection()` lookup must handle `/` in IDs
- Nav button `data-section` attributes with `/`

### 3.2 URL Encoding Considerations

- Raw: `#getting-started/quick-start`
- Encoded: `#getting-started%2Fquick-start`
- Test browser behavior with both formats

## Phase 4: Test Cases

### Unit Tests (`__tests__/scripts/build-tenants-nested.test.js`)

**Content Root Detection**:
- Detects nested structure (directories with content)
- Detects flat `content/` structure
- Detects root-level content
- Handles hybrid structures

**Directory Scanning**:
- Scans single-level directory
- Scans nested directories (3+ levels)
- Excludes `_` prefixed files and directories
- Excludes `.` prefixed files and directories (`.git`, `.github`, `.DS_Store`, etc.)
- Handles empty directories

**Section ID Derivation**:
- `index.md` → directory ID
- `file.md` → parentId/file
- Maximum depth (10 levels)
- ID override from `_manifest.json`

**Directory Manifest**:
- Loads title/summary
- Applies `order` array
- Handles `exclude` patterns
- Falls back to alphabetical

**Output Encoding**:
- `/` → `--` in filename
- Generated module paths correct
- Manifest.js references correct

**Backward Compatibility**:
- Existing flat tenants unchanged
- Explicit `file` property works
- No manifest auto-discovery works

### Integration Tests

1. Build `tenant-nested` example
2. Build hybrid tenant (flat + nested)
3. Build existing `tenant-alpha` (verify unchanged)

## Phase 5: Migration for roko-kb

### Current Structure
```
roko-kb/
  manifest.json
  config.json
  content/           # Flat with copies
    welcome.md
    getting-started-introduction.md
    ...
```

### Target Structure
```
roko-kb/
  config.json
  manifest.json      # Optional, simplified

  README.md          # -> welcome (or move to content root)
  getting-started/
    _manifest.json   # title, order
    index.md         # -> getting-started
    quick-start.md   # -> getting-started/quick-start

  core-technology/
    _manifest.json
    index.md
    temporal-infrastructure/
      _manifest.json
      index.md
      ocp-tap.md
```

### Migration Steps

1. **Remove flat content directory**: Delete `content/` created earlier
2. **Use existing directories**: The repo already has `getting-started/`, `core-technology/`, etc.
3. **Add `_manifest.json` files**: Control ordering and metadata per directory
4. **Update root manifest.json**: Reference directories with `type: "directory"`
5. **Test build**: `npm run build:tenant -- roko-kb`

## Implementation Sequence

### Week 1: Core Implementation

| Order | Task | File |
|-------|------|------|
| 1 | Add `humanizeTitle()` | build-tenants.js |
| 2 | Add `deriveSectionId()` | build-tenants.js |
| 3 | Add `encodePathForFilename()` | build-tenants.js |
| 4 | Add `loadDirectoryManifest()` | build-tenants.js |
| 5 | Add `findContentRoot()` | build-tenants.js |
| 6 | Add `scanContentDirectory()` | build-tenants.js |
| 7 | Modify `materializeSectionModule()` | build-tenants.js |
| 8 | Modify `processTenantManifest()` | build-tenants.js |
| 9 | Modify `processManifestEntries()` | build-tenants.js |
| 10 | Update `buildManifestModuleSource()` | build-tenants.js |

### Week 2: Testing & Validation

| Order | Task |
|-------|------|
| 11 | Create `tenant-nested` example |
| 12 | Add unit tests for new functions |
| 13 | Add integration tests |
| 14 | Verify hash routing with `/` |
| 15 | Migrate roko-kb to nested structure |
| 16 | Document migration guide |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Hash routing breaks with `/` | Test early; URL encode if needed |
| Performance on large trees | Depth limit (10), lazy scanning |
| Backward compatibility | Detect structure type, preserve paths |
| Circular directory refs | Track visited paths during scan |
| Windows path separators | Use `path.sep`, normalize paths |

## Critical Files

- `apps/publisher/scripts/build-tenants.js` - Core implementation
- `apps/publisher/__tests__/scripts/build-tenants.test.js` - Test patterns
- `apps/publisher/src/lib/router.js` - Verify `/` handling
- `apps/publisher/src/app.js` - Verify hash routing

## Success Criteria

1. Existing flat tenants (tenant-alpha, tenant-beta) build unchanged
2. Nested tenant (roko-kb) builds with directory structure preserved
3. Section IDs use `/` separator (e.g., `getting-started/quick-start`)
4. Output filenames use `--` encoding (e.g., `getting-started--quick-start.js`)
5. Hash navigation works with `/` in URLs
6. All existing tests pass
7. New tests cover nested scenarios
