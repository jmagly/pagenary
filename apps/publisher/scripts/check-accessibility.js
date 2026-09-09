#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { resolveTheme } from './build-tenants.js';

const root = process.cwd();

const FOCUS_SELECTORS = [
  '.skip-link:focus',
  '.ghost-button:focus-visible',
  '.brand:focus-visible',
  '.theme-picker-select:focus-visible',
  '.nav-base:focus-visible',
  '.nav-external:focus-visible',
  '.cmd-input:focus',
  '.docs-map-search input:focus-visible',
  '.docs-map-control:focus-visible',
  '.docs-map-node:focus-visible circle',
  '.doc-fortemi-button:focus-visible',
  '.export-option-btn:focus-visible',
  '.export-cancel-btn:focus-visible',
  '.bottom-nav-index:focus-visible',
  '.pe-cta:focus-visible',
  '.nav-strip-link:focus-visible'
];

const failures = [];
const warnings = [];

function readJson(relPath) {
  const full = path.join(root, relPath);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function parseHex(color) {
  if (typeof color !== 'string') return null;
  const value = color.trim();
  const short = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(value);
  if (short) {
    return short.slice(1).map((part) => parseInt(part + part, 16));
  }
  const full = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(value);
  if (!full) return null;
  return full.slice(1).map((part) => parseInt(part, 16));
}

function luminance([r, g, b]) {
  const channel = (value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return (0.2126 * channel(r)) + (0.7152 * channel(g)) + (0.0722 * channel(b));
}

function contrastRatio(fg, bg) {
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  if (!fgRgb || !bgRgb) return null;
  const a = luminance(fgRgb);
  const b = luminance(bgRgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function checkRatio(name, fg, bg, minimum, severity = 'fail') {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) {
    warnings.push(`${name}: contrast skipped for non-hex colors (${fg} on ${bg})`);
    return;
  }
  if (ratio < minimum) {
    const message = `${name}: contrast ${ratio.toFixed(2)} below ${minimum.toFixed(1)} (${fg} on ${bg})`;
    if (severity === 'warn') warnings.push(message);
    else failures.push(message);
  }
}

function checkTheme(name, config, { strictAccent = false } = {}) {
  const { theme } = resolveTheme(config.theme, config);
  checkRatio(`${name} ink text`, theme.ink, theme.surface, 4.5);
  checkRatio(`${name} muted text`, theme.muted, theme.surface, 4.5, 'warn');
  checkRatio(`${name} accent/focus`, theme.accent, theme.surface, 3.0, strictAccent ? 'fail' : 'warn');
}

function tenantConfigsFromRegistry(relPath) {
  const registry = readJson(relPath);
  return (registry.tenants || [])
    .filter((tenant) => tenant && tenant.enabled !== false)
    .map((tenant) => ({ id: tenant.id, config: tenant.config || {} }));
}

function configFilesUnder(relDir) {
  const start = path.join(root, relDir);
  const results = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.name === 'config.json') results.push(path.relative(root, full));
    }
  };
  visit(start);
  return results;
}

function blockForSelector(css, selector) {
  const index = css.indexOf(selector);
  if (index === -1) return null;
  const start = css.indexOf('{', index);
  const end = css.indexOf('}', start);
  if (start === -1 || end === -1) return null;
  return css.slice(start + 1, end);
}

function checkFocusCss() {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  for (const selector of FOCUS_SELECTORS) {
    const block = blockForSelector(css, selector);
    if (!block) {
      failures.push(`missing focus coverage for ${selector}`);
      continue;
    }
    const visibleCuePattern = /(outline|border|background|box-shadow|text-decoration|color|stroke|fill)\s*:/;
    const hasVisibleCue = visibleCuePattern.test(block);
    const onlySuppressesOutline = /outline\s*:\s*none/.test(block) && !/(border|background|box-shadow|text-decoration|color|stroke|fill)\s*:/.test(block);
    if (!hasVisibleCue || onlySuppressesOutline) {
      failures.push(`focus selector lacks a visible cue: ${selector}`);
    }
  }
}

for (const name of ['light', 'dark', 'matrix']) {
  checkTheme(`preset:${name}`, { theme: name }, { strictAccent: true });
}

for (const entry of tenantConfigsFromRegistry('examples/recipes.tenants.json')) {
  checkTheme(`example:${entry.id}`, entry.config);
}

for (const relPath of configFilesUnder('examples')) {
  checkTheme(`config:${relPath}`, readJson(relPath));
}

checkFocusCss();

for (const warning of warnings) {
  console.warn(`⚠ ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✘ ${failure}`);
  process.exit(1);
}

console.log(`Accessibility check passed (${warnings.length} warning${warnings.length === 1 ? '' : 's'}).`);
