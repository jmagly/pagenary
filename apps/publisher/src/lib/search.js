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
 * Filter sections by search query.
 * Matches against title and summary (case-insensitive).
 * @param {Array} manifest - Array of section objects with title and summary
 * @param {string} query - Search query
 * @returns {Array} Filtered sections
 */
export function filterSections(manifest, query) {
  const q = query.trim().toLowerCase();
  if (!q) return manifest;
  return manifest.filter((section) => {
    const haystack = `${section.title} ${section.summary}`.toLowerCase();
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
