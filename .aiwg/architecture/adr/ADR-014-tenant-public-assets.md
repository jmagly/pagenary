# ADR-014: Tenant Public Assets Directory

**Status**: Accepted
**Date**: 2025-12-07
**Decision Makers**: Architecture Team
**Extends**: ADR-008 (External Tenant Sources), ADR-010 (Nested Content Directories)

## Context

Tenants need to include static assets (images, icons, logos, favicons) that can be referenced in their content pages. Currently, there is no standardized convention for where tenants should place these assets or how they are incorporated into the build output.

### Problem Statement

1. **No Asset Convention**: Tenants lack a designated location for static assets like logos, icons, and images
2. **Naming Conflicts**: Using a `public/` directory could conflict with conventional usage in other projects (e.g., Vite, Create React App)
3. **Build Integration**: Assets need to be copied to the build output in a predictable location
4. **URL Resolution**: Content authors need a reliable URL pattern to reference assets

### Use Cases

| Asset Type | Example | Usage |
|------------|---------|-------|
| Favicon | `favicon.ico`, `favicon.png` | Browser tab icon |
| Logo | `logo.svg`, `logo-dark.png` | Branding in header/footer |
| Social Icons | `github.svg`, `discord.svg` | Link pages, footer links |
| Content Images | `diagram.png`, `screenshot.jpg` | Inline documentation images |
| OG Images | `og-image.png` | Social media preview cards |

### Current State

External tenant sources (per ADR-008) can be located anywhere on the filesystem. The build system currently handles:

- `content/` directory for documentation files
- `manifest.json` for navigation structure
- `config.json` for branding configuration
- `overrides/` for post-build file replacements

No convention exists for static assets that should be served alongside the documentation.

## Decision

### 1. Use `.public/` Directory Convention

Create a **dot-prefixed** `.public/` directory in tenant source roots for static assets:

```
tenant-source/
  manifest.json
  config.json
  .public/              # Static assets directory
    favicon.ico         # Favicon (special handling)
    favicon.png         # Alternative favicon format
    logo.svg            # Brand logo
    logo-dark.svg       # Dark mode variant
    icons/              # Subdirectory for icons
      github.svg
      discord.svg
    images/             # Subdirectory for content images
      architecture.png
      workflow.jpg
  content/
    welcome.md
    getting-started/
      index.md
```

### 2. Directory Name Rationale

**Why `.public/` (dot-prefixed)?**

| Alternative | Issue |
|-------------|-------|
| `public/` | Conflicts with Vite, CRA, Next.js conventions; may confuse build tools |
| `assets/` | Ambiguous; could conflict with generated or source assets |
| `static/` | Common in other frameworks; potential confusion |
| `_public/` | Underscore prefix already means "excluded from content" per ADR-010 |
| `.public/` | Dot-prefix is unique; clearly a convention; hidden from casual browsing |

The dot-prefix:
- Avoids conflicts with conventional `public/` directories
- Signals "build system convention" to developers
- Is consistent with other hidden configuration (`.github/`, `.vscode/`, `.claude/`)
- Excluded from content scanning by ADR-010 rules (dot-prefixed directories ignored)

### 3. Build Behavior

During tenant build, contents of `.public/` are copied to `dist/<tenant-id>/assets/`:

```
Source:                           Output:
tenant-alpha/.public/             dist/tenant-alpha/assets/
  favicon.ico          ------>      favicon.ico  (also copied to dist root)
  logo.svg             ------>      logo.svg
  icons/               ------>      icons/
    github.svg                        github.svg
```

**Special Handling for Favicons:**

Favicon files (`favicon.ico`, `favicon.png`, `favicon.svg`) are copied to **both**:
1. `dist/<tenant-id>/assets/favicon.*` (standard location)
2. `dist/<tenant-id>/favicon.*` (root for browser default lookup)

### 4. URL Patterns in Content

Authors reference assets using relative URLs from the `assets/` directory:

```markdown
<!-- In content files -->
![Architecture Diagram](./assets/images/architecture.png)

<!-- Logo in HTML content -->
<img src="./assets/logo.svg" alt="Brand Logo">

<!-- Icons -->
<a href="https://github.com/org/repo">
  <img src="./assets/icons/github.svg" alt="GitHub">
</a>
```

**URL Resolution:**

| Content Location | Asset Reference | Resolved URL |
|------------------|-----------------|--------------|
| Any section | `./assets/logo.svg` | `./assets/logo.svg` |
| Any section | `./assets/icons/github.svg` | `./assets/icons/github.svg` |

Since all content is served from `dist/<tenant-id>/`, relative paths to `./assets/` resolve correctly.

### 5. Supported File Types

The build system copies all files from `.public/`, with these common types expected:

| Category | Extensions |
|----------|------------|
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.avif` |
| Icons | `.ico`, `.svg` |
| Documents | `.pdf` (downloadable assets) |
| Fonts | `.woff`, `.woff2`, `.ttf`, `.otf` |
| Other | Any file type (no filtering) |

**No transformation** is applied to assets; they are copied as-is.

### 6. Build Script Integration

Add to `build-tenants.js`:

```javascript
/**
 * Copy tenant public assets to build output.
 *
 * @param {string} tenantSourceDir - Tenant source directory
 * @param {string} tenantDistDir - Tenant output directory
 */
async function copyPublicAssets(tenantSourceDir, tenantDistDir) {
  const publicDir = path.join(tenantSourceDir, '.public');

  if (!fs.existsSync(publicDir)) {
    return; // No public assets for this tenant
  }

  const assetsDir = path.join(tenantDistDir, 'assets');
  await fs.promises.mkdir(assetsDir, { recursive: true });

  // Recursively copy all files
  await copyDirRecursive(publicDir, assetsDir);

  // Special handling for favicons - also copy to dist root
  const faviconPatterns = ['favicon.ico', 'favicon.png', 'favicon.svg'];
  for (const pattern of faviconPatterns) {
    const faviconSrc = path.join(publicDir, pattern);
    if (fs.existsSync(faviconSrc)) {
      const faviconDst = path.join(tenantDistDir, pattern);
      await fs.promises.copyFile(faviconSrc, faviconDst);
    }
  }
}
```

### 7. Integration with External Tenant Sources

For external tenant sources (ADR-008), the `.public/` directory is located at the source root:

```json
{
  "tenants": [
    {
      "id": "external-docs",
      "source": {
        "type": "local",
        "path": "/home/user/docs/product-docs"
      }
    }
  ]
}
```

Source structure:
```
/home/user/docs/product-docs/
  .public/              # Assets here
    logo.svg
  manifest.json
  content/
    ...
```

### 8. Git Source Type Integration

For git-based tenant sources (ADR-009), `.public/` is cloned along with the repository:

```json
{
  "source": {
    "type": "git",
    "url": "https://github.com/org/docs.git",
    "branch": "main"
  }
}
```

The cloned repository is expected to contain `.public/` at its root.

## Architecture

```
Build Flow for Public Assets:

  Tenant Source                    Build Process                    Output
  ┌──────────────────┐            ┌─────────────────────┐
  │ .public/         │            │                     │
  │   favicon.ico    │───────────►│ 1. Detect .public/  │
  │   logo.svg       │            │                     │
  │   icons/         │            │ 2. Create assets/   │
  │     github.svg   │            │    directory        │
  │                  │            │                     │
  │ content/         │            │ 3. Copy recursively │
  │   welcome.md     │            │    .public/* ->     │
  │   ...            │            │    assets/*         │───► dist/tenant/assets/
  └──────────────────┘            │                     │       logo.svg
                                  │ 4. Special handling │       icons/github.svg
                                  │    for favicons     │
                                  │                     │───► dist/tenant/favicon.ico
                                  └─────────────────────┘


URL Resolution:

  Content Page                     Resolved Asset
  ─────────────────────────────────────────────────
  #getting-started
    <img src="./assets/logo.svg">  -> dist/tenant/assets/logo.svg

  #reference/api
    <img src="./assets/logo.svg">  -> dist/tenant/assets/logo.svg
                                      (relative path works from any section)
```

## Example Configuration

### Minimal Tenant with Assets

```
tenant-minimal/
  .public/
    favicon.ico
    logo.svg
  config.json
  welcome.md
```

### Full Tenant with Organized Assets

```
tenant-full/
  .public/
    favicon.ico
    favicon.png
    og-image.png          # Social media preview
    logo.svg
    logo-light.svg
    logo-dark.svg
    icons/
      github.svg
      discord.svg
      twitter.svg
    images/
      hero-banner.jpg
      architecture-diagram.png
      screenshots/
        dashboard.png
        settings.png
  manifest.json
  config.json
  content/
    welcome.md            # References ./assets/images/hero-banner.jpg
    getting-started/
      index.md
```

### Content Using Assets

```markdown
<!-- welcome.md -->
# Welcome to Product Docs

![Product Logo](./assets/logo.svg)

## Architecture

Our system architecture:

![Architecture Diagram](./assets/images/architecture-diagram.png)

## Community

Join us on:

[![GitHub](./assets/icons/github.svg)](https://github.com/org/repo)
[![Discord](./assets/icons/discord.svg)](https://discord.gg/invite)
```

## Consequences

### Positive

- **Convention Over Configuration**: No manifest entries needed for assets
- **Conflict Avoidance**: Dot-prefix prevents collision with standard `public/` directories
- **Portable Assets**: Assets travel with tenant source (git, local, etc.)
- **Predictable URLs**: `./assets/` path works from any content section
- **Favicon Automation**: Favicons automatically placed for browser discovery
- **Subdirectory Support**: Organized asset structure with icons/, images/, etc.

### Negative

- **Hidden Directory**: Dot-prefixed directories are hidden by default in file browsers
- **Manual Copy**: No asset optimization (minification, compression) during copy
- **No Content Hashing**: Assets not cache-busted (no hash in filename)

### Mitigations

- **Visibility**: Document `.public/` convention clearly; use `ls -la` to see hidden directories
- **Optimization**: Add optional asset optimization as future enhancement (not in scope)
- **Caching**: Configure CDN/server caching headers; consider future content-hash enhancement

### Neutral

- **Build Time**: Minimal impact (file copy is fast)
- **Disk Usage**: Assets add to output size (expected behavior)

## Implementation Approach

### Phase 1: Core Copy Logic

1. Add `copyPublicAssets()` function to `build-tenants.js`
2. Integrate into `buildTenant()` after content materialization
3. Handle recursive directory copy
4. Implement favicon special handling

### Phase 2: Testing

1. Add `.public/` to `tenant-default` example
2. Verify asset copy for local tenant sources
3. Test external tenant source with `.public/`
4. Validate URL resolution in content

### Phase 3: Documentation

1. Update CLAUDE.md with `.public/` convention
2. Add example assets to `tenant-default`
3. Document favicon placement behavior

## Relationship to Other ADRs

- **ADR-008** (External Tenant Sources): `.public/` works with any source type (local, git, etc.)
- **ADR-009** (Git Source Type): Assets cloned as part of repository
- **ADR-010** (Nested Content Directories): Dot-prefix exclusion rule prevents `.public/` from being scanned as content
- **ADR-003** (Static JS Deployment): Assets are static files; no runtime processing needed

## Alternatives Considered

### Alternative 1: Use `public/` Directory

Use standard `public/` without dot prefix.

**Rejected because:**
- Conflicts with Vite, Create React App, Next.js conventions
- Could confuse build tools in polyglot projects
- Risk of accidental inclusion by other build systems

### Alternative 2: Use `_assets/` Directory

Use underscore prefix (`_assets/`).

**Rejected because:**
- Underscore prefix means "excluded from content" per ADR-010
- While correct for exclusion, semantically confusing (not a draft or private file)
- Dot-prefix better signals "build system configuration"

### Alternative 3: Declare Assets in Manifest

Require explicit asset declarations in `manifest.json`:

```json
{
  "assets": ["logo.svg", "icons/*"]
}
```

**Rejected because:**
- Additional configuration burden
- Manifest meant for navigation, not asset management
- Convention-over-configuration preferred

### Alternative 4: Assets in Config.json

Include asset paths in `config.json`:

```json
{
  "brandMark": "Product",
  "assets": {
    "logo": "branding/logo.svg",
    "favicon": "branding/favicon.ico"
  }
}
```

**Rejected because:**
- Mixes concerns (config vs. file structure)
- Doesn't solve generic asset hosting
- Limited to named assets, not arbitrary files

## References

- ADR-008: External Tenant Source Model
- ADR-009: Git Source Type
- ADR-010: Nested Content Directories (dot-prefix exclusion rules)
- [Vite Static Asset Handling](https://vitejs.dev/guide/assets.html)
- [Docusaurus Static Assets](https://docusaurus.io/docs/static-assets)
