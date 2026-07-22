/**
 * Tests for lib/fortemi-corpus.js — the shared, deterministic corpus builder.
 * Validates output against the REAL vendored @fortemi/core validators.
 */

import {
  buildFortemiIndexExport,
  buildFortemiMetadataExport,
  chunkFortemiIndex,
  fortemiRecordToPageMetadata,
  stripHtml,
  normalizeFacetValue,
  recordToSectionId,
  stableHash,
  extractConcepts,
  addConceptRelationships,
  DEFAULT_PART_SIZE
} from '../../../src/lib/fortemi-corpus.js';
import {
  validateAiwgFortemiIndexExport,
  validateAiwgFortemiChunkManifest,
  validateAiwgFortemiChunkPart,
  aiwgFortemiIndexToCommunityGraph,
  createAiwgIndexController,
  filterAiwgRecordsByPrivacy,
  queryAiwgFortemiIndex,
  resolveAiwgFetchUrl
} from '../../../src/vendor/fortemi-aiwg-index.js';

const SECTIONS = [
  { id: 'welcome', title: 'Welcome', summary: 'Landing hub', group: 'Intro' },
  { id: 'developers', title: 'Developers', summary: 'SDKs and APIs', group: 'Build', type: 'guide' },
  { id: 'security', title: 'Security', summary: 'Risk posture', group: 'Govern' }
];
const entries = (sections = SECTIONS) =>
  sections.map((section) => ({ section, text: `${section.title} ${section.summary}` }));

describe('fortemi-corpus', () => {
  describe('stableHash', () => {
    test('is deterministic and content-sensitive', () => {
      expect(stableHash('abc')).toBe(stableHash('abc'));
      expect(stableHash('abc')).not.toBe(stableHash('abd'));
      expect(stableHash('')).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('stripHtml', () => {
    test('removes tags, scripts, and decodes entities', () => {
      expect(stripHtml('<h1>Hi</h1><script>evil()</script><p>a &amp; b</p>')).toBe('Hi a & b');
    });
    test('collapses whitespace and handles empty input', () => {
      expect(stripHtml('<p>  one\n\n two </p>')).toBe('one two');
      expect(stripHtml('')).toBe('');
    });
  });

  describe('normalizeFacetValue', () => {
    test('slugifies and falls back to general', () => {
      expect(normalizeFacetValue('Getting Started!')).toBe('getting-started');
      expect(normalizeFacetValue('   ')).toBe('general');
    });
  });

  describe('buildFortemiIndexExport', () => {
    test('produces an index that passes the real validator', () => {
      const { index } = buildFortemiIndexExport(entries());
      const result = validateAiwgFortemiIndexExport(index);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.counts['docs.page']).toBe(3);
    });

    test('emits the canonical v2 envelope and graph source', () => {
      const { index } = buildFortemiIndexExport(entries(), { repo: 'fixture' });
      expect(index.schema_version).toBe('aiwg.fortemi.index.export.v2');
      expect(index.source.graph).toBe('fixture:docs-map');
      expect(index.compatibility).toEqual({
        previous_schema_version: 'aiwg.fortemi.index.export.v1',
        strategy: 'supported'
      });
      expect(index.items.every((item) => item.schema_version === 'aiwg.fortemi.index.record.v2')).toBe(true);
    });

    test('validator is total and prototype-safe on hostile input', () => {
      expect(() => validateAiwgFortemiIndexExport(null)).not.toThrow();
      expect(validateAiwgFortemiIndexExport(null)).toMatchObject({ valid: false });
      const { index } = buildFortemiIndexExport(entries([SECTIONS[0]]));
      index.items[0].type = '__proto__';
      const result = validateAiwgFortemiIndexExport(index);
      expect(result.valid).toBe(true);
      expect(Object.getPrototypeOf(result.counts)).toBeNull();
      expect(result.counts.__proto__).toBe(1);
      expect({}.polluted).toBeUndefined();
    });

    test('v2 search projection can supply title and text fallbacks', () => {
      const { index } = buildFortemiIndexExport(entries([SECTIONS[0]]));
      const record = index.items[0];
      delete record.title;
      delete record.text;
      record.search = { title: 'Projected title', summary: 'Projected summary' };
      expect(validateAiwgFortemiIndexExport(index)).toMatchObject({ valid: true, errors: [] });
    });

    test('fetch URL resolution rejects hostile schemes and origins', () => {
      const base = 'https://docs.example.test/search-index/';
      expect(() => resolveAiwgFetchUrl('javascript:alert(1)', base)).toThrow(/disallowed scheme/);
      expect(() => resolveAiwgFetchUrl('https://evil.example.test/part.json', base)).toThrow(/cross-origin/);
      expect(resolveAiwgFetchUrl('part-0000.json', base)).toBe(
        'https://docs.example.test/search-index/part-0000.json'
      );
    });

    test('privacy filtering fails closed', () => {
      const { index } = buildFortemiIndexExport(entries());
      index.items[0].privacy = { classification: 'private', pii: false };
      index.items[1].privacy = { classification: 'public', pii: true };
      expect(filterAiwgRecordsByPrivacy(index.items).map((item) => item.id)).toEqual([
        index.items[2].id
      ]);
    });

    test('aiwg-discovery ranking tolerates a one-edit query', () => {
      const { index } = buildFortemiIndexExport(entries([
        { id: 'authentication', title: 'Authentication', summary: 'Secure access', group: 'Security' }
      ]));
      const result = queryAiwgFortemiIndex(index, 'authentcation', {
        searchProfile: 'aiwg-discovery',
        rank: true
      });
      expect(result.items.map((item) => item.id)).toEqual(['docs:page:authentication']);
    });

    test('sorts records by id (validator requires it)', () => {
      const { index } = buildFortemiIndexExport(entries());
      const ids = index.items.map((item) => item.id);
      expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
    });

    test('is deterministic: identical input -> identical output incl generated_at', () => {
      const a = buildFortemiIndexExport(entries());
      const b = buildFortemiIndexExport(entries());
      expect(JSON.stringify(a.index)).toBe(JSON.stringify(b.index));
      expect(a.buildHash).toBe(b.buildHash);
      expect(a.generatedAt).toBe(b.generatedAt);
    });

    test('build hash changes when content changes', () => {
      const a = buildFortemiIndexExport(entries());
      const changed = SECTIONS.map((s) => (s.id === 'security' ? { ...s, summary: 'Edited' } : s));
      const b = buildFortemiIndexExport(entries(changed));
      expect(a.buildHash).not.toBe(b.buildHash);
    });

    test('de-duplicates by section id (first wins)', () => {
      const dup = [...SECTIONS, { id: 'welcome', title: 'Dup', summary: 'dupe' }];
      const { index } = buildFortemiIndexExport(entries(dup));
      const welcomeRecords = index.items.filter((item) => item.id === 'docs:page:welcome');
      expect(welcomeRecords).toHaveLength(1);
      expect(welcomeRecords[0].title).toBe('Welcome');
    });

    test('records carry recoverable section ids', () => {
      const { index } = buildFortemiIndexExport(entries());
      for (const item of index.items) {
        expect(SECTIONS.map((s) => s.id)).toContain(recordToSectionId(item));
        expect(item.source.locator).toBe(`#${recordToSectionId(item)}`);
        expect(item.source.locator).not.toContain('#/');
      }
    });

    test('projects compact page metadata without duplicating record text', () => {
      const { index } = buildFortemiIndexExport(entries());
      const developers = index.items.find((item) => item.id === 'docs:page:developers');
      developers.delivery_assets = [
        { type: 'js_module', label: 'js module', path: 'sections/developers.js' },
        { type: 'static_html', label: 'static html', url: '/pages/developers.html' }
      ];
      developers.skos_concepts = [{ id: 'c:api', prefLabel: 'API', definition: 'Application interface' }];
      developers.skos_relations = [{ source_id: 'c:api', type: 'related', target_id: 'c:sdk' }];
      developers.provenance_events = [{ activity: 'built', agent: 'pagenary', attributes: { source: 'test' } }];

      const metadata = fortemiRecordToPageMetadata(developers);
      expect(metadata.section_id).toBe('developers');
      expect(metadata.record_id).toBe('docs:page:developers');
      expect(metadata.source.path).toBe('developers.md');
      expect(metadata.delivery_assets).toEqual([
        { type: 'js_module', label: 'js module', path: 'sections/developers.js' },
        { type: 'static_html', label: 'static html', url: '/pages/developers.html' }
      ]);
      expect(metadata.facets.group).toEqual(['build']);
      expect(metadata.tags).toEqual(['guide']);
      expect(metadata.provenance[0].confidence).toBe('source');
      expect(metadata.skos_concepts[0].prefLabel).toBe('API');
      expect(metadata.skos_relations[0].target_id).toBe('c:sdk');
      expect(metadata.provenance_events[0].activity).toBe('built');
      expect(metadata.text).toBeUndefined();
    });

    test('adds Fortemi rich metadata fields to generated records', () => {
      const { index } = buildFortemiIndexExport(entries());
      const developers = index.items.find((item) => item.id === 'docs:page:developers');
      expect(developers.skos_concepts).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'concept:build', prefLabel: 'Build', notation: 'build' }),
        expect.objectContaining({ id: 'concept:guide', prefLabel: 'Guide', notation: 'guide' })
      ]));
      expect(developers.skos_relations).toEqual([]);
      expect(developers.provenance_events).toEqual([
        expect.objectContaining({
          activity: 'built',
          agent: 'pagenary',
          confidence: 'source',
          privacy: 'public',
          attributes: expect.objectContaining({
            record_id: 'docs:page:developers',
            section_id: 'developers'
          })
        })
      ]);
    });

    test('builds a page-addressable metadata export', () => {
      const { index } = buildFortemiIndexExport(entries());
      const metadata = buildFortemiMetadataExport(index);
      expect(metadata.schema_version).toBe('pagenary.fortemi.metadata.v1');
      expect(metadata.source.repo).toBe('pagenary');
      expect(metadata.pages.map((page) => page.section_id)).toEqual(['developers', 'security', 'welcome']);
      expect(metadata.pages.find((page) => page.section_id === 'welcome').text).toBeUndefined();
    });
  });

  describe('chunkFortemiIndex', () => {
    test('emits a manifest+parts that pass the real validators', () => {
      const { index } = buildFortemiIndexExport(entries());
      const { manifest, parts } = chunkFortemiIndex(index, { partSize: 2 });
      expect(validateAiwgFortemiChunkManifest(manifest).valid).toBe(true);
      expect(manifest.total).toBe(3);
      expect(parts.length).toBe(2); // 2 + 1
      parts.forEach((part, i) => {
        expect(validateAiwgFortemiChunkPart(part, manifest.parts[i], manifest).valid).toBe(true);
      });
    });

    test('loads v2 chunks with source.graph through the real controller', async () => {
      const { index } = buildFortemiIndexExport(entries(), { repo: 'fixture' });
      const { manifest, parts } = chunkFortemiIndex(index, { partSize: 2 });
      expect(manifest.source_export_schema_version).toBe('aiwg.fortemi.index.export.v2');
      expect(manifest.source.graph).toBe('fixture:docs-map');
      const controller = createAiwgIndexController();
      controller.loadChunkedIndex(manifest, async (partRef) => parts.find(
        (part) => part.offset === partRef.offset
      ));
      const result = await controller.queryChunked('security', {
        searchProfile: 'aiwg-discovery',
        rank: true
      });
      expect(result.items.map((item) => item.id)).toContain('docs:page:security');
    });

    test('part offsets are contiguous from 0 and counts sum to total', () => {
      const { index } = buildFortemiIndexExport(entries());
      const { manifest } = chunkFortemiIndex(index, { partSize: 2 });
      let expected = 0;
      for (const part of manifest.parts) {
        expect(part.offset).toBe(expected);
        expected += part.count;
      }
      expect(expected).toBe(manifest.total);
    });

    test('handles an empty corpus with a single empty part', () => {
      const { index } = buildFortemiIndexExport([]);
      const { manifest, parts } = chunkFortemiIndex(index, { partSize: DEFAULT_PART_SIZE });
      expect(manifest.total).toBe(0);
      expect(parts).toHaveLength(1);
      expect(validateAiwgFortemiChunkManifest(manifest).valid).toBe(true);
    });
  });

  describe('extractConcepts (defined procedure)', () => {
    test('ranks salient terms, drops stopwords and short tokens', () => {
      const text = 'Authentication authorizes requests. Authentication uses API keys. '
        + 'The errors shape is shared. With this and that, you should keep it.';
      const concepts = extractConcepts(text, { max: 4 });
      expect(concepts).toContain('authentication'); // most frequent
      expect(concepts).not.toContain('the');         // stopword
      expect(concepts).not.toContain('and');          // stopword
      expect(concepts.every((c) => c.length >= 4)).toBe(true);
    });

    test('is deterministic and capped, output sorted', () => {
      const text = 'webhooks events retries webhooks events webhooks rate limits errors';
      const a = extractConcepts(text, { max: 3 });
      const b = extractConcepts(text, { max: 3 });
      expect(a).toEqual(b);
      expect(a.length).toBeLessThanOrEqual(3);
      expect([...a]).toEqual([...a].sort()); // returned sorted
    });

    test('empty / whitespace text yields no concepts', () => {
      expect(extractConcepts('')).toEqual([]);
      expect(extractConcepts('   ')).toEqual([]);
      expect(extractConcepts(null)).toEqual([]);
    });
  });

  describe('addConceptRelationships', () => {
    test('relates records that share concepts, capped per record', () => {
      const items = [
        { id: 'a', relationships: [] },
        { id: 'b', relationships: [] },
        { id: 'c', relationships: [] },
        { id: 'd', relationships: [] }
      ];
      const concepts = [
        ['auth', 'errors'],   // a
        ['auth', 'keys'],     // b shares auth with a
        ['errors', 'rate'],   // c shares errors with a
        ['unrelated']         // d shares nothing
      ];
      addConceptRelationships(items, concepts, { maxRelations: 2 });
      const targets = (id) => items.find((i) => i.id === id).relationships.map((r) => r.target_id);
      expect(targets('a')).toEqual(expect.arrayContaining(['b', 'c']));
      expect(targets('d')).toEqual([]); // no shared concepts
      items.forEach((i) => expect(i.relationships.length).toBeLessThanOrEqual(2));
      items.forEach((i) => i.relationships.forEach((r) => expect(r.type).toBe('related')));
      items.forEach((i) => i.relationships.forEach((r) => {
        expect(r.label).toMatch(/^Shares \d+ concept/);
        expect(r.confidence).toBeGreaterThan(0);
        expect(r.privacy).toBe('public');
        expect(Array.isArray(r.metadata.shared_concepts)).toBe(true);
      }));
    });
  });

  describe('buildFortemiIndexExport with concept options', () => {
    const rich = [
      { section: { id: 'auth', title: 'Authentication', group: 'Concepts' },
        text: 'Authentication authorizes requests using keys. Failures return errors.' },
      { section: { id: 'keys', title: 'API Keys', group: 'Guides' },
        text: 'API keys authorize requests. Keep keys under rate limits. Authentication uses keys.' },
      { section: { id: 'errors', title: 'Errors', group: 'Guides' },
        text: 'Errors share one shape. Authentication failures and rate limit errors included.' }
    ];

    test('default build adds no relationships and is still valid', () => {
      const { index } = buildFortemiIndexExport(rich);
      expect(validateAiwgFortemiIndexExport(index).valid).toBe(true);
      index.items.forEach((it) => expect(it.relationships).toEqual([]));
    });

    test('extractConcepts merges content concepts into records', () => {
      const { index } = buildFortemiIndexExport(rich, { extractConcepts: true });
      expect(validateAiwgFortemiIndexExport(index).valid).toBe(true);
      const auth = index.items.find((i) => i.id === 'docs:page:auth');
      expect(auth.concepts).toContain('authentication');
      // structural concepts still present
      expect(auth.concepts).toContain('concepts');
    });

    test('relateByConcept yields a connected community graph with edges', () => {
      const { index } = buildFortemiIndexExport(rich, {
        extractConcepts: true,
        relateByConcept: true
      });
      expect(validateAiwgFortemiIndexExport(index).valid).toBe(true);
      const graph = aiwgFortemiIndexToCommunityGraph(index, { communityFacet: 'group' });
      const auth = index.items.find((i) => i.id === 'docs:page:auth');
      expect(auth.relationships[0]).toEqual(expect.objectContaining({
        label: expect.stringMatching(/^Shares \d+ concept/),
        confidence: expect.any(Number),
        metadata: expect.objectContaining({
          shared_concepts: expect.any(Array)
        })
      }));
      expect(graph.nodes.length).toBe(3);
      expect(graph.edges.length).toBeGreaterThan(0);   // concept-derived edges
      expect(graph.communities.length).toBe(2);        // Concepts + Guides
    });
  });
});
