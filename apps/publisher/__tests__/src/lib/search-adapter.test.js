/**
 * Tests for the runtime search adapter (lib/search.js) — paging, ranking, graph,
 * and fallback. Runs in the 'node' test env where `document`/`fetch` resolve to
 * no usable static index, so these exercise the legacy in-browser fallback path,
 * which shares the same vendored ranking engine as the static path.
 */

import {
  searchContentPage,
  searchContent,
  buildCommunityGraph,
  filterSections,
  resetSearchState
} from '../../../src/lib/search.js';

// Module-less sections so the fallback indexes title/summary/group without
// importing any section modules (none exist in the test env).
const MANIFEST = [
  { id: 'welcome', title: 'Welcome', summary: 'Landing hub for tenants', group: 'Intro' },
  {
    id: 'guides',
    title: 'Guides',
    subsections: [
      { id: 'developers', title: 'Developers', summary: 'SDKs and APIs for engineers', group: 'Build' },
      { id: 'security', title: 'Security', summary: 'Risk posture and controls', group: 'Govern' }
    ]
  }
];

describe('lib/search.js runtime adapter', () => {
  beforeEach(() => resetSearchState());

  describe('searchContentPage', () => {
    test('ranks matches and maps records back to Pagenary sections', async () => {
      const page = await searchContentPage(MANIFEST, 'api', { limit: 10 });
      expect(page.source).toBe('legacy');
      expect(page.total).toBe(1);
      expect(page.items[0].id).toBe('developers');
      expect(page.items[0].searchRank).toBeGreaterThan(0);
      // Mapped back to the full flattened section (summary preserved; `group`
      // reflects the nav hierarchy label assigned by flattenManifest).
      expect(page.items[0].summary).toBe('SDKs and APIs for engineers');
      expect(page.items[0].group).toBe('Guides');
      expect(page.complete).toBe(true);
    });

    test('paginates results for infinite scroll', async () => {
      const first = await searchContentPage(MANIFEST, '', { offset: 0, limit: 2 });
      expect(first.total).toBe(3);
      expect(first.items).toHaveLength(2);
      expect(first.complete).toBe(false);

      const second = await searchContentPage(MANIFEST, '', { offset: 2, limit: 2 });
      expect(second.items).toHaveLength(1);
      expect(second.complete).toBe(true);

      const firstIds = first.items.map((s) => s.id);
      const secondIds = second.items.map((s) => s.id);
      expect(new Set([...firstIds, ...secondIds]).size).toBe(3); // no overlap, full coverage
    });

    test('no-match query yields an empty, complete page', async () => {
      const page = await searchContentPage(MANIFEST, 'zzz-nonexistent', { limit: 10 });
      expect(page.items).toHaveLength(0);
      expect(page.total).toBe(0);
      expect(page.complete).toBe(true);
    });
  });

  describe('searchContent (first page, back-compatible array)', () => {
    test('returns ranked section objects for a query', async () => {
      const results = await searchContent(MANIFEST, 'security');
      expect(Array.isArray(results)).toBe(true);
      expect(results[0].id).toBe('security');
    });

    test('returns all sections for an empty query', async () => {
      const results = await searchContent(MANIFEST, '');
      expect(results.map((s) => s.id).sort()).toEqual(['developers', 'security', 'welcome']);
    });
  });

  describe('buildCommunityGraph (graph capability)', () => {
    test('produces a graph with one node per navigable section', () => {
      const graph = buildCommunityGraph(MANIFEST);
      expect(graph.nodes.length).toBe(3);
      expect(Array.isArray(graph.edges)).toBe(true);
      expect(Array.isArray(graph.communities)).toBe(true);
    });
  });

  describe('filterSections still works (synchronous)', () => {
    test('matches title/summary substrings', () => {
      expect(filterSections(MANIFEST, 'risk').map((s) => s.id)).toEqual(['security']);
    });
  });
});
