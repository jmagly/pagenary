# ADR-010: Nested Content Directories

**Status**: Proposed
**Date**: 2025-12-03
**Decision Makers**: Architecture Team
**Extends**: ADR-008, ADR-009

## Context

The current tenant content model requires a flat `content/` directory structure where all content files (.md, .html, .js) reside at a single level. Section IDs are mapped to files explicitly in `manifest.json`:

```
tenant/
  manifest.json      # Navigation with explicit file mappings
  config.json        # Branding
  content/           # FLAT - all files at one level
    welcome.md
    getting-started-intro.md
    core-tech-overview.md
    temporal-infrastructure-ocp-tap.md
```

With `manifest.json`:
```json
{
  "sections": [
    { "id": "welcome", "file": "welcome.md" },
    { "id": "getting-started", "sections": [
      { "id": "getting-started-intro", "file": "getting-started-intro.md" }
    ]}
  ]
}
```

### Problems with Flat Structure

1. **Naming Collisions**: Long prefixed filenames (`core-tech-temporal-infrastructure-ocp-tap.md`) needed to avoid collisions
2. **Cognitive Load**: 50+ files in a single directory makes navigation difficult
3. **No Filesystem Taxonomy**: Directory structure doesn't mirror documentation hierarchy
4. **Manual Manifest Maintenance**: Every file requires explicit manifest entry
5. **Refactoring Friction**: Moving sections requires updating both files and manifest
6. **External Tenant Onboarding**: Teams with existing nested docs must flatten before publishing

### Driving Use Case

The new `roko-kb` tenant has natural nested documentation organized by domain:

```
roko-kb/
  getting-started/
    index.md
    quick-start.md
  core-technology/
    index.md
    temporal-infrastructure/
      index.md
      ocp-tap.md
      ieee-1588.md
    ptp-integration/
      index.md
      grandmaster-selection.md
```

Requiring this to be flattened creates friction and loses organizational context.

## Decision

### 1. Support Hierarchical Content Directories

Allow tenant content to be organized in nested directories that mirror the documentation taxonomy:

```
tenant/
  manifest.json      # Optional root manifest (can auto-generate)
  config.json        # Branding
  getting-started/
    _manifest.json   # Optional section manifest
    index.md         # Section landing page
    quick-start.md
  core-technology/
    _manifest.json
    index.md
    temporal-infrastructure/
      _manifest.json
      index.md
      ocp-tap.md
      ieee-1588.md
```

### 2. Manifest Format Evolution

#### 2.1 Root Manifest (manifest.json)

The root manifest remains optional. When present, it can reference directories or files:

```json
{
  "default": "getting-started",
  "sections": [
    {
      "id": "getting-started",
      "title": "Getting Started",
      "type": "directory"
    },
    {
      "id": "core-technology",
      "title": "Core Technology",
      "type": "directory"
    }
  ]
}
```

**New Properties:**
| Property | Type | Description |
|----------|------|-------------|
| `type` | `"file"` \| `"directory"` | Content source type (default: inferred from existence) |
| `path` | string | Override directory/file name (default: derived from `id`) |

#### 2.2 Directory Manifest (_manifest.json)

Each directory can have an optional `_manifest.json` to control ordering and metadata:

```json
{
  "title": "Temporal Infrastructure",
  "summary": "PTP/NTP timing architecture components",
  "order": ["index", "ocp-tap", "ieee-1588"],
  "sections": [
    {
      "id": "ocp-tap",
      "title": "OCP TAP Protocol",
      "file": "ocp-tap.md"
    }
  ]
}
```

**Directory Manifest Properties:**
| Property | Required | Description |
|----------|----------|-------------|
| `title` | No | Section group title (default: humanized directory name) |
| `summary` | No | Section group summary |
| `order` | No | Array of section IDs defining sort order |
| `sections` | No | Explicit section definitions (overrides auto-discovery) |
| `exclude` | No | Array of patterns to exclude from auto-discovery |
| `index` | No | ID of the landing page section (default: "index" if exists) |

### 3. Directory Scanning Algorithm

When processing a directory without explicit manifest:

```
function scanDirectory(dirPath, parentId = null):
    sections = []

    # 1. Check for _manifest.json
    manifest = loadManifest(dirPath + "/_manifest.json")

    # 2. Collect content files
    files = glob(dirPath, "*.{md,html,js}")
    subdirs = listDirectories(dirPath)

    # 3. Process files first
    for file in files:
        if file.name.startsWith("_") or file.name.startsWith("."):
            continue  # Skip excluded files (underscore or dot prefix)
        sectionId = deriveSectionId(parentId, file)
        sections.append({
            id: sectionId,
            title: manifest?.sections[file]?.title || humanize(file.stem),
            file: file.name
        })

    # 4. Process subdirectories (recursive)
    for subdir in subdirs:
        if subdir.startsWith("_") or subdir.startsWith("."):
            continue  # Skip excluded directories (underscore or dot prefix)
        childSections = scanDirectory(subdir, sectionId)
        sections.append({
            id: deriveSectionId(parentId, subdir),
            title: manifest?.sections[subdir]?.title || humanize(subdir),
            subsections: childSections
        })

    # 5. Apply ordering
    if manifest?.order:
        sections = sortByOrder(sections, manifest.order)
    else:
        sections = sortAlphabetically(sections)

    return sections
```

### 4. Section ID Derivation Rules

Section IDs are derived from the filesystem path relative to the content root:

| Path | Derived Section ID |
|------|-------------------|
| `getting-started/index.md` | `getting-started` |
| `getting-started/quick-start.md` | `getting-started/quick-start` |
| `core-tech/temporal/ocp-tap.md` | `core-tech/temporal/ocp-tap` |
| `welcome.md` | `welcome` |

**Rules:**
1. Path segments joined with `/`
2. File extension stripped
3. `index.md` resolves to directory ID (not `dir/index`)
4. Hyphens preserved (no case conversion)
5. Maximum depth: 10 levels (configurable)

**ID Override:**
Explicit `id` in `_manifest.json` or root `manifest.json` takes precedence:

```json
{
  "sections": [
    { "id": "ptp-101", "path": "temporal/ieee-1588.md" }
  ]
}
```

### 5. Build Output Structure

#### Option A: Flat Output (Selected)

Build output remains flat in `dist/sections/` with path-encoded filenames:

```
dist/
  sections/
    getting-started.js
    getting-started--quick-start.js
    core-tech--temporal--ocp-tap.js
```

**Path Encoding:**
- `/` in section ID becomes `--` in filename
- Maintains single directory for simpler serving
- Compatible with existing `section-templates.js` imports

#### Option B: Mirrored Output (Alternative)

```
dist/
  sections/
    getting-started/
      index.js
      quick-start.js
    core-tech/
      temporal/
        ocp-tap.js
```

**Trade-offs:**

| Aspect | Flat (A) | Mirrored (B) |
|--------|----------|--------------|
| Serving | Simple | Requires path resolution |
| Import paths | Predictable | Nested |
| Cache busting | All sections equal | Per-directory |
| Backward compat | Better | Breaking change |

**Decision**: Option A (flat output) selected for backward compatibility and serving simplicity.

### 6. Content Root Detection

The build system searches for content in order:

1. Named directories matching manifest entries
2. `content/` directory (legacy flat structure)
3. Root of tenant source (for minimal tenants)

**Detection Algorithm:**
```javascript
function findContentRoot(tenantDir) {
  // Check for any content files in root
  const rootFiles = glob(tenantDir, '*.{md,html,js}');
  if (rootFiles.length > 0) {
    return tenantDir; // Content in root
  }

  // Check for content/ subdirectory
  const contentDir = join(tenantDir, 'content');
  if (exists(contentDir)) {
    return contentDir; // Legacy flat structure
  }

  // Check for directories with content files
  const subdirs = listDirectories(tenantDir);
  for (const dir of subdirs) {
    if (!dir.startsWith('_') && dir !== 'overrides') {
      const hasContent = glob(dir, '*.{md,html,js}').length > 0;
      if (hasContent) {
        return tenantDir; // Nested structure at root
      }
    }
  }

  return null; // No content found
}
```

### 7. Backward Compatibility

Existing tenants with flat `content/` directories continue to work unchanged:

```
tenant-alpha/           # Existing structure
  manifest.json         # With explicit file mappings
  content/
    welcome.html
    launch-checklist.md
```

**Compatibility Guarantees:**
1. Flat `content/` structure still supported
2. Explicit `file` property in manifest still works
3. Section IDs without `/` remain unchanged
4. Build output location unchanged

**Migration Path:**
1. No migration required for existing tenants
2. To adopt nested structure:
   - Create directories matching section hierarchy
   - Move files into directories
   - Optionally simplify manifest or remove entirely
   - Section IDs will change (breaking change for bookmarks)

### 8. Index File Handling

`index.md` files have special treatment:

1. **Section ID**: Directory ID (not `dir/index`)
2. **Title Source**: `_manifest.json` title or directory name
3. **Navigation**: Shown as section group header (clickable)
4. **Required**: No (directory without index shows as non-clickable group)

```
getting-started/
  index.md           -> Section ID: "getting-started"
  quick-start.md     -> Section ID: "getting-started/quick-start"
```

### 9. Excluded Files and Directories

Files and directories starting with `_` (underscore) or `.` (dot) are excluded from content discovery:

```
tenant/
  .git/              # Ignored (dot prefix)
  .github/           # Ignored (dot prefix)
  .claude/           # Ignored (dot prefix)
  .vscode/           # Ignored (dot prefix)
  .gitignore         # Ignored (dot prefix)
  _drafts/           # Ignored (underscore prefix)
  _notes.md          # Ignored (underscore prefix)
  _manifest.json     # Processed as config, not content
  getting-started/
    .DS_Store        # Ignored (dot prefix)
    _wip.md          # Ignored (underscore prefix)
    published.md     # Included
```

**Exclusion Rules:**
1. **Dot prefix (`.`)**: Always ignored - covers `.git`, `.github`, `.vscode`, `.DS_Store`, etc.
2. **Underscore prefix (`_`)**: Always ignored except `_manifest.json` which is processed as config
3. **`overrides/` directory**: Reserved for post-build file replacements, not scanned as content

## Architecture

```
Content Discovery Flow:

  Tenant Source                 Build Process                    Output
  ┌──────────────────┐         ┌────────────────────────┐
  │ manifest.json?   │────┬───►│ 1. Find content root   │
  │ config.json      │    │    │                        │
  │                  │    │    │ 2. Scan directories    │
  │ getting-started/ │    │    │    - Collect files     │
  │   _manifest.json │    │    │    - Process manifests │
  │   index.md       │────┘    │    - Apply ordering    │
  │   quick-start.md │         │                        │
  │                  │         │ 3. Derive section IDs  │
  │ core-tech/       │         │                        │
  │   temporal/      │         │ 4. Build manifest.js   │───► dist/manifest.js
  │     ocp-tap.md   │         │                        │
  └──────────────────┘         │ 5. Materialize modules │───► dist/sections/
                               │    (flat output)       │       getting-started.js
                               │                        │       getting-started--quick-start.js
                               └────────────────────────┘       core-tech--temporal--ocp-tap.js

  ID Derivation:

    getting-started/index.md       -> getting-started
    getting-started/quick-start.md -> getting-started/quick-start
    core-tech/temporal/ocp-tap.md  -> core-tech/temporal/ocp-tap
```

## Example Configurations

### Minimal Nested Structure (No Manifests)

```
tenant-minimal/
  config.json
  welcome.md
  getting-started/
    index.md
    quick-start.md
  reference/
    api.md
    sdk.md
```

Auto-generated navigation:
1. welcome
2. getting-started (index.md as landing)
   - quick-start
3. reference
   - api
   - sdk

### Hybrid Structure (Root Manifest + Directory Manifests)

```
tenant-hybrid/
  manifest.json
  config.json
  getting-started/
    _manifest.json
    index.md
    quick-start.md
  content/              # Legacy flat content
    faq.md
```

Root `manifest.json`:
```json
{
  "default": "getting-started",
  "sections": [
    { "id": "getting-started", "type": "directory" },
    { "id": "faq", "file": "content/faq.md" }
  ]
}
```

### Full Control (Explicit Manifests)

```
tenant-explicit/
  manifest.json
  config.json
  docs/
    _manifest.json
    intro/
      _manifest.json
      overview.md
      concepts.md
```

Manifests provide full control over IDs, titles, and ordering.

## Consequences

### Positive

- **Natural Organization**: Directory structure mirrors documentation taxonomy
- **Reduced Manifest Maintenance**: Auto-discovery reduces boilerplate
- **External Team Friendly**: Teams can use existing nested doc structures
- **Scalable**: Supports large documentation sites (100+ sections)
- **Familiar**: Matches patterns from Docusaurus, GitBook, MkDocs

### Negative

- **Section ID Changes**: Adopting nested structure changes section IDs (breaks bookmarks)
- **Increased Complexity**: Build system must handle recursive scanning
- **Discovery Ambiguity**: Without manifests, ordering depends on alphabetical sort
- **Debug Difficulty**: Auto-generated IDs may not match author expectations

### Neutral

- **Output Size**: No change (still flat output)
- **Runtime Performance**: No change (sections loaded same way)
- **Incremental Builds**: Enhanced - can detect changed directories

## Implementation Approach

### Phase 1: Core Scanning (Week 1)

1. Add `scanContentDirectory()` function to `build-tenants.js`
2. Implement section ID derivation logic
3. Add `_manifest.json` parsing
4. Preserve existing `processTenantManifest()` as fallback

### Phase 2: Manifest Integration (Week 1)

1. Add `type: "directory"` support to root manifest
2. Implement `order` property for section sorting
3. Add `exclude` pattern matching
4. Handle `index.md` -> directory ID mapping

### Phase 3: Output Encoding (Week 1)

1. Add path-to-filename encoding (`/` -> `--`)
2. Update `manifest.js` generation for nested IDs
3. Verify `app.js` handles `/` in section IDs

### Phase 4: Testing & Migration (Week 2)

1. Add tests for nested content discovery
2. Create `tenant-nested` example tenant
3. Document migration guide for existing tenants
4. Validate incremental builds with nested structure

## Relationship to Other ADRs

- **ADR-008** (External Sources): Nested structure works with any source type
- **ADR-009** (Git Sources): Change detection includes directory-level changes
- **ADR-005** (File Registry): Registry unchanged; tenant source can be nested
- **ADR-006** (Testable Architecture): Scanning logic isolated for unit testing

## References

- [Docusaurus Docs Sidebar](https://docusaurus.io/docs/sidebar)
- [MkDocs Navigation](https://www.mkdocs.org/user-guide/configuration/#nav)
- [GitBook Summary](https://docs.gitbook.com/getting-started/structure)
- UC-006: Update Tenant Content
- UC-009: Build Bundles
