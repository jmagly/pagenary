/**
 * Section-scoped layout (shell) resolution (#90, ADR-016).
 *
 * A "layout" is the **shell** (chrome) wrapped around a route's content:
 *   - `docs` — sidebar + content + on-this-page TOC (the default)
 *   - `blog` — reading-first index + post pages
 * Room is reserved for future shells (e.g. `landing`, `api`).
 *
 * Historically `layout` was tenant-global (`config.layout`, applied once at build
 * as `body[data-layout]`). This module makes the shell resolvable per
 * nav group / collection / section, with the tenant value as the lowest-precedence
 * default — so a single site can mix a docs group and a blog group.
 *
 * Pure functions only: no DOM, no Node. Imported by both the runtime (`app.js`)
 * and the build (`build-tenants.js`), so it must stay dependency-free.
 */

/** Closed set of known shells. Extend here when a new shell ships. */
export const LAYOUTS = new Set(['docs', 'blog']);

/** The lowest-precedence fallback when nothing declares a layout. */
export const DEFAULT_LAYOUT = 'docs';

/**
 * Normalize a candidate layout value to a known shell id, or `null`.
 *
 * Unknown / malformed values are treated as "not declared" (→ `null`) rather
 * than throwing, mirroring the build's existing lenient warn-and-default
 * behavior for `navPosition` / `layout`. The caller decides the fallback.
 *
 * @param {unknown} value
 * @returns {string|null} a member of LAYOUTS, or null
 */
export function normalizeLayout(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return LAYOUTS.has(v) ? v : null;
}

/**
 * Strip leading/trailing slashes so collection `route` ("/blog") and `path`
 * ("blog") compare equal, and a leaf's attached `collection` ("/blog") matches.
 * @param {unknown} value
 * @returns {string}
 */
function stripSlashes(value) {
  return String(value == null ? '' : value).replace(/^\/+|\/+$/g, '');
}

/**
 * Resolve the active shell for a route by precedence (most specific wins):
 *
 *   section ?? collection ?? group ?? tenant ?? "docs"
 *
 * Each input is an optional raw layout value (string or undefined). Invalid or
 * absent values are skipped; the result is always a valid shell id.
 *
 * @param {object} [parts]
 * @param {unknown} [parts.section]    section-level `layout`
 * @param {unknown} [parts.collection] collection-level `layout`
 * @param {unknown} [parts.group]      nav-group-level `layout`
 * @param {unknown} [parts.tenant]     tenant-level `layout` (config.layout)
 * @returns {string} a member of LAYOUTS
 */
export function resolveLayout({ section, collection, group, tenant } = {}) {
  return (
    normalizeLayout(section) ??
    normalizeLayout(collection) ??
    normalizeLayout(group) ??
    normalizeLayout(tenant) ??
    DEFAULT_LAYOUT
  );
}

/**
 * Walk a processed manifest tree and resolve every leaf section's shell into a
 * flat `{ sectionId: shell }` map (ADR-016 phase 2). The build emits this map
 * into `manifest.js`; the runtime reads it on navigation.
 *
 * Precedence per leaf: `section.layout ?? collection.layout ?? group.layout ??
 * tenant ?? "docs"`. A leaf's collection is matched by its attached `collection`
 * field (a route like "/blog") against the tenant's `collections[]` config.
 *
 * @param {object} [opts]
 * @param {Array}  [opts.manifest]    processed manifest entries (groups + leaves)
 * @param {Array}  [opts.collections] tenant `config.collections` ({path,route,layout})
 * @param {unknown}[opts.tenant]      tenant-level `config.layout`
 * @returns {Object<string,string>} map of sectionId → shell
 */
export function buildSectionLayoutMap({ manifest = [], collections = [], tenant } = {}) {
  const map = {};

  // Index collections by both their route and path (slash-normalized) so a
  // leaf's `collection` field resolves regardless of which form it carries.
  const collByKey = new Map();
  for (const c of Array.isArray(collections) ? collections : []) {
    if (!c || typeof c !== 'object') continue;
    for (const key of [c.route, c.path]) {
      if (key) collByKey.set(stripSlashes(key), c);
    }
  }

  const walk = (entries, groupLayout) => {
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || typeof entry !== 'object') continue;
      if (Array.isArray(entry.subsections) && entry.subsections.length) {
        // A group may declare its own layout; otherwise it inherits the layout
        // of an enclosing group (nested groups), else undefined (→ tenant).
        const nextGroupLayout = normalizeLayout(entry.layout) ?? groupLayout;
        walk(entry.subsections, nextGroupLayout);
        continue;
      }
      const coll = entry.collection ? collByKey.get(stripSlashes(entry.collection)) : null;
      map[entry.id] = resolveLayout({
        section: entry.layout,
        collection: coll ? coll.layout : undefined,
        group: groupLayout,
        tenant
      });
    }
  };

  walk(manifest, undefined);
  return map;
}
