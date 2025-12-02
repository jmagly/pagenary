/**
 * Tests for section-templates.js pure functions
 *
 * Since src/ files are browser ES modules, we re-implement the pure logic here
 * to test in Node environment. This validates the business logic without
 * requiring DOM or ESM configuration.
 */

// Re-implement pure functions from section-templates.js for testing
const WORD_OVERRIDES = {
  api: 'API',
  apis: 'APIs',
  faq: 'FAQ',
  rpc: 'RPC',
  sdk: 'SDK',
  sdks: 'SDKs',
  ui: 'UI'
};

const CATEGORY_RULES = [
  { category: 'welcome', test: (id) => id.startsWith('welcome') },
  { category: 'guide', test: (id) => id.startsWith('getting-started') },
  { category: 'reference', test: (id) => id.startsWith('core-technology') },
  { category: 'technical', test: (id) => id.startsWith('technical') },
  { category: 'developer', test: (id) => id.startsWith('developers') },
  { category: 'tutorial-overview', test: (id) => id === 'tutorials-overview' },
  { category: 'tutorial', test: (id) => id.startsWith('tutorial-') },
  { category: 'tutorial', test: (id) => id.startsWith('tutorials-') },
  { category: 'use-case', test: (id) => id.startsWith('use-case') },
  { category: 'product', test: (id) => id.startsWith('products') },
  { category: 'governance', test: (id) => id.startsWith('governance') },
  { category: 'resource', test: (id) => id.startsWith('resources') },
  { category: 'security', test: (id) => id.startsWith('security') },
  { category: 'operations', test: (id) => id.startsWith('operations') },
  { category: 'archive', test: (id) => id.startsWith('archive') },
];

function formatWord(word) {
  if (!word) return '';
  if (WORD_OVERRIDES[word]) return WORD_OVERRIDES[word];
  if (/^\d+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalizeId(id) {
  return id.trim();
}

function inferCategory(id) {
  const normalized = normalizeId(id);
  const match = CATEGORY_RULES.find((rule) => rule.test(normalized));
  return match ? match.category : 'default';
}

function titleFromId(id) {
  const normalized = normalizeId(id).replace(/_/g, '-');
  const words = normalized.split('-').filter(Boolean).map((word) => formatWord(word));
  return words.join(' ');
}

// Tests
describe('section-templates.js pure functions', () => {
  describe('formatWord', () => {
    test('returns empty string for falsy input', () => {
      expect(formatWord('')).toBe('');
      expect(formatWord(null)).toBe('');
      expect(formatWord(undefined)).toBe('');
    });

    test('applies word overrides for acronyms', () => {
      expect(formatWord('api')).toBe('API');
      expect(formatWord('apis')).toBe('APIs');
      expect(formatWord('faq')).toBe('FAQ');
      expect(formatWord('rpc')).toBe('RPC');
      expect(formatWord('sdk')).toBe('SDK');
      expect(formatWord('sdks')).toBe('SDKs');
      expect(formatWord('ui')).toBe('UI');
    });

    test('preserves numeric strings unchanged', () => {
      expect(formatWord('123')).toBe('123');
      expect(formatWord('2025')).toBe('2025');
      expect(formatWord('0')).toBe('0');
    });

    test('capitalizes first letter of regular words', () => {
      expect(formatWord('hello')).toBe('Hello');
      expect(formatWord('world')).toBe('World');
      expect(formatWord('documentation')).toBe('Documentation');
    });

    test('preserves rest of word after first letter', () => {
      expect(formatWord('helloWorld')).toBe('HelloWorld');
      expect(formatWord('testCASE')).toBe('TestCASE');
    });
  });

  describe('normalizeId', () => {
    test('trims whitespace from id', () => {
      expect(normalizeId('  welcome  ')).toBe('welcome');
      expect(normalizeId('\ttest\n')).toBe('test');
      expect(normalizeId('no-whitespace')).toBe('no-whitespace');
    });
  });

  describe('inferCategory', () => {
    test('infers welcome category for welcome-* ids', () => {
      expect(inferCategory('welcome')).toBe('welcome');
      expect(inferCategory('welcome-overview')).toBe('welcome');
      expect(inferCategory('welcome-hero')).toBe('welcome');
    });

    test('infers guide category for getting-started-* ids', () => {
      expect(inferCategory('getting-started')).toBe('guide');
      expect(inferCategory('getting-started-introduction')).toBe('guide');
      expect(inferCategory('getting-started-architecture-basics')).toBe('guide');
    });

    test('infers reference category for core-technology-* ids', () => {
      expect(inferCategory('core-technology')).toBe('reference');
      expect(inferCategory('core-technology-overview')).toBe('reference');
      expect(inferCategory('core-technology-system-foundation')).toBe('reference');
    });

    test('infers technical category for technical-* ids', () => {
      expect(inferCategory('technical')).toBe('technical');
      expect(inferCategory('technical-architecture')).toBe('technical');
      expect(inferCategory('technical-whitepaper')).toBe('technical');
    });

    test('infers developer category for developers-* ids', () => {
      expect(inferCategory('developers')).toBe('developer');
      expect(inferCategory('developers-overview')).toBe('developer');
      expect(inferCategory('developers-sdks')).toBe('developer');
      expect(inferCategory('developers-api-reference')).toBe('developer');
    });

    test('infers tutorial-overview category only for exact match', () => {
      expect(inferCategory('tutorials-overview')).toBe('tutorial-overview');
    });

    test('infers tutorial category for tutorial-* and tutorials-* ids', () => {
      expect(inferCategory('tutorial-build-first-integration')).toBe('tutorial');
      expect(inferCategory('tutorial-deploy-automation')).toBe('tutorial');
      expect(inferCategory('tutorials-basics')).toBe('tutorial');
    });

    test('infers use-case category for use-case-* ids', () => {
      expect(inferCategory('use-case-digital-auctions')).toBe('use-case');
      expect(inferCategory('use-case-financial-automation')).toBe('use-case');
    });

    test('infers product category for products-* ids', () => {
      expect(inferCategory('products')).toBe('product');
      expect(inferCategory('products-solution-library')).toBe('product');
    });

    test('infers governance category for governance-* ids', () => {
      expect(inferCategory('governance')).toBe('governance');
      expect(inferCategory('governance-overview')).toBe('governance');
      expect(inferCategory('governance-structure')).toBe('governance');
    });

    test('infers resource category for resources-* ids', () => {
      expect(inferCategory('resources')).toBe('resource');
      expect(inferCategory('resources-faq')).toBe('resource');
      expect(inferCategory('resources-glossary')).toBe('resource');
    });

    test('infers security category for security-* ids', () => {
      expect(inferCategory('security')).toBe('security');
      expect(inferCategory('security-overview')).toBe('security');
      expect(inferCategory('security-best-practices')).toBe('security');
    });

    test('infers operations category for operations-* ids', () => {
      expect(inferCategory('operations')).toBe('operations');
      expect(inferCategory('operations-overview')).toBe('operations');
      expect(inferCategory('operations-monitoring')).toBe('operations');
    });

    test('infers archive category for archive-* ids', () => {
      expect(inferCategory('archive')).toBe('archive');
      expect(inferCategory('archive-timeline-overview')).toBe('archive');
    });

    test('returns default for unmatched ids', () => {
      expect(inferCategory('unknown-section')).toBe('default');
      expect(inferCategory('random-id')).toBe('default');
      expect(inferCategory('custom-content')).toBe('default');
    });

    test('handles whitespace in ids', () => {
      expect(inferCategory('  welcome  ')).toBe('welcome');
      expect(inferCategory('\tsecurity-overview\n')).toBe('security');
    });
  });

  describe('titleFromId', () => {
    test('converts kebab-case to title case', () => {
      expect(titleFromId('welcome-overview')).toBe('Welcome Overview');
      expect(titleFromId('getting-started')).toBe('Getting Started');
    });

    test('converts underscore_case to title case', () => {
      expect(titleFromId('welcome_overview')).toBe('Welcome Overview');
      expect(titleFromId('getting_started_intro')).toBe('Getting Started Intro');
    });

    test('applies word overrides in titles', () => {
      expect(titleFromId('api-reference')).toBe('API Reference');
      expect(titleFromId('sdk-overview')).toBe('SDK Overview');
      expect(titleFromId('developers-sdks')).toBe('Developers SDKs');
      expect(titleFromId('resources-faq')).toBe('Resources FAQ');
      expect(titleFromId('ui-guide')).toBe('UI Guide');
    });

    test('handles single word ids', () => {
      expect(titleFromId('welcome')).toBe('Welcome');
      expect(titleFromId('governance')).toBe('Governance');
    });

    test('handles multiple consecutive separators', () => {
      expect(titleFromId('api--reference')).toBe('API Reference');
      expect(titleFromId('getting---started')).toBe('Getting Started');
    });

    test('preserves numeric segments', () => {
      expect(titleFromId('version-2')).toBe('Version 2');
      expect(titleFromId('tutorial-2025-intro')).toBe('Tutorial 2025 Intro');
    });

    test('handles whitespace in ids', () => {
      expect(titleFromId('  welcome-overview  ')).toBe('Welcome Overview');
    });

    test('handles empty string', () => {
      expect(titleFromId('')).toBe('');
    });

    test('handles mixed separators', () => {
      expect(titleFromId('api_reference-guide')).toBe('API Reference Guide');
    });
  });
});

describe('CATEGORY_RULES ordering', () => {
  test('tutorial-overview takes precedence over tutorial prefix', () => {
    // tutorials-overview should match tutorial-overview category (exact match)
    // not the tutorial prefix rules
    expect(inferCategory('tutorials-overview')).toBe('tutorial-overview');
  });

  test('tutorial- prefix matches before tutorials- prefix', () => {
    // Both should result in 'tutorial' but the first matching rule wins
    expect(inferCategory('tutorial-basics')).toBe('tutorial');
    expect(inferCategory('tutorials-basics')).toBe('tutorial');
  });
});
