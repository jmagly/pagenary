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
// Updates hash to #guides/getting-started and renders section
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

### lib/search.js - Fortemi-backed search

Search runs on the **real, vendored `@fortemi/core` static-index engine**
(`src/vendor/fortemi-aiwg-index.js`). At build time, `scripts/build-tenants.js`
emits a deterministic **chunked** index per tenant under `dist/<tenant>/search-index/`
(`manifest.json` + `part-NNNN.json`, the `aiwg.fortemi.index.*.v1` contract)
plus compact `metadata.json` (`pagenary.fortemi.metadata.v1`) for page-addressable
Fortemi metadata without duplicating full document text. At runtime the adapter
loads that index through an index controller + fetch chunk-loader: parts are
fetched lazily and cached (**precache**), results are ranked with snippets, and
pages are returned by offset for **infinite scroll**.
If the static index is missing or invalid, the adapter falls back to an
in-browser index built from section modules — same ranking engine, same result
shape. See `.aiwg/architecture/adr/ADR-015-fortemi-core-search-adapter.md`.

Build-time and fallback share the deterministic corpus builder in
`lib/fortemi-corpus.js`.

> **Dig deeper.** For the capability overview see [Search & Data](#search-and-data).
> The engine is `@fortemi/core` — full hooks, graph tooling, and APIs are
> documented at [docs.fortemi.com/react](https://docs.fortemi.com/react/)
> ([`@fortemi/core`](https://docs.fortemi.com/react/#packages/core) ·
> [hybrid search](https://docs.fortemi.com/react/#search)).

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

**`filterSections(manifest: SectionEntry[], query: string): FlatSection[]`**

Synchronous title/summary search (no content).

```javascript
const results = filterSections(MANIFEST, 'setup');
```

**`searchContentPage(manifest, query, options?): Promise<SearchPage>`**

Paged full-text search — the primary entry point, used for infinite scroll.

```javascript
const page = await searchContentPage(MANIFEST, 'auth', { offset: 0, limit: 25 });
// page = { items, total, offset, limit, complete, source: 'static' | 'legacy' }
// items: section objects with searchRank, searchSnippet, searchMatches
```

**`searchContent(manifest, query, options?): Promise<Section[]>`**

First-page convenience wrapper (back-compatible array). Empty query returns all
sections.

```javascript
const results = await searchContent(MANIFEST, 'authentication');
```

**`buildCommunityGraph(manifest, options?): { nodes, edges, communities }`**

Project the corpus into a Fortemi community graph (relationships/facets) — the
"graph" capability, no full-text required.

```javascript
const graph = buildCommunityGraph(MANIFEST);
```

**`resolveSectionMetadata(manifest, sectionId): Promise<object|null>`**

Resolve compact Fortemi metadata for one page. The static artifact is preferred;
the browser fallback derives the same shape from the in-browser Fortemi index.

```javascript
const metadata = await resolveSectionMetadata(MANIFEST, 'developers');
// metadata.source, facets, concepts, relationships, provenance, privacy
```

**`resolveSectionMetadataMap(manifest): Promise<Map<string, object>>`**

Resolve all compact Fortemi metadata keyed by section id for page tools, graph
node details, or tenant-specific integrations.

**`findPreferredIndex(entries: Section[], currentId: string): number`**

Find index of current section in filtered results.

Re-exported from the vendored engine for advanced use:
`queryAiwgFortemiIndex`, `getAiwgFortemiFacets`, `createAiwgIndexController`,
`createAiwgFetchChunkLoader`, `aiwgFortemiIndexToCommunityGraph`.

---

### lib/fortemi-corpus.js - Deterministic corpus builder

Pure, DOM-free, `Date.now()`-free helpers shared by the build-time generator and
the runtime fallback: `buildFortemiIndexExport(entries, { repo })` (records sorted
by id, deduped, content-hashed `generated_at` + `source.build_hash`),
`chunkFortemiIndex(index, { partSize })`, `sectionToFortemiRecord`, `stripHtml`,
`recordToSectionId`, `fortemiRecordToPageMetadata`,
`buildFortemiMetadataExport`, `stableHash`.

---

### lib/router.js - Hash Routing

URL hash parsing and resolution.

#### Functions

**`resolveTarget(hash: string): string`**

Extract section ID from URL hash.

```javascript
resolveTarget('#guides/setup'); // 'guides/setup'
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

interface SearchResultSection extends FlatSection {
  searchRank?: number;       // Relevance rank from the Fortemi engine
  searchSnippet?: string;    // Highlighted-context snippet
  searchMatches?: { field: string; value: string }[];
}

interface SearchPage {
  items: SearchResultSection[];
  total: number;
  offset: number;
  limit: number;
  complete: boolean;         // true when no further pages remain
  source: 'static' | 'legacy';
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

## CLI

The **`pagenary`** CLI is the supported, stable interface to the publisher. The
internal `scripts/*.js` entry points it wraps are an implementation detail and
are not invoked directly. Run `pagenary --help` for the full command surface and
`pagenary <command> --help` for per-command options.

### pagenary build

Build the default bundle, a single tenant, or every tenant. Processes tenant
content, applies branding and overrides, copies public assets, then calls the
build library modules for SEO artifacts and collections.

```bash
pagenary build [tenant] [--all] [--incremental] [--target <dir>] [--dev]
```

Arguments / options:
- `tenant` - Build a specific tenant (omit for the default bundle)
- `--all` - Build every enabled tenant
- `--incremental` - Only rebuild changed content
- `--target <dir>` - Override the output directory
- `--dev` - Development build (skip minification; default bundle)

See [Build Library Modules](#build-library-modules) for the helper modules used
during a build.

### pagenary serve

Preview the built output over HTTP.

```bash
pagenary serve [--dev] [--port <n>]
```

### pagenary sync

Regenerate section template modules.

```bash
pagenary sync
```

### pagenary tenants / check / doctor / new

`pagenary tenants list|diff` inspects the registry (`--json` for scripts);
`pagenary check [target]` runs quality checks; `pagenary doctor` reports
environment/config diagnostics; `pagenary new <name>` scaffolds a buildable
tenant. See `pagenary --help` for the complete list.

## Build Library Modules

These modules are called during tenant builds.
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
  reading_label: string;
  reading_length: {
    minutes: number;
    seconds: number;
    words: number;
    proseWords: number;
    tableWords: number;
    tableRows: number;
    codeBlocks: number;
    codeLines: number;
    imageCount: number;
  };
  checklist_progress: { completed: number; total: number; percent: number } | null;
  progress: boolean | { enabled?: boolean; mode?: string } | null;
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
