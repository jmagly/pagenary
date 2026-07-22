/**
 * Search and filtering utilities.
 *
 * Primary path: the real, vendored @fortemi/core static-index engine
 * (../vendor/fortemi-aiwg-index.js) over a build-time chunked index served at
 * `search-index/`. This gives ranking, snippets, offset-paged results (infinite
 * scroll) and lazy chunk fetch with an in-memory part cache (precache).
 *
 * Fallback path: if the static index artifact is missing or fails to load, an
 * in-browser index is built by importing section modules and extracting text,
 * then queried with the SAME vendored engine + SAME corpus builder. Behaviour
 * degrades gracefully and stays Fortemi-compatible.
 */

import {
  queryAiwgFortemiIndex,
  getAiwgFortemiFacets,
  createAiwgIndexController,
  createAiwgFetchChunkLoader,
  aiwgFortemiIndexToCommunityGraph,
  validateAiwgFortemiChunkManifest,
  validateAiwgFortemiIndexExport
} from '../vendor/fortemi-aiwg-index.js';
import {
  buildFortemiMetadataExport,
  buildFortemiIndexExport,
  recordToSectionId
} from './fortemi-corpus.js';

// Re-export the real Fortemi static-index API so consumers (and tests) use the
// vendored engine, not a local reimplementation.
export {
  queryAiwgFortemiIndex,
  getAiwgFortemiFacets,
  createAiwgIndexController,
  createAiwgFetchChunkLoader,
  aiwgFortemiIndexToCommunityGraph
};

const SEARCH_INDEX_DIR = 'search-index';
const DEFAULT_MAX_CACHED_PARTS = 4;
const DEFAULT_PAGE_LIMIT = 25;
const DEFAULT_SNIPPET_LENGTH = 140;

// Static-index controller state (primary path).
let controller = null;
let controllerPromise = null;
let controllerFailed = false;

// Legacy in-browser index state (fallback path).
let legacyIndex = null;
let legacyPromise = null;

// Compact Fortemi metadata, keyed by Pagenary section id.
let metadataExport = null;
let metadataPromise = null;
let metadataFailed = false;

// Section lookup, keyed by Pagenary section id, rebuilt per manifest.
let sectionLookup = null;
let sectionLookupSource = null;

/**
 * Escape special regex characters in a string.
 * @param {string} value - String to escape
 * @returns {string} Escaped string safe for use in RegExp
 */
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Flatten manifest into searchable sections.
 * Returns all navigable sections (those with module paths).
 * Recursively handles deeply nested subsections.
 * @param {Array} manifest - Nested manifest array
 * @param {string} [parentGroup] - Parent group title for tracking hierarchy
 * @returns {Array} Flat array of searchable sections
 */
export function flattenManifest(manifest, parentGroup = '') {
  const flat = [];
  for (const entry of manifest) {
    const groupLabel = parentGroup ? `${parentGroup} > ${entry.title}` : entry.title;
    const hasSubsections = Array.isArray(entry.subsections) && entry.subsections.length > 0;
    // Include an entry as a searchable section when it has a module (including
    // authored groups with their own page) OR when it is a leaf with no
    // subsections (flat manifests carry navigable sections without a module
    // field). Container-only groups are skipped directly; their children are
    // picked up by the recursion below.
    if (entry.module || !hasSubsections) {
      flat.push({
        ...entry,
        group: parentGroup || entry.title
      });
    }
    // Recursively include all subsections
    if (hasSubsections) {
      const nested = flattenManifest(entry.subsections, groupLabel);
      flat.push(...nested);
    }
  }
  return flat;
}

/**
 * Build (and cache) a section lookup map from a manifest.
 * @param {Array} manifest
 * @returns {Map<string, object>}
 */
function getSectionLookup(manifest) {
  if (sectionLookup && sectionLookupSource === manifest) return sectionLookup;
  sectionLookup = new Map();
  for (const section of flattenManifest(manifest)) {
    if (section && section.id && !sectionLookup.has(section.id)) {
      sectionLookup.set(section.id, section);
    }
  }
  sectionLookupSource = manifest;
  return sectionLookup;
}

/**
 * Extract plain text from an HTML string (browser DOM, fallback path only).
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function extractText(html) {
  if (typeof document === 'undefined') return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Resolve the base URL for the static search index, honouring subpath deploys.
 * @returns {string|null}
 */
function searchIndexBaseUrl() {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return null;
  try {
    return new URL(`${SEARCH_INDEX_DIR}/`, document.baseURI).toString();
  } catch {
    return null;
  }
}

/**
 * Load the static-index controller once. Resolves to null on any failure so the
 * caller can fall back to the legacy in-browser index.
 * @returns {Promise<object|null>} Controller or null
 */
async function loadStaticController() {
  if (controller) return controller;
  if (controllerFailed) return null;
  if (controllerPromise) return controllerPromise;

  controllerPromise = (async () => {
    const base = searchIndexBaseUrl();
    if (!base || typeof fetch !== 'function') return null;
    try {
      const response = await fetch(new URL('manifest.json', base).toString());
      if (!response.ok) return null;
      const manifest = await response.json();
      if (!validateAiwgFortemiChunkManifest(manifest).valid) return null;
      const instance = createAiwgIndexController();
      instance.loadChunkedIndex(
        manifest,
        createAiwgFetchChunkLoader(base),
        { maxCachedParts: DEFAULT_MAX_CACHED_PARTS }
      );
      controller = instance;
      return instance;
    } catch {
      return null;
    }
  })();

  const result = await controllerPromise;
  if (!result) controllerFailed = true;
  controllerPromise = null;
  return result;
}

/**
 * Load compact page metadata emitted beside the chunked search index.
 * @returns {Promise<object|null>} Metadata export or null
 */
async function loadStaticMetadata() {
  if (metadataExport) return metadataExport;
  if (metadataFailed) return null;
  if (metadataPromise) return metadataPromise;

  metadataPromise = (async () => {
    const base = searchIndexBaseUrl();
    if (!base || typeof fetch !== 'function') return null;
    try {
      const response = await fetch(new URL('metadata.json', base).toString());
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.schema_version !== 'pagenary.fortemi.metadata.v1' || !Array.isArray(data.pages)) {
        return null;
      }
      metadataExport = data;
      return data;
    } catch {
      return null;
    }
  })();

  const result = await metadataPromise;
  if (!result) metadataFailed = true;
  metadataPromise = null;
  return result;
}

/**
 * Build the legacy in-browser index (fallback). Imports every section module,
 * extracts rendered text, and assembles a Fortemi index export with the shared
 * corpus builder so the fallback matches the build-time corpus.
 * @param {Array} manifest
 * @returns {Promise<object>} { index, byId }
 */
async function buildLegacyIndex(manifest) {
  if (legacyIndex) return legacyIndex;
  if (legacyPromise) return legacyPromise;

  legacyPromise = (async () => {
    const flat = flattenManifest(manifest);
    const entries = await Promise.all(flat.map(async (section) => {
      let content = '';
      try {
        if (section.module) {
          const modulePath = section.module.replace('./', '../');
          const mod = await import(modulePath);
          if (mod.load) {
            const result = await mod.load();
            content = extractText(result.html || '');
          }
        }
      } catch {
        // Module failed to load; index by title/summary only.
      }
      const text = `${section.title || ''} ${section.summary || ''} ${section.group || ''} ${content}`.trim();
      return { section, text };
    }));

    const { index } = buildFortemiIndexExport(entries, { repo: 'pagenary' });
    const byId = new Map(flat.map((section) => [section.id, section]));
    legacyIndex = { index, byId };
    return legacyIndex;
  })();

  return legacyPromise;
}

/**
 * Map a ranked Fortemi record back to a Pagenary command/section entry.
 * @param {object} ranked - { item, rank, snippet, matches }
 * @param {Map<string, object>} lookup - section id -> section
 * @returns {object|null}
 */
function rankedToSection(ranked, lookup) {
  const sectionId = recordToSectionId(ranked.item);
  if (!sectionId) return null;
  const base = lookup.get(sectionId) || {
    id: sectionId,
    title: ranked.item.title,
    summary: ''
  };
  return {
    ...base,
    searchRank: ranked.rank,
    searchSnippet: ranked.snippet,
    searchMatches: ranked.matches || []
  };
}

/**
 * Filter sections by search query (title/summary only, synchronous).
 * @param {Array} manifest - Array of section objects
 * @param {string} query - Search query
 * @returns {Array} Filtered sections
 */
export function filterSections(manifest, query) {
  const flat = flattenManifest(manifest);
  const q = query.trim().toLowerCase();
  if (!q) return flat;
  return flat.filter((section) => {
    const haystack = `${section.title || ''} ${section.summary || ''} ${section.group || ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Paged full-text search across all section content. Backed by the static
 * chunked index when available (lazy fetch + precache + offset paging), else the
 * legacy in-browser index. Both share the same vendored ranking engine.
 *
 * @param {Array} manifest - The manifest array
 * @param {string} query - Search query
 * @param {object} [options]
 * @param {number} [options.offset=0]
 * @param {number} [options.limit=DEFAULT_PAGE_LIMIT]
 * @param {Function} [options.onProgress] - Static-index load progress callback
 * @returns {Promise<{ items: Array, total: number, offset: number, limit: number, complete: boolean, source: string }>}
 */
export async function searchContentPage(manifest, query, options = {}) {
  const offset = Math.max(0, options.offset || 0);
  const limit = Math.max(1, options.limit || DEFAULT_PAGE_LIMIT);
  const lookup = getSectionLookup(manifest);
  const queryOptions = {
    types: ['docs.page'],
    rank: true,
    snippets: true,
    includeMatches: true,
    searchProfile: 'aiwg-discovery',
    snippetLength: DEFAULT_SNIPPET_LENGTH,
    limit,
    offset
  };

  // Primary: static chunked index.
  const ctl = await loadStaticController();
  if (ctl) {
    try {
      const result = await ctl.queryChunked(query, {
        ...queryOptions,
        onProgress: options.onProgress
      });
      const ranked = result.rankedItems || [];
      const items = ranked.map((entry) => rankedToSection(entry, lookup)).filter(Boolean);
      return {
        items,
        total: result.total,
        offset,
        limit,
        complete: offset + items.length >= result.total,
        source: 'static'
      };
    } catch {
      // Fall through to legacy on a query failure.
    }
  }

  // Fallback: legacy in-browser index.
  const legacy = await buildLegacyIndex(manifest);
  if (!query.trim()) {
    const all = Array.from(legacy.byId.values());
    const page = all.slice(offset, offset + limit);
    return { items: page, total: all.length, offset, limit, complete: offset + page.length >= all.length, source: 'legacy' };
  }
  const result = queryAiwgFortemiIndex(legacy.index, query, queryOptions);
  const items = (result.rankedItems || []).map((entry) => rankedToSection(entry, legacy.byId)).filter(Boolean);
  return {
    items,
    total: result.total,
    offset,
    limit,
    complete: offset + items.length >= result.total,
    source: 'legacy'
  };
}

/**
 * Full-text search across all section content (first page, back-compatible).
 * Empty query returns all sections in index order.
 * @param {Array} manifest - The manifest array
 * @param {string} query - Search query
 * @param {object} [options] - Paging options (see searchContentPage)
 * @returns {Promise<Array>} Matching sections (first page)
 */
export async function searchContent(manifest, query, options = {}) {
  if (!query.trim()) {
    // No query: return every section, preferring the controller's order when
    // present, else the manifest flatten order.
    const page = await searchContentPage(manifest, '', {
      offset: 0,
      limit: Number.MAX_SAFE_INTEGER,
      ...options
    });
    return page.items;
  }
  const page = await searchContentPage(manifest, query, { limit: DEFAULT_PAGE_LIMIT, ...options });
  return page.items;
}

/**
 * Build a community graph from the manifest (Fortemi graph capability).
 * Uses record relationships/facets, so it does not require full-text content.
 * @param {Array} manifest
 * @param {object} [options] - AiwgIndexGraphOptions
 * @returns {{ nodes: Array, edges: Array, communities: Array }}
 */
export function buildCommunityGraph(manifest, options = {}) {
  const flat = flattenManifest(manifest);
  const entries = flat.map((section) => ({
    section,
    text: `${section.title || ''} ${section.summary || ''}`.trim()
  }));
  const { index } = buildFortemiIndexExport(entries, { repo: 'pagenary' });
  if (!validateAiwgFortemiIndexExport(index).valid) {
    return { nodes: [], edges: [], communities: [] };
  }
  return aiwgFortemiIndexToCommunityGraph(index, options);
}

/**
 * Resolve compact Fortemi metadata for a section id. Prefers the build-time
 * artifact, then falls back to a locally-built in-browser index.
 * @param {Array} manifest
 * @param {string} sectionId
 * @returns {Promise<object|null>}
 */
export async function resolveSectionMetadata(manifest, sectionId) {
  if (!sectionId) return null;

  const staticMetadata = await loadStaticMetadata();
  if (staticMetadata) {
    const page = staticMetadata.pages.find((entry) => entry.section_id === sectionId);
    if (page) return page;
  }

  const legacy = await buildLegacyIndex(manifest);
  const fallback = buildFortemiMetadataExport(legacy.index);
  return fallback.pages.find((entry) => entry.section_id === sectionId) || null;
}

/**
 * Resolve all compact Fortemi metadata keyed by section id.
 * @param {Array} manifest
 * @returns {Promise<Map<string, object>>}
 */
export async function resolveSectionMetadataMap(manifest) {
  const staticMetadata = await loadStaticMetadata();
  const metadata = staticMetadata || buildFortemiMetadataExport((await buildLegacyIndex(manifest)).index);
  return new Map((metadata.pages || []).map((page) => [page.section_id, page]));
}

/**
 * Parse search query into individual terms.
 * @param {string} query - Search query
 * @returns {Array<string>} Array of search terms
 */
export function parseSearchTerms(query) {
  return query.split(/\s+/).map((term) => term.trim()).filter(Boolean);
}

/**
 * Find the preferred index in filtered entries based on current section.
 * @param {Array} entries - Filtered section entries
 * @param {string} currentId - Current section ID
 * @returns {number} Index to select (0 if current not found)
 */
export function findPreferredIndex(entries, currentId) {
  const index = entries.findIndex((entry) => entry.id === currentId);
  return index >= 0 ? index : 0;
}

/**
 * Reset cached search state. Primarily for tests.
 */
export function resetSearchState() {
  controller = null;
  controllerPromise = null;
  controllerFailed = false;
  legacyIndex = null;
  legacyPromise = null;
  metadataExport = null;
  metadataPromise = null;
  metadataFailed = false;
  sectionLookup = null;
  sectionLookupSource = null;
}
