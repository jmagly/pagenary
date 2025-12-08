# Export Branding Feature Plan

## Overview

Enable tenant-specific branding in exported documents, replacing hardcoded "Docs Toolkit" with configurable logo, brand name, and tagline.

## Requirements Summary

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-1 | Tenant branding configuration via config.json | Must |
| REQ-2 | Logo image support (PNG, JPG, SVG) | Must |
| REQ-3 | Brand name configuration | Must |
| REQ-4 | Optional tagline support | Should |
| REQ-5 | Support all layout combinations (logo-only, text-only, logo+text) | Must |
| REQ-6 | Graceful fallback when config missing | Must |

## Architecture Decision

**Selected Approach**: Extend `EXPORT_CONFIG` in generated `manifest.js`

```
BUILD TIME                              RUNTIME
┌──────────────┐    ┌─────────────┐    ┌─────────────────┐
│ config.json  │───▶│ build-      │───▶│ manifest.js     │
│ .public/     │    │ tenants.js  │    │   EXPORT_CONFIG │
│   logo.png   │    │ (embed b64) │    │   { logo, ...}  │
└──────────────┘    └─────────────┘    └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │ export.js       │
                                       │ composeExport-  │
                                       │ Document(       │
                                       │   chapters,     │
                                       │   EXPORT_CONFIG │
                                       │ )               │
                                       └─────────────────┘
```

**Rationale**:
- Follows existing SITE_CONFIG pattern
- No runtime fetches needed
- Logo embedded as base64 for offline portability
- Single source of truth (config.json)

## Configuration Schema

### config.json Extension

```json
{
  "title": "ROKO Network Documentation",
  "brandMark": "ROKO",
  "brandSub": "Network",
  "tagline": "The Temporal Layer for Web3",

  "export": {
    "logo": "embed",
    "logoPath": "favicon.png",
    "showTagline": true,
    "showDate": true
  }
}
```

**Logo modes**:
- `"embed"` (default) - Base64 embed from `.public/`
- `"reference"` - Use relative path `./assets/logo.png`
- `null` - No logo

### Generated EXPORT_CONFIG

```javascript
export const EXPORT_CONFIG = {
  title: "ROKO Network Documentation",
  brandMark: "ROKO",
  brandSub: "Network",
  tagline: "The Temporal Layer for Web3",
  logo: "data:image/png;base64,...",
  showTagline: true,
  showDate: true
};
```

## UI Design

### Header Variants

**Logo + Text (Recommended)**:
```html
<header class="export-header export-header--logo-text">
  <div class="export-brand">
    <img src="data:..." alt="" class="export-logo" aria-hidden="true" />
    <h1 class="export-brand-name">
      <span class="brand-mark">ROKO</span>
      <span class="brand-sub">.Network</span>
    </h1>
  </div>
  <p class="export-meta">Generated December 8, 2025</p>
</header>
```

**Text Only** (fallback):
```html
<header class="export-header export-header--text-only">
  <div class="export-brand">
    <h1 class="export-brand-name">ROKO.NETWORK</h1>
  </div>
  <p class="export-meta">Generated December 8, 2025</p>
</header>
```

### Logo Specifications

| Variant | Recommended Size | Max Display | Format |
|---------|-----------------|-------------|--------|
| Logo+Text | 96x96px | 48x48px | PNG/SVG |
| Logo-only | 400x400px | 180x180px | PNG/SVG |

**File size**: Target <50KB, max 500KB with warning

## Implementation Steps

### Phase 1: Build Infrastructure

1. **build-tenants.js** - Add helper functions:
   - `embedLogo(publicDir, logoPath)` - Read and base64 encode logo
   - `buildExportConfig(config, sourceDir)` - Build EXPORT_CONFIG object
   - Update `buildManifestModuleSource()` to include EXPORT_CONFIG

### Phase 2: Export Library

2. **export.js** - Update `composeExportDocument()`:
   - Add config parameter: `composeExportDocument(chapters, config = {})`
   - Generate branded header HTML based on config
   - Add CSS for header variants

### Phase 3: App Integration

3. **app.js** - Wire up config:
   - Import `EXPORT_CONFIG` from manifest.js
   - Pass to `composeExportDocument(bundle, EXPORT_CONFIG)`

### Phase 4: Tenant Configuration

4. **roko-kb config.json** - Add export branding:
   ```json
   "export": {
     "logo": "embed",
     "logoPath": "favicon.png"
   }
   ```

## Files to Modify

| File | Changes |
|------|---------|
| `scripts/build-tenants.js` | Add embedLogo(), buildExportConfig(), update manifest generation |
| `src/lib/export.js` | Update composeExportDocument() signature and header template |
| `src/app.js` | Import EXPORT_CONFIG, pass to export function |
| `tenants/roko-kb/config.json` | Add export configuration |

## Fallback Behavior

1. No `export` config → Use existing brandMark/brandSub/tagline from config
2. No config.json → Use "Documentation Export"
3. Logo file missing → Render text-only (log warning)
4. Invalid logo path → Skip logo, continue with text

## CSS Additions (export.js)

```css
.export-header { text-align: center; margin-bottom: 3rem; }
.export-brand { display: flex; align-items: center; justify-content: center; gap: 1rem; }
.export-logo { max-height: 48px; width: auto; }
.export-brand-name { font-size: 2.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin: 0; }
.brand-mark { font-weight: 700; }
.brand-sub { font-weight: 400; }
.export-header--logo-text .export-brand { flex-direction: row; }
.export-header--text-only .export-brand { flex-direction: column; }
@media print { .export-logo { max-height: 36px; } }
```

## Success Criteria

- [ ] Export shows tenant logo next to brand name
- [ ] Works with roko-kb favicon.png
- [ ] Fallback works when no logo configured
- [ ] Export remains self-contained (offline-compatible)
- [ ] Print renders correctly
