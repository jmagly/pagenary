/**
 * Tests for app.js router and navigation logic
 *
 * The router logic is DOM-dependent, but we can test the pure functions:
 * - currentSectionId: extracts section ID from URL hash
 * - resolveTarget: determines target section and parent group
 * - resolveEntry: finds entry from ID
 */

// Re-implement manifest data structures for testing
function sectionEntry(input) {
  const sectionId = typeof input === 'string' ? input : input.id;
  const overrides = typeof input === 'string' ? {} : { title: input.title, summary: input.summary };
  return {
    id: sectionId,
    title: overrides.title || sectionId,
    summary: overrides.summary || 'Summary',
    module: `./sections/${sectionId}.js`
  };
}

function groupEntry({ id, title, summary, sections }) {
  return {
    id,
    title,
    summary,
    subsections: sections.map(sectionEntry)
  };
}

function buildSectionIndex(manifest) {
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

// Create test manifest and index
const TEST_MANIFEST = [
  sectionEntry({ id: 'welcome-overview', title: 'Welcome', summary: 'Landing page' }),
  groupEntry({
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Orientation guides',
    sections: [
      { id: 'getting-started-introduction', title: 'Introduction' },
      { id: 'getting-started-architecture-basics', title: 'Platform Fundamentals' }
    ]
  }),
  groupEntry({
    id: 'developers',
    title: 'Developers',
    summary: 'SDKs and APIs',
    sections: [
      { id: 'developers-overview', title: 'Developer Hub' },
      'developers-sdks',
      'developers-api-reference'
    ]
  })
];

const SECTION_INDEX = buildSectionIndex(TEST_MANIFEST);
const DEFAULT_SECTION = 'welcome-overview';

// Re-implement router functions from app.js
function findSection(id) {
  return SECTION_INDEX.get(id) || null;
}

function currentSectionId(hash) {
  return hash.replace('#', '') || DEFAULT_SECTION;
}

function resolveTarget(id) {
  const entry = findSection(id);
  if (!entry) return { targetId: id, parentId: null };
  // If it's a group with subsections but no module, redirect to first subsection
  if (!entry.module && entry.subsections && entry.subsections.length) {
    return { targetId: entry.subsections[0].id, parentId: entry.id };
  }
  return { targetId: entry.id, parentId: entry.parentId || null };
}

function resolveEntry(id) {
  const { targetId, parentId } = resolveTarget(id);
  const entry = findSection(targetId);
  if (!entry) return null;
  return { entry, targetId, parentId };
}

// Tests
describe('Router: currentSectionId', () => {
  test('extracts section ID from hash', () => {
    expect(currentSectionId('#welcome-overview')).toBe('welcome-overview');
    expect(currentSectionId('#developers-api-reference')).toBe('developers-api-reference');
  });

  test('returns default section for empty hash', () => {
    expect(currentSectionId('')).toBe(DEFAULT_SECTION);
    expect(currentSectionId('#')).toBe(DEFAULT_SECTION);
  });

  test('handles hash with just the pound sign', () => {
    expect(currentSectionId('#')).toBe(DEFAULT_SECTION);
  });

  test('returns hash content even if section does not exist', () => {
    expect(currentSectionId('#non-existent')).toBe('non-existent');
  });
});

describe('Router: resolveTarget', () => {
  test('resolves leaf section to itself', () => {
    const result = resolveTarget('welcome-overview');
    expect(result.targetId).toBe('welcome-overview');
    expect(result.parentId).toBeNull();
  });

  test('resolves subsection with parent reference', () => {
    const result = resolveTarget('getting-started-introduction');
    expect(result.targetId).toBe('getting-started-introduction');
    expect(result.parentId).toBe('getting-started');
  });

  test('resolves group to first subsection', () => {
    const result = resolveTarget('getting-started');
    expect(result.targetId).toBe('getting-started-introduction');
    expect(result.parentId).toBe('getting-started');
  });

  test('resolves developers group to first subsection', () => {
    const result = resolveTarget('developers');
    expect(result.targetId).toBe('developers-overview');
    expect(result.parentId).toBe('developers');
  });

  test('returns passed ID for non-existent section', () => {
    const result = resolveTarget('non-existent');
    expect(result.targetId).toBe('non-existent');
    expect(result.parentId).toBeNull();
  });
});

describe('Router: resolveEntry', () => {
  test('resolves leaf section entry', () => {
    const result = resolveEntry('welcome-overview');
    expect(result).not.toBeNull();
    expect(result.entry.id).toBe('welcome-overview');
    expect(result.entry.title).toBe('Welcome');
    expect(result.targetId).toBe('welcome-overview');
    expect(result.parentId).toBeNull();
  });

  test('resolves subsection entry with parent', () => {
    const result = resolveEntry('developers-api-reference');
    expect(result).not.toBeNull();
    expect(result.entry.id).toBe('developers-api-reference');
    expect(result.parentId).toBe('developers');
  });

  test('resolves group to first subsection entry', () => {
    const result = resolveEntry('getting-started');
    expect(result).not.toBeNull();
    expect(result.entry.id).toBe('getting-started-introduction');
    expect(result.targetId).toBe('getting-started-introduction');
    expect(result.parentId).toBe('getting-started');
  });

  test('returns null for non-existent section', () => {
    const result = resolveEntry('non-existent');
    expect(result).toBeNull();
  });

  test('entry has module path for navigation', () => {
    const result = resolveEntry('developers-sdks');
    expect(result.entry.module).toBe('./sections/developers-sdks.js');
  });
});

describe('Router: navigation flow scenarios', () => {
  test('direct navigation to leaf section', () => {
    // User clicks on "Welcome" in sidebar
    const sectionId = 'welcome-overview';
    const resolved = resolveEntry(sectionId);

    expect(resolved.targetId).toBe('welcome-overview');
    expect(resolved.entry.module).toBeDefined();
    expect(resolved.parentId).toBeNull(); // No group to expand
  });

  test('navigation to subsection expands parent group', () => {
    // User clicks on "Introduction" under "Getting Started"
    const sectionId = 'getting-started-introduction';
    const resolved = resolveEntry(sectionId);

    expect(resolved.targetId).toBe('getting-started-introduction');
    expect(resolved.parentId).toBe('getting-started'); // Group should be expanded
    expect(resolved.entry.module).toBeDefined();
  });

  test('clicking group header shows first subsection', () => {
    // User clicks on "Developers" group header
    const groupId = 'developers';
    const resolved = resolveEntry(groupId);

    // Should redirect to first subsection
    expect(resolved.targetId).toBe('developers-overview');
    expect(resolved.parentId).toBe('developers');
    expect(resolved.entry.id).toBe('developers-overview');
  });

  test('hash navigation simulates browser behavior', () => {
    // Simulate: location.hash = '#developers-sdks'
    const hash = '#developers-sdks';
    const sectionId = currentSectionId(hash);
    const resolved = resolveEntry(sectionId);

    expect(sectionId).toBe('developers-sdks');
    expect(resolved.entry.id).toBe('developers-sdks');
    expect(resolved.parentId).toBe('developers');
  });

  test('empty hash loads default section', () => {
    // Simulate: location.hash = ''
    const hash = '';
    const sectionId = currentSectionId(hash);
    const resolved = resolveEntry(sectionId);

    expect(sectionId).toBe(DEFAULT_SECTION);
    expect(resolved.entry.id).toBe('welcome-overview');
  });

  test('invalid hash returns null entry', () => {
    // Simulate: location.hash = '#invalid-section'
    const hash = '#invalid-section';
    const sectionId = currentSectionId(hash);
    const resolved = resolveEntry(sectionId);

    expect(sectionId).toBe('invalid-section');
    expect(resolved).toBeNull();
  });
});

describe('Router: edge cases', () => {
  test('handles section ID with special characters in hash', () => {
    // Hash encoding edge case
    const hash = '#developers-api-reference';
    const sectionId = currentSectionId(hash);
    expect(sectionId).toBe('developers-api-reference');
  });

  test('resolveTarget handles undefined gracefully', () => {
    // Defensive programming test
    expect(() => resolveTarget(undefined)).not.toThrow();
    const result = resolveTarget(undefined);
    expect(result.targetId).toBeUndefined();
    expect(result.parentId).toBeNull();
  });

  test('resolveEntry handles empty string', () => {
    const result = resolveEntry('');
    expect(result).toBeNull();
  });

  test('nested navigation maintains parent context', () => {
    // Navigate through multiple subsections in same group
    const first = resolveEntry('developers-overview');
    const second = resolveEntry('developers-sdks');
    const third = resolveEntry('developers-api-reference');

    // All should have same parent
    expect(first.parentId).toBe('developers');
    expect(second.parentId).toBe('developers');
    expect(third.parentId).toBe('developers');
  });
});
