import fsp from 'node:fs/promises';
import path from 'node:path';
import { buildFortemiIndexExport, buildFortemiMetadataExport, chunkFortemiIndex } from '../../src/lib/fortemi-corpus.js';
import { assertAiwgFortemiChunkManifest, assertAiwgFortemiChunkPart } from '../../src/vendor/fortemi-aiwg-index.js';

const SCHEMA = 'pagenary.brochure.artifacts.v1';

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function entries(group, value) {
  if (Array.isArray(value)) return value.map((item) => [item.id, item]);
  if (value && typeof value === 'object' && group === 'profile') return [[value.id || 'primary', value]];
  return Object.entries(value || {}).map(([id, item]) => [id, { id, ...item }]);
}

function entityIndex(content) {
  const index = new Map();
  for (const [group, value] of Object.entries(content.entities || {})) {
    for (const [id, item] of entries(group, value)) index.set(`${group}.${id}`, item);
  }
  return index;
}

function sortedEntities(group, content) {
  return entries(group, content.entities?.[group]).map(([, item]) => item)
    .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
}

function entityText(entity) {
  const fields = ['title', 'name', 'tagline', 'summary', 'description', 'period', 'date'];
  return fields.map((field) => entity?.[field]).filter(Boolean).join('\n');
}

function routeDocument(route, index, site) {
  const entities = (route.entityRefs || []).map((ref) => ({ ref, ...index.get(ref) }));
  const text = [route.title, route.summary, ...entities.map(entityText)].filter(Boolean).join('\n\n');
  return {
    schema_version: SCHEMA,
    id: route.id,
    path: route.path,
    role: route.role,
    title: route.title,
    summary: route.summary,
    canonical_url: new URL(route.path, site.canonicalUrl).href,
    entity_refs: route.entityRefs || [],
    entities,
    text
  };
}

function semanticHtml(document, language) {
  const sections = document.entities.map((entity) =>
    `<section data-entity-ref="${escapeHtml(entity.ref)}"><h2>${escapeHtml(entity.title || entity.name || entity.ref)}</h2>` +
    `${entity.summary || entity.description ? `<p>${escapeHtml(entity.summary || entity.description)}</p>` : ''}</section>`).join('');
  return `<!doctype html>\n<html lang="${escapeHtml(language)}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.title)}</title>` +
    `<meta name="description" content="${escapeHtml(document.summary)}"><link rel="canonical" href="${escapeHtml(document.canonical_url)}">` +
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: document.title, description: document.summary, url: document.canonical_url }).replace(/</g, '\\u003c')}</script>` +
    `</head><body><main><h1>${escapeHtml(document.title)}</h1><p>${escapeHtml(document.summary)}</p>${sections}</main></body></html>\n`;
}

export async function generateBrochureArtifacts(distDir, content) {
  if (!content) return null;
  const root = path.join(distDir, 'brochure');
  const pagesDir = path.join(root, 'pages');
  const routesDir = path.join(root, 'routes');
  await fsp.mkdir(pagesDir, { recursive: true });
  await fsp.mkdir(routesDir, { recursive: true });
  const index = entityIndex(content);
  const documents = [];
  const coverage = [];
  for (const route of content.routeManifest) {
    if (route.extractPolicy !== 'public') continue;
    const document = routeDocument(route, index, content.site);
    documents.push(document);
    const files = {
      html: `brochure/pages/${route.id}.html`,
      json: `brochure/routes/${route.id}.json`,
      text: `brochure/routes/${route.id}.txt`
    };
    await Promise.all([
      fsp.writeFile(path.join(pagesDir, `${route.id}.html`), semanticHtml(document, content.site.language)),
      fsp.writeFile(path.join(routesDir, `${route.id}.json`), `${JSON.stringify(document, null, 2)}\n`),
      fsp.writeFile(path.join(routesDir, `${route.id}.txt`), `${document.text}\n`)
    ]);
    coverage.push({ id: route.id, path: route.path, role: route.role, status: 'complete', artifacts: files });
  }
  const llms = documents.map((doc) => `# ${doc.title}\n\n${doc.summary}\n\nURL: ${doc.canonical_url}`).join('\n\n');
  const report = {
    schema_version: 'pagenary.brochure.coverage.v1',
    declared_routes: content.routeManifest.length,
    public_routes: documents.length,
    complete_routes: coverage.length,
    missing: [],
    extra: [],
    routes: coverage
  };
  const surface = (name, items) => ({ schema_version: `pagenary.portfolio-brochure.${name}.v1`, items });
  const updates = sortedEntities('updates', content).map((item) => ({
    ...item,
    path: item.path || `/updates/${item.id}`,
    url: item.url || new URL(item.path || `/updates/${item.id}`, content.site.canonicalUrl).href,
    canonical: item.canonical || item.url || new URL(item.path || `/updates/${item.id}`, content.site.canonicalUrl).href,
    source: { id: content.site.title, title: content.site.title, url: content.site.canonicalUrl, baseUrl: content.site.canonicalUrl }
  }));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    documents.map((doc) => `  <url><loc>${escapeHtml(doc.canonical_url)}</loc></url>`).join('\n') + '\n</urlset>\n';
  const searchEntries = documents.map((document) => ({
    section: {
      id: document.id,
      title: document.title,
      summary: document.summary,
      path: document.path,
      group: document.role,
      tags: document.entity_refs,
      file: `brochure/routes/${document.id}.json`
    },
    text: document.text
  }));
  const { index: searchIndex } = buildFortemiIndexExport(searchEntries, {
    repo: content.site.canonicalUrl,
    extractConcepts: true,
    relateByConcept: true
  });
  const { manifest: searchManifest, parts: searchParts } = chunkFortemiIndex(searchIndex);
  assertAiwgFortemiChunkManifest(searchManifest);
  searchParts.forEach((part, i) => assertAiwgFortemiChunkPart(part, searchManifest.parts[i], searchManifest));
  const searchDir = path.join(distDir, 'search-index');
  await fsp.rm(searchDir, { recursive: true, force: true });
  await fsp.mkdir(searchDir, { recursive: true });
  await Promise.all([
    fsp.writeFile(path.join(distDir, 'content-index.json'), `${JSON.stringify({ schema_version: SCHEMA, documents: documents.map(({ text, entities, ...doc }) => doc) }, null, 2)}\n`),
    fsp.writeFile(path.join(distDir, 'documents.jsonl'), `${documents.map((doc) => JSON.stringify(doc)).join('\n')}\n`),
    fsp.writeFile(path.join(distDir, 'llms.txt'), `${llms}\n`),
    fsp.writeFile(path.join(distDir, 'llms-full.txt'), `${documents.map((doc) => `# ${doc.title}\n\n${doc.text}\n\nURL: ${doc.canonical_url}`).join('\n\n')}\n`),
    fsp.writeFile(path.join(distDir, 'sitemap.xml'), sitemap),
    fsp.writeFile(path.join(distDir, 'route-coverage.json'), `${JSON.stringify(report, null, 2)}\n`),
    fsp.writeFile(path.join(root, 'offers.json'), `${JSON.stringify(surface('offers', sortedEntities('offers', content)), null, 2)}\n`),
    fsp.writeFile(path.join(root, 'projects.json'), `${JSON.stringify(surface('projects', sortedEntities('projects', content)), null, 2)}\n`),
    fsp.writeFile(path.join(root, 'profile.json'), `${JSON.stringify({ schema_version: 'pagenary.portfolio-brochure.profile.v1', profile: content.entities.profile, experience: sortedEntities('experience', content) }, null, 2)}\n`),
    fsp.writeFile(path.join(root, 'updates.json'), `${JSON.stringify({ schema_version: '1.0.0', posts: updates, source: { id: content.site.title, title: content.site.title, url: content.site.canonicalUrl, baseUrl: content.site.canonicalUrl } }, null, 2)}\n`),
    fsp.writeFile(path.join(root, 'contact.json'), `${JSON.stringify({ schema_version: 'pagenary.portfolio-brochure.contact.v1', links: sortedEntities('links', content) }, null, 2)}\n`),
    fsp.writeFile(path.join(searchDir, 'manifest.json'), `${JSON.stringify(searchManifest, null, 2)}\n`),
    fsp.writeFile(path.join(searchDir, 'metadata.json'), `${JSON.stringify(buildFortemiMetadataExport(searchIndex), null, 2)}\n`),
    ...searchParts.map((part, i) => fsp.writeFile(path.join(searchDir, searchManifest.parts[i].href), `${JSON.stringify(part, null, 2)}\n`))
  ]);
  if (coverage.length !== documents.length || report.missing.length) throw new Error('brochureware route coverage is incomplete');
  console.log(`  ↳ brochureware artifacts: ${documents.length} public route(s), coverage complete`);
  return { documents, report };
}
