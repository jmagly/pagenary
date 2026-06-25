/**
 * Minimal, zero-dependency YAML front-matter parser.
 *
 * Handles the documentation subset: a leading `---` fenced block. Scalars are
 * coerced to boolean / number where obvious and quotes are stripped. Beyond flat
 * `key: value` pairs it also understands the nested subset needed by declarative
 * page blocks (#54):
 *
 *   - nested maps (indentation-based),
 *   - block sequences (`- item`), whose items may be scalars, inline `{ }` maps,
 *     or nested maps,
 *   - inline flow maps `{ a: b, c: d }` and inline flow lists `[a, b]`.
 *
 * Flat front matter parses exactly as before (backward compatible). Anything
 * unparseable degrades to a string rather than throwing.
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
  // Drop blank lines and full-line comments; they carry no structure.
  const lines = block
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'));

  if (!lines.length) return { data: {}, body };

  const { value } = parseMap(lines, 0, indentOf(lines[0]));
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { data, body };
}

function indentOf(line) {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

/** Parse an indentation-delimited map starting at `start`. */
function parseMap(lines, start, indent) {
  const map = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const curIndent = indentOf(line);
    if (curIndent < indent) break;
    if (curIndent > indent) { i += 1; continue; } // defensive: skip stray over-indent
    const content = line.slice(indent);
    const idx = content.indexOf(':');
    if (idx === -1) { i += 1; continue; }
    const key = content.slice(0, idx).trim();
    if (!key) { i += 1; continue; }
    const rest = content.slice(idx + 1).trim();

    if (rest !== '') {
      map[key] = coerceValue(rest);
      i += 1;
      continue;
    }

    // Empty value → either a nested block (deeper-indented lines) or null.
    const childStart = i + 1;
    if (childStart < lines.length && indentOf(lines[childStart]) > indent) {
      const childIndent = indentOf(lines[childStart]);
      const childIsList = lines[childStart].slice(childIndent).startsWith('- ');
      const node = childIsList
        ? parseList(lines, childStart, childIndent)
        : parseMap(lines, childStart, childIndent);
      map[key] = node.value;
      i = node.next;
    } else {
      map[key] = null;
      i += 1;
    }
  }
  return { value: map, next: i };
}

/** Parse a block sequence (`- item`) starting at `start`. */
function parseList(lines, start, indent) {
  const list = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const curIndent = indentOf(line);
    if (curIndent < indent) break;
    const content = line.slice(indent);
    if (!content.startsWith('- ') && content !== '-') break;
    const itemText = content.slice(content.startsWith('- ') ? 2 : 1).trim();

    if (itemText.startsWith('{') || itemText.startsWith('[')) {
      list.push(coerceValue(itemText)); // inline flow map / list
      i += 1;
      continue;
    }

    const colon = itemText.indexOf(':');
    if (colon !== -1) {
      // Block-map item: first pair is inline after the dash; continuation pairs
      // are deeper-indented lines that follow (and are not their own list).
      const childIndent = indent + 2;
      const synthetic = [' '.repeat(childIndent) + itemText];
      let j = i + 1;
      while (
        j < lines.length &&
        indentOf(lines[j]) > indent &&
        !lines[j].slice(indentOf(lines[j])).startsWith('- ')
      ) {
        synthetic.push(lines[j]);
        j += 1;
      }
      list.push(parseMap(synthetic, 0, childIndent).value);
      i = j;
      continue;
    }

    list.push(coerceValue(itemText)); // plain scalar item
    i += 1;
  }
  return { value: list, next: i };
}

/** Split `str` on `delim` at the top level only (respecting quotes/brackets). */
function splitTopLevel(str, delim) {
  const out = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of str) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
    if (ch === '{' || ch === '[') { depth += 1; current += ch; continue; }
    if (ch === '}' || ch === ']') { depth -= 1; current += ch; continue; }
    if (ch === delim && depth === 0) { out.push(current); current = ''; continue; }
    current += ch;
  }
  if (current.trim() !== '' || out.length) out.push(current);
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

function parseInlineMap(value) {
  const inner = value.slice(1, -1).trim();
  if (!inner) return {};
  const map = {};
  for (const pair of splitTopLevel(inner, ',')) {
    const idx = pair.indexOf(':');
    if (idx === -1) continue;
    const key = coerceScalar(pair.slice(0, idx).trim());
    map[String(key)] = coerceValue(pair.slice(idx + 1).trim());
  }
  return map;
}

function coerceValue(value) {
  if (value === '' || value === '~' || value.toLowerCase() === 'null') return null;

  // Inline flow map: { a: b, c: d }
  if (value.startsWith('{') && value.endsWith('}')) return parseInlineMap(value);

  // Inline flow list: [a, b, { c: d }]
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner, ',').map((v) => coerceValue(v));
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
