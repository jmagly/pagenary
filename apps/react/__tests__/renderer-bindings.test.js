import assert from 'node:assert/strict';
import test from 'node:test';
import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useRendererBindings } from '../src/docs-map/renderer-bindings.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('Fortemi graph subpath contracts are available at the locked release', async () => {
  const [graph, reactGraph, graph2d, graph3d] = await Promise.all([
    import('@fortemi/graph'),
    import('@fortemi/react/graph'),
    import('@fortemi/react/graph-2d'),
    import('@fortemi/react/graph-3d'),
  ]);
  assert.equal(typeof graph.mapCommunityGraph, 'function');
  assert.equal(typeof reactGraph.GraphView, 'function');
  assert.equal(typeof graph2d.SigmaGraphView, 'function');
  assert.equal(typeof graph3d.ForceGraph3DView, 'function');
});

test('renderer-driving callbacks survive unrelated React rerenders', async () => {
  const labels = { guide: 'Guide' };
  const navigations = [];
  const navigate = (hash) => navigations.push(hash);
  const observations = [];
  let setups = 0;
  let cleanups = 0;

  function RendererProbe({ tick, currentLabels }) {
    const bindings = useRendererBindings(currentLabels, navigate);
    observations.push({ tick, ...bindings });
    useEffect(() => {
      setups += 1;
      return () => { cleanups += 1; };
    }, [bindings.graphLabelFor, bindings.openNode]);
    return React.createElement('span', null, bindings.graphLabelFor('docs:page:guide'));
  }

  let root;
  await act(async () => {
    root = TestRenderer.create(React.createElement(RendererProbe, { tick: 0, currentLabels: labels }));
  });
  const initial = observations.at(-1);
  assert.equal(root.toJSON().children[0], 'Guide');
  assert.equal(setups, 1);

  await act(async () => {
    root.update(React.createElement(RendererProbe, { tick: 1, currentLabels: labels }));
  });
  const rerendered = observations.at(-1);
  assert.equal(rerendered.graphLabelFor, initial.graphLabelFor);
  assert.equal(rerendered.openNode, initial.openNode);
  assert.equal(setups, 1, 'stable props must not reinitialize an interactive renderer');
  assert.equal(cleanups, 0);

  rerendered.openNode('docs:page:guide');
  assert.deepEqual(navigations, ['#guide']);

  await act(async () => { root.unmount(); });
  assert.equal(cleanups, 1);
});

test('the production default navigator is stable too', async () => {
  globalThis.window = { location: { hash: '' } };
  const labels = { guide: 'Guide' };
  const observations = [];

  function Probe({ tick }) {
    observations.push({ tick, ...useRendererBindings(labels) });
    return null;
  }

  let root;
  await act(async () => { root = TestRenderer.create(React.createElement(Probe, { tick: 0 })); });
  await act(async () => { root.update(React.createElement(Probe, { tick: 1 })); });
  assert.equal(observations[0].graphLabelFor, observations[1].graphLabelFor);
  assert.equal(observations[0].openNode, observations[1].openNode);
  observations[1].openNode('docs:page:guide');
  assert.equal(window.location.hash, '#guide');
  await act(async () => { root.unmount(); });
  delete globalThis.window;
});
