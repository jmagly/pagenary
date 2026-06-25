/**
 * Tests for the zero-dependency front-matter parser, covering both the original
 * flat subset (must remain byte-identical — it drives blog/collections metadata)
 * and the nested subset added for declarative page blocks (#54): nested maps,
 * block sequences, lists of inline maps, and inline flow maps/lists.
 */

import { parseFrontmatter } from '../../scripts/lib/frontmatter.js';

const wrap = (body) => `---\n${body}\n---\nBody text here.`;

describe('parseFrontmatter — flat subset (backward compatible)', () => {
  test('scalars, booleans, numbers, and quotes', () => {
    const { data, body } = parseFrontmatter(wrap(
      'title: Hello World\nauthor: "Pagenary Team"\ndraft: false\nweight: 3'
    ));
    expect(data).toEqual({ title: 'Hello World', author: 'Pagenary Team', draft: false, weight: 3 });
    expect(body).toBe('Body text here.');
  });

  test('inline list and date-like strings', () => {
    const { data } = parseFrontmatter(wrap('tags: [announcement, layout, "x"]\ndate: 2026-06-10'));
    expect(data.tags).toEqual(['announcement', 'layout', 'x']);
    expect(data.date).toBe('2026-06-10'); // not coerced to a number
  });

  test('empty value with no children is null', () => {
    const { data } = parseFrontmatter(wrap('hero:\ntitle: Plain'));
    // `hero:` has no indented children → null; `title` is a sibling key.
    expect(data.hero).toBeNull();
    expect(data.title).toBe('Plain');
  });

  test('no front matter returns empty data and full body', () => {
    const { data, body } = parseFrontmatter('# Just markdown\n\nNo frontmatter.');
    expect(data).toEqual({});
    expect(body).toBe('# Just markdown\n\nNo frontmatter.');
  });
});

describe('parseFrontmatter — nested subset (#54)', () => {
  test('nested map of scalars', () => {
    const { data } = parseFrontmatter(wrap(
      'hero:\n  title: Big Title\n  fullBleed: true\n  align: center'
    ));
    expect(data.hero).toEqual({ title: 'Big Title', fullBleed: true, align: 'center' });
  });

  test('block sequence of inline maps', () => {
    const { data } = parseFrontmatter(wrap(
      'hero:\n  title: T\n  cta:\n    - { label: "Get started", href: "#go", style: primary }\n    - { label: Docs, href: "#docs", style: ghost }'
    ));
    expect(data.hero.title).toBe('T');
    expect(data.hero.cta).toEqual([
      { label: 'Get started', href: '#go', style: 'primary' },
      { label: 'Docs', href: '#docs', style: 'ghost' }
    ]);
  });

  test('block sequence of scalars', () => {
    const { data } = parseFrontmatter(wrap('list:\n  - one\n  - two\n  - 3'));
    expect(data.list).toEqual(['one', 'two', 3]);
  });

  test('sibling top-level keys after a nested block', () => {
    const { data } = parseFrontmatter(wrap(
      'title: Page\nhero:\n  title: Hero\n  overlay: true\nbanner:\n  title: Band\n  fullBleed: true'
    ));
    expect(data.title).toBe('Page');
    expect(data.hero).toEqual({ title: 'Hero', overlay: true });
    expect(data.banner).toEqual({ title: 'Band', fullBleed: true });
  });

  test('inline flow map value', () => {
    const { data } = parseFrontmatter(wrap('hero: { title: Quick, fullBleed: true }'));
    expect(data.hero).toEqual({ title: 'Quick', fullBleed: true });
  });

  test('commas inside quoted values are not split', () => {
    const { data } = parseFrontmatter(wrap(
      'banner:\n  cta:\n    - { label: "Buy now, save later", href: "#x" }'
    ));
    expect(data.banner.cta).toEqual([{ label: 'Buy now, save later', href: '#x' }]);
  });
});
