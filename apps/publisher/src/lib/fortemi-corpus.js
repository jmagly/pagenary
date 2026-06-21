/**
 * Fortemi corpus builder — shared, pure, deterministic.
 *
 * Maps Pagenary sections to the `aiwg.fortemi.index.export.v1` record contract
 * and produces a deterministic, chunked static index. No DOM and no Date.now(),
 * so it runs identically at build time (Node, in scripts/build-tenants.js) and
 * in the browser (runtime fallback in lib/search.js). The query/controller/graph
 * side lives in the vendored real package (../vendor/fortemi-aiwg-index.js).
 *
 * Hard constraints enforced here come from the real validators:
 *   - records sorted by `id` (lexicographic) and unique
 *   - provenance non-empty
 *   - chunk part offsets contiguous from 0, counts sum to total
 */

export const FORTEMI_INDEX_SCHEMA = 'aiwg.fortemi.index.export.v1';
export const FORTEMI_RECORD_SCHEMA = 'aiwg.fortemi.index.record.v1';
export const FORTEMI_CHUNK_MANIFEST_SCHEMA = 'aiwg.fortemi.index.chunk-manifest.v1';
export const FORTEMI_CHUNK_PART_SCHEMA = 'aiwg.fortemi.index.chunk.v1';
export const FORTEMI_METADATA_SCHEMA = 'pagenary.fortemi.metadata.v1';

export const DEFAULT_PART_SIZE = 100;

/**
 * Deterministic 64-bit FNV-1a hash, returned as zero-padded hex.
 * Stable across Node and browsers; no crypto dependency required.
 * @param {string} input
 * @returns {string} 16-char hex digest
 */
export function stableHash(input) {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i) & 0xff);
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/**
 * Strip HTML to plain text without a DOM (build-time safe).
 * Drops script/style bodies, unwraps tags, decodes a few common entities,
 * and collapses whitespace deterministically.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an arbitrary label into a stable facet/concept slug.
 * @param {*} value
 * @returns {string}
 */
export function normalizeFacetValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'general';
}

/**
 * Stopwords excluded from concept extraction: high-frequency English function
 * words plus a few doc-structural terms ("related", "example") that otherwise
 * co-occur in every page and collapse the graph into a hairball.
 */
const CONCEPT_STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was',
  'one', 'our', 'out', 'has', 'have', 'his', 'how', 'its', 'may', 'new', 'now', 'old',
  'see', 'two', 'who', 'did', 'get', 'use', 'used', 'uses', 'using', 'with', 'this',
  'that', 'they', 'them', 'then', 'than', 'from', 'into', 'your', 'yours', 'each',
  'once', 'more', 'most', 'some', 'such', 'only', 'over', 'under', 'when', 'what',
  'which', 'while', 'where', 'will', 'would', 'should', 'could', 'also', 'about',
  'after', 'before', 'these', 'those', 'their', 'there', 'here', 'been', 'being',
  'were', 'because', 'between', 'both', 'same', 'every', 'either', 'back', 'down',
  'make', 'made', 'need', 'needs', 'keep', 'read', 'reads', 'call', 'calls', 'set',
  'sets', 'follow', 'follows', 'three', 'plus', 'step', 'steps', 'shape', 'shapes',
  'related', 'example', 'examples', 'docs', 'page', 'pages', 'http', 'https', 'www',
  'com', 'json', 'returns', 'return', 'inspect', 'describe', 'described'
]);

/**
 * Concept-extraction procedure (the "defined procedure"): derive the most
 * salient content terms from a page's text. Deterministic — tokenizes on
 * word boundaries, drops short tokens and stopwords, ranks by frequency
 * (ties broken alphabetically), and returns the top terms as facet slugs.
 *
 * Shared concepts across pages become Fortemi community membership; the index
 * builder additionally turns shared concepts into `related` relationships
 * (edges). Pure: no DOM, no Date.now() — safe at build time and in the browser.
 *
 * @param {string} text - Plain-text page content
 * @param {object} [options]
 * @param {number} [options.max=6] - Maximum concepts to return
 * @param {number} [options.minLength=4] - Minimum token length to consider
 * @returns {string[]} Normalized concept slugs, ranked then alphabetized
 */
export function extractConcepts(text, options = {}) {
  const max = Number.isFinite(options.max) ? options.max : 6;
  const minLength = Number.isFinite(options.minLength) ? options.minLength : 4;
  if (!text) return [];
  const counts = new Map();
  const tokens = String(text).toLowerCase().match(/[a-z][a-z0-9-]+/g) || [];
  for (const raw of tokens) {
    const tok = raw.replace(/^-+|-+$/g, '');
    if (tok.length < minLength) continue;
    if (CONCEPT_STOPWORDS.has(tok)) continue;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  const ranked = Array.from(counts.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, max))
    .map(([word]) => normalizeFacetValue(word))
    .filter(Boolean);
  // De-dupe (post-normalization collisions) while preserving rank, then sort
  // for stable, deterministic output regardless of insertion order.
  return Array.from(new Set(ranked)).sort();
}

/**
 * Derive `related` relationships between records that share extracted content
 * concepts. Each record links to the peers with which it shares the most
 * concepts (capped), so the docs-map shows meaningful edges instead of a
 * hairball. Mutates `items[].relationships` in place. Deterministic.
 *
 * @param {object[]} items - AiwgFortemiRecords (aligned with conceptsPerItem)
 * @param {string[][]} conceptsPerItem - Content concepts for each item, same order
 * @param {object} [options]
 * @param {number} [options.maxRelations=4] - Max related edges per record
 * @param {number} [options.minShared=1] - Min shared concepts to relate
 */
export function addConceptRelationships(items, conceptsPerItem, options = {}) {
  const maxRelations = Number.isFinite(options.maxRelations) ? options.maxRelations : 4;
  const minShared = Number.isFinite(options.minShared) ? options.minShared : 1;
  const sets = conceptsPerItem.map((list) => new Set(list || []));
  for (let i = 0; i < items.length; i += 1) {
    const mine = sets[i];
    if (!mine || mine.size === 0) continue;
    const scored = [];
    for (let j = 0; j < items.length; j += 1) {
      if (j === i) continue;
      const sharedConcepts = [];
      for (const concept of mine) if (sets[j].has(concept)) sharedConcepts.push(concept);
      const shared = sharedConcepts.length;
      if (shared >= minShared) scored.push({ id: items[j].id, shared, sharedConcepts: sharedConcepts.sort() });
    }
    scored.sort((a, b) => (b.shared - a.shared) || a.id.localeCompare(b.id));
    const existing = new Set(items[i].relationships.map((r) => r.target_id));
    for (const peer of scored.slice(0, Math.max(0, maxRelations))) {
      if (existing.has(peer.id)) continue;
      items[i].relationships.push({
        target_id: peer.id,
        type: 'related',
        label: `Shares ${peer.shared} concept${peer.shared === 1 ? '' : 's'}`,
        confidence: Math.min(1, peer.shared / Math.max(1, mine.size)),
        privacy: 'public',
        metadata: { shared_concepts: peer.sharedConcepts }
      });
      existing.add(peer.id);
    }
  }
}

/**
 * The Pagenary section id encoded into a record, recoverable at runtime.
 * @param {object} record - AiwgFortemiRecord
 * @returns {string|null}
 */
export function recordToSectionId(record) {
  if (!record) return null;
  const locator = record.source?.locator || '';
  const match = /^#\/?(.+)$/.exec(locator);
  if (match) return match[1];
  const sectionFacet = record.facets?.section?.[0];
  if (sectionFacet) return sectionFacet;
  return record.id?.replace(/^docs:page:/, '') || null;
}

function cloneJson(value, fallback) {
  if (value == null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function optionalObject(record, keys) {
  for (const key of keys) {
    if (record && record[key] != null) return cloneJson(record[key], null);
  }
  return null;
}

function conceptPrefLabel(concept) {
  return String(concept || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function conceptToSkos(concept) {
  return {
    id: `concept:${concept}`,
    prefLabel: conceptPrefLabel(concept),
    notation: concept,
    uri: `urn:pagenary:concept:${concept}`
  };
}

function applyRichRecordMetadata(items) {
  for (const item of items) {
    item.skos_concepts = Array.from(new Set(item.concepts || []))
      .sort()
      .map(conceptToSkos);
    item.skos_relations = [];
    item.provenance_events = [
      {
        activity: 'built',
        agent: 'pagenary',
        source: item.source?.repo_relative_path || item.source?.path,
        path: '$',
        confidence: 'source',
        privacy: item.privacy?.classification || 'public',
        attributes: {
          record_id: item.id,
          section_id: recordToSectionId(item)
        }
      }
    ];
  }
}

/**
 * Project a Fortemi record into compact, page-addressable metadata.
 * Deliberately excludes `text` so static metadata artifacts do not duplicate
 * full document bodies. Unknown richer SKOS/PROV fields are copied only when
 * present, preserving forward compatibility with newer Fortemi contracts.
 *
 * @param {object} record - AiwgFortemiRecord or compatible future record
 * @returns {object|null}
 */
export function fortemiRecordToPageMetadata(record) {
  const sectionId = recordToSectionId(record);
  if (!record || !sectionId) return null;

  const metadata = {
    section_id: sectionId,
    record_id: record.id,
    type: record.type,
    title: record.title || sectionId,
    source: cloneJson(record.source, null),
    facets: cloneJson(record.facets || {}, {}),
    tags: cloneJson(record.tags || [], []),
    concepts: cloneJson(record.concepts || [], []),
    relationships: cloneJson(record.relationships || [], []),
    provenance: cloneJson(record.provenance || [], []),
    privacy: cloneJson(record.privacy || null, null),
    updated_at: record.updated_at || null
  };

  const richConcepts = optionalObject(record, [
    'skos_concepts',
    'skosConcepts',
    'concept_details',
    'conceptDetails'
  ]);
  if (richConcepts) metadata.skos_concepts = richConcepts;

  const skosRelations = optionalObject(record, [
    'skos_relations',
    'skosRelations',
    'concept_relations',
    'conceptRelations'
  ]);
  if (skosRelations) metadata.skos_relations = skosRelations;

  const provenanceEvents = optionalObject(record, [
    'provenance_events',
    'provenanceEvents',
    'prov',
    'prov_events',
    'provEvents'
  ]);
  if (provenanceEvents) metadata.provenance_events = provenanceEvents;

  return metadata;
}

/**
 * Build a compact metadata export from an AiwgFortemiIndexExport.
 * @param {object} index - AiwgFortemiIndexExport
 * @returns {{ schema_version: string, generated_at: string|null, source: object|null, pages: object[] }}
 */
export function buildFortemiMetadataExport(index) {
  const pages = (index?.items || [])
    .map((record) => fortemiRecordToPageMetadata(record))
    .filter(Boolean)
    .sort((a, b) => a.section_id.localeCompare(b.section_id));

  return {
    schema_version: FORTEMI_METADATA_SCHEMA,
    generated_at: index?.generated_at || null,
    source: cloneJson(index?.source || null, null),
    pages
  };
}

/**
 * Map a flattened Pagenary section + extracted text to an AiwgFortemiRecord.
 * @param {object} section - Flattened section ({ id, title, summary, group, module, type, date })
 * @param {string} text - Plain-text content for the section
 * @param {string} updatedAt - Deterministic ISO timestamp
 * @returns {object} AiwgFortemiRecord
 */
export function sectionToFortemiRecord(section, text, updatedAt) {
  const groupParts = String(section.group || section.title || 'Documentation')
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
  const modulePath = section.module || '';
  const sourcePath = modulePath
    ? modulePath.replace(/^\.?\//, '').replace(/^sections\//, 'sections/')
    : `${section.id}.md`;
  const concepts = Array.from(new Set([
    ...groupParts.map(normalizeFacetValue),
    section.type ? normalizeFacetValue(section.type) : null
  ].filter(Boolean)));
  const body = (text && text.trim())
    ? text.trim()
    : `${section.title || ''} ${section.summary || ''}`.trim();

  return {
    schema_version: FORTEMI_RECORD_SCHEMA,
    id: `docs:page:${section.id}`,
    type: 'docs.page',
    source: {
      path: sourcePath,
      repo_relative_path: sourcePath,
      locator: `#/${section.id}`
    },
    title: section.title || section.id,
    text: body,
    facets: {
      section: [section.id],
      group: groupParts.length ? groupParts.map(normalizeFacetValue) : ['documentation']
    },
    tags: section.type ? [normalizeFacetValue(section.type)] : [],
    concepts,
    relationships: [],
    provenance: [
      {
        field: 'text',
        source: sourcePath,
        path: '$.text',
        confidence: 'source',
        privacy: 'public'
      }
    ],
    privacy: {
      classification: 'public',
      pii: false
    },
    updated_at: updatedAt
  };
}

/**
 * Build a deterministic AiwgFortemiIndexExport from already-flattened sections.
 * Each `entry` is { section, text }. Records are sorted by id and de-duplicated,
 * which the real validator requires. `generated_at` is derived from a content
 * hash so the corpus is reproducible yet changes when content changes (drives
 * HTTP cache / future invalidation via `source.build_hash`).
 *
 * @param {Array<{section: object, text: string}>} entries
 * @param {object} [options]
 * @param {string} [options.repo='pagenary']
 * @returns {{ index: object, buildHash: string, generatedAt: string }}
 */
export function buildFortemiIndexExport(entries, options = {}) {
  const repo = options.repo || 'pagenary';

  // Stable content fingerprint over (id|title|text) of every section, in id order.
  const seen = new Map();
  for (const { section, text } of entries) {
    if (!section || !section.id) continue;
    if (seen.has(section.id)) continue; // first wins; dedupe by section id
    seen.set(section.id, { section, text: text || '' });
  }
  const ordered = Array.from(seen.values())
    .sort((a, b) => (`docs:page:${a.section.id}`).localeCompare(`docs:page:${b.section.id}`));

  const fingerprint = ordered
    .map(({ section, text }) => `${section.id} ${section.title || ''} ${text || ''}`)
    .join('');
  const buildHash = stableHash(`${repo}${fingerprint}`);
  // Deterministic ISO timestamp seeded from the hash (valid, stable, content-sensitive).
  const seconds = Number(BigInt(`0x${buildHash.slice(0, 8)}`));
  const generatedAt = new Date(seconds * 1000).toISOString();

  const items = ordered.map(({ section, text }) =>
    sectionToFortemiRecord(section, text, section.date || generatedAt));

  // Opt-in content-concept enrichment (used by the docs-map build, off by
  // default so search/runtime behavior is unchanged). Extract concepts from
  // each page's text; merge them into record concepts (→ communities) and
  // optionally relate co-occurring pages (→ edges).
  if (options.extractConcepts || options.relateByConcept) {
    const conceptsPerItem = ordered.map(({ text }) => extractConcepts(text, options.conceptOptions));
    if (options.extractConcepts) {
      items.forEach((item, i) => {
        item.concepts = Array.from(new Set([...item.concepts, ...conceptsPerItem[i]])).sort();
      });
    }
    if (options.relateByConcept) {
      addConceptRelationships(items, conceptsPerItem, options.relationOptions);
    }
  }

  applyRichRecordMetadata(items);

  const index = {
    schema_version: FORTEMI_INDEX_SCHEMA,
    generated_at: generatedAt,
    source: {
      repo,
      privacy: 'public',
      build_hash: buildHash
    },
    items
  };
  return { index, buildHash, generatedAt };
}

/**
 * Compute nested facet counts for a set of records (matches the vendored
 * getAiwgFortemiFacets shape) without importing the vendor module.
 * @param {Array<object>} items
 * @returns {Record<string, Record<string, number>>}
 */
export function computeFacetCounts(items) {
  const result = {};
  const push = (name, value) => {
    if (value == null) return;
    result[name] ||= {};
    result[name][value] = (result[name][value] || 0) + 1;
  };
  for (const item of items) {
    push('type', item.type);
    push('privacy', item.privacy?.classification);
    (item.tags || []).forEach((tag) => push('tag', tag));
    (item.concepts || []).forEach((concept) => push('concept', concept));
    Object.entries(item.facets || {}).forEach(([name, values]) =>
      (values || []).forEach((value) => push(name, value)));
  }
  return result;
}

/**
 * Split an index export into a chunk manifest + parts. Offsets are contiguous
 * from 0 and counts sum to total, as the chunk validator requires.
 *
 * @param {object} index - AiwgFortemiIndexExport
 * @param {object} [options]
 * @param {number} [options.partSize=DEFAULT_PART_SIZE]
 * @param {(i: number) => string} [options.partHref] - relative href for part i
 * @returns {{ manifest: object, parts: object[] }}
 */
export function chunkFortemiIndex(index, options = {}) {
  const partSize = Math.max(1, options.partSize || DEFAULT_PART_SIZE);
  const partHref = options.partHref || ((i) => `part-${String(i).padStart(4, '0')}.json`);
  const items = index.items || [];
  const parts = [];
  const partRefs = [];

  let offset = 0;
  let partIndex = 0;
  // Always emit at least one (possibly empty) part so total/offset math holds.
  do {
    const slice = items.slice(offset, offset + partSize);
    const href = partHref(partIndex);
    parts.push({
      schema_version: FORTEMI_CHUNK_PART_SCHEMA,
      manifest_schema_version: FORTEMI_CHUNK_MANIFEST_SCHEMA,
      offset,
      items: slice
    });
    partRefs.push({ href, offset, count: slice.length });
    offset += slice.length || partSize; // empty-corpus guard advances once
    partIndex += 1;
  } while (offset < items.length);

  const manifest = {
    schema_version: FORTEMI_CHUNK_MANIFEST_SCHEMA,
    generated_at: index.generated_at,
    source: index.source,
    total: items.length,
    part_size: partSize,
    facets: computeFacetCounts(items),
    parts: partRefs
  };
  return { manifest, parts };
}
