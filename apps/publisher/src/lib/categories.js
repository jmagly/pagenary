/**
 * Category inference and title formatting utilities.
 * Pure functions - no DOM dependencies.
 */

export const WORD_OVERRIDES = {
  api: 'API',
  apis: 'APIs',
  faq: 'FAQ',
  rpc: 'RPC',
  sdk: 'SDK',
  sdks: 'SDKs',
  ui: 'UI'
};

export const CATEGORY_RULES = [
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

export function formatWord(word) {
  if (!word) return '';
  if (WORD_OVERRIDES[word]) return WORD_OVERRIDES[word];
  if (/^\d+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function normalizeId(id) {
  return id.trim();
}

export function inferCategory(id) {
  const normalized = normalizeId(id);
  const match = CATEGORY_RULES.find((rule) => rule.test(normalized));
  return match ? match.category : 'default';
}

export function titleFromId(id) {
  const normalized = normalizeId(id).replace(/_/g, '-');
  const words = normalized.split('-').filter(Boolean).map((word) => formatWord(word));
  return words.join(' ');
}
