// Pure docs-map graph data helpers — no React, safe to import from Node
// build tooling (the bake step) and from the browser control alike.

export function sectionIdFromNode(nodeId) {
  return String(nodeId || '').replace(/^docs:page:/, '');
}

export function humanize(value) {
  return String(value || '')
    .replace(/^[a-z]+:/, '')
    .replace(/^docs:page:/, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function labelFor(nodeId, labels = {}) {
  const sectionId = sectionIdFromNode(nodeId);
  return labels[sectionId] || labels[nodeId] || humanize(sectionId);
}

/** Coerce a raw docs-map graph into a @fortemi/graph CommunityGraph. */
export function toCommunityGraph(graph) {
  const nodes = Array.isArray(graph?.nodes)
    ? graph.nodes.map((node) => ({ id: node.id }))
    : [];
  const ids = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(graph?.edges)
    ? graph.edges
        .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          weight: Number.isFinite(Number(edge.weight)) && Number(edge.weight) > 0 ? Number(edge.weight) : 1,
          kind: edge.kind || 'related',
        }))
    : [];
  const communities = Array.isArray(graph?.communities)
    ? graph.communities.map((community) => ({
        id: community.id,
        nodes: (community.nodes || []).filter((id) => ids.has(id)),
      }))
    : [];
  return { nodes, edges, communities };
}
