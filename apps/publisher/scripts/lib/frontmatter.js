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

function countWords(value) {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .split(/[^A-Za-z0-9'-]+/)
    .filter(Boolean).length;
}

function readingLabel(minutes, seconds) {
  if (seconds > 0 && seconds < 60) return '<1 min read';
  return `${minutes} min read`;
}

/**
 * Estimate realistic reading length from Markdown body content.
 *
 * The model excludes frontmatter and ordinary Markdown syntax, weights code and
 * tables more conservatively than prose, and records checklist completion as
 * author/publisher metadata rather than reader scroll progress.
 *
 * @param {string} body
 * @param {object} [options]
 * @returns {object}
 */
export function estimateReadingLength(body, options = {}) {
  const text = String(body || '').replace(/\r\n/g, '\n');
  const proseWpm = Number(options.proseWpm) > 0 ? Number(options.proseWpm) : 225;
  const codeLineSeconds = Number(options.codeLineSeconds) > 0 ? Number(options.codeLineSeconds) : 8;
  const imageSeconds = Number(options.imageSeconds) > 0 ? Number(options.imageSeconds) : 12;
  const tableRowSeconds = Number(options.tableRowSeconds) > 0 ? Number(options.tableRowSeconds) : 3;

  let prose = text;
  let codeBlocks = 0;
  let codeLines = 0;
  prose = prose.replace(/```[\w-]*\n([\s\S]*?)```/g, (_match, code) => {
    codeBlocks += 1;
    codeLines += String(code || '').split('\n').filter((line) => line.trim()).length;
    return ' ';
  });

  let imageCount = 0;
  prose = prose.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt) => {
    imageCount += 1;
    return ` ${alt || ''} `;
  });

  prose = prose.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  let tableRows = 0;
  const tableText = [];
  prose = prose.replace(/^\s*\|(.+)\|\s*$/gm, (line) => {
    if (/^\s*\|?[\s\-:|]+\|?\s*$/.test(line)) return ' ';
    tableRows += 1;
    tableText.push(line.replace(/\|/g, ' '));
    return ' ';
  });

  let checklistTotal = 0;
  let checklistCompleted = 0;
  prose = prose.replace(/^\s*[-*+]\s+\[([ xX])\]\s+/gm, (_match, state) => {
    checklistTotal += 1;
    if (state.toLowerCase() === 'x') checklistCompleted += 1;
    return ' ';
  });

  prose = prose
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/[*_`~#<>]/g, ' ');

  const proseWords = countWords(prose);
  const tableWords = countWords(tableText.join(' '));
  const words = proseWords + tableWords;
  const seconds = Math.round(
    (proseWords / proseWpm) * 60 +
    (tableWords / Math.max(150, proseWpm - 60)) * 60 +
    tableRows * tableRowSeconds +
    codeLines * codeLineSeconds +
    imageCount * imageSeconds
  );
  const minutes = Math.max(1, Math.round(seconds / 60));
  const checklistProgress = checklistTotal > 0
    ? { completed: checklistCompleted, total: checklistTotal, percent: Math.round((checklistCompleted / checklistTotal) * 100) }
    : null;

  return {
    minutes,
    label: readingLabel(minutes, seconds),
    seconds,
    words,
    proseWords,
    tableWords,
    tableRows,
    codeBlocks,
    codeLines,
    imageCount,
    checklist: checklistProgress,
    model: {
      proseWpm,
      codeLineSeconds,
      imageSeconds,
      tableRowSeconds
    }
  };
}

/**
 * Backward-compatible reading time in minutes.
 * @param {string} body
 * @param {object} [options]
 * @returns {number}
 */
export function estimateReadingTime(body, options = {}) {
  return estimateReadingLength(body, options).minutes;
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
