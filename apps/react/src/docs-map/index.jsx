import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  colorForCommunity,
  communityRanks,
  computeDegrees,
  filterCommunityGraph,
  GREYSCALE_COMMUNITY_RAMP,
  neighborhoodSubgraph,
} from '@fortemi/graph';
import { GraphView } from '@fortemi/react/graph';
import { humanize, labelFor, toCommunityGraph } from './graph-data.js';
import { routeFromNode, useRendererBindings } from './renderer-bindings.js';
import { themeForRenderer, useDocsMapTheme } from './theme.js';

// Docs-map control over the canonical fortemi engine (#128, #132): @fortemi/graph
// owns filtering/degree/neighborhood; rendering is upstream <GraphView> from the
// PGlite-free @fortemi/react/graph subpath (verified through 2026.7.15)
// — no @electric-sql/pglite WASM, no DB worker, no embeddings in the bundle.
// The graph ships pre-computed from the build, so a semantic (embedding) mode is
// surfaced as an opt-in affordance but intentionally gated — matching the
// magly.net default of compute-based search with inference enabled only by
// user choice.

const roots = new WeakMap();
const DEFAULT_DATA_PATH = 'docs-map-data.js';

const SELECT_STYLE = {
  padding: '6px 8px',
  border: '1px solid var(--pagenary-graph-rule)',
  borderRadius: 6,
  background: 'var(--pagenary-graph-surface)',
  color: 'var(--pagenary-graph-ink)',
  fontSize: 13,
  width: '100%',
};

const LABEL_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  color: 'var(--pagenary-graph-muted)',
};

const LAYOUTS = [
  { id: 'community', label: 'Community' },
  { id: 'force', label: 'Force' },
  { id: 'radial', label: 'Radial' },
];

function normalizeMap(value) {
  if (value instanceof Map) return value;
  return new Map(Array.isArray(value) ? value : Object.entries(value || {}));
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

/**
 * Lazy-load the opted-in interactive renderer tier (#135). The subpath modules
 * are only bundled when the tenant selected that tier at build time — for any
 * other tenant the specifier is external and the import fails fast, which is
 * fine because this hook only runs when view is '2d'/'3d'. A failed load
 * (missing peers at runtime, blocked chunk) falls back to the GraphView tier.
 */
function useDocsMapTier(view) {
  const wantsTier = view === '2d' || view === '3d';
  const [tier, setTier] = useState({ status: wantsTier ? 'loading' : 'none', Component: null });
  useEffect(() => {
    if (!wantsTier) {
      setTier({ status: 'none', Component: null });
      return undefined;
    }
    let cancelled = false;
    setTier({ status: 'loading', Component: null });
    const importer = view === '2d'
      ? import('@fortemi/react/graph-2d').then((mod) => mod.SigmaGraphView)
      : import('@fortemi/react/graph-3d').then((mod) => mod.ForceGraph3DView);
    importer
      .then((Component) => {
        if (!cancelled) setTier({ status: Component ? 'ready' : 'failed', Component: Component || null });
      })
      .catch(() => {
        if (!cancelled) setTier({ status: 'failed', Component: null });
      });
    return () => {
      cancelled = true;
    };
  }, [view, wantsTier]);
  return tier;
}

/**
 * Community color resolver for the legend. Mirrors upstream mapCommunityGraph
 * palette semantics: 'community' hashes the id (matches GraphView); greyscale/
 * custom ramps index by community rank (largest cluster first, unassigned last).
 */
function communityColorResolver(graph, palette) {
  if (!palette || palette === 'community') return (id) => colorForCommunity(id);
  const ranks = communityRanks(graph);
  const ramp = palette === 'greyscale' ? GREYSCALE_COMMUNITY_RAMP : palette;
  return (id) => {
    const rank = ranks.get(id) ?? -1;
    return rank < 0 ? ramp[ramp.length - 1] : ramp[rank % ramp.length];
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

function FortemiDocsMap({
  dataPath = DEFAULT_DATA_PATH,
  view = 'graph',
  palette,
  draggable = false,
  snapshot,
}) {
  const graphTheme = useDocsMapTheme();
  const { status, data, error } = useDocsMapData(dataPath);
  const tier = useDocsMapTier(view);
  const baseGraph = data?.graph || { nodes: [], edges: [], communities: [] };
  const labels = data?.labels || {};
  const metadata = data?.metadata || {};
  // Interactive tier is active unless it failed to load (then GraphView takes over).
  const interactive = (view === '2d' || view === '3d') && tier.status !== 'failed';
  const snapshotUrl = useMemo(
    () => (snapshot ? new URL(snapshot, document.baseURI).href : undefined),
    [snapshot],
  );

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
  // Fortemi's interactive renderers memoize their RenderGraph on labelFor.
  // Keep host callbacks stable across unrelated UI state changes so Sigma/3D
  // retain their settled layout, camera, and renderer instance (#151).
  const { graphLabelFor, openNode } = useRendererBindings(labels);
  // Legend swatches match the active tier's node colors: interactive tiers
  // honor the configured palette (rank-based), GraphView hashes community ids.
  const communityColor = useMemo(
    () => communityColorResolver(baseGraph, interactive ? palette : undefined),
    [baseGraph, interactive, palette],
  );

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
    <div className="pagenary-docs-map" data-testid="pagenary-docs-map" style={graphTheme.css}>
      <style>{styles}</style>

      <div className="pagenary-docs-map__controls">
        {!interactive ? (
          <label style={LABEL_STYLE}>
            Layout
            <select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)} style={SELECT_STYLE}>
              {LAYOUTS.map((layout) => (
                <option key={layout.id} value={layout.id}>{layout.label}</option>
              ))}
            </select>
          </label>
        ) : null}

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
                <span className="pagenary-docs-map__swatch" style={{ background: communityColor(community.id) }} />
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
        {status === 'ready' ? (() => {
          if (interactive) {
            const TierView = tier.Component;
            if (tier.status === 'ready' && TierView) {
              return (
                <TierView
                  graph={displayGraph}
                  snapshot={snapshotUrl}
                  palette={palette || 'community'}
                  labelFor={graphLabelFor}
                  onSelectNode={setSelectedNodeId}
                  onOpenNode={openNode}
                  theme={themeForRenderer(graphTheme, view)}
                  height="60vh"
                />
              );
            }
            return <div className="pagenary-docs-map__overlay">Loading interactive view…</div>;
          }
          return (
            <GraphView
              graph={displayGraph}
              layout={{ algorithm }}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              onNavigate={openNode}
              labelFor={graphLabelFor}
              draggableNodes={draggable}
              width={VIEW_W}
              height={VIEW_H}
            />
          );
        })() : null}
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

/**
 * Renderer options for a mount root: explicit call options win; otherwise fall
 * back to the data attributes the publisher's docs-map loader stamps on the
 * root (#135). The DOM path is what serves tenant entries that self-mount
 * `mountFortemiDocsMap()` with no arguments (the documented hybrid pattern).
 */
function resolveMountOptions(root, options) {
  const ds = root.dataset || {};
  let palette = options.palette ?? ds.docsMapPalette;
  if (typeof palette === 'string' && palette.startsWith('[')) {
    try { palette = JSON.parse(palette); } catch { palette = undefined; }
  }
  return {
    dataPath: options.dataPath || DEFAULT_DATA_PATH,
    view: options.view ?? ds.docsMapView,
    palette,
    draggable: options.draggable === true || (options.draggable === undefined && ds.docsMapDraggable === 'true'),
    snapshot: options.snapshot ?? ds.docsMapSnapshot,
  };
}

function mountInto(root, options) {
  if (!root || roots.has(root)) return;
  const resolved = resolveMountOptions(root, options);
  const view = resolved.view === '2d' || resolved.view === '3d' ? resolved.view : 'graph';
  root.dataset.docsMapRenderer = view === 'graph' ? 'fortemi-react' : `fortemi-react-${view}`;
  // Claim the root: the publisher's bridge checks this before painting its SVG
  // fallback, so a tenant entry that self-mounts isn't stomped by the fallback.
  root.dataset.docsMapMounted = 'true';
  delete root.dataset.docsMapFallback;
  root.replaceChildren();
  const reactRoot = createRoot(root);
  roots.set(root, reactRoot);
  reactRoot.render(
    <FortemiDocsMap
      dataPath={resolved.dataPath}
      view={view}
      palette={resolved.palette}
      draggable={resolved.draggable}
      snapshot={resolved.snapshot}
    />,
  );
}

export function mountFortemiDocsMap(options = {}) {
  const selector = options.selector || '#docsMapRoot';
  const mountCurrent = () => {
    for (const root of document.querySelectorAll(selector)) {
      mountInto(root, {
        dataPath: options.dataPath,
        view: options.view,
        palette: options.palette,
        draggable: options.draggable,
        snapshot: options.snapshot,
      });
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
  color: var(--pagenary-graph-ink);
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
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pagenary-graph-surface);
}
.pagenary-docs-map__mode button,
.pagenary-docs-map__button,
.pagenary-docs-map__matches button,
.pagenary-docs-map__chip {
  min-height: 34px;
  border: 0;
  background: transparent;
  color: var(--pagenary-graph-muted);
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  cursor: pointer;
}
.pagenary-docs-map__mode button {
  padding: 0 12px;
}
.pagenary-docs-map__mode button + button {
  border-left: 1px solid var(--pagenary-graph-rule);
}
.pagenary-docs-map__mode button.active {
  background: var(--pagenary-graph-ink);
  color: var(--pagenary-graph-surface);
}
.pagenary-docs-map__mode button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pagenary-docs-map__button {
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 6px;
  padding: 0 12px;
  background: var(--pagenary-graph-surface);
}
.pagenary-docs-map__matches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pagenary-docs-map__matches button {
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 999px;
  padding: 0 10px;
  max-width: min(100%, 320px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--pagenary-graph-surface);
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
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 999px;
  padding: 0 10px;
  background: var(--pagenary-graph-surface);
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
  color: var(--pagenary-graph-muted);
  font-weight: 500;
}
.pagenary-docs-map__canvas {
  position: relative;
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 6px;
  overflow: hidden;
  background: var(--pagenary-graph-surface);
}
.pagenary-docs-map__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pagenary-graph-muted);
  background: var(--pagenary-graph-surface);
  font: 600 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  z-index: 2;
}
.pagenary-docs-map__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  color: var(--pagenary-graph-muted);
  font: 600 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.pagenary-docs-map__status strong {
  color: var(--pagenary-graph-ink);
}
.pagenary-docs-map__detail {
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 6px;
  padding: 12px;
  background: var(--pagenary-graph-surface);
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.pagenary-docs-map__detail h2 {
  margin: 0;
  font-size: 15px;
  color: var(--pagenary-graph-ink);
}
.pagenary-docs-map__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pagenary-docs-map__chips span {
  border: 1px solid var(--pagenary-graph-rule);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  color: var(--pagenary-graph-muted);
}
.pagenary-docs-map :is(button, input, select):focus-visible {
  outline: 3px solid var(--pagenary-graph-accent);
  outline-offset: 2px;
}
@media (max-width: 680px) {
  .pagenary-docs-map__controls {
    grid-template-columns: 1fr 1fr;
  }
}
`;
