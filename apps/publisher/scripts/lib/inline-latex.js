import katex from 'katex';

const DEFAULT_MAX_SIZE = 20;
const DEFAULT_MAX_EXPAND = 1000;

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

export function resolveInlineLatexConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  return {
    enabled: source.enabled !== false,
    dollarDelimiters: source.dollarDelimiters === true || source.singleDollar === true,
    throwOnError: source.throwOnError === true,
    maxSize: boundedInteger(source.maxSize, DEFAULT_MAX_SIZE, 1, 100),
    maxExpand: boundedInteger(source.maxExpand, DEFAULT_MAX_EXPAND, 0, 10000),
    macros: source.macros && typeof source.macros === 'object' && !Array.isArray(source.macros)
      ? Object.fromEntries(Object.entries(source.macros).map(([key, value]) => [
        key.replace(/^(?:"(.*)"|'(.*)')$/, '$1$2').replace(/\\\\/g, '\\'),
        typeof value === 'string' ? value.replace(/\\\\/g, '\\') : value
      ]))
      : {}
  };
}

function isEscaped(source, offset) {
  let slashes = 0;
  for (let index = offset - 1; index >= 0 && source[index] === '\\'; index--) slashes++;
  return slashes % 2 === 1;
}

function findClosing(source, start, closing) {
  for (let index = start; index <= source.length - closing.length; index++) {
    if (source.startsWith(closing, index) && !isEscaped(source, index)) return index;
  }
  return -1;
}

function opaqueRanges(source) {
  const ranges = [];
  const patterns = [
    /(^|\n)[ \t]*(```+|~~~+)[^\n]*\n[\s\S]*?\n[ \t]*\2(?=\n|$)/g,
    /(`+)(?:(?!\1)[\s\S])*?\1/g,
    /<([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/g,
    /<!--[\s\S]*?-->/g,
    /<[^>]*>/g
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      let start = match.index;
      // Keep a leading newline outside an opaque fenced-code range.
      if (match[1] === '\n') start++;
      ranges.push([start, match.index + match[0].length]);
    }
  }
  // Only destinations are opaque: inline LaTeX remains available in labels.
  const destination = /!?\[[^\]]*\]\((<?[^)\n]*>?)\)/g;
  let linkMatch;
  while ((linkMatch = destination.exec(source))) {
    const destinationOffset = linkMatch[0].lastIndexOf(linkMatch[1]);
    ranges.push([
      linkMatch.index + destinationOffset,
      linkMatch.index + destinationOffset + linkMatch[1].length
    ]);
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  return ranges;
}

function containingRange(ranges, offset) {
  return ranges.find(([start, end]) => offset >= start && offset < end);
}

function sourceLocation(source, offset) {
  const prefix = source.slice(0, offset);
  const lines = prefix.split('\n');
  return { line: lines.length, column: lines.at(-1).length + 1, offset };
}

/**
 * Render KaTeX-supported inline LaTeX before Markdown parsing. Generated HTML is
 * represented by inert alphanumeric tokens so Markdown cannot reinterpret it.
 */
export function protectInlineLatex(source, config = {}) {
  const resolved = resolveInlineLatexConfig(config);
  const input = String(source ?? '');
  const diagnostics = [];
  const rendered = new Map();
  if (!resolved.enabled) return { source: input, diagnostics, restore: (value) => String(value ?? '') };

  const opaque = opaqueRanges(input);
  let output = '';
  let cursor = 0;
  let tokenIndex = 0;

  while (cursor < input.length) {
    const range = containingRange(opaque, cursor);
    if (range) {
      output += input.slice(cursor, range[1]);
      cursor = range[1];
      continue;
    }

    const candidates = [
      { open: '\\[', close: '\\]', displayMode: true },
      { open: '$$', close: '$$', displayMode: true },
      { open: '\\(', close: '\\)', displayMode: false },
      ...(resolved.dollarDelimiters ? [{ open: '$', close: '$', displayMode: false }] : [])
    ];
    const delimiter = candidates.find(({ open }) => input.startsWith(open, cursor) && !isEscaped(input, cursor));
    if (!delimiter) {
      output += input[cursor++];
      continue;
    }

    const contentStart = cursor + delimiter.open.length;
    const closeAt = findClosing(input, contentStart, delimiter.close);
    if (closeAt < 0 || containingRange(opaque, closeAt)) {
      output += input[cursor++];
      continue;
    }

    const latex = input.slice(contentStart, closeAt);
    const original = input.slice(cursor, closeAt + delimiter.close.length);
    try {
      const options = {
        displayMode: delimiter.displayMode,
        output: 'htmlAndMathml',
        trust: false,
        throwOnError: true,
        strict: 'warn',
        maxSize: resolved.maxSize,
        maxExpand: resolved.maxExpand,
        macros: { ...resolved.macros }
      };
      const html = katex.renderToString(latex, options);
      const token = `PAGENARYLATEX${tokenIndex++}TOKEN`;
      rendered.set(token, html);
      output += token;
    } catch (error) {
      const diagnostic = {
        code: 'INLINE_LATEX_RENDER_FAILED',
        severity: resolved.throwOnError ? 'error' : 'warning',
        message: error instanceof Error ? error.message : String(error),
        source: original,
        location: sourceLocation(input, cursor)
      };
      diagnostics.push(diagnostic);
      if (resolved.throwOnError) {
        output += original;
      } else {
        const html = katex.renderToString(latex, {
          displayMode: delimiter.displayMode,
          output: 'htmlAndMathml',
          trust: false,
          throwOnError: false,
          strict: 'warn',
          maxSize: resolved.maxSize,
          maxExpand: resolved.maxExpand,
          macros: { ...resolved.macros }
        });
        const token = `PAGENARYLATEX${tokenIndex++}TOKEN`;
        rendered.set(token, html);
        output += token;
      }
    }
    cursor = closeAt + delimiter.close.length;
  }

  return {
    source: output,
    diagnostics,
    restore(value) {
      return String(value ?? '').replace(/PAGENARYLATEX(\d+)TOKEN/g, (token) => rendered.get(token) ?? token);
    }
  };
}

export const INLINE_LATEX_STYLESHEET = 'katex/dist/katex.min.css';
