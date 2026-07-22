import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  contrastRatio,
  createDocsMapTheme,
  themeForRenderer,
  useDocsMapTheme,
} from '../src/docs-map/theme.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PALETTES = {
  default: { surface: '#ffffff', ink: '#172033', muted: '#5c667a', accent: '#3057d5' },
  dark: { surface: '#111827', ink: '#f8fafc', muted: '#9ca3af', accent: '#93c5fd' },
  tenant: { surface: '#fff8ed', ink: '#382718', muted: '#806a55', accent: '#a33b20' },
};

test('tenant tokens produce coherent, contrast-safe graph chrome', () => {
  for (const [name, tokens] of Object.entries(PALETTES)) {
    const theme = createDocsMapTheme(tokens);
    assert.ok(contrastRatio(theme.ink, theme.surface) >= 4.5, `${name} control text`);
    assert.ok(contrastRatio(theme.muted, theme.surface) >= 4.5, `${name} muted text`);
    assert.ok(contrastRatio(theme.accent, theme.surface) >= 3, `${name} focus/selection`);
    assert.ok(contrastRatio(theme.edge, theme.surface) >= 3, `${name} edges`);
    assert.ok(contrastRatio(theme.rule, theme.surface) >= 3, `${name} control boundaries`);
  }
});

test('one adapter covers GraphView, Sigma 2D, and ForceGraph 3D contracts', () => {
  const theme = createDocsMapTheme(PALETTES.dark);
  assert.deepEqual(Object.keys(theme.css).sort(), [
    '--fortemi-graph-bg',
    '--fortemi-graph-edge',
    '--fortemi-graph-muted',
    '--fortemi-graph-node-stroke',
    '--fortemi-graph-node-strong',
    '--fortemi-graph-rule',
    '--fortemi-graph-rule-soft',
    '--pagenary-graph-accent',
    '--pagenary-graph-ink',
    '--pagenary-graph-muted',
    '--pagenary-graph-rule',
    '--pagenary-graph-rule-soft',
    '--pagenary-graph-surface',
  ].sort());
  assert.equal(theme.css['--fortemi-graph-bg'], theme.surface);
  assert.equal(theme.css['--fortemi-graph-node-strong'], theme.accent);
  assert.equal(theme.sigma.edge, theme.edge);
  assert.equal(theme.sigma.label, theme.ink);
  assert.deepEqual(theme.three, { background: theme.surface, link: theme.edge });
  assert.equal(themeForRenderer(theme, 'graph'), undefined);
  assert.equal(themeForRenderer(theme, '2d'), theme.sigma);
  assert.equal(themeForRenderer(theme, '3d'), theme.three);
  assert.equal('palette' in theme, false, 'community/custom/greyscale palette remains a separate concern');
});

test('theme object identity survives unrelated React rerenders', async () => {
  const observations = [];
  function Probe({ tick }) {
    observations.push({ tick, theme: useDocsMapTheme(undefined) });
    return null;
  }
  let root;
  await act(async () => { root = TestRenderer.create(React.createElement(Probe, { tick: 0 })); });
  await act(async () => { root.update(React.createElement(Probe, { tick: 1 })); });
  assert.equal(observations[0].theme, observations[1].theme);
  assert.equal(observations[0].theme.sigma, observations[1].theme.sigma);
  assert.equal(observations[0].theme.three, observations[1].theme.three);
  await act(async () => { root.unmount(); });
});
