# ADR-011: Internal Link Transformation

**Status**: Proposed
**Date**: 2025-12-03
**Decision Makers**: Architecture Team
**Extends**: ADR-010 (Nested Content Directories)

## Context

Markdown content in Pagenary uses standard relative link syntax:

```markdown
[Get Started](./quick-start.md)
[See OCP TAP](../temporal-infrastructure/ocp-tap.md)
[API Reference](/reference/api.md)
```

The current build process converts markdown to HTML via `markdownToHtml()` in `build-tenants.js`, but preserves link `href` values unchanged. This creates broken links because:

1. **Hash-based SPA Routing**: The application uses `#section-id` URLs, not file paths
2. **No File Extension Resolution**: `.md` extensions don't map to runtime resources
3. **Relative Path Context Lost**: At runtime, the browser cannot resolve `./sibling.md` to the correct section

### Problem Statement

Given a markdown file at `getting-started/quick-start.md` containing:

```markdown
Read the [installation guide](./installation.md) first.
Then check out the [API docs](../reference/api.md).
```

The current output produces:

```html
<a href="./installation.md">installation guide</a>
<a href="../reference/api.md">API docs</a>
```

**Expected output** (per ADR-010 section ID rules):

```html
<a href="#getting-started/installation">installation guide</a>
<a href="#reference/api">API docs</a>
```

### Scope

This ADR addresses transformation of **internal documentation links** only:

| Link Type | Example | Transformed? |
|-----------|---------|--------------|
| Relative to current dir | `./sibling.md` | Yes |
| Relative to parent | `../other/page.md` | Yes |
| Absolute from content root | `/reference/api.md` | Yes |
| External URL | `https://example.com` | No |
| Hash anchor | `#section-anchor` | No |
| Protocol links | `mailto:`, `tel:`, `javascript:` | No |

## Decision

### 1. Build-Time Transformation (Not Runtime)

Transform internal links **during the build process**, not at runtime.

**Rationale:**

| Approach | Pros | Cons |
|----------|------|------|
| **Build-time** | Zero runtime cost; validation possible; deterministic | Requires rebuild for link changes |
| **Runtime** | No rebuild needed | Performance overhead; cannot validate links; complex path resolution |

**Selected**: Build-time transformation. Links are static content; validation during build catches broken links early.

### 2. Integration Point: `parseInlineMarkdown()`

Transform links in the existing `parseInlineMarkdown()` function in `build-tenants.js`, which already handles `[label](href)` patterns.

**Current implementation** (line 891-894):

```javascript
// Links: [label](href)
output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
  return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
});
```

**New implementation:**

```javascript
// Links: [label](href)
output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
  const resolvedHref = resolveInternalLink(href, context.currentPath, context.contentRoot);
  return `<a href="${escapeAttribute(resolvedHref)}">${escapeHtml(label)}</a>`;
});
```

### 3. Link Resolution Algorithm

```javascript
/**
 * Resolve a markdown link href to a hash-based section ID.
 *
 * @param {string} href - Original href from markdown
 * @param {string} currentPath - Path of the markdown file being processed (relative to content root)
 * @param {string} contentRoot - Absolute path to content root directory
 * @returns {string} Resolved href (hash-based for internal, unchanged for external)
 */
function resolveInternalLink(href, currentPath, contentRoot) {
  // 1. Skip non-transformable links
  if (isExternalLink(href)) {
    return href;
  }

  // 2. Parse the href
  const { pathname, hash } = parseHref(href);

  // 3. Skip pure anchors (e.g., #section-heading)
  if (!pathname && hash) {
    return href;
  }

  // 4. Resolve relative path to absolute (relative to content root)
  const absolutePath = resolvePath(pathname, currentPath, contentRoot);

  // 5. Convert to section ID
  const sectionId = pathToSectionId(absolutePath);

  // 6. Compose hash-based URL
  return hash ? `#${sectionId}${hash}` : `#${sectionId}`;
}
```

### 4. Path Resolution Rules

**Input Normalization:**

```javascript
function resolvePath(linkPath, currentFilePath, contentRoot) {
  // Get directory containing current file
  const currentDir = path.dirname(currentFilePath);

  let resolvedPath;

  if (linkPath.startsWith('/')) {
    // Absolute path from content root
    resolvedPath = linkPath.slice(1);
  } else if (linkPath.startsWith('./')) {
    // Relative to current directory
    resolvedPath = path.join(currentDir, linkPath.slice(2));
  } else if (linkPath.startsWith('../')) {
    // Relative to parent
    resolvedPath = path.join(currentDir, linkPath);
  } else {
    // Implicit relative (no prefix)
    resolvedPath = path.join(currentDir, linkPath);
  }

  // Normalize path separators and remove leading/trailing slashes
  return path.normalize(resolvedPath).replace(/\\/g, '/').replace(/^\/|\/$/g, '');
}
```

**Section ID Derivation:**

```javascript
function pathToSectionId(resolvedPath) {
  // Strip content file extensions
  const withoutExt = resolvedPath.replace(/\.(md|markdown|html|htm|js|mjs)$/i, '');

  // Handle index files: getting-started/index -> getting-started
  const normalized = withoutExt.replace(/\/index$/i, '');

  // Return empty string if this resolves to root
  return normalized || '';
}
```

### 5. External Link Detection

```javascript
function isExternalLink(href) {
  // Protocol-based links
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    return true;
  }

  // Protocol-relative URLs
  if (href.startsWith('//')) {
    return true;
  }

  return false;
}
```

**External patterns (not transformed):**

| Pattern | Example |
|---------|---------|
| HTTP/HTTPS | `https://example.com/page` |
| Protocol-relative | `//cdn.example.com/asset` |
| mailto | `mailto:user@example.com` |
| tel | `tel:+1-555-1234` |
| data | `data:image/png;base64,...` |
| javascript | `javascript:void(0)` |

### 6. Anchor Fragment Preservation

Links with anchors are preserved:

```markdown
[Installation](./installation.md#prerequisites)
```

Transforms to:

```html
<a href="#getting-started/installation#prerequisites">Installation</a>
```

**Note**: The double hash (`#section-id#anchor`) is intentional for SPA routing:
- First `#` signals hash-based section routing
- Second `#` is an in-page anchor within that section

**Alternative considered**: Using `#section-id/anchor` format
- Rejected: Would conflict with nested section ID format

### 7. Build Context Propagation

The `context` object passed through content processing must include:

```javascript
const context = {
  // Existing properties
  contentRoot: string,      // Absolute path to content root
  sectionsDir: string,      // Output sections directory
  tenantId: string,         // Tenant identifier
  keepFiles: Set,           // Files to preserve
  leafOrder: Array,         // Section ordering

  // New property for link resolution
  currentPath: string       // Current file path relative to contentRoot
};
```

**Propagation points:**

1. `ensureMarkdownModule()` - receives `sourcePath`, derives `currentPath`
2. `markdownToHtml()` - receives context with `currentPath`
3. `parseInlineMarkdown()` - receives context for link resolution

### 8. Build-Time Validation (Optional Enhancement)

Validate links during build to catch broken references:

```javascript
function validateInternalLink(sectionId, knownSections) {
  if (!knownSections.has(sectionId)) {
    console.warn(`  warning: broken link to unknown section "${sectionId}"`);
    return false;
  }
  return true;
}
```

**Implementation approach:**
1. First pass: Scan all content, build section ID map
2. Second pass: Transform links, validate against map
3. Report warnings for broken links (don't fail build)

## Architecture

```
Link Transformation Flow:

  Markdown Source                Build Process                      Output
  ┌────────────────────┐        ┌──────────────────────────┐
  │ quick-start.md     │        │                          │
  │                    │        │ 1. Read markdown source  │
  │ [Guide](./guide.md)│───────►│                          │
  │                    │        │ 2. Resolve link context: │
  │ ../api/ref.md      │        │    currentPath:          │
  │                    │        │    getting-started/      │
  └────────────────────┘        │    quick-start.md        │
                                │                          │
                                │ 3. Transform links:      │
                                │    ./guide.md            │
                                │    -> #getting-started/  │───► <a href="#getting-started/guide">
                                │       guide              │
                                │                          │
                                │    ../api/ref.md         │
                                │    -> #api/ref           │───► <a href="#api/ref">
                                │                          │
                                └──────────────────────────┘

  Path Resolution Examples:

    Source File               Link                      Resolved Section ID
    ─────────────────────────────────────────────────────────────────────────
    getting-started/
      quick-start.md          ./guide.md                getting-started/guide
                              ../reference/api.md       reference/api
                              /troubleshooting/faq.md   troubleshooting/faq

    core-tech/temporal/
      ocp-tap.md              ./ieee-1588.md            core-tech/temporal/ieee-1588
                              ../index.md               core-tech
                              ../../getting-started/    getting-started
                                quick-start.md
```

## Example Transformations

### Basic Relative Links

**Source**: `getting-started/quick-start.md`

```markdown
## Getting Started

First, read the [overview](./index.md).

Then check out the:
- [Installation Guide](./installation.md)
- [Configuration](./config.md#environment)
- [API Reference](../reference/api.md)
- [External docs](https://docs.example.com)
```

**Output**:

```html
<h2>Getting Started</h2>
<p>First, read the <a href="#getting-started">overview</a>.</p>
<p>Then check out the:</p>
<ul>
  <li><a href="#getting-started/installation">Installation Guide</a></li>
  <li><a href="#getting-started/config#environment">Configuration</a></li>
  <li><a href="#reference/api">API Reference</a></li>
  <li><a href="https://docs.example.com">External docs</a></li>
</ul>
```

### Deep Nesting

**Source**: `core-tech/temporal/ptp/grandmaster.md`

```markdown
See also:
- [PTP Overview](../index.md)
- [OCP TAP](../ocp-tap.md)
- [IEEE 1588](./ieee-1588.md)
- [Top-level intro](/getting-started/index.md)
```

**Output**:

```html
<p>See also:</p>
<ul>
  <li><a href="#core-tech/temporal">PTP Overview</a></li>
  <li><a href="#core-tech/temporal/ocp-tap">OCP TAP</a></li>
  <li><a href="#core-tech/temporal/ptp/ieee-1588">IEEE 1588</a></li>
  <li><a href="#getting-started">Top-level intro</a></li>
</ul>
```

### Edge Cases

| Input | Source Path | Output |
|-------|-------------|--------|
| `./index.md` | `getting-started/setup.md` | `#getting-started` |
| `../` | `getting-started/setup.md` | `#` (root) |
| `./` | `getting-started/setup.md` | `#getting-started` |
| `./page.md#anchor` | `docs/intro.md` | `#docs/page#anchor` |
| `/absolute/path.md` | (any) | `#absolute/path` |
| `https://...` | (any) | `https://...` (unchanged) |
| `#local-anchor` | (any) | `#local-anchor` (unchanged) |

## Consequences

### Positive

- **Working Internal Links**: Cross-references between sections function correctly
- **Author-Friendly**: Authors use standard markdown relative links
- **Build-Time Validation**: Broken links detected early in build process
- **Zero Runtime Cost**: No JavaScript needed for link resolution
- **Portable Content**: Same markdown works in GitHub preview and published site

### Negative

- **Build Complexity**: Additional transformation step in content processing
- **Context Propagation**: Must track current file path through build pipeline
- **Double Hash URLs**: `#section-id#anchor` format is unconventional
- **No Hot Updates**: Link changes require rebuild (acceptable per ADR-003)

### Neutral

- **Debugging**: Transformed links may differ from source (use build output for verification)
- **External Links Unchanged**: No impact on external URL handling

## Implementation Approach

### Phase 1: Core Transformation (Week 1)

1. Add `resolveInternalLink()` function to `build-tenants.js`
2. Add `isExternalLink()` helper
3. Add `pathToSectionId()` helper
4. Modify `parseInlineMarkdown()` to accept context
5. Pass `currentPath` through content processing pipeline

### Phase 2: Context Propagation (Week 1)

1. Update `ensureMarkdownModule()` to compute and pass `currentPath`
2. Update `markdownToHtml()` signature to accept context
3. Thread context through `processManifestEntries()` and `materializeScannedSections()`

### Phase 3: Testing (Week 2)

1. Add unit tests for `resolveInternalLink()`
2. Add integration tests with nested content structure
3. Test edge cases (deep nesting, absolute paths, external links)
4. Verify anchor fragment handling

### Phase 4: Validation (Optional, Week 2)

1. Implement optional link validation during build
2. Build section ID registry during first pass
3. Warn on broken internal links (don't fail build)
4. Document validation behavior

## Relationship to Other ADRs

- **ADR-010** (Nested Content Directories): Defines section ID derivation rules this ADR depends on
- **ADR-003** (Static JS Deployment): Confirms build-time transformation is appropriate
- **ADR-006** (Testable Architecture): Link resolution functions should be pure and testable

## Alternatives Considered

### Alternative 1: Runtime Link Transformation

Transform links via JavaScript after page load.

**Rejected because:**
- Performance overhead on every page view
- Cannot validate links during build
- Requires complex path context at runtime
- Flickers as links transform

### Alternative 2: Custom Link Syntax

Use custom syntax like `[[section-id]]` or `{@link section-id}`.

**Rejected because:**
- Non-standard markdown (breaks GitHub preview)
- Learning curve for content authors
- Cannot reuse existing documentation

### Alternative 3: Link Manifest

Maintain explicit link mappings in manifest files.

**Rejected because:**
- Additional maintenance burden
- Duplicates information from file structure
- Prone to drift from actual content

## References

- ADR-010: Nested Content Directories (section ID derivation)
- ADR-003: Static JS Deployment (build-time processing philosophy)
- [CommonMark Spec - Links](https://spec.commonmark.org/0.30/#links)
- [Node.js path.resolve()](https://nodejs.org/api/path.html#pathresolvepaths)
