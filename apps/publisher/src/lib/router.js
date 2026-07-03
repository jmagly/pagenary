/**
 * Router and navigation utilities.
 * Pure functions - no DOM dependencies.
 */

/**
 * Extract current section ID from URL hash.
 * @param {string} hash - URL hash (e.g., '#section-id' or '')
 * @param {string} defaultSection - Default section ID if hash is empty
 * @returns {string} Section ID
 */
export function currentSectionId(hash, defaultSection) {
  return hash.replace('#', '') || defaultSection;
}

/**
 * Resolve target section and parent group from an ID.
 * If ID is a group with subsections and no own module, redirects to first subsection.
 * @param {string} id - Section ID to resolve
 * @param {Function} findSection - Function to look up section by ID
 * @returns {{targetId: string, parentId: string|null}} Resolved target and parent
 */
export function resolveTarget(id, findSection) {
  const entry = findSection(id);
  if (!entry) return { targetId: id, parentId: null };
  // If it's a group with subsections but no module, redirect to first subsection
  if (!entry.module && entry.subsections && entry.subsections.length) {
    return { targetId: entry.subsections[0].id, parentId: entry.id };
  }
  return { targetId: entry.id, parentId: entry.parentId || null };
}

/**
 * Resolve full entry information from an ID.
 * @param {string} id - Section ID to resolve
 * @param {Function} findSection - Function to look up section by ID
 * @returns {{entry: object, targetId: string, parentId: string|null}|null} Resolved entry or null
 */
export function resolveEntry(id, findSection) {
  const { targetId, parentId } = resolveTarget(id, findSection);
  const entry = findSection(targetId);
  if (!entry) return null;
  return { entry, targetId, parentId };
}
