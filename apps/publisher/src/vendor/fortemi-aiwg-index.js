/**
 * VENDORED — @fortemi/core/aiwg-index
 *
 * Source : @fortemi/core@2026.6.3  →  dist/aiwg-index.js
 * SHA-256: f2e6793fd7e52e20441459e18633a9546c7cfc6281cbc63ab28f0767422946bf (upstream dist file)
 * License: AGPL-3.0-only (compatible with this package's AGPL-3.0-or-later)
 * Why    : Pagenary's publisher build is a no-bundler copy-src→dist pipeline that
 *          loads ES modules by relative path; bare specifiers (`@fortemi/core`)
 *          do not resolve in the browser. This module is self-contained (no bare
 *          imports) and runs unchanged in Node (build-time index emission) and the
 *          browser (runtime search). See .aiwg/architecture/adr/ADR-015-*.md.
 * Update : Re-vendor by copying the dist file from a newer @fortemi/core release
 *          and refreshing the SHA-256 above. Do not hand-edit below this banner.
 *          6.3 adds buildAiwgChunkedIndex / createAiwgFetchDetailLoader (additive).
 */
// src/aiwg-index.ts
var AIWG_SCAN_REQUIRED_FIELDS = [
  "schema_version",
  "id",
  "type",
  "title",
  "text",
  "facets",
  "tags",
  "concepts",
  "privacy"
];
var REQUIRED_RECORD_FIELDS = [
  "schema_version",
  "id",
  "type",
  "source",
  "title",
  "text",
  "facets",
  "tags",
  "concepts",
  "relationships",
  "provenance",
  "privacy",
  "updated_at"
];
var VALID_TYPES = /* @__PURE__ */ new Set([
  "crm.contact",
  "crm.organization",
  "crm.event",
  "crm.interaction",
  "aiwg.artifact",
  "docs.page"
]);
var DEFAULT_QUERY_WEIGHTS = {
  title: 4,
  tag: 3,
  concept: 2,
  text: 1
};
function hasString(value) {
  return typeof value === "string" && value.length > 0;
}
function pushFacet(counts, name, value) {
  counts[name] ??= {};
  counts[name][value] = (counts[name][value] ?? 0) + 1;
}
function hasNonNegativeInteger(value) {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}
function hasPositiveInteger(value) {
  return Number.isInteger(value) && typeof value === "number" && value > 0;
}
function isFacetCounts(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((counts) => !!counts && typeof counts === "object" && !Array.isArray(counts) && Object.values(counts).every((count) => hasNonNegativeInteger(count)));
}
function validateAiwgFortemiIndexExport(value) {
  const errors = [];
  const counts = {};
  const data = value;
  if (data?.schema_version !== "aiwg.fortemi.index.export.v1") {
    errors.push("schema_version must be aiwg.fortemi.index.export.v1");
  }
  if (!hasString(data?.generated_at)) errors.push("generated_at is required");
  if (!hasString(data?.source?.repo)) errors.push("source.repo is required");
  if (!hasString(data?.source?.privacy)) errors.push("source.privacy is required");
  if (!Array.isArray(data?.items)) errors.push("items must be an array");
  const ids = /* @__PURE__ */ new Set();
  let previousId = "";
  for (const [index, item] of (data.items ?? []).entries()) {
    for (const field of REQUIRED_RECORD_FIELDS) {
      if (!(field in item)) errors.push("items[" + index + "]." + field + " is required");
    }
    if (item.schema_version !== "aiwg.fortemi.index.record.v1") {
      errors.push("items[" + index + "].schema_version must be aiwg.fortemi.index.record.v1");
    }
    if (!hasString(item.id)) errors.push("items[" + index + "].id is required");
    if (hasString(item.id) && ids.has(item.id)) errors.push("duplicate id: " + item.id);
    if (hasString(item.id)) ids.add(item.id);
    if (previousId && hasString(item.id) && previousId.localeCompare(item.id) > 0) {
      errors.push("items must be sorted by id: " + previousId + " before " + item.id);
    }
    if (hasString(item.id)) previousId = item.id;
    if (!VALID_TYPES.has(item.type)) errors.push("items[" + index + "].type is invalid");
    else counts[item.type] = (counts[item.type] ?? 0) + 1;
    if (!hasString(item.source?.path)) errors.push("items[" + index + "].source.path is required");
    if (!hasString(item.source?.repo_relative_path)) errors.push("items[" + index + "].source.repo_relative_path is required");
    if (!hasString(item.source?.locator)) errors.push("items[" + index + "].source.locator is required");
    if (!Array.isArray(item.tags)) errors.push("items[" + index + "].tags must be an array");
    if (!Array.isArray(item.concepts)) errors.push("items[" + index + "].concepts must be an array");
    if (!Array.isArray(item.relationships)) errors.push("items[" + index + "].relationships must be an array");
    if (!Array.isArray(item.provenance) || item.provenance.length === 0) {
      errors.push("items[" + index + "].provenance must be a non-empty array");
    }
    if (!item.privacy || typeof item.privacy.pii !== "boolean" || !hasString(item.privacy.classification)) {
      errors.push("items[" + index + "].privacy requires classification and pii");
    }
  }
  return { valid: errors.length === 0, errors, counts };
}
function assertAiwgFortemiIndexExport(value) {
  const result = validateAiwgFortemiIndexExport(value);
  if (!result.valid) {
    throw new Error("Invalid AIWG Fortemi index export:\n" + result.errors.join("\n"));
  }
  return value;
}
function validateAiwgFortemiChunkManifest(value) {
  const errors = [];
  const data = value;
  if (data?.schema_version !== "aiwg.fortemi.index.chunk-manifest.v1") {
    errors.push("schema_version must be aiwg.fortemi.index.chunk-manifest.v1");
  }
  if (!hasString(data?.generated_at)) errors.push("generated_at is required");
  if (!hasString(data?.source?.repo)) errors.push("source.repo is required");
  if (!hasString(data?.source?.privacy)) errors.push("source.privacy is required");
  if (!hasNonNegativeInteger(data?.total)) errors.push("total must be a non-negative integer");
  if (!hasPositiveInteger(data?.part_size)) errors.push("part_size must be a positive integer");
  if (data.facets !== void 0 && !isFacetCounts(data.facets)) {
    errors.push("facets must be a nested string-to-number count object");
  }
  if (data.projection !== void 0) {
    if (!Array.isArray(data.projection) || !data.projection.every((field) => typeof field === "string")) {
      errors.push("projection must be an array of field names");
    } else {
      const present = new Set(data.projection);
      for (const field of AIWG_SCAN_REQUIRED_FIELDS) {
        if (!present.has(field)) errors.push("projection must include scan-required field " + field);
      }
    }
  }
  if (data.detail !== void 0) {
    if (!hasString(data.detail.href)) errors.push("detail.href is required");
    else if (!data.detail.href.includes("{id}")) errors.push("detail.href must contain the {id} placeholder");
  }
  if (!Array.isArray(data?.parts)) errors.push("parts must be an array");
  let expectedOffset = 0;
  const parts = Array.isArray(data?.parts) ? data.parts : [];
  for (const [index, part] of parts.entries()) {
    if (!hasString(part.href)) errors.push("parts[" + index + "].href is required");
    if (!hasNonNegativeInteger(part.offset)) errors.push("parts[" + index + "].offset must be a non-negative integer");
    if (!hasNonNegativeInteger(part.count)) errors.push("parts[" + index + "].count must be a non-negative integer");
    if (hasNonNegativeInteger(part.offset) && part.offset !== expectedOffset) {
      errors.push("parts[" + index + "].offset must be " + expectedOffset);
    }
    if (hasNonNegativeInteger(part.count)) expectedOffset += part.count;
  }
  if (hasNonNegativeInteger(data?.total) && expectedOffset !== data.total) {
    errors.push("parts counts must add up to total");
  }
  return { valid: errors.length === 0, errors };
}
function assertAiwgFortemiChunkManifest(value) {
  const result = validateAiwgFortemiChunkManifest(value);
  if (!result.valid) {
    throw new Error("Invalid AIWG Fortemi chunk manifest:\n" + result.errors.join("\n"));
  }
  return value;
}
function validateProjectedRecords(items) {
  const errors = [];
  const ids = /* @__PURE__ */ new Set();
  let previousId = "";
  for (const [index, item] of items.entries()) {
    if (item.schema_version !== "aiwg.fortemi.index.record.v1") {
      errors.push("items[" + index + "].schema_version must be aiwg.fortemi.index.record.v1");
    }
    if (!hasString(item.id)) errors.push("items[" + index + "].id is required");
    if (hasString(item.id) && ids.has(item.id)) errors.push("duplicate id: " + item.id);
    if (hasString(item.id)) ids.add(item.id);
    if (previousId && hasString(item.id) && previousId.localeCompare(item.id) > 0) {
      errors.push("items must be sorted by id: " + previousId + " before " + item.id);
    }
    if (hasString(item.id)) previousId = item.id;
    if (!item.type || !VALID_TYPES.has(item.type)) errors.push("items[" + index + "].type is invalid");
    if (!hasString(item.title)) errors.push("items[" + index + "].title is required");
    if (typeof item.text !== "string") errors.push("items[" + index + "].text is required");
    if (!item.facets || typeof item.facets !== "object" || Array.isArray(item.facets)) {
      errors.push("items[" + index + "].facets must be an object");
    }
    if (!Array.isArray(item.tags)) errors.push("items[" + index + "].tags must be an array");
    if (!Array.isArray(item.concepts)) errors.push("items[" + index + "].concepts must be an array");
    if (!item.privacy || !hasString(item.privacy.classification)) {
      errors.push("items[" + index + "].privacy.classification is required");
    }
  }
  return errors;
}
function validateAiwgFortemiChunkPart(value, partRef, manifest) {
  const errors = [];
  const data = value;
  if (data?.schema_version !== "aiwg.fortemi.index.chunk.v1") {
    errors.push("schema_version must be aiwg.fortemi.index.chunk.v1");
  }
  if (data?.manifest_schema_version !== "aiwg.fortemi.index.chunk-manifest.v1") {
    errors.push("manifest_schema_version must be aiwg.fortemi.index.chunk-manifest.v1");
  }
  if (!hasNonNegativeInteger(data?.offset)) errors.push("offset must be a non-negative integer");
  if (!Array.isArray(data?.items)) errors.push("items must be an array");
  if (partRef && hasNonNegativeInteger(data?.offset) && data.offset !== partRef.offset) {
    errors.push("offset must match manifest part offset " + partRef.offset);
  }
  if (partRef && Array.isArray(data?.items) && data.items.length !== partRef.count) {
    errors.push("items length must match manifest part count " + partRef.count);
  }
  if (Array.isArray(data?.items)) {
    if (manifest?.projection) {
      errors.push(...validateProjectedRecords(data.items).map((error) => "items." + error));
    } else {
      const validation = validateAiwgFortemiIndexExport({
        schema_version: "aiwg.fortemi.index.export.v1",
        generated_at: manifest?.generated_at ?? "1970-01-01T00:00:00.000Z",
        source: manifest?.source ?? { repo: "chunk", privacy: "public" },
        items: data.items
      });
      errors.push(...validation.errors.map((error) => "items." + error));
    }
  }
  return { valid: errors.length === 0, errors };
}
function assertAiwgFortemiChunkPart(value, partRef, manifest) {
  const result = validateAiwgFortemiChunkPart(value, partRef, manifest);
  if (!result.valid) {
    throw new Error("Invalid AIWG Fortemi chunk part:\n" + result.errors.join("\n"));
  }
  return value;
}
function createAiwgFetchChunkLoader(baseUrl) {
  return async (part) => {
    const href = baseUrl ? new URL(part.href, baseUrl).toString() : part.href;
    const response = await fetch(href);
    if (!response.ok) throw new Error("Failed to fetch AIWG index chunk " + href + ": " + response.status);
    return response.json();
  };
}
function createAiwgFetchDetailLoader(baseUrl) {
  return async (id, manifest) => {
    if (!manifest.detail?.href) throw new Error("Manifest has no detail.href for record resolution");
    const relative = manifest.detail.href.replace("{id}", encodeURIComponent(id));
    const href = baseUrl ? new URL(relative, baseUrl).toString() : relative;
    const response = await fetch(href);
    if (!response.ok) throw new Error("Failed to fetch AIWG index detail " + href + ": " + response.status);
    return response.json();
  };
}
function getAiwgFortemiFacets(items) {
  const result = {};
  for (const item of items) {
    pushFacet(result, "type", item.type);
    pushFacet(result, "privacy", item.privacy.classification);
    for (const tag of item.tags) pushFacet(result, "tag", tag);
    for (const concept of item.concepts) pushFacet(result, "concept", concept);
    for (const [name, values] of Object.entries(item.facets)) {
      for (const value of values) pushFacet(result, name, value);
    }
  }
  return result;
}
function buildAiwgChunkedIndex(index, options = {}) {
  const partSize = hasPositiveInteger(options.partSize) ? options.partSize : 500;
  const projection = options.projection;
  const items = index.items;
  const pad = (value) => String(value).padStart(4, "0");
  const project = (record) => {
    if (!projection) return record;
    const slim = {};
    for (const field of projection) slim[field] = record[field];
    return slim;
  };
  const parts = [];
  const partRefs = [];
  for (let offset = 0, partIndex = 0; offset < items.length; offset += partSize, partIndex += 1) {
    const slice = items.slice(offset, offset + partSize);
    const href = "part-" + pad(partIndex) + ".json";
    parts.push({
      href,
      part: {
        schema_version: "aiwg.fortemi.index.chunk.v1",
        manifest_schema_version: "aiwg.fortemi.index.chunk-manifest.v1",
        offset,
        items: slice.map(project)
      }
    });
    partRefs.push({ href, offset, count: slice.length });
  }
  const manifest = {
    schema_version: "aiwg.fortemi.index.chunk-manifest.v1",
    generated_at: options.generatedAt ?? index.generated_at,
    source: index.source,
    total: items.length,
    part_size: partSize,
    facets: getAiwgFortemiFacets(items),
    parts: partRefs,
    ...projection ? { projection, detail: { href: options.detailHref ?? "detail/{id}.json" } } : {}
  };
  return {
    manifest,
    parts,
    details: projection ? items.map((record) => ({ id: record.id, record })) : []
  };
}
function includesAll(actual, expected) {
  if (!expected || expected.length === 0) return true;
  const actualSet = new Set(actual);
  return expected.every((value) => actualSet.has(value));
}
function matchesFacetFilters(item, filters) {
  if (!filters) return true;
  return Object.entries(filters).every(([name, expected]) => includesAll(item.facets[name] ?? [], expected));
}
function queryMatches(item, q) {
  if (!q) return [];
  const matches = [];
  if (item.title.toLowerCase().includes(q)) matches.push({ field: "title", value: item.title });
  if (item.text.toLowerCase().includes(q)) matches.push({ field: "text", value: item.text });
  for (const tag of item.tags) {
    if (tag.toLowerCase().includes(q)) matches.push({ field: "tag", value: tag });
  }
  for (const concept of item.concepts) {
    if (concept.toLowerCase().includes(q)) matches.push({ field: "concept", value: concept });
  }
  return matches;
}
function rankMatches(matches, weights) {
  return matches.reduce((total, match) => total + weights[match.field], 0);
}
function clipSnippet(value, q, maxLength) {
  const normalizedLength = Math.max(20, maxLength);
  if (!value) return "";
  if (!q) return value.length > normalizedLength ? `${value.slice(0, normalizedLength).trimEnd()}...` : value;
  const lower = value.toLowerCase();
  const index = lower.indexOf(q);
  if (index < 0) return value.length > normalizedLength ? `${value.slice(0, normalizedLength).trimEnd()}...` : value;
  const context = Math.max(0, Math.floor((normalizedLength - q.length) / 2));
  const start = Math.max(0, index - context);
  const end = Math.min(value.length, start + normalizedLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < value.length ? "..." : "";
  return `${prefix}${value.slice(start, end).trim()}${suffix}`;
}
function createSnippet(item, matches, q, maxLength) {
  const textMatch = matches.find((match) => match.field === "text");
  const titleMatch = matches.find((match) => match.field === "title");
  const firstMatch = textMatch ?? titleMatch ?? matches[0];
  return clipSnippet(firstMatch?.value ?? item.text, q, maxLength);
}
function createRankedEntries(items, q, options, ordinalBase = 0) {
  const weights = { ...DEFAULT_QUERY_WEIGHTS, ...options.weights };
  return items.map((item, ordinal) => ({ item, ordinal: ordinalBase + ordinal, matches: queryMatches(item, q) })).filter(({ item, matches }) => {
    if (q && matches.length === 0) return false;
    if (options.types && !options.types.includes(item.type)) return false;
    if (options.privacy && !options.privacy.includes(item.privacy.classification)) return false;
    if (!includesAll(item.tags, options.tags)) return false;
    if (!includesAll(item.concepts, options.concepts)) return false;
    if (!matchesFacetFilters(item, options.facets)) return false;
    if (options.relationshipTargetId && !(item.relationships ?? []).some((rel) => rel.target_id === options.relationshipTargetId)) {
      return false;
    }
    return true;
  }).map(({ item, ordinal, matches }) => ({
    item,
    ordinal,
    rank: rankMatches(matches, weights),
    matches
  }));
}
function sortRankedEntries(entries, rank) {
  return [...entries].sort((left, right) => {
    if (rank) return right.rank - left.rank || left.ordinal - right.ordinal;
    return left.ordinal - right.ordinal;
  });
}
function createQueryResultFromRankedEntries(entries, query, options) {
  const ranked = sortRankedEntries(entries, options.rank);
  const offset = options.offset ?? 0;
  const limit = options.limit ?? ranked.length;
  const page = ranked.slice(offset, offset + limit);
  const result = {
    items: page.map((entry) => entry.item),
    total: ranked.length,
    facets: getAiwgFortemiFacets(ranked.map((entry) => entry.item))
  };
  if (options.rank || options.snippets || options.includeMatches) {
    const snippetLength = options.snippetLength ?? 160;
    result.rankedItems = page.map((entry) => ({
      item: entry.item,
      rank: entry.rank,
      ...options.snippets ? { snippet: createSnippet(entry.item, entry.matches, query, snippetLength) } : {},
      ...options.includeMatches ? { matches: entry.matches } : {}
    }));
  }
  return result;
}
function queryAiwgFortemiIndex(index, query = "", options = {}) {
  const q = query.trim().toLowerCase();
  return createQueryResultFromRankedEntries(createRankedEntries(index.items, q, options), q, options);
}
function chunkPartCacheKey(part) {
  return `${part.offset}:${part.href}`;
}
function clampMaxCachedParts(value) {
  if (!hasPositiveInteger(value)) return 3;
  return value;
}
function clampMaxCachedDetails(value) {
  if (!hasPositiveInteger(value)) return 32;
  return value;
}
function isDirectChunkBrowse(query, options) {
  return query.trim() === "" && !options.rank && !options.snippets && !options.includeMatches && !options.types && !options.facets && !options.tags && !options.concepts && !options.privacy && !options.relationshipTargetId;
}
function getPartsForRange(manifest, offset, limit) {
  const end = offset + limit;
  return manifest.parts.filter((part) => part.count > 0 && part.offset < end && part.offset + part.count > offset);
}
async function loadChunkPart(runtime, part) {
  const key = chunkPartCacheKey(part);
  const cached = runtime.partCache.get(key);
  if (cached) {
    runtime.partCache.delete(key);
    runtime.partCache.set(key, cached);
    return { part: cached, fetched: false };
  }
  const parsed = assertAiwgFortemiChunkPart(await runtime.loader(part, runtime.manifest), part, runtime.manifest);
  runtime.partCache.set(key, parsed);
  while (runtime.partCache.size > runtime.maxCachedParts) {
    const oldest = runtime.partCache.keys().next().value;
    if (oldest === void 0) break;
    runtime.partCache.delete(oldest);
  }
  return { part: parsed, fetched: true };
}
async function getChunkRecord(runtime, id) {
  const cached = runtime.detailCache.get(id);
  if (cached) {
    runtime.detailCache.delete(id);
    runtime.detailCache.set(id, cached);
    return cached;
  }
  if (!runtime.manifest.projection) {
    for (const part of runtime.partCache.values()) {
      const found = part.items.find((item) => item.id === id);
      if (found) return found;
    }
  }
  if (!runtime.detailLoader) {
    throw new Error("No detailLoader configured to resolve record " + id);
  }
  const raw = await runtime.detailLoader(id, runtime.manifest);
  const record = assertAiwgFortemiIndexExport({
    schema_version: "aiwg.fortemi.index.export.v1",
    generated_at: runtime.manifest.generated_at,
    source: runtime.manifest.source,
    items: [raw]
  }).items[0];
  if (record.id !== id) {
    throw new Error("Detail record id mismatch: expected " + id + ", got " + record.id);
  }
  runtime.detailCache.set(id, record);
  while (runtime.detailCache.size > runtime.maxCachedDetails) {
    const oldest = runtime.detailCache.keys().next().value;
    if (oldest === void 0) break;
    runtime.detailCache.delete(oldest);
  }
  return record;
}
async function queryChunkedAiwgFortemiIndex(runtime, query = "", options = {}) {
  const q = query.trim().toLowerCase();
  let scannedParts = 0;
  let fetchedParts = 0;
  if (isDirectChunkBrowse(query, options)) {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? runtime.manifest.total;
    const parts = getPartsForRange(runtime.manifest, offset, limit);
    const items = [];
    for (const partRef of parts) {
      const loaded = await loadChunkPart(runtime, partRef);
      if (loaded.fetched) fetchedParts += 1;
      scannedParts += 1;
      options.onProgress?.({ phase: "part", done: scannedParts, total: parts.length, href: partRef.href });
      const start = Math.max(0, offset - partRef.offset);
      const end = Math.min(loaded.part.items.length, offset + limit - partRef.offset);
      items.push(...loaded.part.items.slice(start, end));
    }
    return {
      items,
      total: runtime.manifest.total,
      facets: runtime.manifest.facets ?? {},
      manifestTotal: runtime.manifest.total,
      scannedParts,
      fetchedParts,
      complete: true
    };
  }
  const entries = [];
  for (const partRef of runtime.manifest.parts) {
    const loaded = await loadChunkPart(runtime, partRef);
    if (loaded.fetched) fetchedParts += 1;
    scannedParts += 1;
    options.onProgress?.({ phase: "part", done: scannedParts, total: runtime.manifest.parts.length, href: partRef.href });
    entries.push(...createRankedEntries(loaded.part.items, q, options, partRef.offset));
    options.onProgress?.({ phase: "query", done: scannedParts, total: runtime.manifest.parts.length, href: partRef.href });
  }
  return {
    ...createQueryResultFromRankedEntries(entries, q, options),
    manifestTotal: runtime.manifest.total,
    scannedParts,
    fetchedParts,
    complete: true
  };
}
function createAiwgReviewDecisionExport(source, decisions, generatedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    schema_version: "aiwg.fortemi.review-decisions.v1",
    generated_at: generatedAt,
    source_export_schema_version: source.schema_version,
    decisions: [...decisions].sort((left, right) => left.item_id.localeCompare(right.item_id))
  };
}
function createAiwgIndexController(initialIndex) {
  let index = initialIndex ?? null;
  let chunked = null;
  let data = null;
  let error = null;
  let reviewDecisions = [];
  const listeners = /* @__PURE__ */ new Set();
  const snapshot = () => ({
    index,
    chunked: chunked ? {
      manifest: chunked.manifest,
      cachedParts: chunked.partCache.size,
      maxCachedParts: chunked.maxCachedParts
    } : null,
    data,
    error,
    reviewDecisions: [...reviewDecisions]
  });
  const notify = () => {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  };
  const requireIndex = () => {
    if (!index) throw new Error("No AIWG index export loaded");
    return index;
  };
  return {
    loadIndex(value) {
      try {
        const parsed = assertAiwgFortemiIndexExport(value);
        index = parsed;
        chunked = null;
        data = null;
        reviewDecisions = [];
        error = null;
        notify();
        return parsed;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        notify();
        throw error;
      }
    },
    loadChunkedIndex(manifest, loader, options = {}) {
      try {
        const parsed = assertAiwgFortemiChunkManifest(manifest);
        index = null;
        chunked = {
          manifest: parsed,
          loader,
          maxCachedParts: clampMaxCachedParts(options.maxCachedParts),
          partCache: /* @__PURE__ */ new Map(),
          detailLoader: options.detailLoader,
          maxCachedDetails: clampMaxCachedDetails(options.maxCachedDetails),
          detailCache: /* @__PURE__ */ new Map()
        };
        data = null;
        reviewDecisions = [];
        error = null;
        notify();
        return parsed;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        notify();
        throw error;
      }
    },
    getIndex() {
      return index;
    },
    getChunkedManifest() {
      return chunked?.manifest ?? null;
    },
    getSnapshot() {
      return snapshot();
    },
    query(query = "", options) {
      const result = queryAiwgFortemiIndex(requireIndex(), query, options);
      data = result;
      error = null;
      notify();
      return result;
    },
    async queryChunked(query = "", options) {
      if (!chunked) throw new Error("No AIWG chunked index manifest loaded");
      try {
        const result = await queryChunkedAiwgFortemiIndex(chunked, query, options);
        data = result;
        error = null;
        notify();
        return result;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        notify();
        throw error;
      }
    },
    async getRecord(id) {
      if (chunked) {
        try {
          return await getChunkRecord(chunked, id);
        } catch (err) {
          error = err instanceof Error ? err : new Error(String(err));
          notify();
          throw error;
        }
      }
      const found = requireIndex().items.find((item) => item.id === id);
      if (!found) throw new Error("Record not found: " + id);
      return found;
    },
    clearChunkCache() {
      chunked?.partCache.clear();
      chunked?.detailCache.clear();
      error = null;
      notify();
    },
    toCommunityGraph(options) {
      return aiwgFortemiIndexToCommunityGraph(requireIndex(), options);
    },
    setReviewDecision(input) {
      const decision = {
        ...input,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      reviewDecisions = [
        ...reviewDecisions.filter((item) => item.item_id !== decision.item_id),
        decision
      ].sort((left, right) => left.item_id.localeCompare(right.item_id));
      error = null;
      notify();
      return decision;
    },
    clearReviewDecision(itemId) {
      reviewDecisions = reviewDecisions.filter((item) => item.item_id !== itemId);
      error = null;
      notify();
    },
    createReviewDecisionExport(generatedAt) {
      return createAiwgReviewDecisionExport(requireIndex(), reviewDecisions, generatedAt);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
function aiwgFortemiIndexToCommunityGraph(index, options = {}) {
  const ids = new Set(index.items.map((item) => item.id));
  const relationshipWeights = options.relationshipWeights ?? {};
  const edgeCounts = /* @__PURE__ */ new Map();
  for (const item of index.items) {
    for (const relationship of item.relationships) {
      if (!ids.has(relationship.target_id) && !options.includeDanglingRelationships) continue;
      const kind = relationship.type;
      const baseWeight = relationshipWeights[kind] ?? 1;
      const key = `${item.id}\0${relationship.target_id}\0${kind}`;
      const existing = edgeCounts.get(key);
      if (existing) existing.weight += baseWeight;
      else edgeCounts.set(key, { source: item.id, target: relationship.target_id, kind, weight: baseWeight });
    }
  }
  const communities = /* @__PURE__ */ new Map();
  for (const item of index.items) {
    const communityIds = communityIdsFor(item, options);
    for (const communityId of communityIds) {
      const nodes = communities.get(communityId) ?? [];
      nodes.push(item.id);
      communities.set(communityId, nodes);
    }
  }
  return {
    nodes: index.items.map((item) => ({ id: item.id })),
    edges: Array.from(edgeCounts.values()).sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target) || left.kind.localeCompare(right.kind)),
    communities: Array.from(communities.entries()).map(([id, nodes]) => ({ id, nodes: [...new Set(nodes)].sort() })).sort((left, right) => left.id.localeCompare(right.id))
  };
}
function communityIdsFor(item, options) {
  if (options.communityFacet) {
    const values = item.facets[options.communityFacet] ?? [];
    if (values.length > 0) return values.map((value) => `${options.communityFacet}:${value}`);
  }
  if (options.communityTagPrefix) {
    const prefix = options.communityTagPrefix;
    const tags = item.tags.filter((tag) => tag.startsWith(prefix));
    if (tags.length > 0) return tags;
  }
  if (item.concepts.length > 0) return item.concepts.map((concept) => `concept:${concept}`);
  return [`type:${item.type}`];
}

export { AIWG_SCAN_REQUIRED_FIELDS, aiwgFortemiIndexToCommunityGraph, assertAiwgFortemiChunkManifest, assertAiwgFortemiChunkPart, assertAiwgFortemiIndexExport, buildAiwgChunkedIndex, createAiwgFetchChunkLoader, createAiwgFetchDetailLoader, createAiwgIndexController, createAiwgReviewDecisionExport, getAiwgFortemiFacets, queryAiwgFortemiIndex, validateAiwgFortemiChunkManifest, validateAiwgFortemiChunkPart, validateAiwgFortemiIndexExport };
//# sourceMappingURL=aiwg-index.js.map
//# sourceMappingURL=aiwg-index.js.map
