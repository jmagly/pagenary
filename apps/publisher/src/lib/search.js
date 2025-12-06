/**
 * Search and filtering utilities.
 * Pure functions - no DOM dependencies.
 */

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
 * @param {Array} manifest - Nested manifest array
 * @returns {Array} Flat array of searchable sections
 */
export function flattenManifest(manifest) {
  const flat = [];
  for (const entry of manifest) {
    // Include top-level section if it has a module
    if (entry.module) {
      flat.push(entry);
    }
    // Include all subsections
    if (entry.subsections) {
      for (const sub of entry.subsections) {
        flat.push({
          ...sub,
          group: entry.title // Track parent group for display
        });
      }
    }
  }
  return flat;
}

/**
 * Filter sections by search query.
 * Matches against title and summary (case-insensitive).
 * Searches both top-level and nested subsections.
 * @param {Array} manifest - Array of section objects with title and summary
 * @param {string} query - Search query
 * @returns {Array} Filtered sections (flattened)
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
