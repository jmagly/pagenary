/**
 * Collection generator (#18)
 *
 * For a tenant that marks a content folder as a "collection" (e.g. a blog),
 * emit a machine-readable manifest (`index.json`) and optional RSS `feed.xml`
 * derived from each post's front matter — so downstream sites can consume the
 * collection without scraping rendered HTML.
 *
 * Config (tenant config.json):
 *   "collections": [
 *     { "path": "blog", "route": "/blog", "title": "Blog",
 *       "manifest": true, "feed": true, "sortBy": "date", "order": "desc" }
 *   ]
 *
 * `path` is relative to the tenant content root. Output lands at the route
 * (or path) under dist: `<dist>/<route>/index.json` and `/feed.xml`.
 */

import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { resolveBaseUrl, encodePathForFilename } from './seo-generator.js';
import { parseFrontmatter, estimateReadingTime, firstHeading } from './frontmatter.js';

const POST_EXTENSIONS = new Set(['.md', '.markdown']);

function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Output subdirectory for a collection: its route (slug-ified) or its path. */
function outputDir(collection) {
  const route = (collection.route || collection.path || '').replace(/^\/+|\/+$/g, '');
  return route;
}

/**
 * Build the entry list for one collection by reading its source posts.
 * @returns {Promise<Array>} sorted post entries
 */
async function collectEntries(collection, contentBasePath, baseUrl) {
  const srcDir = path.join(contentBasePath, collection.path);
  let files;
  try {
    files = await fsp.readdir(srcDir, { withFileTypes: true });
  } catch {
    return null; // folder missing — caller warns
  }

  const entries = [];
  for (const f of files) {
    if (!f.isFile()) continue;
    const ext = path.extname(f.name).toLowerCase();
    if (!POST_EXTENSIONS.has(ext)) continue;
    if (f.name.startsWith('_') || f.name.toLowerCase() === 'index.md') continue;

    const slug = f.name.slice(0, -ext.length);
    const raw = await fsp.readFile(path.join(srcDir, f.name), 'utf8');
    const { data, body } = parseFrontmatter(raw);

    // Section id mirrors the build's nested-id scheme: <collection.path>/<slug>
    const sectionId = `${collection.path.replace(/^\/+|\/+$/g, '')}/${slug}`;
    const staticPath = `/pages/${encodePathForFilename(sectionId)}.html`;
    const routePath = collection.route
      ? `${collection.route.replace(/\/+$/, '')}/${slug}`
      : `/#/${sectionId}`;

    entries.push({
      slug,
      title: data.title || firstHeading(body) || slug,
      date: data.date || null,
      summary: data.summary || data.description || '',
      hero: data.hero || data.image || null,
      tags: Array.isArray(data.tags) ? data.tags : (data.tags ? [data.tags] : []),
      reading_time: estimateReadingTime(body),
      canonical: baseUrl ? `${baseUrl}${staticPath}` : staticPath,
      path: routePath
    });
  }

  const sortBy = collection.sortBy || 'date';
  const dir = (collection.order || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  entries.sort((a, b) => {
    const av = a[sortBy];
    const bv = b[sortBy];
    // Missing sort key always sorts last, regardless of order.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
  return entries;
}

function buildFeedXml(collection, entries, config, baseUrl) {
  const title = collection.title || config.title || 'Feed';
  const channelLink = baseUrl
    ? `${baseUrl}/${outputDir(collection)}`
    : `/${outputDir(collection)}`;
  const items = entries.map((e) => {
    const pubDate = e.date ? new Date(e.date).toUTCString() : '';
    return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${escapeXml(e.canonical)}</link>
      <guid isPermaLink="true">${escapeXml(e.canonical)}</guid>${pubDate ? `\n      <pubDate>${pubDate}</pubDate>` : ''}
      <description>${escapeXml(e.summary)}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(config.description || title)}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/**
 * Generate collection artifacts for a tenant.
 * @param {string} distDir - Tenant dist directory
 * @param {object} config - Tenant configuration
 * @param {string} contentBasePath - Resolved tenant content root (source)
 */
export async function generateCollections(distDir, config, contentBasePath) {
  const collections = Array.isArray(config.collections) ? config.collections : [];
  if (collections.length === 0 || !contentBasePath) return;

  const baseUrl = resolveBaseUrl(config);

  for (const collection of collections) {
    if (!collection || !collection.path) {
      console.warn('  ⚠ collection entry missing "path" — skipped');
      continue;
    }
    const entries = await collectEntries(collection, contentBasePath, baseUrl);
    if (entries === null) {
      console.warn(`  ⚠ collection source not found: ${collection.path}`);
      continue;
    }

    const outDir = path.join(distDir, outputDir(collection));
    await fsp.mkdir(outDir, { recursive: true });

    if (collection.manifest !== false) {
      const manifest = {
        title: collection.title || config.title || '',
        route: collection.route || `/${outputDir(collection)}`,
        count: entries.length,
        generated: new Date().toISOString(),
        posts: entries
      };
      await fsp.writeFile(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`  ↳ generated ${outputDir(collection)}/index.json (${entries.length} posts)`);
    }

    if (collection.feed) {
      const xml = buildFeedXml(collection, entries, config, baseUrl);
      await fsp.writeFile(path.join(outDir, 'feed.xml'), xml, 'utf8');
      console.log(`  ↳ generated ${outputDir(collection)}/feed.xml`);
    }
  }
}
