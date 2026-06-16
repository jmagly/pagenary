/**
 * Docs Map (#33) — an optional, framework-free relationship view of the docs
 * corpus, rendered from buildCommunityGraph(). No React, no canvas libs: a
 * small clustered-radial SVG layout, drawn with the DOM API.
 *
 * Shipped as a section module (sections/docs-map.js re-exports load) only when
 * a tenant sets `docsMap.enabled`. The build also injects a `docs-map` entry
 * into MANIFEST so the standard router/nav/command-palette drive it — no
 * changes to app.js.
 */
import { buildCommunityGraph, flattenManifest } from './search.js';
import { MANIFEST } from '../manifest.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 700;

function sectionIdFromNode(nodeId) {
  return String(nodeId).replace(/^docs:page:/, '');
}

/** Map node/section id -> human title from the flattened manifest. */
function buildLabelMap(manifest) {
  const map = new Map();
  for (const section of flattenManifest(manifest)) {
    if (section && section.id) map.set(section.id, section.title || section.id);
  }
  return map;
}

/**
 * Compute {x,y} positions: communities arranged on a ring, each community's
 * member nodes clustered around its anchor. Edges (when present) connect node
 * positions. Returns { positions: Map<nodeId,{x,y}>, communityAnchors }.
 */
function layout(graph) {
  const positions = new Map();
  const communities = graph.communities && graph.communities.length
    ? graph.communities
    : [{ id: 'all', nodes: graph.nodes.map((n) => n.id) }];

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const ringR = Math.min(WIDTH, HEIGHT) * 0.34;
  const clusterR = Math.min(WIDTH, HEIGHT) * 0.12;
  const anchors = [];

  communities.forEach((community, ci) => {
    const a = communities.length === 1
      ? { x: cx, y: cy }
      : { x: cx + ringR * Math.cos((2 * Math.PI * ci) / communities.length - Math.PI / 2),
          y: cy + ringR * Math.sin((2 * Math.PI * ci) / communities.length - Math.PI / 2) };
    anchors.push({ id: community.id, x: a.x, y: a.y, index: ci });

    const members = community.nodes || [];
    members.forEach((nodeId, mi) => {
      if (members.length === 1) {
        positions.set(nodeId, { x: a.x, y: a.y, community: ci });
      } else {
        const ang = (2 * Math.PI * mi) / members.length;
        positions.set(nodeId, {
          x: a.x + clusterR * Math.cos(ang),
          y: a.y + clusterR * Math.sin(ang),
          community: ci
        });
      }
    });
  });

  // Any node not placed by a community → drop near center.
  graph.nodes.forEach((n, i) => {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: cx + (i % 5) * 12 - 24, y: cy, community: -1 });
    }
  });

  return { positions, anchors, communityCount: communities.length };
}

function edgeEnds(edge) {
  const s = edge.source ?? edge.from ?? (Array.isArray(edge) ? edge[0] : null);
  const t = edge.target ?? edge.to ?? (Array.isArray(edge) ? edge[1] : null);
  return [s, t];
}

/**
 * Render the graph into `container`. Pure-ish: no globals beyond the DOM passed.
 * @param {Element} container
 * @param {object} graph - { nodes, edges, communities }
 * @param {object} opts - { labelFor(nodeId)->string, onNavigate(sectionId) }
 */
export function renderDocsMap(container, graph, opts = {}) {
  if (!container) return;
  container.textContent = '';

  const nodes = (graph && graph.nodes) || [];
  if (nodes.length < 2) {
    const note = document.createElement('p');
    note.className = 'docs-map-empty';
    note.textContent = 'Not enough pages to map yet — add a few more sections to see how they relate.';
    container.appendChild(note);
    return;
  }

  const labelFor = opts.labelFor || ((id) => sectionIdFromNode(id));
  const onNavigate = opts.onNavigate || (() => {});
  const { positions, anchors, communityCount } = layout(graph);
  const hue = (ci) => (ci < 0 ? 0 : Math.round((360 * ci) / Math.max(1, communityCount)));

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'docs-map-svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Relationship map of ${nodes.length} documentation pages`);

  // Edges (under nodes). Sparse corpora may have none — that's fine.
  for (const edge of (graph.edges || [])) {
    const [s, t] = edgeEnds(edge);
    const a = positions.get(s);
    const b = positions.get(t);
    if (!a || !b) continue;
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', 'docs-map-edge');
    svg.appendChild(line);
  }

  // Community labels.
  anchors.forEach((anchor) => {
    if (anchor.id === 'all') return;
    const label = document.createElementNS(SVGNS, 'text');
    label.setAttribute('x', anchor.x);
    label.setAttribute('y', anchor.y - (Math.min(WIDTH, HEIGHT) * 0.12) - 10);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'docs-map-community');
    label.setAttribute('fill', `hsl(${hue(anchor.index)} 60% 55%)`);
    label.textContent = String(anchor.id).replace(/^[a-z]+:/, '').replace(/[-_]/g, ' ');
    svg.appendChild(label);
  });

  // Nodes (interactive).
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const sectionId = sectionIdFromNode(node.id);
    const title = labelFor(node.id);

    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'docs-map-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'link');
    g.setAttribute('aria-label', title);

    const circle = document.createElementNS(SVGNS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', 8);
    circle.setAttribute('fill', `hsl(${hue(pos.community)} 60% 55%)`);
    g.appendChild(circle);

    const text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('x', pos.x + 12);
    text.setAttribute('y', pos.y + 4);
    text.setAttribute('class', 'docs-map-label');
    text.textContent = title;
    g.appendChild(text);

    const go = () => onNavigate(sectionId);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    svg.appendChild(g);
  }

  container.appendChild(svg);
}

const DOCS_MAP_HTML = [
  '<section class="section doc">',
  '  <div class="doc-content">',
  '    <header>',
  '      <p class="eyebrow">Overview</p>',
  '      <h1>Docs Map</h1>',
  '      <p class="lead">How these pages cluster and relate. Click a node to jump to it.</p>',
  '    </header>',
  '    <div id="docsMapRoot" class="docs-map"></div>',
  '  </div>',
  '</section>'
].join('\n');

/**
 * Render a pre-built graph embedded at build time. The build extracts concepts
 * from full page text (which the runtime, seeing only title+summary, cannot),
 * so the embedded graph has richer communities and concept-derived edges.
 *
 * @param {object} graph - { nodes, edges, communities }
 * @param {Array<[string,string]>|Record<string,string>} [labels] - id → title
 * @returns {{ html: string, afterRender: (app: Element) => void }}
 */
export function loadDocsMap(graph, labels) {
  const labelMap = labels instanceof Map
    ? labels
    : new Map(Array.isArray(labels) ? labels : Object.entries(labels || {}));
  return {
    html: DOCS_MAP_HTML,
    afterRender(app) {
      const root = app.querySelector('#docsMapRoot');
      if (!root) return;
      renderDocsMap(root, graph || { nodes: [], edges: [], communities: [] }, {
        labelFor: (nodeId) => labelMap.get(sectionIdFromNode(nodeId)) || sectionIdFromNode(nodeId),
        onNavigate: (sectionId) => { location.hash = `#${sectionId}`; }
      });
    }
  };
}

/** Section-module entry point. Computes the graph client-side from MANIFEST. */
export async function load() {
  return {
    html: DOCS_MAP_HTML,
    afterRender(app) {
      const root = app.querySelector('#docsMapRoot');
      if (!root) return;
      let graph;
      try {
        graph = buildCommunityGraph(MANIFEST);
      } catch {
        graph = { nodes: [], edges: [], communities: [] };
      }
      const labels = buildLabelMap(MANIFEST);
      renderDocsMap(root, graph, {
        labelFor: (nodeId) => labels.get(sectionIdFromNode(nodeId)) || sectionIdFromNode(nodeId),
        onNavigate: (sectionId) => { location.hash = `#${sectionId}`; }
      });
    }
  };
}
