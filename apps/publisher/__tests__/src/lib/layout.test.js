/**
 * Tests for lib/layout.js (#90, ADR-016)
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  LAYOUTS,
  DEFAULT_LAYOUT,
  normalizeLayout,
  resolveLayout,
  buildSectionLayoutMap
} from '../../../src/lib/layout.js';

describe('lib/layout.js', () => {
  describe('constants', () => {
    test('LAYOUTS is the closed shell set', () => {
      expect(LAYOUTS.has('docs')).toBe(true);
      expect(LAYOUTS.has('blog')).toBe(true);
      expect(LAYOUTS.has('landing')).toBe(false);
    });

    test('DEFAULT_LAYOUT is docs', () => {
      expect(DEFAULT_LAYOUT).toBe('docs');
    });
  });

  describe('normalizeLayout', () => {
    test('returns known shells lowercased + trimmed', () => {
      expect(normalizeLayout('docs')).toBe('docs');
      expect(normalizeLayout('BLOG')).toBe('blog');
      expect(normalizeLayout('  Blog  ')).toBe('blog');
    });

    test('returns null for unknown / malformed values', () => {
      expect(normalizeLayout('landing')).toBeNull();
      expect(normalizeLayout('')).toBeNull();
      expect(normalizeLayout(undefined)).toBeNull();
      expect(normalizeLayout(null)).toBeNull();
      expect(normalizeLayout(42)).toBeNull();
      expect(normalizeLayout({})).toBeNull();
    });
  });

  describe('resolveLayout precedence (section ?? collection ?? group ?? tenant ?? docs)', () => {
    test('defaults to docs when nothing declared', () => {
      expect(resolveLayout()).toBe('docs');
      expect(resolveLayout({})).toBe('docs');
    });

    test('tenant value used when nothing more specific', () => {
      expect(resolveLayout({ tenant: 'blog' })).toBe('blog');
    });

    test('group overrides tenant', () => {
      expect(resolveLayout({ group: 'blog', tenant: 'docs' })).toBe('blog');
      expect(resolveLayout({ group: 'docs', tenant: 'blog' })).toBe('docs');
    });

    test('collection overrides group', () => {
      expect(resolveLayout({ collection: 'blog', group: 'docs', tenant: 'docs' })).toBe('blog');
    });

    test('section is most specific and wins over all', () => {
      expect(resolveLayout({
        section: 'docs', collection: 'blog', group: 'blog', tenant: 'blog'
      })).toBe('docs');
    });

    test('invalid candidates are skipped, not errors', () => {
      // section is garbage → falls through to collection
      expect(resolveLayout({ section: 'landing', collection: 'blog' })).toBe('blog');
      // everything garbage → default
      expect(resolveLayout({ section: 'x', collection: 'y', group: 'z', tenant: 'w' })).toBe('docs');
    });
  });

  describe('buildSectionLayoutMap', () => {
    test('empty inputs yield empty map', () => {
      expect(buildSectionLayoutMap()).toEqual({});
      expect(buildSectionLayoutMap({ manifest: [], collections: [], tenant: 'blog' })).toEqual({});
    });

    test('leaf inherits tenant default', () => {
      const manifest = [{ id: 'welcome', title: 'Welcome', module: './x.js' }];
      expect(buildSectionLayoutMap({ manifest, tenant: 'docs' })).toEqual({ welcome: 'docs' });
      expect(buildSectionLayoutMap({ manifest, tenant: 'blog' })).toEqual({ welcome: 'blog' });
    });

    test('mixes a docs group and a blog group in one tenant', () => {
      const manifest = [
        {
          id: 'guides', title: 'Guides', layout: 'docs',
          subsections: [
            { id: 'guides-intro', title: 'Intro', module: './a.js' },
            { id: 'guides-setup', title: 'Setup', module: './b.js' }
          ]
        },
        {
          id: 'blog', title: 'Blog', layout: 'blog',
          subsections: [
            { id: 'blog/post-1', title: 'Post 1', module: './c.js' },
            { id: 'blog/post-2', title: 'Post 2', module: './d.js' }
          ]
        }
      ];
      const map = buildSectionLayoutMap({ manifest, tenant: 'docs' });
      expect(map).toEqual({
        'guides-intro': 'docs',
        'guides-setup': 'docs',
        'blog/post-1': 'blog',
        'blog/post-2': 'blog'
      });
    });

    test('section-level layout overrides its group', () => {
      const manifest = [
        {
          id: 'blog', title: 'Blog', layout: 'blog',
          subsections: [
            { id: 'blog/normal', title: 'Normal', module: './a.js' },
            { id: 'blog/special', title: 'Special', module: './b.js', layout: 'docs' }
          ]
        }
      ];
      const map = buildSectionLayoutMap({ manifest, tenant: 'docs' });
      expect(map['blog/normal']).toBe('blog');
      expect(map['blog/special']).toBe('docs');
    });

    test('collection layout applies to posts via attached collection field', () => {
      const manifest = [
        {
          id: 'news', title: 'News',
          subsections: [
            // post entries carry `collection` (a route like "/news") per #55
            { id: 'news/a', title: 'A', module: './a.js', collection: '/news' },
            { id: 'news/b', title: 'B', module: './b.js', collection: '/news' }
          ]
        }
      ];
      const collections = [{ path: 'news', route: '/news', layout: 'blog' }];
      const map = buildSectionLayoutMap({ manifest, collections, tenant: 'docs' });
      expect(map).toEqual({ 'news/a': 'blog', 'news/b': 'blog' });
    });

    test('precedence: section > collection > group > tenant', () => {
      const manifest = [
        {
          id: 'g', title: 'G', layout: 'docs', // group says docs
          subsections: [
            { id: 'g/a', title: 'A', module: './a.js', collection: 'feed' }, // collection wins → blog
            { id: 'g/b', title: 'B', module: './b.js', collection: 'feed', layout: 'docs' } // section wins → docs
          ]
        }
      ];
      const collections = [{ path: 'feed', layout: 'blog' }];
      const map = buildSectionLayoutMap({ manifest, collections, tenant: 'blog' });
      expect(map['g/a']).toBe('blog'); // collection 'blog' beats group 'docs'
      expect(map['g/b']).toBe('docs'); // section 'docs' beats collection 'blog'
    });

    test('group with no declared layout falls through to tenant', () => {
      const manifest = [
        { id: 'g', title: 'G', subsections: [{ id: 'g/a', title: 'A', module: './a.js' }] }
      ];
      expect(buildSectionLayoutMap({ manifest, tenant: 'blog' })).toEqual({ 'g/a': 'blog' });
    });
  });
});
