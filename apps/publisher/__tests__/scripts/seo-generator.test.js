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
  generateCorpusArtifacts,
  generateLlmsTxt,
  generateSeoArtifacts,
  generateSitemap,
  generateRobotsTxt,
  resolveDiscoverabilityProfile
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

describe('resolveDiscoverabilityProfile (#113, #115)', () => {
  test('keeps standard public-doc defaults', () => {
    const resolved = resolveDiscoverabilityProfile({ seo: { discoverabilityProfile: 'standard' } });
    expect(resolved.seo.generateSitemap).toBe(true);
    expect(resolved.seo.generateStaticPages).toBe(true);
    expect(resolved.seo.generateLlmsTxt).toBe(true);
    expect(resolved.seo.generateCorpusArtifacts).toBe(false);
    expect(resolved.seo.noIndex).toBe(false);
  });

  test('open profile enables machine-readable corpus artifacts', () => {
    const resolved = resolveDiscoverabilityProfile({ seo: { discoverabilityProfile: 'open' } });
    expect(resolved.seo.generateCorpusArtifacts).toBe(true);
    expect(resolved.seo.generateLlmsTxt).toBe(true);
    expect(resolved.seo.aiCrawlers).toEqual({ search: true, aiInput: true, aiTrain: true });
  });

  test('limited profile suppresses advertising artifacts and forces noindex', () => {
    const resolved = resolveDiscoverabilityProfile({ seo: { discoverabilityProfile: 'limited' } });
    expect(resolved.seo.generateSitemap).toBe(false);
    expect(resolved.seo.generateLlmsTxt).toBe(false);
    expect(resolved.seo.generateCorpusArtifacts).toBe(false);
    expect(resolved.seo.noIndex).toBe(true);
    expect(resolved.seo.robots.sitemap).toBe(false);
  });

  test('locked profile disables static snapshots and root fallback by default', () => {
    const resolved = resolveDiscoverabilityProfile({ seo: { discoverabilityProfile: 'locked' } });
    expect(resolved.seo.generateStaticPages).toBe(false);
    expect(resolved.seo.rootHtmlFallback).toBe(false);
    expect(resolved.seo.robots.blockAll).toBe(true);
  });

  test('explicit low-level generation fields override profile artifact defaults', () => {
    const resolved = resolveDiscoverabilityProfile({
      seo: {
        discoverabilityProfile: 'locked',
        generateStaticPages: true,
        rootHtmlFallback: true,
        robots: { sitemap: true }
      }
    });
    expect(resolved.seo.generateStaticPages).toBe(true);
    expect(resolved.seo.rootHtmlFallback).toBe(true);
    expect(resolved.seo.robots.sitemap).toBe(true);
    expect(resolved.seo.noIndex).toBe(true);
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

  test('does not redirect no-JS readers away from the static snapshot', () => {
    const html = buildStaticPage(baseOpts);
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain('<noscript>');
  });

  test('allows no-JS readers to scroll the static snapshot', () => {
    const html = buildStaticPage(baseOpts);
    expect(html).toMatch(/html,\s*body\s*{[\s\S]*height: auto;[\s\S]*overflow: auto;/);
    expect(html).toMatch(/body\s*{[\s\S]*display: block;/);
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

  test('emits noindex metadata when seo.noIndex is set', () => {
    const html = buildStaticPage({
      ...baseOpts,
      config: { seo: { siteUrl: 'https://docs.pagenary.com', noIndex: true }, title: 'Pagenary Docs' }
    });
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
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

describe('generateRobotsTxt (#95)', () => {
  test('preserves default public robots output', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-robots-'));
    try {
      await generateRobotsTxt(dir, { title: 'Docs', domain: 'docs.pagenary.com' });
      const text = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(text).toContain('User-agent: *');
      expect(text).toContain('Allow: /');
      expect(text).toContain('Allow: /pages/');
      expect(text).toContain('Disallow: /sections/');
      expect(text).toContain('Disallow: /lib/');
      expect(text).toContain('Sitemap: https://docs.pagenary.com/sitemap.xml');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('emits restrictive robots without sitemap when seo.noIndex is set', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-robots-'));
    try {
      await generateRobotsTxt(dir, { title: 'Private Docs', seo: { noIndex: true, siteUrl: 'https://private.example' } });
      const text = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(text).toContain('User-agent: *');
      expect(text).toContain('Disallow: /');
      expect(text).not.toContain('Allow: /pages/');
      expect(text).not.toContain('Sitemap:');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('honors custom allow/disallow rules and sitemap toggle', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-robots-'));
    try {
      await generateRobotsTxt(dir, {
        seo: {
          siteUrl: 'https://docs.example',
          robots: {
            allow: ['/public/'],
            disallow: ['/', '/drafts/'],
            sitemap: false
          }
        }
      });
      const text = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(text).toContain('Allow: /public/');
      expect(text).toContain('Disallow: /');
      expect(text).toContain('Disallow: /drafts/');
      expect(text).not.toContain('Sitemap:');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('emits configured AI content-signal controls', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-robots-'));
    try {
      await generateRobotsTxt(dir, {
        title: 'Docs',
        seo: {
          siteUrl: 'https://docs.example',
          aiCrawlers: { search: true, aiInput: false, aiTrain: false }
        }
      });
      const text = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(text).toContain('Content-Signal: search=yes, ai-input=no, ai-train=no');
      expect(text).toContain('Sitemap: https://docs.example/sitemap.xml');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('open profile emits permissive content signals by default', async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-robots-'));
    try {
      await generateRobotsTxt(dir, { title: 'Open Docs', seo: { discoverabilityProfile: 'open' } });
      const text = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(text).toContain('Content-Signal: search=yes, ai-input=yes, ai-train=yes');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('profile artifact matrix (#114, #115, #117)', () => {
  const manifest = [
    { id: 'welcome', title: 'Welcome', summary: 'Default page', module: './sections/welcome.js' },
    {
      id: 'guides',
      title: 'Guides',
      summary: 'Guide group',
      subsections: [
        { id: 'guides/start', title: 'Start', summary: 'Nested page', module: './sections/start.js' }
      ]
    }
  ];

  async function writeSeoFixture() {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-seo-profile-'));
    await fsp.mkdir(path.join(dir, 'sections'), { recursive: true });
    await fsp.writeFile(
      path.join(dir, 'manifest.js'),
      `export const MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`,
      'utf8'
    );
    await fsp.writeFile(path.join(dir, 'sections', 'welcome.js'), 'export default { html: "<h1>Welcome</h1><p>Default body text.</p>" };\n', 'utf8');
    await fsp.writeFile(path.join(dir, 'sections', 'start.js'), 'export default { html: "<h1>Start</h1><p>Nested body text.</p>" };\n', 'utf8');
    return dir;
  }

  test('open profile emits parseable site-wide and per-page corpus artifacts', async () => {
    const dir = await writeSeoFixture();
    try {
      await generateSeoArtifacts(dir, {
        title: 'Open Docs',
        domain: 'docs.example',
        seo: { discoverabilityProfile: 'open' }
      });
      const index = JSON.parse(await fsp.readFile(path.join(dir, 'content-index.json'), 'utf8'));
      expect(index.pages).toHaveLength(2);
      expect(index.pages[0].canonicalUrl).toBe('https://docs.example/pages/welcome.html');

      const jsonl = (await fsp.readFile(path.join(dir, 'documents.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
      expect(jsonl.map((doc) => doc.id)).toEqual(['welcome', 'guides/start']);
      expect(jsonl[0].bodyText).toContain('Default body text.');
      expect(jsonl[1].bodyText).toContain('Nested body text.');

      const pageJson = JSON.parse(await fsp.readFile(path.join(dir, 'pages', 'guides--start.json'), 'utf8'));
      expect(pageJson.extractUrls.text).toBe('https://docs.example/pages/guides--start.txt');
      await expect(fsp.readFile(path.join(dir, 'pages', 'guides--start.txt'), 'utf8')).resolves.toContain('Nested body text.');
      await expect(fsp.readFile(path.join(dir, 'llms-full.txt'), 'utf8')).resolves.toContain('# Welcome');

      const llms = await fsp.readFile(path.join(dir, 'llms.txt'), 'utf8');
      expect(llms).toContain('extract: https://docs.example/pages/welcome.txt');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('limited profile suppresses sitemap, llms, and corpus artifacts by default', async () => {
    const dir = await writeSeoFixture();
    try {
      await generateSeoArtifacts(dir, {
        title: 'Limited Docs',
        seo: { discoverabilityProfile: 'limited' }
      });
      await expect(fsp.access(path.join(dir, 'sitemap.xml'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'llms.txt'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'content-index.json'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'documents.jsonl'))).rejects.toThrow();
      await expect(fsp.readFile(path.join(dir, 'pages', 'welcome.html'), 'utf8')).resolves.toContain('noindex, nofollow');
      const robots = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(robots).toContain('Disallow: /');
      expect(robots).not.toContain('Sitemap:');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('locked profile suppresses pages and discovery artifacts by default', async () => {
    const dir = await writeSeoFixture();
    try {
      await generateSeoArtifacts(dir, {
        title: 'Locked Docs',
        seo: { discoverabilityProfile: 'locked' }
      });
      await expect(fsp.access(path.join(dir, 'pages'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'sitemap.xml'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'llms.txt'))).rejects.toThrow();
      await expect(fsp.access(path.join(dir, 'content-index.json'))).rejects.toThrow();
      const robots = await fsp.readFile(path.join(dir, 'robots.txt'), 'utf8');
      expect(robots).toContain('Disallow: /');
      expect(robots).not.toContain('Sitemap:');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('noIndex suppresses open-profile corpus artifacts unless explicitly disabled', async () => {
    const dir = await writeSeoFixture();
    try {
      await generateCorpusArtifacts(dir, manifest, {
        seo: { discoverabilityProfile: 'open', noIndex: true }
      });
      await expect(fsp.access(path.join(dir, 'content-index.json'))).rejects.toThrow();
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  test('llms.txt is skipped when the profile disables it', async () => {
    const dir = await writeSeoFixture();
    try {
      await generateLlmsTxt(dir, manifest, { seo: { discoverabilityProfile: 'limited' } });
      await expect(fsp.access(path.join(dir, 'llms.txt'))).rejects.toThrow();
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });
});
