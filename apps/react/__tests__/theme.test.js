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

// Independent fixture oracle: production themes normalize colors to six-digit hex.
function fixtureContrast(foreground, background) {
  const light = (hex) => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    const channels = hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255);
    return channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const values = [light(foreground), light(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('contrast ratio matches independently known luminance fixtures', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  assert.ok(Math.abs(contrastRatio('#777777', '#ffffff') - 4.478089453577214) < 1e-12);
});

test('low-contrast tenant tokens are corrected against an independent oracle', () => {
  const theme = createDocsMapTheme({ surface: '#ffffff', ink: '#eeeeee', muted: '#eeeeee', accent: '#eeeeee' });
  assert.ok(fixtureContrast(theme.ink, theme.surface) >= 4.5);
  assert.ok(fixtureContrast(theme.muted, theme.surface) >= 4.5);
  assert.ok(fixtureContrast(theme.accent, theme.surface) >= 3);
});

test('tenant tokens produce coherent, contrast-safe graph chrome', () => {
  for (const [name, tokens] of Object.entries(PALETTES)) {
    const theme = createDocsMapTheme(tokens);
    assert.ok(fixtureContrast(theme.ink, theme.surface) >= 4.5, `${name} control text`);
    assert.ok(fixtureContrast(theme.muted, theme.surface) >= 4.5, `${name} muted text`);
    assert.ok(fixtureContrast(theme.accent, theme.surface) >= 3, `${name} focus/selection`);
    assert.ok(fixtureContrast(theme.edge, theme.surface) >= 3, `${name} edges`);
    assert.ok(fixtureContrast(theme.rule, theme.surface) >= 3, `${name} control boundaries`);
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
