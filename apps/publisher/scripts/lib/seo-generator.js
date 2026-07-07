/**
 * SEO Generator Utilities
 * Build-time generation of sitemap.xml, robots.txt, static HTML snapshots, and JSON-LD
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { buildShareHref, buildShareTargets, resolveSharePayload } from '../../src/lib/share.js';

const DISCOVERABILITY_PROFILES = new Set(['standard', 'open', 'limited', 'locked']);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

/**
 * Resolve high-level discoverability profiles into concrete SEO switches.
 * Explicit low-level generation fields override profile artifact defaults,
 * while restrictive profiles keep noindex/robots blocking as their safety floor.
 *
 * @param {object} config - Tenant configuration
 * @returns {object} Tenant config copy with resolved `seo`
 */
export function resolveDiscoverabilityProfile(config = {}) {
  const seoConfig = config.seo || {};
  const profile = DISCOVERABILITY_PROFILES.has(seoConfig.discoverabilityProfile)
    ? seoConfig.discoverabilityProfile
    : 'standard';
  const defaultsByProfile = {
    standard: {
      generateSitemap: true,
      generateStaticPages: true,
      rootHtmlFallback: true,
      generateRobotsTxt: true,
      generateLlmsTxt: true,
      generateCorpusArtifacts: false,
      noIndex: false,
      robots: {}
    },
    open: {
      generateSitemap: true,
      generateStaticPages: true,
      rootHtmlFallback: true,
      generateRobotsTxt: true,
      generateLlmsTxt: true,
      generateCorpusArtifacts: true,
      noIndex: false,
      robots: {},
      aiCrawlers: { search: true, aiInput: true, aiTrain: true }
    },
    limited: {
      generateSitemap: false,
      generateStaticPages: true,
      rootHtmlFallback: true,
      generateRobotsTxt: true,
      generateLlmsTxt: false,
      generateCorpusArtifacts: false,
      noIndex: true,
      robots: { sitemap: false }
    },
    locked: {
      generateSitemap: false,
      generateStaticPages: false,
      rootHtmlFallback: false,
      generateRobotsTxt: true,
      generateLlmsTxt: false,
      generateCorpusArtifacts: false,
      noIndex: true,
      robots: { blockAll: true, sitemap: false }
    }
  };
  const defaults = defaultsByProfile[profile];
  const resolvedSeo = {
    ...defaults,
    ...seoConfig,
    discoverabilityProfile: profile,
    robots: {
      ...(defaults.robots || {}),
      ...(seoConfig.robots || {})
    }
  };

  if (defaults.aiCrawlers || seoConfig.aiCrawlers) {
    resolvedSeo.aiCrawlers = {
      ...(defaults.aiCrawlers || {}),
      ...(seoConfig.aiCrawlers || {})
    };
  }

  if ((profile === 'limited' || profile === 'locked') && !hasOwn(seoConfig, 'noIndex')) {
    resolvedSeo.noIndex = true;
  }
  if (profile === 'locked' && !hasOwn(seoConfig.robots, 'blockAll')) {
    resolvedSeo.robots.blockAll = true;
  }
  if ((profile === 'limited' || profile === 'locked') && !hasOwn(seoConfig.robots, 'sitemap')) {
    resolvedSeo.robots.sitemap = false;
  }

  return { ...config, seo: resolvedSeo };
}

/**
 * Resolve the absolute base URL for a tenant's SEO output.
 *
 * Precedence: `seo.siteUrl` > `domain` (https:// prefixed) > '' (relative fallback).
 * Returns a URL with no trailing slash, or '' when neither is configured.
 * Tenants that declare only `domain` (the common case) get absolute SEO URLs
 * for free — see issue #15.
 *
 * @param {object} config - Tenant configuration
 * @returns {string} Absolute base URL (no trailing slash) or ''
 */
export function resolveBaseUrl(config = {}) {
  const seoConfig = config.seo || {};
  const raw = String(seoConfig.siteUrl || config.domain || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

/**
 * Resolve a social-share image URL (og:image / twitter:image).
 * Absolute URLs pass through; site-relative paths are joined to baseUrl.
 * Returns '' when no image is configured. See issue #16.
 *
 * @param {object} config - Tenant configuration
 * @param {string} baseUrl - Resolved base URL (may be '')
 * @returns {string} Image URL, or '' when none configured
 */
export function resolveOgImage(config = {}, baseUrl = '') {
  const seoConfig = config.seo || {};
  const img = String(seoConfig.ogImage || '').trim();
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  const pathPart = img.startsWith('/') ? img : `/${img}`;
  return baseUrl ? `${baseUrl}${pathPart}` : pathPart;
}

/**
 * Encode section ID for use as filename (replace / with --)
 * @param {string} sectionId - Section ID like "guides/getting-started"
 * @returns {string} Filename-safe string like "guides--getting-started"
 */
export function encodePathForFilename(sectionId) {
  return sectionId.replace(/\//g, '--');
}

/**
 * Collect all sections with modules from manifest (recursive)
 * @param {Array} manifest - Navigation manifest
 * @param {string|null} parentTitle - Parent group title for breadcrumbs
 * @returns {Array} Flat array of sections with metadata
 */
export function collectAllSections(manifest, parentTitle = null) {
  const sections = [];
  for (const entry of manifest) {
    if (entry.module) {
      sections.push({
        id: entry.id,
        title: entry.title,
        summary: entry.summary || '',
        module: entry.module,
        parent: parentTitle,
        hero: entry.hero || '',
        heroAlt: entry.heroAlt || '',
        ogImage: entry.ogImage || ''
      });
    }
    if (entry.subsections) {
      sections.push(...collectAllSections(entry.subsections, entry.title));
    }
  }
  return sections;
}

/**
 * Build the static HTML href map for manifest-backed sections.
 * @param {Array} sections - Flat sections from collectAllSections()
 * @param {string} pagePrefix - Relative prefix from the current document
 * @returns {Map<string, string>}
 */
export function buildStaticSectionHrefMap(sections, pagePrefix = './') {
  const prefix = String(pagePrefix || '');
  return new Map(
    (sections || [])
      .filter((section) => section?.id)
      .map((section) => [
        String(section.id),
        `${prefix}${encodePathForFilename(String(section.id))}.html`
      ])
  );
}

function decodeHashFragment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveStaticSectionHref(rawHref, { currentId, sectionHrefMap }) {
  if (!rawHref || !sectionHrefMap?.size) return rawHref;
  const href = String(rawHref).trim();
  if (!href || href.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(href)) return rawHref;
  if (/\.(?:html?|css|js|mjs|json|txt|xml|png|jpe?g|gif|svg|webp|avif|ico|pdf|zip)(?:[?#].*)?$/i.test(href)) return rawHref;

  let fragment = '';
  if (href.startsWith('#')) {
    fragment = href.slice(1);
  } else if (href.startsWith('./#') || href.startsWith('/#')) {
    fragment = href.slice(href.indexOf('#') + 1);
  } else {
    return rawHref;
  }

  if (!fragment) return rawHref;
  const targetId = decodeHashFragment(fragment);
  if (targetId === currentId) return rawHref;

  return sectionHrefMap.get(targetId) || rawHref;
}

/**
 * Rewrite static-only intra-docbase links to generated HTML snapshots.
 * Runtime section modules keep their SPA hash links; this is applied only to
 * exported HTML fallback documents.
 * @param {string} contentHtml - HTML body from a compiled section module
 * @param {object} options
 * @param {string} options.currentId - Current manifest section id
 * @param {Map<string, string>} options.sectionHrefMap - Static section hrefs
 * @returns {string}
 */
export function rewriteStaticHtmlLinks(contentHtml, { currentId = '', sectionHrefMap = new Map() } = {}) {
  return String(contentHtml || '').replace(
    /\bhref\s*=\s*(["'])([^"']*)\1/gi,
    (match, quote, rawHref) => {
      const rewritten = resolveStaticSectionHref(rawHref, { currentId, sectionHrefMap });
      return rewritten === rawHref ? match : `href=${quote}${rewritten}${quote}`;
    }
  );
}

/**
 * Generate XML sitemap content
 * @param {Array} urls - Array of URL objects with loc, priority, changefreq
 * @returns {string} XML sitemap content
 */
export function buildSitemapXml(urls) {
  const urlEntries = urls.map(url => {
    const lastmod = url.lastmod || new Date().toISOString().split('T')[0];
    return `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${url.changefreq || 'monthly'}</changefreq>
    <priority>${url.priority || '0.5'}</priority>
  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
}

/**
 * Escape special characters for XML
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate sitemap.xml for a tenant
 * @param {string} distDir - Tenant dist directory
 * @param {Array} manifest - Navigation manifest
 * @param {object} config - Tenant configuration
 */
export async function generateSitemap(distDir, manifest, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  if (seoConfig.generateSitemap === false) return;

  const baseUrl = resolveBaseUrl(config);
  const defaultChangeFreq = seoConfig.defaultChangeFreq || 'weekly';
  const urls = [];

  // Add root URL
  urls.push({
    loc: baseUrl ? `${baseUrl}/` : '/',
    priority: '1.0',
    changefreq: defaultChangeFreq
  });

  // Collect all sections (deduplicate by ID to prevent double entries)
  const sections = collectAllSections(manifest);
  const seen = new Set();

  for (const section of sections) {
    if (seen.has(section.id)) continue;
    seen.add(section.id);
    const filename = encodePathForFilename(section.id);
    urls.push({
      loc: baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`,
      priority: section.parent ? '0.6' : '0.8',
      changefreq: 'monthly'
    });
  }

  const xml = buildSitemapXml(urls);
  await fsp.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.log(`  ↳ generated sitemap.xml (${urls.length} unique URLs)`);
}

/**
 * Generate robots.txt for a tenant
 * @param {string} distDir - Tenant dist directory
 * @param {object} config - Tenant configuration
 */
export async function generateRobotsTxt(distDir, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  if (seoConfig.generateRobotsTxt === false) return;

  const baseUrl = resolveBaseUrl(config);
  const sitemapUrl = baseUrl ? `${baseUrl}/sitemap.xml` : '/sitemap.xml';
  const buildDate = new Date().toISOString();
  const robotsConfig = seoConfig.robots || {};
  const userAgent = robotsConfig.userAgent || '*';
  const allowRules = Array.isArray(robotsConfig.allow) ? robotsConfig.allow : ['/', '/pages/'];
  const disallowRules = Array.isArray(robotsConfig.disallow) ? robotsConfig.disallow : ['/sections/', '/lib/'];
  const includeSitemap = robotsConfig.sitemap !== false && seoConfig.generateSitemap !== false;
  const contentSignals = buildContentSignalDirectives(seoConfig.aiCrawlers);

  let directives;
  if (seoConfig.noIndex || robotsConfig.blockAll) {
    directives = [
      `User-agent: ${userAgent}`,
      'Disallow: /'
    ];
  } else {
    directives = [
      `User-agent: ${userAgent}`,
      ...allowRules.map((rule) => `Allow: ${rule}`),
      ...disallowRules.map((rule) => `Disallow: ${rule}`)
    ];
  }

  const content = `# ${config.title || 'Documentation'}
# Generated: ${buildDate}

${directives.join('\n')}
${contentSignals ? `\n${contentSignals}` : ''}
${includeSitemap && !seoConfig.noIndex && !robotsConfig.blockAll ? `\nSitemap: ${sitemapUrl}` : ''}
`;

  await fsp.writeFile(path.join(distDir, 'robots.txt'), content, 'utf8');
  console.log(`  ↳ generated robots.txt`);
}

function buildContentSignalDirectives(aiCrawlers) {
  if (!aiCrawlers || typeof aiCrawlers !== 'object') return '';
  const signals = [
    ['search', 'search'],
    ['aiInput', 'ai-input'],
    ['aiTrain', 'ai-train']
  ]
    .filter(([key]) => typeof aiCrawlers[key] === 'boolean')
    .map(([key, label]) => `${label}=${aiCrawlers[key] ? 'yes' : 'no'}`);
  if (!signals.length) return '';
  return [
    '# Content signals are advisory crawler preferences, not access control.',
    `Content-Signal: ${signals.join(', ')}`
  ].join('\n');
}

/**
 * Generate JSON-LD for a documentation page
 * @param {object} section - Section metadata
 * @param {object} config - Tenant configuration
 * @returns {string} JSON-LD script content
 */
export function buildPageJsonLd(section, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  const baseUrl = resolveBaseUrl(config);
  // Canonical points at the crawlable static snapshot, not the SPA hash route
  // (search engines ignore #fragments, which collapsed every page to home). #17
  const canonicalUrl = `${baseUrl}/pages/${encodePathForFilename(section.id)}.html`;
  const buildDate = new Date().toISOString().split('T')[0];

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: section.title,
    description: section.summary || config.description || '',
    url: canonicalUrl,
    dateModified: buildDate,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl
    },
    isPartOf: {
      '@type': 'WebSite',
      name: config.title || 'Documentation',
      url: baseUrl || '/'
    }
  };

  // Add publisher if organization info provided
  if (seoConfig.structuredData?.organizationName) {
    articleSchema.publisher = {
      '@type': 'Organization',
      name: seoConfig.structuredData.organizationName
    };
    if (seoConfig.structuredData.logoUrl) {
      articleSchema.publisher.logo = seoConfig.structuredData.logoUrl;
    }
  }

  // Build breadcrumb schema
  const breadcrumbItems = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl || '/' }
  ];

  if (section.parent) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: section.parent,
      item: `${baseUrl}/#${section.parent.toLowerCase().replace(/\s+/g, '-')}`
    });
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: section.title,
      item: canonicalUrl
    });
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: section.title,
      item: canonicalUrl
    });
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems
  };

  return JSON.stringify([articleSchema, breadcrumbSchema], null, 2);
}

/**
 * Generate JSON-LD for the home page (WebSite schema)
 * @param {object} config - Tenant configuration
 * @returns {string} JSON-LD content
 */
export function buildHomePageJsonLd(config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  const baseUrl = resolveBaseUrl(config);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.title || 'Documentation',
    description: config.description || '',
    url: baseUrl || '/'
  };

  // Add search action if search is available
  if (baseUrl) {
    schema.potentialAction = {
      '@type': 'SearchAction',
      target: `${baseUrl}/#?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    };
  }

  return JSON.stringify(schema, null, 2);
}

/**
 * Build static HTML page for a section
 * @param {object} options - Page options
 * @returns {string} Complete HTML document
 */
export function buildStaticPage(options) {
  const {
    sectionId,
    sectionTitle,
    sectionSummary,
    sectionParent,
    section,
    contentHtml,
    siteTitle,
    baseUrl,
    ogImage = '',
    config
  } = options;
  const resolvedConfig = resolveDiscoverabilityProfile(config || {});

  // Canonical = the crawlable static snapshot (#17). The SPA hash route is for
  // JavaScript-enabled browsers and the "interactive version" link. Do not add
  // a no-JS refresh: HTML-only users need to stay on the static snapshot.
  const canonicalUrl = `${baseUrl}/pages/${encodePathForFilename(sectionId)}.html`;
  const spaUrl = `${baseUrl}/#${sectionId}`;
  const jsonLd = buildPageJsonLd({
    id: sectionId,
    title: sectionTitle,
    summary: sectionSummary,
    parent: sectionParent
  }, resolvedConfig);

  // Escape content for HTML
  const safeTitle = escapeHtml(sectionTitle);
  const safeSiteTitle = escapeHtml(siteTitle);
  const safeSummary = escapeHtml(sectionSummary || '');
  const sectionHero = section && typeof section.hero === 'string' ? section.hero : '';
  const safeHero = sectionHero ? escapeHtml(sectionHero) : '';
  const safeHeroAlt = section && section.heroAlt ? escapeHtml(section.heroAlt) : '';
  const heroHtml = safeHero
    ? `\n      <figure class="post-hero"><img src="${safeHero}" alt="${safeHeroAlt}" loading="eager" /></figure>`
    : '';
  const shareHtml = buildStaticShareHtml({
    sectionId,
    sectionTitle,
    sectionSummary,
    siteTitle,
    canonicalUrl,
    config: resolvedConfig
  });

  // Social share image (#16): summary_large_image when present, else summary.
  const safeImage = ogImage ? escapeHtml(ogImage) : '';
  const twitterCard = safeImage ? 'summary_large_image' : 'summary';
  const imageTags = safeImage
    ? `\n  <meta property="og:image" content="${safeImage}" />\n  <meta name="twitter:image" content="${safeImage}" />`
    : '';
  const robotsMeta = resolvedConfig?.seo?.noIndex
    ? '\n  <meta name="robots" content="noindex, nofollow" />'
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | ${safeSiteTitle}</title>
  <meta name="description" content="${safeSummary}" />${robotsMeta}
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeSummary}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />${imageTags}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeSummary}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <!-- Redirect to SPA for JavaScript-enabled browsers -->
  <script>
    if (typeof window !== 'undefined') {
      window.location.replace('${spaUrl}');
    }
  </script>

  <link rel="stylesheet" href="../styles.css" />
  <style>
    html,
    body {
      height: auto;
      min-height: 100%;
      overflow: auto;
    }

    body {
      display: block;
    }

    .static-content { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .static-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #666; }
  </style>
</head>
<body>
  <main class="static-content">
    <article>
      ${heroHtml}
      <h1>${safeTitle}</h1>
      ${sectionSummary ? `<p class="lead">${safeSummary}</p>` : ''}
      <div class="section-body">
${contentHtml}
      </div>
      ${shareHtml}
    </article>
    <footer class="static-footer">
      <p>Canonical URL: <a href="${canonicalUrl}">${canonicalUrl}</a></p>
      <p>View interactive version: <a href="${spaUrl}">${safeTitle}</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

function buildStaticShareHtml({ sectionId, sectionTitle, sectionSummary, siteTitle, canonicalUrl, config }) {
  const targets = buildShareTargets(config.share);
  if (!targets.length) return '';
  const payload = resolveSharePayload({
    entry: {
      id: sectionId,
      title: sectionTitle,
      summary: sectionSummary,
      staticUrl: canonicalUrl
    },
    siteConfig: {
      siteTitle,
      siteUrl: resolveBaseUrl(config),
      description: config.description || ''
    }
  });
  const links = targets
    .filter((target) => target.kind !== 'action')
    .map((target) => {
      const href = buildShareHref(target, payload);
      if (!href) return '';
      const rel = /^(mailto:|sms:|sgnl:|fb-messenger:)/i.test(href) ? '' : ' rel="noopener noreferrer"';
      return `<li><a href="${escapeHtml(href)}"${rel}>${escapeHtml(target.label)}</a></li>`;
    })
    .filter(Boolean);
  links.unshift(`<li><a href="${escapeHtml(canonicalUrl)}">Copy link</a></li>`);
  return `
      <nav class="static-share" aria-label="Share this page">
        <h2>Share</h2>
        <ul>${links.join('')}</ul>
      </nav>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Extract HTML content from a compiled section module
 * @param {string} moduleContent - The JS module source
 * @returns {string|null} The HTML content or null
 */
export function extractHtmlFromModule(moduleContent) {
  // Look for the html property in the module
  // Pattern: html: "..." or html: `...`
  const patterns = [
    /html:\s*"((?:[^"\\]|\\.)*)"/s,
    /html:\s*`((?:[^`\\]|\\.)*)`/s,
    /html:\s*'((?:[^'\\]|\\.)*)'/s
  ];

  for (const pattern of patterns) {
    const match = moduleContent.match(pattern);
    if (match) {
      // Unescape the string
      try {
        return JSON.parse(`"${match[1].replace(/"/g, '\\"')}"`);
      } catch {
        // Try direct return if JSON parse fails
        return match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
      }
    }
  }
  return null;
}

function buildDynamicSectionFallbackHtml(section) {
  if (section?.id !== 'docs-map') return null;
  const safeTitle = escapeHtml(section.title || 'Docs Map');
  const safeSummary = escapeHtml(section.summary || 'How these pages cluster and relate.');
  return `
        <p>${safeSummary}</p>
        <p>The interactive ${safeTitle} renders in the JavaScript app. It uses the generated docs-map data artifact to show page clusters, relationship edges, search, zoom, and page-detail popups.</p>
        <p>If this static snapshot does not redirect automatically, use the interactive version link below.</p>`;
}

/**
 * Generate static HTML snapshots for all sections
 * @param {string} distDir - Tenant dist directory
 * @param {Array} manifest - Navigation manifest
 * @param {object} config - Tenant configuration
 */
export async function generateStaticSnapshots(distDir, manifest, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  if (seoConfig.generateStaticPages === false) return;

  const pagesDir = path.join(distDir, 'pages');
  await fsp.mkdir(pagesDir, { recursive: true });

  const baseUrl = resolveBaseUrl(config);
  const siteOgImage = resolveOgImage(config, baseUrl);
  const sections = collectAllSections(manifest);
  const sectionHrefMap = buildStaticSectionHrefMap(sections, './');
  let generated = 0;

  for (const section of sections) {
    try {
      // Read the compiled module
      const modulePath = path.join(distDir, section.module);
      const moduleContent = await fsp.readFile(modulePath, 'utf8');

      // Extract HTML content
      const contentHtml = extractHtmlFromModule(moduleContent) || buildDynamicSectionFallbackHtml(section);
      if (!contentHtml) {
        console.warn(`  ⚠ Could not extract HTML from ${section.id}`);
        continue;
      }
      const staticContentHtml = rewriteStaticHtmlLinks(contentHtml, {
        currentId: section.id,
        sectionHrefMap
      });

      // Per-section og:image override (frontmatter) falls back to the site image
      const pageOgImage = section.ogImage
        ? resolveOgImage({ seo: { ogImage: section.ogImage } }, baseUrl)
        : siteOgImage;

      // Generate static page
      const pageHtml = buildStaticPage({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionSummary: section.summary,
        sectionParent: section.parent,
        section,
        contentHtml: staticContentHtml,
        siteTitle: config.title || 'Documentation',
        baseUrl,
        ogImage: pageOgImage,
        config
      });

      // Write the file
      const filename = `${encodePathForFilename(section.id)}.html`;
      await fsp.writeFile(path.join(pagesDir, filename), pageHtml, 'utf8');
      generated++;
    } catch (err) {
      console.warn(`  ⚠ Failed to generate static page for ${section.id}: ${err.message}`);
    }
  }

  console.log(`  ↳ generated ${generated} static HTML snapshots in /pages/`);
}

/**
 * Read and parse the MANIFEST from a generated manifest.js file
 * @param {string} distDir - Tenant dist directory
 * @returns {Array|null} The manifest array or null if not found
 */
export async function readManifestFromDist(distDir) {
  const manifestPath = path.join(distDir, 'manifest.js');
  try {
    const content = await fsp.readFile(manifestPath, 'utf8');
    // Extract the MANIFEST array from the module
    const match = content.match(/export\s+const\s+MANIFEST\s*=\s*(\[[\s\S]*?\]);/);
    if (match) {
      // Use Function constructor to safely evaluate the JSON-like array
      // eslint-disable-next-line no-new-func
      const manifest = new Function(`return ${match[1]}`)();
      return manifest;
    }
  } catch (err) {
    console.warn(`  ⚠ Could not read manifest: ${err.message}`);
  }
  return null;
}

/**
 * Generate llms.txt for LLM-friendly site discovery
 * Follows the llms.txt specification (https://llmstxt.org/)
 * @param {string} distDir - Tenant dist directory
 * @param {Array} manifest - Navigation manifest
 * @param {object} config - Tenant configuration
 */
export async function generateLlmsTxt(distDir, manifest, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  if (seoConfig.generateLlmsTxt === false) return;
  const baseUrl = resolveBaseUrl(config);
  const title = config.title || 'Documentation';
  const description = config.description || '';

  const lines = [];
  lines.push(`# ${title}`);
  if (description) {
    lines.push('');
    lines.push(`> ${description}`);
  }

  // Group sections by top-level entries
  for (const entry of manifest) {
    if (entry.url) continue; // Skip external links

    if (entry.subsections && entry.subsections.length > 0) {
      lines.push('');
      lines.push(`## ${entry.title}`);
      if (entry.summary) lines.push('');

      // Add group's own page if it has one
      if (entry.module) {
        const filename = encodePathForFilename(entry.id);
        const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
        lines.push(`- [${entry.title}](${url}): ${entry.summary || ''}${buildLlmsExtractSuffix(baseUrl, filename, seoConfig)}`);
      }

      // Add subsection pages
      for (const sub of entry.subsections) {
        if (!sub.module && !sub.subsections) continue;
        if (sub.module) {
          const filename = encodePathForFilename(sub.id);
          const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
          lines.push(`- [${sub.title}](${url}): ${sub.summary || ''}${buildLlmsExtractSuffix(baseUrl, filename, seoConfig)}`);
        }
        // Recurse one more level for deeply nested sections
        if (sub.subsections) {
          for (const nested of sub.subsections) {
            if (!nested.module) continue;
            const filename = encodePathForFilename(nested.id);
            const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
            lines.push(`- [${nested.title}](${url}): ${nested.summary || ''}${buildLlmsExtractSuffix(baseUrl, filename, seoConfig)}`);
          }
        }
      }
    } else if (entry.module) {
      // Top-level page without subsections
      const filename = encodePathForFilename(entry.id);
      const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
      lines.push('');
      lines.push(`- [${entry.title}](${url}): ${entry.summary || ''}${buildLlmsExtractSuffix(baseUrl, filename, seoConfig)}`);
    }
  }

  const content = lines.join('\n') + '\n';
  await fsp.writeFile(path.join(distDir, 'llms.txt'), content, 'utf8');
  console.log(`  ↳ generated llms.txt`);
}

function buildLlmsExtractSuffix(baseUrl, filename, seoConfig) {
  if (seoConfig.generateCorpusArtifacts !== true || seoConfig.noIndex) return '';
  const url = baseUrl ? `${baseUrl}/pages/${filename}.txt` : `/pages/${filename}.txt`;
  return `; extract: ${url}`;
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveArtifactUrl(baseUrl, pathname) {
  return baseUrl ? `${baseUrl}${pathname}` : pathname;
}

export async function generateCorpusArtifacts(distDir, manifest, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};
  if (seoConfig.generateCorpusArtifacts !== true || seoConfig.noIndex) return;

  const pagesDir = path.join(distDir, 'pages');
  await fsp.mkdir(pagesDir, { recursive: true });

  const baseUrl = resolveBaseUrl(config);
  const buildTimestamp = new Date().toISOString();
  const siteTitle = config.title || 'Documentation';
  const sections = collectAllSections(manifest);
  const documents = [];
  const pages = [];
  const seen = new Set();

  for (const section of sections) {
    if (seen.has(section.id)) continue;
    seen.add(section.id);

    try {
      const moduleContent = await fsp.readFile(path.join(distDir, section.module), 'utf8');
      const contentHtml = extractHtmlFromModule(moduleContent) || '';
      const bodyText = htmlToText(contentHtml);
      const filename = encodePathForFilename(section.id);
      const staticPath = `/pages/${filename}.html`;
      const jsonPath = `/pages/${filename}.json`;
      const textPath = `/pages/${filename}.txt`;
      const record = {
        id: section.id,
        title: section.title,
        summary: section.summary || '',
        parent: section.parent || null,
        siteTitle,
        canonicalUrl: resolveArtifactUrl(baseUrl, staticPath),
        staticHtmlUrl: resolveArtifactUrl(baseUrl, staticPath),
        extractUrls: {
          json: resolveArtifactUrl(baseUrl, jsonPath),
          text: resolveArtifactUrl(baseUrl, textPath)
        },
        bodyText,
        buildTimestamp
      };

      await fsp.writeFile(path.join(pagesDir, `${filename}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      await fsp.writeFile(path.join(pagesDir, `${filename}.txt`), `${bodyText}\n`, 'utf8');
      documents.push(record);
      pages.push({
        id: record.id,
        title: record.title,
        summary: record.summary,
        parent: record.parent,
        canonicalUrl: record.canonicalUrl,
        staticHtmlUrl: record.staticHtmlUrl,
        extractUrls: record.extractUrls,
        buildTimestamp
      });
    } catch (err) {
      console.warn(`  ⚠ Failed to generate corpus artifact for ${section.id}: ${err.message}`);
    }
  }

  await fsp.writeFile(path.join(distDir, 'content-index.json'), `${JSON.stringify({ siteTitle, buildTimestamp, pages }, null, 2)}\n`, 'utf8');
  await fsp.writeFile(path.join(distDir, 'documents.jsonl'), `${documents.map((doc) => JSON.stringify(doc)).join('\n')}\n`, 'utf8');

  const fullText = documents
    .map((doc) => `# ${doc.title}\n\n${doc.summary ? `${doc.summary}\n\n` : ''}${doc.bodyText}`)
    .join('\n\n---\n\n');
  if (fullText.length <= (seoConfig.llmsFullMaxBytes || 1_000_000)) {
    await fsp.writeFile(path.join(distDir, 'llms-full.txt'), `${fullText}\n`, 'utf8');
  }

  console.log(`  ↳ generated corpus artifacts (${documents.length} pages)`);
}

/**
 * Generate all SEO artifacts for a tenant
 * @param {string} distDir - Tenant dist directory
 * @param {object} config - Tenant configuration
 */
export async function generateSeoArtifacts(distDir, config) {
  config = resolveDiscoverabilityProfile(config);
  const seoConfig = config.seo || {};

  // Skip if SEO is explicitly disabled
  if (seoConfig.enabled === false) {
    return;
  }

  // Warn when neither seo.siteUrl nor domain is set — SEO output will use
  // relative URLs (invalid sitemap <loc>, weak canonicals). See #15.
  if (!resolveBaseUrl(config)) {
    console.warn(`  ⚠ SEO: no seo.siteUrl or domain set — sitemap/canonical URLs will be relative. Set "domain" or "seo.siteUrl" for absolute URLs.`);
  }

  // Read manifest from generated file
  const manifest = await readManifestFromDist(distDir);
  if (!manifest) {
    console.warn(`  ⚠ Could not generate SEO artifacts: manifest not found`);
    return;
  }

  // Generate each artifact
  await generateSitemap(distDir, manifest, config);
  await generateRobotsTxt(distDir, config);
  await generateLlmsTxt(distDir, manifest, config);
  await generateStaticSnapshots(distDir, manifest, config);
  await generateCorpusArtifacts(distDir, manifest, config);
}
