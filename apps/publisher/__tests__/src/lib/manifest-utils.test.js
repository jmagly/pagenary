/**
 * Tests for lib/manifest-utils.js
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  sectionEntry,
  groupEntry,
  buildSectionIndex,
  createFindSection
} from '../../../src/lib/manifest-utils.js';

// Mock metadata function for testing
function mockGetSectionMetadata(sectionId, overrides = {}) {
  const defaults = {
    'welcome': { title: 'Welcome', summary: 'Welcome overview' },
    'getting-started': { title: 'Getting Started', summary: 'Quick start guide' },
    'api-reference': { title: 'API Reference', summary: 'API documentation' },
    'developers-overview': { title: 'Developers Overview', summary: 'Developer hub' },
    'developers-sdks': { title: 'Developer SDKs', summary: 'SDK documentation' }
  };

  const meta = defaults[sectionId] || { title: sectionId, summary: '' };
  return {
    title: overrides.title || meta.title,
    summary: overrides.summary || meta.summary
  };
}

describe('lib/manifest-utils.js', () => {
  describe('sectionEntry', () => {
    test('creates entry from string ID', () => {
      const entry = sectionEntry('welcome', mockGetSectionMetadata);

      expect(entry.id).toBe('welcome');
      expect(entry.title).toBe('Welcome');
      expect(entry.summary).toBe('Welcome overview');
      expect(entry.module).toBe('/sections/welcome.js');
    });

    test('creates entry from object with ID', () => {
      const entry = sectionEntry({ id: 'api-reference' }, mockGetSectionMetadata);

      expect(entry.id).toBe('api-reference');
      expect(entry.title).toBe('API Reference');
      expect(entry.module).toBe('/sections/api-reference.js');
    });

    test('applies title override from object', () => {
      const entry = sectionEntry(
        { id: 'welcome', title: 'Custom Welcome Title' },
        mockGetSectionMetadata
      );

      expect(entry.id).toBe('welcome');
      expect(entry.title).toBe('Custom Welcome Title');
      expect(entry.summary).toBe('Welcome overview'); // Default from metadata
    });

    test('applies summary override from object', () => {
      const entry = sectionEntry(
        { id: 'welcome', summary: 'Custom summary text' },
        mockGetSectionMetadata
      );

      expect(entry.summary).toBe('Custom summary text');
      expect(entry.title).toBe('Welcome'); // Default from metadata
    });

    test('applies both title and summary overrides', () => {
      const entry = sectionEntry(
        { id: 'welcome', title: 'Override Title', summary: 'Override Summary' },
        mockGetSectionMetadata
      );

      expect(entry.title).toBe('Override Title');
      expect(entry.summary).toBe('Override Summary');
    });

    test('generates correct module path', () => {
      const entry = sectionEntry('developers-overview', mockGetSectionMetadata);
      expect(entry.module).toBe('/sections/developers-overview.js');
    });

    test('handles unknown section IDs', () => {
      const entry = sectionEntry('unknown-section', mockGetSectionMetadata);

      expect(entry.id).toBe('unknown-section');
      expect(entry.title).toBe('unknown-section'); // Falls back to ID
      expect(entry.module).toBe('/sections/unknown-section.js');
    });
  });

  describe('groupEntry', () => {
    test('creates group with subsections', () => {
      const group = groupEntry({
        id: 'developers',
        title: 'Developers',
        summary: 'Developer resources',
        sections: ['developers-overview', 'developers-sdks']
      }, mockGetSectionMetadata);

      expect(group.id).toBe('developers');
      expect(group.title).toBe('Developers');
      expect(group.summary).toBe('Developer resources');
      expect(group.subsections).toHaveLength(2);
    });

    test('subsections have correct structure', () => {
      const group = groupEntry({
        id: 'developers',
        title: 'Developers',
        summary: 'Developer resources',
        sections: ['developers-overview']
      }, mockGetSectionMetadata);

      const subsection = group.subsections[0];
      expect(subsection.id).toBe('developers-overview');
      expect(subsection.title).toBe('Developers Overview');
      expect(subsection.module).toBe('/sections/developers-overview.js');
    });

    test('supports object sections with overrides', () => {
      const group = groupEntry({
        id: 'custom',
        title: 'Custom Group',
        summary: 'Custom summary',
        sections: [
          { id: 'developers-overview', title: 'Custom Title' }
        ]
      }, mockGetSectionMetadata);

      expect(group.subsections[0].title).toBe('Custom Title');
    });

    test('handles empty sections array', () => {
      const group = groupEntry({
        id: 'empty',
        title: 'Empty Group',
        summary: 'No sections',
        sections: []
      }, mockGetSectionMetadata);

      expect(group.subsections).toHaveLength(0);
    });
  });

  describe('buildSectionIndex', () => {
    test('indexes leaf sections', () => {
      const manifest = [
        { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' },
        { id: 'setup', title: 'Setup', module: './sections/setup.js' }
      ];

      const index = buildSectionIndex(manifest);

      expect(index.size).toBe(2);
      expect(index.get('welcome').title).toBe('Welcome');
      expect(index.get('setup').title).toBe('Setup');
    });

    test('indexes groups and their subsections', () => {
      const manifest = [
        {
          id: 'developers',
          title: 'Developers',
          subsections: [
            { id: 'dev-overview', title: 'Overview', module: './sections/dev-overview.js' },
            { id: 'dev-api', title: 'API', module: './sections/dev-api.js' }
          ]
        }
      ];

      const index = buildSectionIndex(manifest);

      expect(index.size).toBe(3); // Group + 2 subsections
      expect(index.has('developers')).toBe(true);
      expect(index.has('dev-overview')).toBe(true);
      expect(index.has('dev-api')).toBe(true);
    });

    test('sets parentId on subsections', () => {
      const manifest = [
        {
          id: 'getting-started',
          title: 'Getting Started',
          subsections: [
            { id: 'gs-intro', title: 'Introduction', module: './sections/gs-intro.js' }
          ]
        }
      ];

      const index = buildSectionIndex(manifest);
      const subsection = index.get('gs-intro');

      expect(subsection.parentId).toBe('getting-started');
    });

    test('does not set parentId on top-level sections', () => {
      const manifest = [
        { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' }
      ];

      const index = buildSectionIndex(manifest);
      const section = index.get('welcome');

      expect(section.parentId).toBeUndefined();
    });

    test('handles complex nested manifest', () => {
      const manifest = [
        { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' },
        {
          id: 'developers',
          title: 'Developers',
          subsections: [
            { id: 'dev-overview', title: 'Overview', module: './sections/dev-overview.js' },
            { id: 'dev-sdks', title: 'SDKs', module: './sections/dev-sdks.js' }
          ]
        },
        { id: 'faq', title: 'FAQ', module: './sections/faq.js' }
      ];

      const index = buildSectionIndex(manifest);

      expect(index.size).toBe(5);
      expect(index.get('welcome').parentId).toBeUndefined();
      expect(index.get('developers').parentId).toBeUndefined();
      expect(index.get('dev-overview').parentId).toBe('developers');
      expect(index.get('dev-sdks').parentId).toBe('developers');
      expect(index.get('faq').parentId).toBeUndefined();
    });

    test('handles empty manifest', () => {
      const index = buildSectionIndex([]);
      expect(index.size).toBe(0);
    });
  });

  describe('createFindSection', () => {
    const manifest = [
      { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' },
      {
        id: 'developers',
        title: 'Developers',
        subsections: [
          { id: 'dev-overview', title: 'Overview', module: './sections/dev-overview.js' }
        ]
      }
    ];

    test('returns section by ID', () => {
      const index = buildSectionIndex(manifest);
      const findSection = createFindSection(index);

      const section = findSection('welcome');
      expect(section.id).toBe('welcome');
      expect(section.title).toBe('Welcome');
    });

    test('returns subsection by ID', () => {
      const index = buildSectionIndex(manifest);
      const findSection = createFindSection(index);

      const subsection = findSection('dev-overview');
      expect(subsection.id).toBe('dev-overview');
      expect(subsection.parentId).toBe('developers');
    });

    test('returns group by ID', () => {
      const index = buildSectionIndex(manifest);
      const findSection = createFindSection(index);

      const group = findSection('developers');
      expect(group.id).toBe('developers');
      expect(group.subsections).toHaveLength(1);
    });

    test('returns null for non-existent ID', () => {
      const index = buildSectionIndex(manifest);
      const findSection = createFindSection(index);

      expect(findSection('non-existent')).toBeNull();
      expect(findSection('')).toBeNull();
      expect(findSection(undefined)).toBeNull();
    });
  });
});

describe('manifest building workflow', () => {
  test('build complete manifest from section list', () => {
    const manifest = [
      sectionEntry('welcome', mockGetSectionMetadata),
      groupEntry({
        id: 'getting-started',
        title: 'Getting Started',
        summary: 'Quick start',
        sections: ['getting-started']
      }, mockGetSectionMetadata)
    ];

    expect(manifest).toHaveLength(2);
    expect(manifest[0].id).toBe('welcome');
    expect(manifest[1].id).toBe('getting-started');
    expect(manifest[1].subsections).toHaveLength(1);
  });

  test('index and lookup workflow', () => {
    const manifest = [
      sectionEntry('welcome', mockGetSectionMetadata),
      groupEntry({
        id: 'developers',
        title: 'Developers',
        summary: 'Dev resources',
        sections: ['developers-overview', 'developers-sdks']
      }, mockGetSectionMetadata)
    ];

    const index = buildSectionIndex(manifest);
    const findSection = createFindSection(index);

    // Can find leaf section
    expect(findSection('welcome')).not.toBeNull();
    expect(findSection('welcome').title).toBe('Welcome');

    // Can find group
    expect(findSection('developers')).not.toBeNull();
    expect(findSection('developers').subsections).toHaveLength(2);

    // Can find subsections with parent reference
    const sdk = findSection('developers-sdks');
    expect(sdk).not.toBeNull();
    expect(sdk.parentId).toBe('developers');
  });
});
