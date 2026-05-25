/**
 * SEO Generator Utilities
 * Build-time generation of sitemap.xml, robots.txt, static HTML snapshots, and JSON-LD
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';

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
        parent: parentTitle
      });
    }
    if (entry.subsections) {
      sections.push(...collectAllSections(entry.subsections, entry.title));
    }
  }
  return sections;
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
  const seoConfig = config.seo || {};
  if (seoConfig.generateSitemap === false) return;

  const baseUrl = seoConfig.siteUrl || '';
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
  const seoConfig = config.seo || {};
  if (seoConfig.generateRobotsTxt === false) return;

  const baseUrl = seoConfig.siteUrl || '';
  const sitemapUrl = baseUrl ? `${baseUrl}/sitemap.xml` : '/sitemap.xml';
  const buildDate = new Date().toISOString();

  const content = `# ${config.title || 'Documentation'}
# Generated: ${buildDate}

User-agent: *
Allow: /
Allow: /pages/
Disallow: /sections/
Disallow: /lib/

Sitemap: ${sitemapUrl}
`;

  await fsp.writeFile(path.join(distDir, 'robots.txt'), content, 'utf8');
  console.log(`  ↳ generated robots.txt`);
}

/**
 * Generate JSON-LD for a documentation page
 * @param {object} section - Section metadata
 * @param {object} config - Tenant configuration
 * @returns {string} JSON-LD script content
 */
export function buildPageJsonLd(section, config) {
  const seoConfig = config.seo || {};
  const baseUrl = seoConfig.siteUrl || '';
  const canonicalUrl = `${baseUrl}/#${section.id}`;
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
  const seoConfig = config.seo || {};
  const baseUrl = seoConfig.siteUrl || '';

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
    contentHtml,
    siteTitle,
    baseUrl,
    config
  } = options;

  const canonicalUrl = `${baseUrl}/#${sectionId}`;
  const jsonLd = buildPageJsonLd({
    id: sectionId,
    title: sectionTitle,
    summary: sectionSummary,
    parent: sectionParent
  }, config);

  // Escape content for HTML
  const safeTitle = escapeHtml(sectionTitle);
  const safeSiteTitle = escapeHtml(siteTitle);
  const safeSummary = escapeHtml(sectionSummary || '');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} | ${safeSiteTitle}</title>
  <meta name="description" content="${safeSummary}" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeSummary}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonicalUrl}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeSummary}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
${jsonLd}
  </script>

  <!-- Redirect to SPA for JavaScript-enabled browsers -->
  <script>
    if (typeof window !== 'undefined') {
      window.location.replace('${baseUrl}/#${sectionId}');
    }
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url=${baseUrl}/#${sectionId}" />
  </noscript>

  <link rel="stylesheet" href="../styles.css" />
  <style>
    .static-content { max-width: 800px; margin: 0 auto; padding: 2rem; }
    .static-footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #666; }
  </style>
</head>
<body>
  <main class="static-content">
    <article>
      <h1>${safeTitle}</h1>
      ${sectionSummary ? `<p class="lead">${safeSummary}</p>` : ''}
      <div class="section-body">
${contentHtml}
      </div>
    </article>
    <footer class="static-footer">
      <p>View interactive version: <a href="${canonicalUrl}">${safeTitle}</a></p>
    </footer>
  </main>
</body>
</html>
`;
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

/**
 * Generate static HTML snapshots for all sections
 * @param {string} distDir - Tenant dist directory
 * @param {Array} manifest - Navigation manifest
 * @param {object} config - Tenant configuration
 */
export async function generateStaticSnapshots(distDir, manifest, config) {
  const seoConfig = config.seo || {};
  if (seoConfig.generateStaticPages === false) return;

  const pagesDir = path.join(distDir, 'pages');
  await fsp.mkdir(pagesDir, { recursive: true });

  const baseUrl = seoConfig.siteUrl || '';
  const sections = collectAllSections(manifest);
  let generated = 0;

  for (const section of sections) {
    try {
      // Read the compiled module
      const modulePath = path.join(distDir, section.module);
      const moduleContent = await fsp.readFile(modulePath, 'utf8');

      // Extract HTML content
      const contentHtml = extractHtmlFromModule(moduleContent);
      if (!contentHtml) {
        console.warn(`  ⚠ Could not extract HTML from ${section.id}`);
        continue;
      }

      // Generate static page
      const pageHtml = buildStaticPage({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionSummary: section.summary,
        sectionParent: section.parent,
        contentHtml,
        siteTitle: config.title || 'Documentation',
        baseUrl,
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
  const seoConfig = config.seo || {};
  const baseUrl = seoConfig.siteUrl || '';
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
        lines.push(`- [${entry.title}](${url}): ${entry.summary || ''}`);
      }

      // Add subsection pages
      for (const sub of entry.subsections) {
        if (!sub.module && !sub.subsections) continue;
        if (sub.module) {
          const filename = encodePathForFilename(sub.id);
          const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
          lines.push(`- [${sub.title}](${url}): ${sub.summary || ''}`);
        }
        // Recurse one more level for deeply nested sections
        if (sub.subsections) {
          for (const nested of sub.subsections) {
            if (!nested.module) continue;
            const filename = encodePathForFilename(nested.id);
            const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
            lines.push(`- [${nested.title}](${url}): ${nested.summary || ''}`);
          }
        }
      }
    } else if (entry.module) {
      // Top-level page without subsections
      const filename = encodePathForFilename(entry.id);
      const url = baseUrl ? `${baseUrl}/pages/${filename}.html` : `/pages/${filename}.html`;
      lines.push('');
      lines.push(`- [${entry.title}](${url}): ${entry.summary || ''}`);
    }
  }

  const content = lines.join('\n') + '\n';
  await fsp.writeFile(path.join(distDir, 'llms.txt'), content, 'utf8');
  console.log(`  ↳ generated llms.txt`);
}

/**
 * Generate all SEO artifacts for a tenant
 * @param {string} distDir - Tenant dist directory
 * @param {object} config - Tenant configuration
 */
export async function generateSeoArtifacts(distDir, config) {
  const seoConfig = config.seo || {};

  // Skip if SEO is explicitly disabled
  if (seoConfig.enabled === false) {
    return;
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
}
