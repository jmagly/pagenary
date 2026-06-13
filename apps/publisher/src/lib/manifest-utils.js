/**
 * Manifest building utilities.
 * Pure functions - no DOM dependencies.
 */

/**
 * Create a section entry from input (string ID or object with overrides).
 * @param {string|{id: string, title?: string, summary?: string}} input - Section ID or config object
 * @param {Function} getSectionMetadata - Function to get metadata for a section ID
 * @returns {{id: string, title: string, summary: string, module: string}} Section entry
 */
export function sectionEntry(input, getSectionMetadata) {
  const sectionId = typeof input === 'string' ? input : input.id;
  const overrides = typeof input === 'string' ? {} : { title: input.title, summary: input.summary };
  const meta = getSectionMetadata(sectionId, overrides);
  return {
    id: sectionId,
    title: meta.title,
    summary: meta.summary,
    module: `/sections/${sectionId}.js`
  };
}

/**
 * Create a group entry with subsections.
 * @param {{id: string, title: string, summary: string, sections: Array}} config - Group config
 * @param {Function} getSectionMetadata - Function to get metadata for section IDs
 * @returns {{id: string, title: string, summary: string, subsections: Array}} Group entry
 */
export function groupEntry(config, getSectionMetadata) {
  const { id, title, summary, sections } = config;
  return {
    id,
    title,
    summary,
    subsections: sections.map((s) => sectionEntry(s, getSectionMetadata))
  };
}

/**
 * Build a section index from a manifest array.
 * @param {Array} manifest - Array of section/group entries
 * @returns {Map} Map of section ID to entry (with parentId set on subsections)
 */
export function buildSectionIndex(manifest) {
  const index = new Map();

  function registerEntry(entry, parentId = null) {
    if (parentId) entry.parentId = parentId;
    index.set(entry.id, entry);
    if (Array.isArray(entry.subsections)) {
      entry.subsections.forEach((subsection) => registerEntry(subsection, entry.id));
    }
  }

  manifest.forEach((entry) => registerEntry(entry));
  return index;
}

/**
 * Create a findSection function from an index.
 * @param {Map} index - Section index map
 * @returns {Function} Function that takes ID and returns entry or null
 */
export function createFindSection(index) {
  return function findSection(id) {
    return index.get(id) || null;
  };
}
