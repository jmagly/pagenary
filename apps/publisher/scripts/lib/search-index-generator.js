/**
 * Build-time Fortemi search-index generator.
 *
 * After a tenant's manifest.js + sections/ are materialized, this emits a
 * deterministic chunked static index that the runtime adapter (src/lib/search.js)
 * loads through the vendored @fortemi/core controller:
 *
 *   dist/<tenant>/search-index/manifest.json   (AiwgFortemiChunkManifest)
 *   dist/<tenant>/search-index/part-0000.json   (AiwgFortemiChunkPart)
 *   ...
 *
 * Text is extracted by importing each section module and calling load(), the
 * same contract the renderer uses, then stripping HTML without a DOM. The corpus
 * is deterministic (sorted by record id, content-hashed generated_at) so repeat
 * builds are byte-identical and incremental rebuilds refresh stale entries.
 */
import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';
import {
  buildFortemiIndexExport,
  chunkFortemiIndex,
  stripHtml,
  DEFAULT_PART_SIZE
} from '../../src/lib/fortemi-corpus.js';
import { flattenManifest } from '../../src/lib/search.js';

const SEARCH_INDEX_DIR = 'search-index';

async function pathExists(target) {
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Import a materialized section module and return its plain-text content.
 * Resilient: a module that fails to load degrades to title/summary text, exactly
 * as the runtime search index does.
 * @param {object} section - Flattened section with a `module` path (./sections/x.js)
 * @param {string} distDir - Tenant output directory
 * @returns {Promise<string>}
 */
async function extractSectionText(section, distDir) {
  if (!section.module) return '';
  const rel = section.module.replace(/^\.?\//, '');
  const abs = path.resolve(distDir, rel);
  if (!(await pathExists(abs))) return '';
  try {
    const mod = await import(pathToFileURL(abs).href);
    const loader = mod.load || mod.default;
    if (typeof loader !== 'function') return '';
    const payload = await loader();
    return stripHtml(payload && payload.html ? payload.html : '');
  } catch {
    return '';
  }
}

/**
 * Generate and write the chunked Fortemi index for one tenant bundle.
 * @param {string} distDir - Tenant output directory (contains manifest.js, sections/)
 * @param {Array} processedManifest - The nested manifest array written to manifest.js
 * @param {object} [options]
 * @param {string} [options.tenantId='pagenary']
 * @param {number} [options.partSize=DEFAULT_PART_SIZE]
 * @returns {Promise<{ total: number, parts: number, buildHash: string }>}
 */
export async function generateSearchIndex(distDir, processedManifest, options = {}) {
  const tenantId = options.tenantId || 'pagenary';
  const partSize = options.partSize || DEFAULT_PART_SIZE;
  const outDir = path.join(distDir, SEARCH_INDEX_DIR);

  const flat = flattenManifest(processedManifest || []);
  const entries = [];
  for (const section of flat) {
    if (!section || !section.id) continue;
    const content = await extractSectionText(section, distDir);
    const text = `${section.title || ''} ${section.summary || ''} ${section.group || ''} ${content}`.trim();
    entries.push({ section, text });
  }

  const { index, buildHash } = buildFortemiIndexExport(entries, { repo: tenantId });
  const { manifest, parts } = chunkFortemiIndex(index, { partSize });

  // Replace the directory wholesale so stale parts from a larger prior corpus
  // never linger (incremental-build correctness).
  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });

  await fsp.writeFile(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  await Promise.all(parts.map((part, i) =>
    fsp.writeFile(
      path.join(outDir, manifest.parts[i].href),
      `${JSON.stringify(part, null, 2)}\n`,
      'utf8'
    )));

  console.log(`  ↳ search index: ${manifest.total} record(s) in ${parts.length} part(s) [${buildHash.slice(0, 8)}]`);
  return { total: manifest.total, parts: parts.length, buildHash };
}

export { SEARCH_INDEX_DIR };
