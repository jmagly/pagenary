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
const SIMULATION_TICKS = 220;
const NODE_MIN_RADIUS = 7;
const NODE_MAX_RADIUS = 18;

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
 * Compute settled {x,y} positions. We seed from the community ring so groups
 * remain legible, then run a deterministic force pass before emitting SVG.
 */
export function layout(graph) {
  const positions = new Map();
  const communities = graph.communities && graph.communities.length
    ? graph.communities
    : [{ id: 'all', nodes: graph.nodes.map((n) => n.id) }];
  const degrees = buildDegreeMap(graph.edges);
  const radii = new Map();

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
        positions.set(nodeId, { x: a.x, y: a.y, vx: 0, vy: 0, community: ci });
      } else {
        const ang = (2 * Math.PI * mi) / members.length;
        positions.set(nodeId, {
          x: a.x + clusterR * Math.cos(ang),
          y: a.y + clusterR * Math.sin(ang),
          vx: 0,
          vy: 0,
          community: ci
        });
      }
    });
  });

  // Any node not placed by a community → drop near center.
  graph.nodes.forEach((n, i) => {
    radii.set(n.id, nodeRadius(n, degrees));
    if (!positions.has(n.id)) {
      positions.set(n.id, {
        x: cx + (i % 5) * 12 - 24,
        y: cy + seededOffset(n.id, 17) * 24,
        vx: 0,
        vy: 0,
        community: -1
      });
    }
  });

  const simulationNodes = graph.nodes
    .map((node) => {
      const pos = positions.get(node.id);
      if (!pos) return null;
      return { id: node.id, ...pos, radius: radii.get(node.id) || NODE_MIN_RADIUS };
    })
    .filter(Boolean);
  const byId = new Map(simulationNodes.map((node) => [node.id, node]));
  const links = (graph.edges || [])
    .map((edge) => {
      const [s, t] = edgeEnds(edge);
      const source = byId.get(s);
      const target = byId.get(t);
      return source && target ? { source, target, weight: edgeWeight(edge) } : null;
    })
    .filter(Boolean);

  for (let tick = 0; tick < SIMULATION_TICKS; tick += 1) {
    const alpha = Math.pow(1 - (tick / SIMULATION_TICKS), 1.45);

    for (const link of links) {
      const seed = `${link.source.id}:${link.target.id}`;
      const dx = link.target.x - link.source.x || seededOffset(seed, 3) * 0.01;
      const dy = link.target.y - link.source.y || seededOffset(seed, 5) * 0.01;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const desired = Math.max(70, 132 - Math.min(5, link.weight) * 6);
      const pull = ((distance - desired) / distance) * 0.018 * alpha;
      const fx = dx * pull;
      const fy = dy * pull;
      link.source.vx += fx;
      link.source.vy += fy;
      link.target.vx -= fx;
      link.target.vy -= fy;
    }

    for (let i = 0; i < simulationNodes.length; i += 1) {
      const a = simulationNodes[i];
      for (let j = i + 1; j < simulationNodes.length; j += 1) {
        const b = simulationNodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          const seed = `${a.id}:${b.id}`;
          dx = seededOffset(seed, 7) || 0.01;
          dy = seededOffset(seed, 11) || 0.01;
          distance = Math.hypot(dx, dy);
        }

        const clearance = a.radius + b.radius + 5;
        const repel = (7000 * alpha) / Math.max(144, distance * distance);
        const rx = (dx / distance) * repel;
        const ry = (dy / distance) * repel;
        a.vx -= rx;
        a.vy -= ry;
        b.vx += rx;
        b.vy += ry;

        if (distance < clearance) {
          const push = ((clearance - distance) / distance) * 0.22 * alpha;
          const px = dx * push;
          const py = dy * push;
          a.vx -= px;
          a.vy -= py;
          b.vx += px;
          b.vy += py;
        }
      }
    }

    for (const node of simulationNodes) {
      const anchor = anchors[node.community];
      const targetX = anchor ? anchor.x : cx;
      const targetY = anchor ? anchor.y : cy;
      node.vx += (targetX - node.x) * 0.0025 * alpha;
      node.vy += (targetY - node.y) * 0.0025 * alpha;
      node.vx += (cx - node.x) * 0.0008 * alpha;
      node.vy += (cy - node.y) * 0.0008 * alpha;
      node.vx *= 0.82;
      node.vy *= 0.82;
      node.x = Math.max(node.radius + 8, Math.min(WIDTH - node.radius - 8, node.x + node.vx));
      node.y = Math.max(node.radius + 8, Math.min(HEIGHT - node.radius - 8, node.y + node.vy));
    }
  }

  for (const node of simulationNodes) {
    positions.set(node.id, {
      x: Number(node.x.toFixed(2)),
      y: Number(node.y.toFixed(2)),
      community: node.community
    });
    radii.set(node.id, Number(node.radius.toFixed(2)));
  }

  return { positions, radii, anchors, communityCount: communities.length };
}

export function edgeEnds(edge) {
  const s = edge.source ?? edge.from ?? (Array.isArray(edge) ? edge[0] : null);
  const t = edge.target ?? edge.to ?? (Array.isArray(edge) ? edge[1] : null);
  return [s, t];
}

function edgeWeight(edge) {
  const numeric = Number(edge?.weight);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function buildDegreeMap(edges) {
  const degrees = new Map();
  for (const edge of edges || []) {
    const [s, t] = edgeEnds(edge);
    if (!s || !t) continue;
    const weight = edgeWeight(edge);
    degrees.set(s, (degrees.get(s) || 0) + weight);
    degrees.set(t, (degrees.get(t) || 0) + weight);
  }
  return degrees;
}

function nodeRadius(node, degrees) {
  const degree = degrees.get(node.id) || 0;
  return Math.max(NODE_MIN_RADIUS, Math.min(NODE_MAX_RADIUS, NODE_MIN_RADIUS + Math.sqrt(degree) * 2.3));
}

function seededOffset(value, salt = 0) {
  let hash = 2166136261 ^ salt;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) - 0.5;
}

function normalizeMap(value) {
  if (value instanceof Map) return value;
  return new Map(Array.isArray(value) ? value : Object.entries(value || {}));
}

function humanize(value) {
  return String(value || '')
    .replace(/^concept:/, '')
    .replace(/^docs:page:/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function edgeKey(source, target, kind) {
  return `${source}\0${target}\0${kind || 'related'}`;
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${Math.round(Math.max(0, Math.min(1, numeric)) * 100)}%`;
}

function titleText(parts) {
  return parts.filter(Boolean).join('\n');
}

function closestSvgClass(target, className) {
  let current = target;
  while (current && current.nodeType === 1) {
    if (current.classList && current.classList.contains(className)) return current;
    current = current.parentNode;
  }
  return null;
}

function findNodeElement(viewport, nodeId) {
  return Array.from(viewport.querySelectorAll('.docs-map-node'))
    .find((node) => node.dataset.nodeId === nodeId) || null;
}

function createGraphButton(label, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'docs-map-control';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', onClick);
  return button;
}

function createGraphSearch(onSearch) {
  const label = document.createElement('label');
  label.className = 'docs-map-search';
  const text = document.createElement('span');
  text.className = 'sr-only';
  text.textContent = 'Focus page in docs map';
  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Focus page';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Focus page in docs map');
  input.addEventListener('input', () => onSearch(input.value));
  label.append(text, input);
  return label;
}

function createGraphPopup(onNavigate) {
  const panel = document.createElement('aside');
  panel.className = 'docs-map-popup';
  panel.hidden = true;
  panel.dataset.pinned = 'false';
  panel.setAttribute('aria-live', 'polite');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'docs-map-popup-close';
  close.textContent = 'x';
  close.setAttribute('aria-label', 'Close graph details');
  close.addEventListener('click', () => {
    panel.hidden = true;
    panel.dataset.pinned = 'false';
  });
  panel.appendChild(close);

  panel.renderDetails = (detail, pinned = false) => {
    panel.dataset.pinned = String(pinned);
    panel.hidden = false;
    panel.querySelectorAll(':scope > :not(.docs-map-popup-close)').forEach((node) => node.remove());

    const title = document.createElement('h2');
    title.textContent = detail.title;
    panel.appendChild(title);

    if (detail.source) {
      const source = document.createElement('p');
      source.className = 'docs-map-popup-source';
      source.textContent = detail.source;
      panel.appendChild(source);
    }

    if (detail.concepts.length) {
      const chips = document.createElement('div');
      chips.className = 'docs-map-popup-chips';
      detail.concepts.slice(0, 8).forEach((concept) => {
        const chip = document.createElement('span');
        chip.textContent = concept;
        chips.appendChild(chip);
      });
      panel.appendChild(chips);
    }

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'docs-map-popup-open';
    open.textContent = 'Open page';
    open.addEventListener('click', () => onNavigate(detail.sectionId));
    panel.appendChild(open);
  };

  return panel;
}

/**
 * Render the graph into `container`. Pure-ish: no globals beyond the DOM passed.
 * @param {Element} container
 * @param {object} graph - { nodes, edges, communities }
 * @param {object} opts - { labelFor(nodeId)->string, onNavigate(sectionId), metadata }
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
  const nodeMetadata = normalizeMap(opts.metadata?.nodes);
  const edgeMetadata = normalizeMap(opts.metadata?.edges);
  const { positions, radii, anchors, communityCount } = layout(graph);
  const hue = (ci) => (ci < 0 ? 0 : Math.round((360 * ci) / Math.max(1, communityCount)));
  const adjacency = new Map();
  for (const edge of (graph.edges || [])) {
    const [s, t] = edgeEnds(edge);
    if (!s || !t) continue;
    if (!adjacency.has(s)) adjacency.set(s, new Set());
    if (!adjacency.has(t)) adjacency.set(t, new Set());
    adjacency.get(s).add(t);
    adjacency.get(t).add(s);
  }

  let zoom = 1;
  const pan = { x: 0, y: 0 };
  let dragging = false;
  let dragStart = null;
  const stopDrag = (e) => {
    dragging = false;
    dragStart = null;
    if (e && typeof svg.hasPointerCapture === 'function' && svg.hasPointerCapture(e.pointerId)) {
      svg.releasePointerCapture(e.pointerId);
    }
  };

  const controls = document.createElement('div');
  controls.className = 'docs-map-controls';

  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'docs-map-svg');
  svg.setAttribute('viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Relationship map of ${nodes.length} documentation pages`);
  const win = svg.ownerDocument.defaultView;

  const viewport = document.createElementNS(SVGNS, 'g');
  viewport.setAttribute('class', 'docs-map-viewport');
  svg.appendChild(viewport);

  const updateTransform = () => {
    viewport.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
    viewport.querySelectorAll('.docs-map-label').forEach((label) => {
      const node = label.closest('.docs-map-node');
      const active = node && (node.classList.contains('is-active') || node.classList.contains('is-neighbor'));
      label.classList.toggle('is-decluttered', !active && zoom < 1.18);
    });
  };
  const setZoom = (next) => {
    zoom = Math.max(0.55, Math.min(2.8, next));
    updateTransform();
  };
  const resetView = () => {
    zoom = 1;
    pan.x = 0;
    pan.y = 0;
    updateTransform();
  };
  const panBy = (dx, dy) => {
    pan.x += dx;
    pan.y += dy;
    updateTransform();
  };
  const focusNode = (nodeId) => {
    const pos = positions.get(nodeId);
    if (!pos) return false;
    zoom = Math.max(1.25, zoom);
    pan.x = (WIDTH / 2) - (pos.x * zoom);
    pan.y = (HEIGHT / 2) - (pos.y * zoom);
    updateTransform();
    return true;
  };

  controls.append(
    createGraphSearch((query) => {
      const needle = String(query || '').trim().toLowerCase();
      if (!needle) return;
      const match = nodes.find((node) => {
        const sectionId = sectionIdFromNode(node.id);
        const title = labelFor(node.id);
        return sectionId.toLowerCase().includes(needle) || String(title || '').toLowerCase().includes(needle);
      });
      if (!match) return;
      focusNode(match.id);
      const el = findNodeElement(viewport, match.id);
      if (el) {
        el.dispatchEvent(new Event('docs-map-focus-node'));
        el.focus();
      }
    }),
    createGraphButton('+ Zoom', 'Zoom in', () => setZoom(zoom * 1.2)),
    createGraphButton('- Zoom', 'Zoom out', () => setZoom(zoom / 1.2)),
    createGraphButton('←', 'Pan left', () => panBy(48, 0)),
    createGraphButton('↑', 'Pan up', () => panBy(0, 48)),
    createGraphButton('↓', 'Pan down', () => panBy(0, -48)),
    createGraphButton('→', 'Pan right', () => panBy(-48, 0)),
    createGraphButton('Fit', 'Fit graph', resetView)
  );

  const popup = createGraphPopup(onNavigate);

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.88));
  }, { passive: false });
  svg.addEventListener('pointerdown', (e) => {
    if (closestSvgClass(e.target, 'docs-map-node')) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    if (typeof svg.setPointerCapture === 'function') svg.setPointerCapture(e.pointerId);
    win?.addEventListener('pointerup', stopDrag, { once: true });
    win?.addEventListener('pointercancel', stopDrag, { once: true });
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging || !dragStart) return;
    pan.x = dragStart.panX + (e.clientX - dragStart.x);
    pan.y = dragStart.panY + (e.clientY - dragStart.y);
    updateTransform();
  });
  svg.addEventListener('pointerup', stopDrag);
  svg.addEventListener('pointercancel', stopDrag);

  // Edges (under nodes). Sparse corpora may have none — that's fine.
  for (const edge of (graph.edges || [])) {
    const [s, t] = edgeEnds(edge);
    const a = positions.get(s);
    const b = positions.get(t);
    if (!a || !b) continue;
    const meta = edgeMetadata.get(edgeKey(s, t, edge.kind));
    const confidence = formatPercent(meta?.confidence);
    const shared = Array.isArray(meta?.shared_concepts) && meta.shared_concepts.length
      ? meta.shared_concepts.map(humanize).join(', ')
      : null;
    const line = document.createElementNS(SVGNS, 'line');
    line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
    line.setAttribute('class', 'docs-map-edge');
    line.setAttribute('data-kind', edge.kind || 'related');
    line.dataset.source = s;
    line.dataset.target = t;
    line.setAttribute('stroke-width', String(Math.max(1, Math.min(5, 1 + Number(edge.weight || 1) * 0.6))));
    line.setAttribute('opacity', String(Math.max(0.28, Math.min(0.82, 0.34 + Number(edge.weight || 1) * 0.08))));
    const title = document.createElementNS(SVGNS, 'title');
    title.textContent = titleText([
      meta?.label || edge.kind || 'related',
      confidence ? `Confidence: ${confidence}` : null,
      shared ? `Shared concepts: ${shared}` : null
    ]);
    line.appendChild(title);
    viewport.appendChild(line);
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
    viewport.appendChild(label);
  });

  // Nodes (interactive).
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;
    const sectionId = sectionIdFromNode(node.id);
    const title = labelFor(node.id);
    const meta = nodeMetadata.get(node.id);
    const concepts = Array.isArray(meta?.skos_concepts) && meta.skos_concepts.length
      ? meta.skos_concepts.map((concept) => concept.prefLabel || concept.id)
      : (meta?.concepts || []).map(humanize);
    const detail = {
      sectionId,
      title,
      concepts,
      source: meta?.source?.repo_relative_path || meta?.source?.path || ''
    };

    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'docs-map-node');
    g.dataset.nodeId = node.id;
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', title);
    const titleNode = document.createElementNS(SVGNS, 'title');
    titleNode.textContent = titleText([
      title,
      concepts.length ? `Concepts: ${concepts.slice(0, 8).join(', ')}` : null,
      meta?.source?.repo_relative_path || meta?.source?.path
    ]);
    g.appendChild(titleNode);

    const circle = document.createElementNS(SVGNS, 'circle');
    circle.setAttribute('cx', pos.x);
    circle.setAttribute('cy', pos.y);
    circle.setAttribute('r', String(radii.get(node.id) || NODE_MIN_RADIUS));
    circle.setAttribute('fill', `hsl(${hue(pos.community)} 60% 55%)`);
    g.appendChild(circle);

    const text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('x', pos.x + 12);
    text.setAttribute('y', pos.y + 4);
    text.setAttribute('class', 'docs-map-label');
    text.textContent = title;
    g.appendChild(text);

    const highlight = () => {
      const neighbors = adjacency.get(node.id) || new Set();
      viewport.querySelectorAll('.docs-map-node').forEach((candidate) => {
        const candidateId = candidate.dataset.nodeId;
        candidate.classList.toggle('is-active', candidateId === node.id);
        candidate.classList.toggle('is-neighbor', neighbors.has(candidateId));
        candidate.classList.toggle('is-dimmed', candidateId !== node.id && !neighbors.has(candidateId));
      });
      viewport.querySelectorAll('.docs-map-edge').forEach((candidate) => {
        const connected = candidate.dataset.source === node.id || candidate.dataset.target === node.id;
        candidate.classList.toggle('is-active', connected);
        candidate.classList.toggle('is-dimmed', !connected);
      });
      updateTransform();
    };
    const clearHighlight = () => {
      viewport.querySelectorAll('.is-active, .is-neighbor, .is-dimmed').forEach((candidate) => {
        candidate.classList.remove('is-active', 'is-neighbor', 'is-dimmed');
      });
      updateTransform();
    };

    g.addEventListener('mouseenter', () => {
      highlight();
      if (popup.dataset.pinned !== 'true') popup.renderDetails(detail, false);
    });
    g.addEventListener('mouseleave', () => {
      if (popup.dataset.pinned !== 'true') clearHighlight();
      if (popup.dataset.pinned !== 'true') popup.hidden = true;
    });
    g.addEventListener('click', (e) => {
      e.preventDefault();
      focusNode(node.id);
      highlight();
      popup.renderDetails(detail, true);
    });
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        focusNode(node.id);
        popup.renderDetails(detail, true);
      }
    });
    g.addEventListener('docs-map-focus-node', () => {
      highlight();
      popup.renderDetails(detail, true);
    });
    viewport.appendChild(g);
  }

  updateTransform();
  container.append(controls, svg, popup);
}

const DOCS_MAP_HTML = [
  '<section class="section doc">',
  '  <div class="doc-content">',
  '    <header>',
  '      <p class="eyebrow">Overview</p>',
  '      <h1>Docs Map</h1>',
  '      <p class="lead">How these pages cluster and relate.</p>',
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
function normalizeRenderer(value) {
  return String(value || 'svg').trim().toLowerCase() === 'cytoscape' ? 'cytoscape' : 'svg';
}

function renderDocsMapWithRenderer(root, graph, opts = {}) {
  const renderer = normalizeRenderer(opts.renderer);
  root.dataset.docsMapRenderer = renderer;
  delete root.dataset.docsMapFallback;
  renderDocsMap(root, graph, opts);
}

export function loadDocsMap(graph, labels, options = {}) {
  const labelMap = labels instanceof Map
    ? labels
    : new Map(Array.isArray(labels) ? labels : Object.entries(labels || {}));
  return {
    html: DOCS_MAP_HTML,
    afterRender(app) {
      const root = app.querySelector('#docsMapRoot');
      if (!root) return;
      renderDocsMapWithRenderer(root, graph || { nodes: [], edges: [], communities: [] }, {
        renderer: options.renderer,
        metadata: options.metadata,
        labelFor: (nodeId) => labelMap.get(sectionIdFromNode(nodeId)) || sectionIdFromNode(nodeId),
        onNavigate: (sectionId) => { location.hash = `#${sectionId}`; }
      });
    }
  };
}

/** Section-module entry point. Computes the graph client-side from MANIFEST. */
export async function loadManifestDocsMap(options = {}) {
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
      renderDocsMapWithRenderer(root, graph, {
        renderer: options.renderer,
        labelFor: (nodeId) => labels.get(sectionIdFromNode(nodeId)) || sectionIdFromNode(nodeId),
        onNavigate: (sectionId) => { location.hash = `#${sectionId}`; }
      });
    }
  };
}

export async function load() {
  return loadManifestDocsMap();
}
