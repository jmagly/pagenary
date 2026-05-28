# API Reference

Complete reference for Pagenary Publisher modules and functions.

## Core Modules

### app.js - Shell Controller

Main application controller handling routing, navigation, and UI state.

#### Functions

**`navigate(id: string): void`**

Navigate to a section by ID.

```javascript
navigate('guides/getting-started');
// Updates hash to #/guides/getting-started and renders section
```

**`handleRoute(): Promise<void>`**

Process current URL hash and render corresponding section.

**`loadSection(entry: SectionEntry): Promise<void>`**

Load and render a section from the manifest.

```javascript
const section = findSection('welcome');
await loadSection(section);
```

**`updateNavState(activeId: string): void`**

Update navigation UI to reflect active section.

**`openCommandPalette(): void`**

Open the command palette (search interface).

**`closeCommandPalette(): void`**

Close the command palette.

---

### manifest.js - Navigation Registry

Defines navigation structure and section metadata.

#### Exports

**`MANIFEST: SectionEntry[]`**

Ordered array of sections defining navigation.

```javascript
export const MANIFEST = [
  {
    id: 'welcome',
    title: 'Welcome',
    summary: 'Introduction',
    module: './sections/welcome.js'
  },
  {
    id: 'guides',
    title: 'Guides',
    subsections: [
      { id: 'guides/setup', title: 'Setup', module: './sections/guides--setup.js' }
    ]
  }
];
```

**`DEFAULT_SECTION: string`**

ID of the default section (first in manifest).

**`SITE_CONFIG: SiteConfig`**

Site configuration from build.

```javascript
export const SITE_CONFIG = {
  title: 'My Docs',
  description: 'Documentation for My Product',
  brandMark: 'MY',
  brandSub: 'DOCS'
};
```

**`findSection(id: string): SectionEntry | undefined`**

Look up a section by ID.

```javascript
const section = findSection('guides/setup');
// Returns { id: 'guides/setup', title: 'Setup', ... }
```

**`getAdjacentSections(id: string): { prev?: SectionEntry, next?: SectionEntry }`**

Get previous and next sections for navigation.

---

### seo.js - Metadata Helper

Manages document metadata for SEO.

#### Functions

**`updateMetaTags({ title: string, description?: string }): void`**

Update document title and meta description.

```javascript
updateMetaTags({
  title: 'Getting Started - My Docs',
  description: 'Learn how to get started with My Product'
});
```

---

## Library Modules

### lib/search.js - Full-Text Search

Search functionality with lazy content indexing.

#### Functions

**`escapeRegExp(value: string): string`**

Escape special regex characters.

```javascript
escapeRegExp('foo.bar'); // 'foo\\.bar'
```

**`flattenManifest(manifest: SectionEntry[]): FlatSection[]`**

Flatten nested manifest into searchable sections.

```javascript
const flat = flattenManifest(MANIFEST);
// Returns all navigable sections with group info
```

**`buildSearchIndex(manifest: SectionEntry[]): Promise<IndexedSection[]>`**

Build search index by loading all section modules. Cached after first call.

```javascript
const index = await buildSearchIndex(MANIFEST);
// Each entry has searchContent: lowercase text for matching
```

**`filterSections(manifest: SectionEntry[], query: string): FlatSection[]`**

Synchronous title/summary search (no content).

```javascript
const results = filterSections(MANIFEST, 'setup');
```

**`searchContent(manifest: SectionEntry[], query: string): Promise<IndexedSection[]>`**

Full-text search across all content.

```javascript
const results = await searchContent(MANIFEST, 'authentication');
// Searches titles, summaries, and full content
```

**`findPreferredIndex(entries: Section[], currentId: string): number`**

Find index of current section in filtered results.

---

### lib/router.js - Hash Routing

URL hash parsing and resolution.

#### Functions

**`resolveTarget(hash: string): string`**

Extract section ID from URL hash.

```javascript
resolveTarget('#/guides/setup'); // 'guides/setup'
resolveTarget('#'); // '' (empty)
```

**`resolveEntry(entry: SectionEntry): SectionEntry`**

Resolve a section entry, following redirects if needed.

---

### lib/export.js - Document Export

Compose sections into exportable HTML documents.

#### Functions

**`composeExportDocument(chapters: Chapter[]): string`**

Generate complete HTML document from chapters.

```javascript
const html = composeExportDocument([
  { section: { title: 'Welcome' }, html: '<p>Hello</p>' },
  { section: { title: 'Setup' }, html: '<p>Install...</p>' }
]);
// Returns complete HTML with TOC, styles, syntax highlighting
```

**`collectExportableSections(manifest: SectionEntry[]): SectionEntry[]`**

Get all sections that can be exported (have module paths).

```javascript
const sections = collectExportableSections(MANIFEST);
```

---

## Enhancement Modules

### mermaid-init.js - Diagram Rendering

Lazy-load and render Mermaid diagrams.

#### Functions

**`renderMermaidBlocks(container: Element): Promise<void>`**

Find and render all Mermaid code blocks in a container.

```javascript
await renderMermaidBlocks(document.querySelector('.canvas'));
// Replaces ```mermaid blocks with rendered SVGs
```

---

### syntax-highlight.js - Code Highlighting

Lazy-load and apply Prism.js syntax highlighting.

#### Functions

**`highlightCodeBlocks(container: Element): Promise<void>`**

Highlight all code blocks in a container.

```javascript
await highlightCodeBlocks(document.querySelector('.canvas'));
// Applies syntax highlighting to all <code> elements
```

Supported languages: JavaScript, TypeScript, Python, Rust, Go, C, JSON, YAML, Bash, SQL, Solidity.

---

## Section Module Contract

All section modules must export a `load` function:

```javascript
/**
 * Load section content.
 * @returns {Promise<{ html: string, afterRender?: (container: Element) => void }>}
 */
export async function load() {
  return {
    html: '<section class="section doc">...</section>',

    // Optional: called after HTML is inserted into DOM
    afterRender(container) {
      // DOM manipulation, event listeners, etc.
    }
  };
}
```

### Examples

**Static Content:**
```javascript
export async function load() {
  return {
    html: `
      <section class="section doc markdown">
        <div class="doc-content">
          <h1>Welcome</h1>
          <p>Hello, world!</p>
        </div>
      </section>
    `
  };
}
```

**Dynamic Content:**
```javascript
export async function load() {
  const data = await fetch('/api/stats.json').then(r => r.json());

  return {
    html: `
      <section class="section doc">
        <h1>Stats</h1>
        <p>Count: ${data.count}</p>
      </section>
    `,
    afterRender(container) {
      container.querySelector('button')?.addEventListener('click', refresh);
    }
  };
}
```

---

## Type Definitions

```typescript
interface SectionEntry {
  id: string;
  title: string;
  summary?: string;
  module?: string;
  subsections?: SectionEntry[];
  exclude?: boolean;
}

interface FlatSection extends SectionEntry {
  group?: string;  // Parent group title
}

interface IndexedSection extends FlatSection {
  searchContent: string;  // Lowercase text for searching
}

interface SiteConfig {
  title: string;
  description?: string;
  brandMark?: string;
  brandSub?: string;
  tagline?: string;
  copyright?: string;
}

interface Chapter {
  section: { title: string; summary?: string };
  html: string;
}
```

---

## Build Scripts

### scripts/build.js

Core build script for copying and minifying assets.

```bash
node scripts/build.js [--dev]
```

Options:
- `--dev` - Skip minification

### scripts/build-tenants.js

Multi-tenant build orchestrator. It processes tenant content, applies branding
and overrides, copies public assets, then calls the build library modules for
SEO artifacts and collections.

```bash
node scripts/build-tenants.js [tenant-id] [--incremental]
```

Arguments:
- `tenant-id` - Build specific tenant (omit for all)
- `--incremental` - Only rebuild changed files

See [Build Library Modules](#build-library-modules) for the helper modules used
by this orchestrator.

### scripts/serve.js

Development server.

```bash
node scripts/serve.js [--port=5173]
```

### scripts/sync-docs.js

Regenerate section template modules.

```bash
node scripts/sync-docs.js
```

## Build Library Modules

These modules are called by `scripts/build-tenants.js` during tenant builds.
They generate files that ship in each tenant output, so they are part of the
build-time API surface even though they do not run in the browser.

### scripts/lib/seo-generator.js

Generates crawler-facing SEO artifacts after tenant content, branding, theme,
welcome, and public assets have been written.

#### Exports

**`resolveBaseUrl(config?: object): string`**

Resolve the tenant absolute base URL. `seo.siteUrl` takes precedence over
`domain`; domains without a scheme are treated as HTTPS. Returns an empty
string when neither value is configured.

```javascript
const baseUrl = resolveBaseUrl({ domain: 'docs.example.com' });
// 'https://docs.example.com'
```

**`resolveOgImage(config?: object, baseUrl?: string): string`**

Resolve `seo.ogImage` for Open Graph and Twitter metadata. Absolute image URLs
pass through; site-relative paths are joined to `baseUrl` when available.

**`generateSeoArtifacts(distDir: string, config: object): Promise<void>`**

Generate all enabled SEO artifacts for the tenant output directory:

- `sitemap.xml`
- `robots.txt`
- `llms.txt`
- static crawler snapshots under `pages/`
- JSON-LD embedded in generated static pages

Called from `scripts/build-tenants.js` after `.public/` assets are copied and
before collection manifests are generated.

```javascript
await generateSeoArtifacts(distDir, config);
```

**`generateSitemap(distDir: string, manifest: SectionEntry[], config: object): Promise<void>`**

Write `sitemap.xml` from the generated navigation manifest.

**`generateRobotsTxt(distDir: string, config: object): Promise<void>`**

Write `robots.txt`, including a sitemap pointer when a base URL is configured.

**`generateStaticSnapshots(distDir: string, manifest: SectionEntry[], config: object): Promise<void>`**

Write static HTML snapshots for each navigable section so crawlers can consume
content without executing the SPA.

**`generateLlmsTxt(distDir: string, manifest: SectionEntry[], config: object): Promise<void>`**

Write `llms.txt` with tenant-level metadata and links to generated static pages.

### scripts/lib/collections-generator.js

Generates per-collection manifests and optional RSS feeds from Markdown posts'
front matter. Collections are opt-in through `config.collections`.

#### Exports

**`generateCollections(distDir: string, config: object, contentBasePath: string): Promise<void>`**

For each collection config, read posts under `contentBasePath/<collection.path>`
and emit artifacts under the configured route:

- `<route>/index.json` when `manifest !== false`
- `<route>/feed.xml` when `feed === true`

The `index.json` entry shape is:

```typescript
interface CollectionEntry {
  slug: string;
  title: string;
  date: string | null;
  summary: string;
  hero: string | null;
  tags: string[];
  reading_time: number;
  canonical: string;
  path: string;
}
```

Called from `scripts/build-tenants.js` after SEO artifacts are generated:

```javascript
const collectionRoot = await findContentRoot(sourceDir);
await generateCollections(distDir, config, collectionRoot.basePath);
```

### scripts/lib/frontmatter.js

Parses the Markdown front-matter subset used by collection posts and tenant
content metadata.

#### Exports

**`parseFrontmatter(raw: string): { data: Record<string, any>, body: string }`**

Parse a leading `---` fenced block of `key: value` pairs. Values are coerced to
booleans, numbers, `null`, quoted strings, or inline lists such as
`[docs, release]`. Nested maps are not supported; unsupported values remain
strings.

```javascript
const { data, body } = parseFrontmatter(markdown);
```

**`estimateReadingTime(body: string): number`**

Estimate reading time in minutes at roughly 200 words per minute, with a
minimum of `1`.

**`firstHeading(body: string): string | null`**

Return the first Markdown H1 (`# Title`) in the body, or `null` when none is present.
