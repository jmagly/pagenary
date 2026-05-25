/**
 * Search and filtering utilities.
 */

// Cache for loaded section content
let searchIndex = null;
let indexPromise = null;

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
    // Include an entry as a searchable section when it has a module (a
    // navigable leaf in production manifests) OR when it is a leaf with no
    // subsections (flat manifests carry navigable sections without a module
    // field). Group entries — those with subsections — are containers, not
    // navigable targets, so they are not included directly; their children
    // are picked up by the recursion below.
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
 * Extract plain text from HTML string.
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function extractText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Build search index by loading all section modules.
 * @param {Array} manifest - The manifest array
 * @returns {Promise<Array>} Indexed sections with content
 */
export async function buildSearchIndex(manifest) {
  if (searchIndex) return searchIndex;
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const flat = flattenManifest(manifest);
    const indexed = await Promise.all(
      flat.map(async (section) => {
        let content = '';
        try {
          if (section.module) {
            // Adjust path: module paths are relative to root, but we're in lib/
            const modulePath = section.module.replace('./', '../');
            const mod = await import(modulePath);
            if (mod.load) {
              const result = await mod.load();
              content = extractText(result.html || '');
            }
          }
        } catch (e) {
          // Module failed to load, search by title/summary only
        }
        return {
          ...section,
          searchContent: `${section.title || ''} ${section.summary || ''} ${section.group || ''} ${content}`.toLowerCase()
        };
      })
    );
    searchIndex = indexed;
    return indexed;
  })();

  return indexPromise;
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
 * Full-text search across all section content.
 * Loads all modules on first call (cached thereafter).
 * @param {Array} manifest - The manifest array
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching sections
 */
export async function searchContent(manifest, query) {
  const index = await buildSearchIndex(manifest);
  const q = query.trim().toLowerCase();
  if (!q) return index;
  return index.filter((section) => section.searchContent.includes(q));
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
