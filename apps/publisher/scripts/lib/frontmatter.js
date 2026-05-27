/**
 * Minimal, zero-dependency YAML front-matter parser.
 *
 * Handles the common documentation subset: a leading `---` fenced block of
 * `key: value` pairs. Values are coerced to boolean / number where obvious,
 * inline `[a, b]` lists are parsed, and quotes are stripped. Nested maps are
 * NOT supported (out of scope for post metadata) — a nested value is kept as a
 * raw string. Anything unparseable degrades to a string rather than throwing.
 */

/**
 * @param {string} raw - File contents
 * @returns {{ data: Record<string, any>, body: string }}
 */
export function parseFrontmatter(raw) {
  const text = String(raw == null ? '' : raw);
  // Front matter must be the very first thing in the file.
  const match = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const [, block, body] = match;
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    const rawValue = line.slice(idx + 1).trim();
    data[key] = coerceValue(rawValue);
  }
  return { data, body };
}

function coerceValue(value) {
  if (value === '' || value === '~' || value.toLowerCase() === 'null') return null;

  // Inline list: [a, b, "c"]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((v) => coerceScalar(v.trim()));
  }
  return coerceScalar(value);
}

function coerceScalar(value) {
  // Strip surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Number (but not a date like 2026-05-27, and not a version like 1.2.3)
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/**
 * Estimate reading time in minutes from body text (~200 words/min, min 1).
 * @param {string} body
 * @returns {number}
 */
export function estimateReadingTime(body) {
  const words = String(body || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * First Markdown H1 (`# Title`) in the body, or null.
 * @param {string} body
 * @returns {string|null}
 */
export function firstHeading(body) {
  const m = String(body || '').match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}
