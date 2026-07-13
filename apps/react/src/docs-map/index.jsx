import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  colorForCommunity,
  computeDegrees,
  filterCommunityGraph,
  layoutCommunityGraph,
  neighborhoodSubgraph,
} from '@fortemi/graph';

// Phase 1 of the fortemi/react docs-map integration (#128). This control drives
// the canonical fortemi engine — @fortemi/graph for layout/color/filter/
// neighborhood — over Pagenary's prebuilt, compute-based docs-map graph, and
// renders a thin SVG view (the JS-only renderer proposed upstream in fortemi-react
// #259). No PGlite, no embeddings, no model downloads: the graph ships pre-computed
// from the build, so a semantic (embedding) mode is surfaced as an opt-in affordance
// but intentionally gated — matching the magly.net default of compute-based search
// with inference enabled only by user choice.
//
// NOTE: we deliberately do NOT import @fortemi/react's <GraphView> yet. Its barrel
// pulls @fortemi/core → @electric-sql/pglite (WASM + worker), which both breaks the
// static tenant's code-split Vite build and would bundle an unused browser DB into
// every docs site. Tracked upstream in fortemi-react #261 (make PGlite optional);
// once GraphView is reachable without PGlite we can swap this SVG view for it.
// @fortemi/graph is PGlite-free (its lone unused GraphController core import
// tree-shakes away), so the engine here stays canonical and light.

const roots = new WeakMap();
const DEFAULT_DATA_PATH = 'docs-map-data.js';

const INK = '#172033';
const MUTED = '#5c667a';
const SURFACE = '#ffffff';
const RULE = '#d7dde6';

const SELECT_STYLE = {
  padding: '6px 8px',
  border: `1px solid ${RULE}`,
  borderRadius: 6,
  background: SURFACE,
  color: INK,
  fontSize: 13,
  width: '100%',
};

const LABEL_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: MUTED,
};

const LAYOUTS = [
  { id: 'community', label: 'Community' },
  { id: 'force', label: 'Force' },
  { id: 'radial', label: 'Radial' },
];

function sectionIdFromNode(nodeId) {
  return String(nodeId || '').replace(/^docs:page:/, '');
}

function routeFromNode(nodeId) {
  const sectionId = sectionIdFromNode(nodeId);
  return sectionId === 'index' ? '#overview' : `#${sectionId}`;
}

function humanize(value) {
  return String(value || '')
    .replace(/^[a-z]+:/, '')
    .replace(/^docs:page:/, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelFor(nodeId, labels = {}) {
  const sectionId = sectionIdFromNode(nodeId);
  return labels[sectionId] || labels[nodeId] || humanize(sectionId);
}

function normalizeMap(value) {
  if (value instanceof Map) return value;
  return new Map(Array.isArray(value) ? value : Object.entries(value || {}));
}

/** Coerce a raw docs-map graph into a @fortemi/graph CommunityGraph. */
function toCommunityGraph(graph) {
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

function conceptsFor(nodeId, metadata) {
  const meta = normalizeMap(metadata?.nodes).get(nodeId);
  if (!meta) return [];
  if (Array.isArray(meta.skos_concepts) && meta.skos_concepts.length) {
    return meta.skos_concepts.map((concept) => concept.prefLabel || concept.id);
  }
  return (meta.concepts || []).map(humanize);
}

async function loadDocsMapData(dataPath = DEFAULT_DATA_PATH) {
  const url = new URL(dataPath, document.baseURI).href;
  const mod = await import(/* @vite-ignore */ url);
  return {
    graph: toCommunityGraph(mod.DOCS_MAP_GRAPH || { nodes: [], edges: [], communities: [] }),
    labels: mod.DOCS_MAP_LABELS || {},
    metadata: mod.DOCS_MAP_METADATA || {},
  };
}

function useDocsMapData(dataPath) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', data: null, error: null });
    loadDocsMapData(dataPath)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [dataPath]);
  return state;
}

const VIEW_W = 960;
const VIEW_H = 540;
const EDGE_COLOR = '#9aa0a6';

/**
 * Thin SVG view over a positioned @fortemi/graph layout. Mirrors the fortemi
 * <GraphView> visual system (light canvas, community-colored circles, gray edges,
 * selection highlight, zoom/pan toolbar) without importing @fortemi/react — see
 * the file header re: PGlite. This is the JS-only renderer proposed in #259.
 */
function GraphCanvas({ graph, algorithm, labels, selectedNodeId, onSelect, onOpen }) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const positioned = useMemo(
    () => layoutCommunityGraph(graph, { algorithm, width: VIEW_W, height: VIEW_H }),
    [graph, algorithm],
  );

  const setZoom = (factor) => setScale((s) => Math.max(0.4, Math.min(3, s * factor)));
  const pan = (dx, dy) => setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  const fit = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (event) => {
    if (event.target.closest?.('[data-node]')) return;
    dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({ x: drag.ox + (event.clientX - drag.x), y: drag.oy + (event.clientY - drag.y) });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <>
      <div className="pagenary-docs-map__toolbar">
        <button type="button" aria-label="Zoom out" onClick={() => setZoom(0.9)}>−</button>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom(1.12)}>+</button>
        <button type="button" aria-label="Pan left" onClick={() => pan(40, 0)}>←</button>
        <button type="button" aria-label="Pan right" onClick={() => pan(-40, 0)}>→</button>
        <button type="button" aria-label="Pan up" onClick={() => pan(0, 40)}>↑</button>
        <button type="button" aria-label="Pan down" onClick={() => pan(0, -40)}>↓</button>
        <button type="button" onClick={fit}>Fit</button>
        <span className="pagenary-docs-map__toolbar-count">
          {positioned.nodes.length} nodes · {positioned.edges.length} edges
        </span>
      </div>
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Relationship map of ${positioned.nodes.length} documentation pages`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        style={{ display: 'block', aspectRatio: `${VIEW_W} / ${VIEW_H}`, background: '#fafafa', touchAction: 'none', cursor: 'grab' }}
        onWheel={(event) => { event.preventDefault(); setZoom(event.deltaY < 0 ? 1.12 : 0.9); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
          {positioned.edges.map((edge) => {
            const source = positioned.nodeIndex.get(edge.source);
            const target = positioned.nodeIndex.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={`${edge.source}:${edge.target}:${edge.kind ?? 'e'}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={EDGE_COLOR}
                strokeWidth={Math.max(1, Math.min(5, edge.weight || 1))}
                opacity={0.55}
              />
            );
          })}
          {positioned.nodes.map((node) => {
            const selected = node.id === selectedNodeId;
            return (
              <g key={node.id} data-node transform={`translate(${node.x} ${node.y})`}>
                <circle
                  r={selected ? node.r + 3 : node.r}
                  fill={colorForCommunity(node.communityId)}
                  stroke={selected ? '#111' : '#fff'}
                  strokeWidth={selected ? 3 : 1.5}
                  tabIndex={0}
                  role="button"
                  aria-label={labelFor(node.id, labels)}
                  onClick={() => onSelect(node.id)}
                  onDoubleClick={() => onOpen(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                />
                <title>{labelFor(node.id, labels)}</title>
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
}

function FortemiDocsMap({ dataPath = DEFAULT_DATA_PATH }) {
  const { status, data, error } = useDocsMapData(dataPath);
  const baseGraph = data?.graph || { nodes: [], edges: [], communities: [] };
  const labels = data?.labels || {};
  const metadata = data?.metadata || {};

  const [algorithm, setAlgorithm] = useState('community');
  const [hiddenCommunities, setHiddenCommunities] = useState(() => new Set());
  const [minConnections, setMinConnections] = useState(0);
  const [neighborhoodMode, setNeighborhoodMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [query, setQuery] = useState('');

  const degrees = useMemo(() => computeDegrees(baseGraph), [baseGraph]);
  const maxDegree = useMemo(() => {
    let max = 0;
    for (const value of degrees.values()) max = Math.max(max, value);
    return max;
  }, [degrees]);

  // A stable list of communities (with member counts) for the legend/filter.
  const communityList = useMemo(
    () =>
      (baseGraph.communities || [])
        .map((community) => ({
          id: community.id,
          label: humanize(community.id) || community.id,
          count: (community.nodes || []).length,
        }))
        .filter((community) => community.count > 0)
        .sort((a, b) => b.count - a.count),
    [baseGraph],
  );

  // Compose the display graph entirely in @fortemi/graph so the fortemi engine
  // owns filtering/neighborhood; GraphView then just projects + renders it.
  const displayGraph = useMemo(() => {
    let graph = baseGraph;
    if (hiddenCommunities.size) {
      const visible = communityList
        .filter((community) => !hiddenCommunities.has(community.id))
        .map((community) => community.id);
      graph = filterCommunityGraph(graph, { communityIds: visible });
    }
    if (minConnections > 0) {
      const nodeIds = graph.nodes
        .map((node) => node.id)
        .filter((id) => (degrees.get(id) ?? 0) >= minConnections);
      graph = filterCommunityGraph(graph, { nodeIds });
    }
    if (neighborhoodMode && selectedNodeId) {
      graph = neighborhoodSubgraph(graph, [selectedNodeId]);
    }
    return graph;
  }, [baseGraph, communityList, hiddenCommunities, minConnections, neighborhoodMode, selectedNodeId, degrees]);

  const stats = useMemo(
    () => ({
      nodes: displayGraph.nodes.length,
      edges: displayGraph.edges.length,
      communities: displayGraph.communities.length,
    }),
    [displayGraph],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return (baseGraph.nodes || [])
      .map((node) => ({ id: node.id, label: labelFor(node.id, labels) }))
      .filter((node) => node.label.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [baseGraph, labels, query]);

  const selectedLabel = selectedNodeId ? labelFor(selectedNodeId, labels) : null;
  const selectedConcepts = selectedNodeId ? conceptsFor(selectedNodeId, metadata) : [];

  function toggleCommunity(id) {
    setHiddenCommunities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openSelected() {
    if (selectedNodeId) window.location.hash = routeFromNode(selectedNodeId);
  }

  function resetView() {
    setHiddenCommunities(new Set());
    setMinConnections(0);
    setNeighborhoodMode(false);
    setSelectedNodeId(null);
    setQuery('');
    setAlgorithm('community');
  }

  return (
    <div className="pagenary-docs-map" data-testid="pagenary-docs-map">
      <style>{styles}</style>

      <div className="pagenary-docs-map__controls">
        <label style={LABEL_STYLE}>
          Layout
          <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} style={SELECT_STYLE}>
            {LAYOUTS.map((layout) => (
              <option key={layout.id} value={layout.id}>{layout.label}</option>
            ))}
          </select>
        </label>

        <label style={LABEL_STYLE}>
          Focus
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a page"
            style={SELECT_STYLE}
          />
        </label>

        <label style={LABEL_STYLE}>
          Min connections ({minConnections})
          <input
            type="range"
            min={0}
            max={Math.max(1, maxDegree)}
            value={minConnections}
            onChange={(event) => setMinConnections(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </label>

        <label style={LABEL_STYLE} title="Semantic similarity needs an embedding model. Compute-based is the default; semantic is opt-in and not enabled in this build.">
          Similarity
          <select value="compute" disabled style={{ ...SELECT_STYLE, opacity: 0.7, cursor: 'not-allowed' }}>
            <option value="compute">Compute (default)</option>
            <option value="semantic">Semantic — opt-in (soon)</option>
          </select>
        </label>
      </div>

      <div className="pagenary-docs-map__actions">
        <div className="pagenary-docs-map__mode" role="group" aria-label="Docs map mode">
          <button type="button" className={!neighborhoodMode ? 'active' : ''} onClick={() => setNeighborhoodMode(false)}>All</button>
          <button
            type="button"
            className={neighborhoodMode ? 'active' : ''}
            onClick={() => setNeighborhoodMode(true)}
            disabled={!selectedNodeId}
            title={selectedNodeId ? 'Show the selected page and its neighbors' : 'Select a page first'}
          >
            Neighborhood
          </button>
        </div>
        <button type="button" className="pagenary-docs-map__button" onClick={resetView}>Reset</button>
        {selectedNodeId ? (
          <button type="button" className="pagenary-docs-map__button" onClick={openSelected}>Open page</button>
        ) : null}
      </div>

      {matches.length > 0 ? (
        <div className="pagenary-docs-map__matches">
          {matches.map((match) => (
            <button key={match.id} type="button" onClick={() => setSelectedNodeId(match.id)}>{match.label}</button>
          ))}
        </div>
      ) : null}

      {communityList.length > 1 ? (
        <div className="pagenary-docs-map__legend" aria-label="Communities">
          {communityList.map((community) => {
            const hidden = hiddenCommunities.has(community.id);
            return (
              <button
                key={community.id}
                type="button"
                className={`pagenary-docs-map__chip${hidden ? ' is-hidden' : ''}`}
                onClick={() => toggleCommunity(community.id)}
                title={hidden ? 'Show this cluster' : 'Hide this cluster'}
                aria-pressed={!hidden}
              >
                <span className="pagenary-docs-map__swatch" style={{ background: colorForCommunity(community.id) }} />
                {community.label}
                <span className="pagenary-docs-map__count">{community.count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="pagenary-docs-map__canvas">
        {status === 'loading' ? <div className="pagenary-docs-map__overlay">Loading graph…</div> : null}
        {status === 'error' ? (
          <div className="pagenary-docs-map__overlay">Graph data unavailable: {error?.message || 'unknown error'}</div>
        ) : null}
        {status === 'ready' ? (
          <GraphCanvas
            graph={displayGraph}
            algorithm={algorithm}
            labels={labels}
            selectedNodeId={selectedNodeId}
            onSelect={setSelectedNodeId}
            onOpen={(id) => { window.location.hash = routeFromNode(id); }}
          />
        ) : null}
      </div>

      <div className="pagenary-docs-map__status" aria-live="polite">
        <span>{stats.nodes} pages</span>
        <span>{stats.edges} relationships</span>
        <span>{stats.communities} communities</span>
        {selectedLabel ? (
          <strong>{selectedLabel}</strong>
        ) : (
          <span>Click a page to focus; use Open page to navigate.</span>
        )}
      </div>

      {selectedLabel ? (
        <aside className="pagenary-docs-map__detail">
          <h2>{selectedLabel}</h2>
          {selectedConcepts.length ? (
            <div className="pagenary-docs-map__chips">
              {selectedConcepts.slice(0, 8).map((concept) => (
                <span key={concept}>{concept}</span>
              ))}
            </div>
          ) : null}
          <button type="button" className="pagenary-docs-map__button" onClick={openSelected}>Open page</button>
        </aside>
      ) : null}
    </div>
  );
}

function mountInto(root, options) {
  if (!root || roots.has(root)) return;
  root.dataset.docsMapRenderer = 'fortemi-react';
  root.replaceChildren();
  const reactRoot = createRoot(root);
  roots.set(root, reactRoot);
  reactRoot.render(<FortemiDocsMap dataPath={options.dataPath} />);
}

export function mountFortemiDocsMap(options = {}) {
  const selector = options.selector || '#docsMapRoot';
  const mountCurrent = () => {
    for (const root of document.querySelectorAll(selector)) {
      mountInto(root, { dataPath: options.dataPath || DEFAULT_DATA_PATH });
    }
  };

  mountCurrent();
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(mountCurrent);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export default { mountFortemiDocsMap };

const styles = `
.pagenary-docs-map {
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: ${INK};
}
.pagenary-docs-map__controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}
.pagenary-docs-map__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.pagenary-docs-map__mode {
  display: inline-flex;
  border: 1px solid ${RULE};
  border-radius: 6px;
  overflow: hidden;
  background: ${SURFACE};
}
.pagenary-docs-map__mode button,
.pagenary-docs-map__button,
.pagenary-docs-map__matches button,
.pagenary-docs-map__chip {
  min-height: 34px;
  border: 0;
  background: transparent;
  color: ${MUTED};
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
}
.pagenary-docs-map__mode button {
  padding: 0 12px;
}
.pagenary-docs-map__mode button + button {
  border-left: 1px solid ${RULE};
}
.pagenary-docs-map__mode button.active {
  background: ${INK};
  color: ${SURFACE};
}
.pagenary-docs-map__mode button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pagenary-docs-map__button {
  border: 1px solid ${RULE};
  border-radius: 6px;
  padding: 0 12px;
  background: ${SURFACE};
}
.pagenary-docs-map__matches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pagenary-docs-map__matches button {
  border: 1px solid ${RULE};
  border-radius: 999px;
  padding: 0 10px;
  max-width: min(100%, 320px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: ${SURFACE};
}
.pagenary-docs-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pagenary-docs-map__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${RULE};
  border-radius: 999px;
  padding: 0 10px;
  background: ${SURFACE};
}
.pagenary-docs-map__chip.is-hidden {
  opacity: 0.45;
}
.pagenary-docs-map__swatch {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  display: inline-block;
}
.pagenary-docs-map__count {
  color: ${MUTED};
  font-weight: 500;
}
.pagenary-docs-map__canvas {
  position: relative;
  border: 1px solid ${RULE};
  border-radius: 6px;
  overflow: hidden;
  background: ${SURFACE};
}
.pagenary-docs-map__toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid ${RULE};
}
.pagenary-docs-map__toolbar button {
  min-width: 30px;
  min-height: 30px;
  border: 1px solid ${RULE};
  border-radius: 6px;
  background: ${SURFACE};
  color: ${MUTED};
  font: 600 13px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
}
.pagenary-docs-map__toolbar-count {
  margin-left: auto;
  color: ${MUTED};
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.pagenary-docs-map__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${MUTED};
  background: ${SURFACE};
  font: 600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  z-index: 2;
}
.pagenary-docs-map__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: ${MUTED};
  font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.pagenary-docs-map__status strong {
  color: ${INK};
}
.pagenary-docs-map__detail {
  border: 1px solid ${RULE};
  border-radius: 6px;
  padding: 12px;
  background: ${SURFACE};
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.pagenary-docs-map__detail h2 {
  margin: 0;
  font-size: 15px;
  color: ${INK};
}
.pagenary-docs-map__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pagenary-docs-map__chips span {
  border: 1px solid ${RULE};
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  color: ${MUTED};
}
@media (max-width: 680px) {
  .pagenary-docs-map__controls {
    grid-template-columns: 1fr 1fr;
  }
}
`;
