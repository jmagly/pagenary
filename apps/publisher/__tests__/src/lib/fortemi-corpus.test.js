/**
 * Tests for lib/fortemi-corpus.js — the shared, deterministic corpus builder.
 * Validates output against the REAL vendored @fortemi/core validators.
 */

import {
  buildFortemiIndexExport,
  chunkFortemiIndex,
  stripHtml,
  normalizeFacetValue,
  recordToSectionId,
  stableHash,
  DEFAULT_PART_SIZE
} from '../../../src/lib/fortemi-corpus.js';
import {
  validateAiwgFortemiIndexExport,
  validateAiwgFortemiChunkManifest,
  validateAiwgFortemiChunkPart
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
      }
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
});
