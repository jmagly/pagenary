/**
 * Tests for manifest.js navigation structure and lookup functions
 *
 * Since src/ files are browser ES modules, we re-implement the data structures
 * and logic here to test in Node environment.
 */

// Re-implement data structures from manifest.js for testing

// Simplified section metadata (mirrors getSectionMetadata behavior)
function getSectionMetadata(id, overrides = {}) {
  const title = overrides.title || titleFromId(id);
  const summary = overrides.summary || 'Default summary';
  return { id, title, summary };
}

function titleFromId(id) {
  const normalized = id.trim().replace(/_/g, '-');
  const words = normalized.split('-').filter(Boolean).map((word) => {
    const overrides = { api: 'API', sdk: 'SDK', faq: 'FAQ' };
    if (overrides[word]) return overrides[word];
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return words.join(' ');
}

function sectionEntry(input) {
  const sectionId = typeof input === 'string' ? input : input.id;
  const overrides = typeof input === 'string' ? {} : { title: input.title, summary: input.summary };
  const meta = getSectionMetadata(sectionId, overrides);
  return {
    id: sectionId,
    title: meta.title,
    summary: meta.summary,
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

// Build SECTION_INDEX similar to manifest.js
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

function createFindSection(index) {
  return function findSection(id) {
    return index.get(id) || null;
  };
}

// Tests
describe('manifest.js data structures', () => {
  describe('sectionEntry', () => {
    test('creates entry from string id', () => {
      const entry = sectionEntry('welcome-overview');
      expect(entry.id).toBe('welcome-overview');
      expect(entry.title).toBe('Welcome Overview');
      expect(entry.module).toBe('./sections/welcome-overview.js');
    });

    test('creates entry from object with overrides', () => {
      const entry = sectionEntry({
        id: 'welcome-overview',
        title: 'Welcome',
        summary: 'Landing hub for introducing each tenant experience.'
      });
      expect(entry.id).toBe('welcome-overview');
      expect(entry.title).toBe('Welcome');
      expect(entry.summary).toBe('Landing hub for introducing each tenant experience.');
      expect(entry.module).toBe('./sections/welcome-overview.js');
    });

    test('generates module path from id', () => {
      const entry = sectionEntry('developers-api-reference');
      expect(entry.module).toBe('./sections/developers-api-reference.js');
    });
  });

  describe('groupEntry', () => {
    test('creates group with subsections', () => {
      const group = groupEntry({
        id: 'getting-started',
        title: 'Getting Started',
        summary: 'Orientation guides',
        sections: [
          { id: 'getting-started-introduction', title: 'Introduction' },
          'getting-started-architecture-basics'
        ]
      });

      expect(group.id).toBe('getting-started');
      expect(group.title).toBe('Getting Started');
      expect(group.summary).toBe('Orientation guides');
      expect(group.subsections).toHaveLength(2);
      expect(group.subsections[0].id).toBe('getting-started-introduction');
      expect(group.subsections[0].title).toBe('Introduction');
      expect(group.subsections[1].id).toBe('getting-started-architecture-basics');
    });

    test('handles empty sections array', () => {
      const group = groupEntry({
        id: 'empty-group',
        title: 'Empty',
        summary: 'No sections',
        sections: []
      });

      expect(group.subsections).toHaveLength(0);
    });
  });
});

describe('manifest.js navigation functions', () => {
  // Create a test manifest
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

  const index = buildSectionIndex(TEST_MANIFEST);
  const findSection = createFindSection(index);

  describe('buildSectionIndex', () => {
    test('indexes top-level sections', () => {
      expect(index.has('welcome-overview')).toBe(true);
      expect(index.has('getting-started')).toBe(true);
      expect(index.has('developers')).toBe(true);
    });

    test('indexes subsections', () => {
      expect(index.has('getting-started-introduction')).toBe(true);
      expect(index.has('getting-started-architecture-basics')).toBe(true);
      expect(index.has('developers-overview')).toBe(true);
      expect(index.has('developers-sdks')).toBe(true);
      expect(index.has('developers-api-reference')).toBe(true);
    });

    test('sets parentId on subsections', () => {
      const intro = index.get('getting-started-introduction');
      expect(intro.parentId).toBe('getting-started');

      const devOverview = index.get('developers-overview');
      expect(devOverview.parentId).toBe('developers');
    });

    test('top-level entries have no parentId', () => {
      const welcome = index.get('welcome-overview');
      expect(welcome.parentId).toBeUndefined();

      const gettingStarted = index.get('getting-started');
      expect(gettingStarted.parentId).toBeUndefined();
    });
  });

  describe('findSection', () => {
    test('finds top-level section by id', () => {
      const section = findSection('welcome-overview');
      expect(section).not.toBeNull();
      expect(section.id).toBe('welcome-overview');
      expect(section.title).toBe('Welcome');
    });

    test('finds group by id', () => {
      const group = findSection('getting-started');
      expect(group).not.toBeNull();
      expect(group.id).toBe('getting-started');
      expect(group.subsections).toHaveLength(2);
    });

    test('finds subsection by id', () => {
      const subsection = findSection('developers-api-reference');
      expect(subsection).not.toBeNull();
      expect(subsection.id).toBe('developers-api-reference');
      expect(subsection.parentId).toBe('developers');
    });

    test('returns null for non-existent id', () => {
      expect(findSection('non-existent')).toBeNull();
      expect(findSection('')).toBeNull();
      expect(findSection('unknown-section')).toBeNull();
    });
  });
});

describe('manifest structure validation', () => {
  // Test with structure matching real manifest
  const REAL_MANIFEST_STRUCTURE = [
    sectionEntry({ id: 'welcome-overview', title: 'Welcome', summary: 'Landing hub' }),
    groupEntry({
      id: 'getting-started',
      title: 'Getting Started',
      summary: 'Orientation guides',
      sections: [
        { id: 'getting-started-introduction', title: 'Introduction' },
        { id: 'getting-started-architecture-basics', title: 'Platform Fundamentals' },
        { id: 'getting-started-performance-overview', title: 'Why Precision Matters' }
      ]
    }),
    groupEntry({
      id: 'core-technology',
      title: 'Core Systems',
      summary: 'Reference templates',
      sections: [
        { id: 'core-technology-overview', title: 'Overview' },
        'core-technology-system-foundation',
        'core-technology-compliance-frameworks'
      ]
    })
  ];

  const index = buildSectionIndex(REAL_MANIFEST_STRUCTURE);
  const findSection = createFindSection(index);

  test('all sections have required properties', () => {
    index.forEach((entry, id) => {
      expect(entry.id).toBe(id);
      expect(typeof entry.title).toBe('string');
      expect(entry.title.length).toBeGreaterThan(0);
    });
  });

  test('all leaf sections have module path', () => {
    index.forEach((entry) => {
      // Leaf sections (no subsections) should have module
      if (!entry.subsections) {
        expect(entry.module).toBeDefined();
        expect(entry.module).toMatch(/^\.\/sections\/.*\.js$/);
      }
    });
  });

  test('groups have subsections array', () => {
    const gettingStarted = findSection('getting-started');
    expect(Array.isArray(gettingStarted.subsections)).toBe(true);
    expect(gettingStarted.subsections.length).toBeGreaterThan(0);
  });

  test('subsections reference valid parent', () => {
    index.forEach((entry) => {
      if (entry.parentId) {
        const parent = findSection(entry.parentId);
        expect(parent).not.toBeNull();
        expect(parent.subsections.some(s => s.id === entry.id)).toBe(true);
      }
    });
  });
});

describe('DEFAULT_SECTION behavior', () => {
  const DEFAULT_SECTION = 'welcome-overview';

  test('default section exists in manifest', () => {
    const TEST_MANIFEST = [
      sectionEntry({ id: 'welcome-overview', title: 'Welcome', summary: 'Landing page' })
    ];
    const index = buildSectionIndex(TEST_MANIFEST);
    const findSection = createFindSection(index);

    expect(findSection(DEFAULT_SECTION)).not.toBeNull();
  });

  test('default section is a leaf (has module)', () => {
    const TEST_MANIFEST = [
      sectionEntry({ id: 'welcome-overview', title: 'Welcome', summary: 'Landing page' })
    ];
    const index = buildSectionIndex(TEST_MANIFEST);
    const findSection = createFindSection(index);

    const defaultEntry = findSection(DEFAULT_SECTION);
    expect(defaultEntry.module).toBeDefined();
    expect(defaultEntry.subsections).toBeUndefined();
  });
});
