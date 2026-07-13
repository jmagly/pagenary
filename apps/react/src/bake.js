// Build-time docs-map snapshot baking (#133). Runs the deterministic
// @fortemi/graph layout once at publish time and emits a render-ready
// RenderGraph JSON (sorted nodes/links — stable bytes for git diffs and CI).
// Consumed by renderer tiers that support warm-starting from baked positions
// (the Sigma 2D explorer's `snapshot` prop); loaders fall back to a live
// layout when the snapshot is absent or malformed, so emitting it is always
// safe. Node-only concern — no React imports here.

import { bakeRenderGraph, stringifyRenderGraph } from '@fortemi/graph';
import { labelFor, toCommunityGraph } from './docs-map/graph-data.js';

/**
 * Bake a docs-map graph into a deterministic RenderGraph snapshot string.
 *
 * @param {object} rawGraph  DOCS_MAP_GRAPH-shaped data ({ nodes, edges, communities })
 * @param {object} [options]
 * @param {object} [options.labels]     DOCS_MAP_LABELS map for node labels
 * @param {string} [options.algorithm]  layout algorithm (default 'community')
 * @param {number} [options.width]      layout width (default 960)
 * @param {number} [options.height]     layout height (default 540)
 * @returns {string|null} deterministic JSON, or null when there is nothing to bake
 */
export function bakeDocsMapSnapshot(rawGraph, options = {}) {
  const graph = toCommunityGraph(rawGraph);
  if (!graph.nodes.length) return null;
  const {
    labels = {},
    algorithm = 'community',
    width = 960,
    height = 540,
  } = options;
  const baked = bakeRenderGraph(graph, {
    layout: { algorithm, width, height },
    labelFor: (id) => labelFor(id, labels),
  });
  return stringifyRenderGraph(baked);
}

export default { bakeDocsMapSnapshot };
