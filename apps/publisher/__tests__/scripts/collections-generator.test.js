/**
 * Tests for collection support (#18): front-matter parsing + index.json/feed.xml
 * generation. Exercises the ACTUAL source.
 */

import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseFrontmatter, estimateReadingTime, firstHeading } from '../../scripts/lib/frontmatter.js';
import { generateCollections } from '../../scripts/lib/collections-generator.js';

describe('parseFrontmatter', () => {
  test('parses a fenced block and returns the body', () => {
    const { data, body } = parseFrontmatter('---\ntitle: Hello\ndate: 2026-05-20\n---\n# Hi\n\nBody.');
    expect(data.title).toBe('Hello');
    expect(data.date).toBe('2026-05-20'); // dates stay strings (not coerced to number)
    expect(body.trim()).toBe('# Hi\n\nBody.');
  });

  test('coerces booleans, numbers, and inline lists; strips quotes', () => {
    const { data } = parseFrontmatter('---\ndraft: false\nweight: 3\ntags: [a, "b c"]\nsummary: "Quoted"\n---\nx');
    expect(data.draft).toBe(false);
    expect(data.weight).toBe(3);
    expect(data.tags).toEqual(['a', 'b c']);
    expect(data.summary).toBe('Quoted');
  });

  test('no front matter → empty data, full body', () => {
    const { data, body } = parseFrontmatter('# Just content');
    expect(data).toEqual({});
    expect(body).toBe('# Just content');
  });

  test('reading time and first heading helpers', () => {
    expect(estimateReadingTime('one two three')).toBe(1);
    expect(estimateReadingTime(Array(450).fill('word').join(' '))).toBe(2);
    expect(firstHeading('intro\n# The Title\nmore')).toBe('The Title');
    expect(firstHeading('no heading here')).toBeNull();
  });
});

describe('generateCollections (#18)', () => {
  let content, dist;

  beforeEach(async () => {
    const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-coll-'));
    content = path.join(base, 'content');
    dist = path.join(base, 'dist');
    await fsp.mkdir(path.join(content, 'blog'), { recursive: true });
    await fsp.mkdir(dist, { recursive: true });
    await fsp.writeFile(path.join(content, 'blog', 'newer.md'),
      '---\ntitle: Newer Post\ndate: 2026-05-25\nsummary: The newer one\nhero: /img/n.png\n---\n# Newer\n\nBody words here.');
    await fsp.writeFile(path.join(content, 'blog', 'older.md'),
      '---\ntitle: Older Post\ndate: 2026-05-01\nsummary: The older one\n---\n# Older\n\nText.');
    await fsp.writeFile(path.join(content, 'blog', '_draft.md'), '---\ntitle: Skip me\n---\nx'); // underscore → skipped
  });

  afterEach(async () => {
    await fsp.rm(path.dirname(content), { recursive: true, force: true });
  });

  const config = {
    title: 'AIWG Docs',
    domain: 'docs.aiwg.io',
    collections: [{ path: 'blog', route: '/blog', title: 'Blog', manifest: true, feed: true }]
  };

  test('emits index.json with posts sorted newest-first, skipping _ files', async () => {
    await generateCollections(dist, config, content);
    const manifest = JSON.parse(await fsp.readFile(path.join(dist, 'blog', 'index.json'), 'utf8'));
    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.source).toEqual({
      id: 'blog',
      title: 'Blog',
      url: 'https://docs.aiwg.io/blog',
      baseUrl: 'https://docs.aiwg.io/blog'
    });
    expect(manifest.count).toBe(2); // _draft.md skipped
    expect(manifest.posts.map((p) => p.slug)).toEqual(['newer', 'older']); // date desc
    const newer = manifest.posts[0];
    expect(newer.title).toBe('Newer Post');
    expect(newer.summary).toBe('The newer one');
    expect(newer.hero).toBe('/img/n.png');
    expect(newer.path).toBe('/#blog/newer');
    expect(newer.url).toBe('https://docs.aiwg.io/pages/blog--newer.html');
    expect(newer.canonical).toBe('https://docs.aiwg.io/pages/blog--newer.html'); // absolute via domain + static-page scheme
    expect(newer.source).toEqual(manifest.source);
    expect(newer.docbase).toEqual(manifest.source);
    expect(newer.reading_time).toBeGreaterThanOrEqual(1);
  });

  test('default collection paths use router-resolvable hash routes', async () => {
    const cfg = { ...config, collections: [{ path: 'blog', title: 'Blog', manifest: true }] };
    await generateCollections(dist, cfg, content);
    const manifest = JSON.parse(await fsp.readFile(path.join(dist, 'blog', 'index.json'), 'utf8'));
    expect(manifest.posts[0].path).toBe('/#blog/newer');
    expect(manifest.posts[0].path).not.toContain('/#/');
  });

  test('emits a valid RSS feed.xml with items', async () => {
    await generateCollections(dist, config, content);
    const xml = await fsp.readFile(path.join(dist, 'blog', 'feed.xml'), 'utf8');
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<title>Blog</title>');
    expect(xml).toContain('<link>https://docs.aiwg.io/pages/blog--newer.html</link>');
    expect((xml.match(/<item>/g) || []).length).toBe(2);
  });

  test('missing collection folder warns and does not throw', async () => {
    const cfg = { ...config, collections: [{ path: 'nope', route: '/nope', manifest: true }] };
    await expect(generateCollections(dist, cfg, content)).resolves.toBeUndefined();
    await expect(fsp.access(path.join(dist, 'nope', 'index.json'))).rejects.toBeDefined();
  });

  test('no collections config → no-op', async () => {
    await expect(generateCollections(dist, { title: 'x' }, content)).resolves.toBeUndefined();
  });
});
