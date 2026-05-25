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

Multi-tenant build orchestrator.

```bash
node scripts/build-tenants.js [tenant-id] [--incremental]
```

Arguments:
- `tenant-id` - Build specific tenant (omit for all)
- `--incremental` - Only rebuild changed files

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
