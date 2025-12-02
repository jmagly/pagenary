/**
 * Tests for lib/search.js
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  escapeRegExp,
  filterSections,
  parseSearchTerms,
  findPreferredIndex
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
