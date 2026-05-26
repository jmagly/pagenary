# Tenant Configuration Reference

Complete reference for all tenant configuration options.

## Tenant Registry (tenants.json)

Located at `apps/publisher/tenants.json`, this file registers all tenants:

```json
{
  "tenant-id": {
    "source": "/path/to/content",
    "domain": "docs.example.com"
  }
}
```

### Registry Properties

| Property | Required | Description |
|----------|----------|-------------|
| `source` | Yes | Path to tenant content directory |
| `domain` | No | Custom domain for Caddy routing |
| `enabled` | No | Whether to build this tenant (default `true`) |
| `strictLinks` | No | Broken-link gate (default `true`). When `true`, **broken internal links fail the build** — the tenant is reported `Failed` and the process exits non-zero, so CI can gate on it. Set `false` to log broken links as warnings and continue. |

### Source Types

**Local Path:**
```json
{
  "my-docs": {
    "source": "/home/user/my-docs"
  }
}
```

**Git Repository:**
```json
{
  "my-docs": {
    "source": "git:https://github.com/org/my-docs.git#main"
  }
}
```

Format: `git:<repo-url>#<branch>`

Git sources are cloned to a cache directory and updated on each build.

## Tenant Directory Structure

```
my-tenant/
├── config.json           # Branding and theme (required)
├── manifest.json         # Navigation structure (optional)
├── content/              # Content files
│   ├── *.md              # Markdown files
│   ├── *.html            # HTML files
│   ├── *.js              # JavaScript modules
│   └── section/          # Nested directories
│       └── _manifest.json
├── .public/              # Static assets (optional)
│   ├── favicon.ico       # Favicons copied to dist root
│   ├── logo.svg          # Assets copied to dist/assets/
│   └── icons/            # Subdirectories preserved
└── overrides/            # Post-build replacements (optional)
    └── styles.css        # Replace built files
```

## Branding Configuration (config.json)

### Complete Example

```json
{
  "title": "ACME Documentation",
  "description": "Complete guide to the ACME platform",
  "brandMark": "ACME",
  "brandSub": "Docs",
  "tagline": "Build better, faster",
  "copyright": "ACME Corporation",
  "accentColor": "#6366F1",
  "surfaceColor": "#F7FAFC"
}
```

### Properties Reference

#### Site Metadata

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | "Docs Toolkit" | Browser tab title and header |
| `description` | string | - | Meta description for SEO |

#### Branding

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `brandMark` | string | "DOCS" | Primary brand text (bold, uppercase) |
| `brandSub` | string | "TOOLKIT" | Secondary brand text (light weight) |
| `tagline` | string | - | Subtitle displayed under brand |
| `copyright` | string | "Modular Documentation Toolkit" | Footer copyright text |

#### Theme Colors

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `accentColor` | hex string | "#111111" | Links, buttons, active states |
| `surfaceColor` | hex string | "#ffffff" | Page background color |

Color values must be 6-digit hex codes (e.g., `#6366F1`).

## Navigation Manifest (manifest.json)

### Root Manifest

Located at tenant root, defines top-level navigation:

```json
[
  {
    "id": "welcome",
    "title": "Welcome",
    "summary": "Introduction to the platform",
    "file": "welcome.md"
  },
  {
    "id": "guides",
    "title": "Guides",
    "summary": "Step-by-step tutorials",
    "subsections": [
      {
        "id": "guides/getting-started",
        "title": "Getting Started",
        "summary": "First steps",
        "file": "guides/getting-started.md"
      },
      {
        "id": "guides/advanced",
        "title": "Advanced",
        "file": "guides/advanced.md"
      }
    ]
  }
]
```

### Section Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes* | Unique section identifier (used in URLs) |
| `title` | Yes | Display title in navigation |
| `summary` | No | Description shown in search results |
| `file` | No** | Path to content file (relative to `content/`) |
| `url` | No** | External link URL (opens in new tab) |
| `subsections` | No | Array of child sections |
| `exclude` | No | Exclude from build (`true` to skip) |

*Not required for external links
**Use either `file` OR `url`, not both

### External Links in Navigation

Manifest entries can link to external resources using `url` instead of `id`/`file`:

```json
[
  {
    "id": "docs",
    "title": "Documentation",
    "file": "docs.md"
  },
  {
    "title": "GitHub",
    "url": "https://github.com/example/repo"
  },
  {
    "title": "Support Portal",
    "url": "https://support.example.com"
  }
]
```

External links automatically:
- Open in new tab (`target="_blank"`)
- Display subtle arrow icon indicator (↗)
- Skip URL hash routing

### Section Manifest (_manifest.json)

Located in content subdirectories for nested navigation:

```json
{
  "title": "API Reference",
  "summary": "Complete API documentation",
  "sections": [
    {
      "id": "overview",
      "title": "Overview",
      "file": "overview.md"
    },
    {
      "id": "endpoints",
      "title": "Endpoints",
      "file": "endpoints.md"
    }
  ]
}
```

### Auto-Generated Manifest

If no `manifest.json` exists, the build system auto-generates navigation from the `content/` directory structure:

- Files become sections (filename → title)
- Directories become groups
- `_manifest.json` in directories customizes the group

## Bottom Navigation

Configure bottom navigation bar behavior in root `_manifest.json` or `manifest.json`:

```json
{
  "bottomNav": "always",
  "bottomNavSections": ["getting-started", "api-reference", "faq"],
  "sections": [
    // ... section definitions
  ]
}
```

### Bottom Navigation Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `bottomNav` | string | `"mobile"` | When to show bottom nav: `"mobile"`, `"always"`, or `"never"` |
| `bottomNavSections` | string[] | `[]` | Section IDs to include (empty array = all sections) |

**Behavior:**
- `"mobile"` - Show only on small screens (default)
- `"always"` - Show on all screen sizes
- `"never"` - Hide bottom navigation completely

**Examples:**

Show all sections on mobile only (default):
```json
{
  "bottomNav": "mobile"
}
```

Show specific sections always:
```json
{
  "bottomNav": "always",
  "bottomNavSections": ["home", "docs", "api"]
}
```

Hide bottom navigation:
```json
{
  "bottomNav": "never"
}
```

## Content Files

### Markdown (.md)

Full CommonMark support plus:

- Fenced code blocks with syntax highlighting
- Mermaid diagrams with interactive controls
- Internal links via `#section-id`
- External links auto-open in new tab

```markdown
# Page Title

Regular markdown content.

## Code Example

\`\`\`javascript
const x = 1;
\`\`\`

## Diagram

\`\`\`mermaid
graph LR
    A --> B
\`\`\`

See also: [Getting Started](#guides/getting-started)

Learn more: [GitHub](https://github.com/example)
```

#### External Links in Content

All HTTP/HTTPS links in markdown automatically:
- Open in new tab (`target="_blank"`)
- Display subtle ↗ indicator via CSS
- Include security attributes (`rel="noopener noreferrer"`)

**Standard external link:**
```markdown
Visit our [GitHub repository](https://github.com/example/repo).
```

**Prominent call-to-action link:**
```html
<a href="https://example.com/signup" class="external-cta">
  Sign Up Now →
</a>
```

The `.external-cta` class provides enhanced styling for important external links.

#### Mermaid Diagrams

Mermaid diagrams render with interactive controls:

**Features:**
- **Zoom controls**: +/− buttons for zoom in/out
- **Reset button**: ⊙ restores original view
- **Pan**: Click and drag to move diagram
- **Pinch zoom**: Touch devices support pinch gestures
- **Auto-scroll**: Diagrams larger than viewport are scrollable

**Supported diagram types:**
- Flowcharts (`graph`, `flowchart`)
- Sequence diagrams (`sequenceDiagram`)
- Class diagrams (`classDiagram`)
- State diagrams (`stateDiagram`)
- ER diagrams (`erDiagram`)
- User journey (`journey`)
- Gantt charts (`gantt`)
- And more (see Mermaid documentation)

**Example:**
```markdown
\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
\`\`\`
```

### HTML (.html)

Direct HTML with access to built-in CSS classes:

```html
<section class="section doc markdown">
  <div class="doc-content">
    <h1>Custom Section</h1>

    <table class="spec-table">
      <thead>
        <tr><th>Feature</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr><td>Search</td><td>Ready</td></tr>
      </tbody>
    </table>

    <div class="layer-stack">
      <div class="layer">
        <div class="layer-title">Layer 1</div>
        <div class="layer-desc">Description</div>
      </div>
    </div>
  </div>
</section>
```

### JavaScript (.js)

Dynamic content modules:

```javascript
export async function load() {
  // Fetch data, compute values, etc.
  const data = await fetch('/api/data.json').then(r => r.json());

  return {
    html: `
      <section class="section doc">
        <h1>Dynamic Content</h1>
        <p>Value: ${data.value}</p>
      </section>
    `,
    afterRender(container) {
      // Optional: DOM manipulation after render
      container.querySelector('button')?.addEventListener('click', () => {
        // Handle click
      });
    }
  };
}
```

## CSS Classes Reference

### Layout

| Class | Description |
|-------|-------------|
| `.section` | Section container |
| `.doc` | Document-style section |
| `.markdown` | Apply markdown typography |
| `.doc-content` | Content wrapper |

### Components

| Class | Description |
|-------|-------------|
| `.spec-table` | Styled data table |
| `.layer-stack` | Vertical layer diagram |
| `.layer` | Individual layer in stack |
| `.layer-title` | Layer heading |
| `.layer-desc` | Layer description |
| `.card` | Card component |
| `.card-grid` | Grid of cards |
| `.content-box` | Bordered content box |
| `.box-title` | Box heading |
| `.html-block` | HTML content wrapper |
| `.external-cta` | Prominent external link button |

### Typography

| Class | Description |
|-------|-------------|
| `.doc-h1` through `.doc-h4` | Heading styles |
| `.doc-list` | Styled list |
| `.doc-grid` | Two-column grid |

## Overrides Directory

Files in `overrides/` replace built files after the build completes:

```
my-tenant/
└── overrides/
    ├── styles.css      # Replace default styles
    └── favicon.ico     # Custom favicon
```

Use for:
- Custom stylesheets
- Custom favicons
- Additional assets

## Static Assets (.public/)

The `.public/` directory stores static assets (images, icons, logos) that should be included in the built tenant bundle.

### Directory Structure

```
my-tenant/
├── .public/              # Static assets directory
│   ├── favicon.ico       # Copied to dist root
│   ├── favicon.png       # Copied to dist root
│   ├── logo.svg          # Copied to dist/assets/
│   └── icons/            # Subdirectories preserved
│       ├── discord.svg
│       └── github.svg
├── config.json
├── content/
└── ...
```

### Build Behavior

During the build process:

1. **Assets directory creation**: Contents are copied to `dist/<tenant-id>/assets/`
2. **Favicon handling**: Files matching `favicon.*` (e.g., `favicon.ico`, `favicon.png`, `favicon.svg`) are copied to the dist root (`dist/<tenant-id>/`) for browser auto-detection
3. **Subdirectory preservation**: Subdirectory structure within `.public/` is maintained in the output

### Referencing Assets in Content

**In Markdown:**
```markdown
![Company Logo](./assets/logo.svg)
![Product Screenshot](./assets/screenshots/dashboard.png)
```

**In HTML content:**
```html
<img src="./assets/logo.svg" alt="Company Logo">
<img src="./assets/icons/github.svg" alt="GitHub">
```

**In CSS (via overrides):**
```css
.custom-header {
  background-image: url(./assets/logo.svg);
}

.icon-discord {
  content: url(./assets/icons/discord.svg);
}
```

### Why .public Instead of public?

The dot-prefix (`.public/`) was chosen to:

- **Avoid conflicts**: Prevents naming collisions with user's conventional `public/` directories that might contain user-facing content
- **Clear separation**: Distinguishes between tenant assets and potential user content directories
- **Build system clarity**: Signals this is a build-time directive, not user-facing content

### Supported File Formats

The `.public/` directory supports all static file types:

**Images:**
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- SVG (`.svg`)
- WebP (`.webp`)
- GIF (`.gif`)

**Icons:**
- ICO (`.ico`)
- SVG (`.svg`)

**Other static files:**
- Any additional static assets needed by your documentation

### Example Usage

**Typical tenant structure with assets:**

```
acme-docs/
├── config.json
├── manifest.json
├── .public/
│   ├── favicon.ico              # Browser tab icon
│   ├── favicon.svg              # Modern browsers
│   ├── logo.svg                 # Company logo
│   ├── logo-dark.svg            # Dark mode variant
│   ├── screenshots/             # Product screenshots
│   │   ├── dashboard.png
│   │   └── settings.png
│   └── icons/                   # Social/external icons
│       ├── github.svg
│       ├── discord.svg
│       └── twitter.svg
└── content/
    └── welcome.md
```

**Referenced in welcome.md:**

```markdown
# Welcome to ACME Docs

![ACME Logo](./assets/logo.svg)

## Quick Start

Check out our dashboard:

![Dashboard Screenshot](./assets/screenshots/dashboard.png)

## Community

Join us on:
- ![GitHub](./assets/icons/github.svg) [GitHub](https://github.com/acme)
- ![Discord](./assets/icons/discord.svg) [Discord](https://discord.gg/acme)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUILD_OUTPUT` | `dist/` | Output directory |
| `DOCS_TOOLKIT_PORT` | `80` | Caddy server port |
| `PORT` | `5173` | Dev server port |

## Build Modes

### Full Build

```bash
npm run build:tenants my-tenant
```

Rebuilds everything from scratch.

### Incremental Build

```bash
npm run build:incremental my-tenant
```

Only rebuilds files changed since last build (git-aware).

### All Tenants

```bash
npm run build:tenants
```

Builds all registered tenants.
