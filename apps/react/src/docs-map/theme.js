import { useEffect, useMemo, useState } from 'react';

const DEFAULT_TOKENS = Object.freeze({
  surface: '#ffffff',
  ink: '#172033',
  muted: '#5c667a',
  accent: '#172033',
  font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

function parseColor(value) {
  const input = String(value || '').trim();
  const hex = input.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
  }
  const rgb = input.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  return rgb ? rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part)))) : null;
}

function toHex(rgb) {
  return `#${rgb.map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a, b, amount) {
  const left = parseColor(a);
  const right = parseColor(b);
  if (!left || !right) return a;
  return toHex(left.map((part, index) => part + (right[index] - part) * amount));
}

function luminance(value) {
  const rgb = parseColor(value);
  if (!rgb) return 0;
  const linear = rgb.map((part) => {
    const channel = part / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a, b) {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

function ensureContrast(color, background, minimum) {
  if (contrastRatio(color, background) >= minimum) return color;
  const target = contrastRatio('#000000', background) >= contrastRatio('#ffffff', background)
    ? '#000000'
    : '#ffffff';
  for (let step = 1; step <= 20; step += 1) {
    const candidate = mix(color, target, step / 20);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target;
}

function clean(value, fallback) {
  const resolved = String(value || '').trim();
  return parseColor(resolved) ? toHex(parseColor(resolved)) : fallback;
}

/** Map Pagenary tenant tokens to every Fortemi renderer without changing node palettes. */
export function createDocsMapTheme(tokens = {}) {
  const surface = clean(tokens.surface, DEFAULT_TOKENS.surface);
  const ink = ensureContrast(clean(tokens.ink, DEFAULT_TOKENS.ink), surface, 4.5);
  const muted = ensureContrast(clean(tokens.muted, DEFAULT_TOKENS.muted), surface, 4.5);
  const accent = ensureContrast(clean(tokens.accent, ink), surface, 3);
  const rule = ensureContrast(mix(surface, ink, 0.28), surface, 3);
  const ruleSoft = mix(surface, ink, 0.16);
  const edge = ensureContrast(mix(surface, muted, 0.72), surface, 3);
  const dimNode = mix(surface, muted, 0.48);
  const dimEdge = mix(surface, edge, 0.52);
  const font = String(tokens.font || DEFAULT_TOKENS.font);

  return Object.freeze({
    surface,
    ink,
    muted,
    accent,
    rule,
    ruleSoft,
    edge,
    css: Object.freeze({
      '--fortemi-graph-bg': surface,
      '--fortemi-graph-rule': rule,
      '--fortemi-graph-rule-soft': ruleSoft,
      '--fortemi-graph-muted': muted,
      '--fortemi-graph-edge': edge,
      '--fortemi-graph-node-strong': accent,
      '--fortemi-graph-node-stroke': surface,
      '--pagenary-graph-surface': surface,
      '--pagenary-graph-ink': ink,
      '--pagenary-graph-muted': muted,
      '--pagenary-graph-accent': accent,
      '--pagenary-graph-rule': rule,
      '--pagenary-graph-rule-soft': ruleSoft,
    }),
    sigma: Object.freeze({
      node: ink,
      ink: accent,
      edge,
      dimNode,
      dimEdge,
      label: ink,
      labelFont: font,
    }),
    three: Object.freeze({ background: surface, link: edge }),
  });
}

export function themeForRenderer(theme, view) {
  if (view === '2d') return theme.sigma;
  if (view === '3d') return theme.three;
  return undefined;
}

function readTenantTokens(doc) {
  if (!doc?.documentElement || typeof getComputedStyle !== 'function') return DEFAULT_TOKENS;
  const styles = getComputedStyle(doc.documentElement);
  const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    surface: read('--surface', DEFAULT_TOKENS.surface),
    ink: read('--ink', DEFAULT_TOKENS.ink),
    muted: read('--muted', DEFAULT_TOKENS.muted),
    accent: read('--accent', DEFAULT_TOKENS.accent),
    font: read('--font-mono', DEFAULT_TOKENS.font),
  };
}

export function useDocsMapTheme(doc = globalThis.document) {
  const [tokens, setTokens] = useState(() => readTenantTokens(doc));
  useEffect(() => {
    if (!doc?.documentElement || typeof MutationObserver !== 'function') return undefined;
    let frame;
    const refresh = () => {
      if (frame) globalThis.cancelAnimationFrame?.(frame);
      frame = globalThis.requestAnimationFrame(() => {
        const next = readTenantTokens(doc);
        setTokens((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      });
    };
    const observer = new MutationObserver(refresh);
    observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    if (doc.body) observer.observe(doc.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    const dark = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    dark?.addEventListener?.('change', refresh);
    globalThis.addEventListener?.('pagenary:themechange', refresh);
    globalThis.addEventListener?.('themechange', refresh);
    return () => {
      observer.disconnect();
      dark?.removeEventListener?.('change', refresh);
      globalThis.removeEventListener?.('pagenary:themechange', refresh);
      globalThis.removeEventListener?.('themechange', refresh);
      if (frame) globalThis.cancelAnimationFrame?.(frame);
    };
  }, [doc]);
  return useMemo(() => createDocsMapTheme(tokens), [tokens]);
}
