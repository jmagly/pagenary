/**
 * Tests for scripts/lib/seo-generator.js
 * Covers the SEO learnings from issues #15 (absolute base URL via domain
 * fallback), #16 (og:image), and #17 (self-canonical static snapshots).
 * Exercises the ACTUAL source — no logic duplication.
 */

import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  resolveBaseUrl,
  resolveOgImage,
  buildPageJsonLd,
  buildStaticPage,
  generateSitemap
} from '../../scripts/lib/seo-generator.js';

describe('resolveBaseUrl (#15)', () => {
  test('seo.siteUrl takes precedence over domain', () => {
    expect(resolveBaseUrl({ seo: { siteUrl: 'https://a.example' }, domain: 'b.example' }))
      .toBe('https://a.example');
  });

  test('falls back to domain, adding https://', () => {
    expect(resolveBaseUrl({ domain: 'docs.pagenary.com' })).toBe('https://docs.pagenary.com');
  });

  test('preserves an explicit scheme on domain', () => {
    expect(resolveBaseUrl({ domain: 'http://internal.local' })).toBe('http://internal.local');
  });

  test('strips trailing slash', () => {
    expect(resolveBaseUrl({ seo: { siteUrl: 'https://a.example/' } })).toBe('https://a.example');
  });

  test('returns empty string when neither siteUrl nor domain is set', () => {
    expect(resolveBaseUrl({})).toBe('');
    expect(resolveBaseUrl({ seo: {} })).toBe('');
  });
});

describe('resolveOgImage (#16)', () => {
  const base = 'https://docs.pagenary.com';

  test('absolute image URL passes through', () => {
    expect(resolveOgImage({ seo: { ogImage: 'https://cdn.example/x.png' } }, base))
      .toBe('https://cdn.example/x.png');
  });

  test('site-relative path is joined to the base URL', () => {
    expect(resolveOgImage({ seo: { ogImage: '/og.png' } }, base)).toBe('https://docs.pagenary.com/og.png');
    expect(resolveOgImage({ seo: { ogImage: 'og.png' } }, base)).toBe('https://docs.pagenary.com/og.png');
  });

  test('returns empty string when no image configured', () => {
    expect(resolveOgImage({}, base)).toBe('');
  });
});

describe('buildPageJsonLd (#17)', () => {
  test('canonical/url points at the static snapshot, not a #hash', () => {
    const json = buildPageJsonLd(
      { id: 'guides/quickstart', title: 'Quickstart', summary: 's', parent: 'Guides' },
      { seo: { siteUrl: 'https://docs.pagenary.com' }, title: 'Pagenary' }
    );
    expect(json).toContain('https://docs.pagenary.com/pages/guides--quickstart.html');
    expect(json).not.toContain('/#guides/quickstart');
  });
});

describe('buildStaticPage (#17 + #16)', () => {
  const baseOpts = {
    sectionId: 'welcome',
    sectionTitle: 'Welcome',
    sectionSummary: 'What Pagenary is',
    sectionParent: null,
    contentHtml: '<p>hi</p>',
    siteTitle: 'Pagenary Docs',
    baseUrl: 'https://docs.pagenary.com',
    config: { seo: { siteUrl: 'https://docs.pagenary.com' }, title: 'Pagenary Docs' }
  };

  test('canonical and og:url are the crawlable static URL (#17)', () => {
    const html = buildStaticPage(baseOpts);
    expect(html).toContain('<link rel="canonical" href="https://docs.pagenary.com/pages/welcome.html" />');
    expect(html).toContain('<meta property="og:url" content="https://docs.pagenary.com/pages/welcome.html" />');
  });

  test('SPA hash route is still used for the human-facing redirect/links', () => {
    const html = buildStaticPage(baseOpts);
    expect(html).toContain("window.location.replace('https://docs.pagenary.com/#welcome')");
    expect(html).toContain('href="https://docs.pagenary.com/#welcome"'); // "interactive version"
  });

  test('og:image + twitter:image emitted and card upgraded when image present (#16)', () => {
    const html = buildStaticPage({ ...baseOpts, ogImage: 'https://docs.pagenary.com/og.png' });
    expect(html).toContain('<meta property="og:image" content="https://docs.pagenary.com/og.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://docs.pagenary.com/og.png" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  test('no image tags and summary card when no image (#16)', () => {
    const html = buildStaticPage(baseOpts);
    expect(html).not.toContain('og:image');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
  });
});

describe('generateSitemap (#15)', () => {
  test('emits absolute <loc> when only domain is set (no seo.siteUrl)', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-seo-'));
    try {
      const manifest = [{ id: 'welcome', title: 'Welcome', summary: 's', module: 'sections/welcome.js' }];
      await generateSitemap(dir, manifest, { domain: 'docs.pagenary.com' });
      const xml = await fsp.readFile(path.join(dir, 'sitemap.xml'), 'utf8');
      expect(xml).toContain('<loc>https://docs.pagenary.com/</loc>');
      expect(xml).toContain('<loc>https://docs.pagenary.com/pages/welcome.html</loc>');
      expect(xml).not.toContain('<loc>/</loc>');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
});
