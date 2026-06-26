/**
 * Tests for lib/search.js
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  escapeRegExp,
  filterSections,
  parseSearchTerms,
  findPreferredIndex,
  resetSearchState,
  resolveSectionMetadata,
  resolveSectionMetadataMap,
  queryAiwgFortemiIndex
} from '../../../src/lib/search.js';

// Test manifest data
const TEST_MANIFEST = [
  { id: 'welcome-overview', title: 'Welcome', summary: 'Landing hub for introducing each tenant experience.' },
  { id: 'getting-started', title: 'Getting Started', summary: 'Orientation guides that prepare new teams to launch quickly.' },
  { id: 'core-technology', title: 'Core Systems', summary: 'Reference templates describing foundational infrastructure.' },
  { id: 'developers', title: 'Developers', summary: 'SDKs, APIs, and engineering workflows.' },
  { id: 'tutorials', title: 'Tutorials', summary: 'Hands-on walkthroughs that demonstrate scenarios.' },
  { id: 'governance', title: 'Governance', summary: 'Policy and decision-making templates.' },
  { id: 'security', title: 'Security', summary: 'Risk management templates spanning posture and controls.' },
  { id: 'operations', title: 'Operations', summary: 'Runbooks and checklists for service operators.' }
];

describe('lib/search.js', () => {
  afterEach(() => {
    resetSearchState();
  });

  describe('queryAiwgFortemiIndex', () => {
    const fortemiIndex = {
      schema_version: 'aiwg.fortemi.index.export.v1',
      generated_at: '2026-06-14T00:00:00.000Z',
      source: {
        repo: 'pagenary',
        privacy: 'public'
      },
      items: [
        {
          schema_version: 'aiwg.fortemi.index.record.v1',
          id: 'docs:page:welcome-overview',
          type: 'docs.page',
          source: {
            path: 'sections/welcome-overview.js',
            repo_relative_path: 'sections/welcome-overview.js',
            locator: '#welcome-overview'
          },
          title: 'Welcome',
          text: 'Landing hub for introducing each tenant experience.',
          facets: { section: ['welcome-overview'], group: ['documentation'] },
          tags: [],
          concepts: ['documentation'],
          relationships: [],
          provenance: [{ field: 'text', source: 'sections/welcome-overview.js', path: '$.text', confidence: 'source', privacy: 'public' }],
          privacy: { classification: 'public', pii: false },
          updated_at: '2026-06-14T00:00:00.000Z'
        },
        {
          schema_version: 'aiwg.fortemi.index.record.v1',
          id: 'docs:page:developers',
          type: 'docs.page',
          source: {
            path: 'sections/developers.js',
            repo_relative_path: 'sections/developers.js',
            locator: '#developers'
          },
          title: 'Developers',
          text: 'SDKs, APIs, and engineering workflows for teams shipping integrations.',
          facets: { section: ['developers'], group: ['documentation'] },
          tags: ['guide'],
          concepts: ['documentation', 'api'],
          relationships: [],
          provenance: [{ field: 'text', source: 'sections/developers.js', path: '$.text', confidence: 'source', privacy: 'public' }],
          privacy: { classification: 'public', pii: false },
          updated_at: '2026-06-14T00:00:00.000Z'
        }
      ]
    };

    test('returns docs.page records with ranking and snippets', () => {
      const result = queryAiwgFortemiIndex(fortemiIndex, 'api', {
        types: ['docs.page'],
        rank: true,
        snippets: true,
        includeMatches: true,
        snippetLength: 64
      });

      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('docs:page:developers');
      expect(result.rankedItems[0].rank).toBeGreaterThan(0);
      expect(result.rankedItems[0].snippet).toContain('API');
      expect(result.rankedItems[0].snippet).not.toContain('<mark>');
      expect(result.rankedItems[0].matches.some((match) => match.field === 'text' || match.field === 'concept')).toBe(true);
      expect(result.facets.type['docs.page']).toBe(1);
    });

    test('preserves export order unless ranking is requested', () => {
      const result = queryAiwgFortemiIndex(fortemiIndex, '', { types: ['docs.page'] });

      expect(result.items.map((item) => item.id)).toEqual([
        'docs:page:welcome-overview',
        'docs:page:developers'
      ]);
      expect(result.rankedItems).toBeUndefined();
    });
  });

  describe('escapeRegExp', () => {
    test('escapes special regex characters', () => {
      expect(escapeRegExp('.')).toBe('\\.');
      expect(escapeRegExp('*')).toBe('\\*');
      expect(escapeRegExp('+')).toBe('\\+');
      expect(escapeRegExp('?')).toBe('\\?');
      expect(escapeRegExp('^')).toBe('\\^');
      expect(escapeRegExp('$')).toBe('\\$');
      expect(escapeRegExp('{')).toBe('\\{');
      expect(escapeRegExp('}')).toBe('\\}');
      expect(escapeRegExp('(')).toBe('\\(');
      expect(escapeRegExp(')')).toBe('\\)');
      expect(escapeRegExp('|')).toBe('\\|');
      expect(escapeRegExp('[')).toBe('\\[');
      expect(escapeRegExp(']')).toBe('\\]');
      expect(escapeRegExp('\\')).toBe('\\\\');
    });

    test('preserves normal characters', () => {
      expect(escapeRegExp('hello')).toBe('hello');
      expect(escapeRegExp('api')).toBe('api');
      expect(escapeRegExp('123')).toBe('123');
    });

    test('handles mixed content', () => {
      expect(escapeRegExp('API (v1.0)')).toBe('API \\(v1\\.0\\)');
      expect(escapeRegExp('user@example.com')).toBe('user@example\\.com');
      expect(escapeRegExp('price: $10')).toBe('price: \\$10');
    });

    test('handles empty string', () => {
      expect(escapeRegExp('')).toBe('');
    });

    test('handles string with multiple special chars', () => {
      expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });
  });

  describe('resolveSectionMetadata', () => {
    test('resolves compact Fortemi metadata by section id without record text', async () => {
      const metadata = await resolveSectionMetadata(TEST_MANIFEST, 'developers');
      expect(metadata.section_id).toBe('developers');
      expect(metadata.record_id).toBe('docs:page:developers');
      expect(metadata.title).toBe('Developers');
      expect(metadata.facets.section).toEqual(['developers']);
      expect(metadata.source.locator).toBe('#developers');
      expect(metadata.provenance[0].confidence).toBe('source');
      expect(metadata.text).toBeUndefined();
    });

    test('resolves all metadata as a section-id map', async () => {
      const map = await resolveSectionMetadataMap(TEST_MANIFEST);
      expect(map.has('welcome-overview')).toBe(true);
      expect(map.get('security').privacy.classification).toBe('public');
    });
  });

  describe('filterSections', () => {
    test('returns all sections for empty query', () => {
      const result = filterSections(TEST_MANIFEST, '');
      expect(result).toHaveLength(TEST_MANIFEST.length);
    });

    test('returns all sections for whitespace-only query', () => {
      const result = filterSections(TEST_MANIFEST, '   ');
      expect(result).toHaveLength(TEST_MANIFEST.length);
    });

    test('filters by title match', () => {
      const result = filterSections(TEST_MANIFEST, 'welcome');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('welcome-overview');
    });

    test('filters by summary match', () => {
      const result = filterSections(TEST_MANIFEST, 'runbooks');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('operations');
    });

    test('search is case-insensitive', () => {
      const result1 = filterSections(TEST_MANIFEST, 'WELCOME');
      const result2 = filterSections(TEST_MANIFEST, 'Welcome');
      const result3 = filterSections(TEST_MANIFEST, 'welcome');

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result3).toHaveLength(1);
      expect(result1[0].id).toBe(result2[0].id);
      expect(result2[0].id).toBe(result3[0].id);
    });

    test('matches partial words', () => {
      const result = filterSections(TEST_MANIFEST, 'dev');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('developers');
    });

    test('matches across title and summary combined', () => {
      const result = filterSections(TEST_MANIFEST, 'sdk');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('developers');
    });

    test('returns multiple matches', () => {
      const result = filterSections(TEST_MANIFEST, 'templates');
      expect(result.length).toBeGreaterThan(1);
      expect(result.some(s => s.id === 'core-technology')).toBe(true);
      expect(result.some(s => s.id === 'governance')).toBe(true);
      expect(result.some(s => s.id === 'security')).toBe(true);
    });

    test('returns empty array for no matches', () => {
      const result = filterSections(TEST_MANIFEST, 'xyz123nonexistent');
      expect(result).toHaveLength(0);
    });

    test('handles query with leading/trailing whitespace', () => {
      const result = filterSections(TEST_MANIFEST, '  welcome  ');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('welcome-overview');
    });
  });

  describe('parseSearchTerms', () => {
    test('parses single word', () => {
      const terms = parseSearchTerms('welcome');
      expect(terms).toEqual(['welcome']);
    });

    test('parses multiple words', () => {
      const terms = parseSearchTerms('getting started');
      expect(terms).toEqual(['getting', 'started']);
    });

    test('handles multiple spaces between words', () => {
      const terms = parseSearchTerms('getting   started');
      expect(terms).toEqual(['getting', 'started']);
    });

    test('handles leading and trailing spaces', () => {
      const terms = parseSearchTerms('  welcome  overview  ');
      expect(terms).toEqual(['welcome', 'overview']);
    });

    test('returns empty array for empty string', () => {
      const terms = parseSearchTerms('');
      expect(terms).toEqual([]);
    });

    test('returns empty array for whitespace only', () => {
      const terms = parseSearchTerms('   ');
      expect(terms).toEqual([]);
    });
  });

  describe('findPreferredIndex', () => {
    test('returns 0 for empty entries', () => {
      expect(findPreferredIndex([], 'welcome-overview')).toBe(0);
    });

    test('returns current section index if found', () => {
      const index = findPreferredIndex(TEST_MANIFEST, 'developers');
      expect(index).toBe(3);
    });

    test('returns 0 if current section not in filtered results', () => {
      const filtered = filterSections(TEST_MANIFEST, 'security');
      const index = findPreferredIndex(filtered, 'developers');
      expect(index).toBe(0);
    });

    test('preserves selection when section matches', () => {
      const filtered = filterSections(TEST_MANIFEST, 'templates');
      const index = findPreferredIndex(filtered, 'governance');
      expect(index).toBeGreaterThanOrEqual(0);
      expect(filtered[index].id).toBe('governance');
    });
  });
});

describe('real-world search scenarios', () => {
  test('user searches for API documentation', () => {
    const result = filterSections(TEST_MANIFEST, 'api');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('developers');
  });

  test('user searches for getting started guide', () => {
    const result = filterSections(TEST_MANIFEST, 'getting started');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('getting-started');
  });

  test('user searches for security content', () => {
    const result = filterSections(TEST_MANIFEST, 'security');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('security');
  });

  test('user searches for hands-on content', () => {
    const result = filterSections(TEST_MANIFEST, 'hands-on');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tutorials');
  });

  test('user searches for infrastructure content', () => {
    const result = filterSections(TEST_MANIFEST, 'infrastructure');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('core-technology');
  });

  test('user searches for operator guides', () => {
    const result = filterSections(TEST_MANIFEST, 'operators');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('operations');
  });
});
