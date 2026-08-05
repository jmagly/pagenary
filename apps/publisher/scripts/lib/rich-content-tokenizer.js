import { createRenderDiagnostic } from './rich-content-diagnostics.js';

const DEFAULT_SPECIAL_FENCES = ['mermaid', 'plantuml', 'puml', 'media', 'form'];

export function tokenizeRichContent(source, options = {}) {
  const text = String(source == null ? '' : source);
  const lineStarts = buildLineStarts(text);
  const specialFences = new Set(options.specialFences || DEFAULT_SPECIAL_FENCES);
  const nodes = [];
  const diagnostics = [];
  let proseStart = 0;
  let offset = 0;

  const flushProse = (end) => {
    if (end <= proseStart) return;
    const value = text.slice(proseStart, end);
    if (!value) return;
    nodes.push(makeNode('prose', value, proseStart, end, lineStarts));
  };

  const pushProtected = (node, end) => {
    flushProse(node.start);
    nodes.push(withLocation(node, lineStarts));
    offset = end;
    proseStart = end;
  };

  while (offset < text.length) {
    const fence = matchFence(text, offset, specialFences);
    if (fence) {
      pushProtected(fence.node, fence.end);
      if (fence.diagnostic) diagnostics.push(createRenderDiagnostic({
        ...fence.diagnostic,
        location: fence.node.location || locationForRange(fence.node.start, fence.node.end, lineStarts)
      }));
      continue;
    }

    const codeSpan = matchCodeSpan(text, offset);
    if (codeSpan) {
      pushProtected(codeSpan.node, codeSpan.end);
      continue;
    }

    const image = matchInlineResource(text, offset, true);
    if (image) {
      pushProtected(image.node, image.end);
      continue;
    }

    const link = matchInlineResource(text, offset, false);
    if (link) {
      pushProtected(link.node, link.end);
      continue;
    }

    const html = matchRawHtml(text, offset);
    if (html) {
      pushProtected(html.node, html.end);
      continue;
    }

    offset += 1;
  }

  flushProse(text.length);
  return { nodes, diagnostics };
}

function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function makeNode(type, source, start, end, lineStarts, extra = {}) {
  return withLocation({ type, source, start, end, ...extra }, lineStarts);
}

function withLocation(node, lineStarts) {
  return {
    ...node,
    location: locationForRange(node.start, node.end, lineStarts)
  };
}

function locationForRange(start, end, lineStarts) {
  return {
    start: pointForOffset(start, lineStarts),
    end: pointForOffset(end, lineStarts)
  };
}

function pointForOffset(offset, lineStarts) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
    offset
  };
}

function matchFence(text, offset, specialFences) {
  if (text.slice(offset, offset + 3) !== '```') return null;
  if (offset !== 0 && text[offset - 1] !== '\n') return null;

  const lineEnd = findLineEnd(text, offset);
  const info = text.slice(offset + 3, lineEnd).trim();
  const language = (info.split(/\s+/)[0] || '').toLowerCase();
  const bodyStart = lineEnd < text.length ? lineEnd + 1 : lineEnd;
  let closeStart = findClosingFence(text, bodyStart);
  let end;
  let bodyEnd;
  let diagnostic = null;

  if (closeStart === -1) {
    closeStart = text.length;
    bodyEnd = text.length;
    end = text.length;
    diagnostic = {
      code: 'RTC_TOKEN_UNTERMINATED_FENCE',
      severity: 'error',
      renderer: specialFences.has(language) ? language : null,
      message: `Unterminated fenced block${language ? ` for ${language}` : ''}`
    };
  } else {
    bodyEnd = closeStart;
    if (text[bodyEnd - 1] === '\n') bodyEnd -= 1;
    end = findLineEnd(text, closeStart);
  }

  const renderer = specialFences.has(language) ? language : null;
  return {
    end,
    diagnostic,
    node: {
      type: 'fence',
      source: text.slice(offset, end),
      start: offset,
      end,
      info,
      language,
      renderer,
      body: text.slice(bodyStart, bodyEnd)
    }
  };
}

function findLineEnd(text, offset) {
  const index = text.indexOf('\n', offset);
  return index === -1 ? text.length : index;
}

function findClosingFence(text, offset) {
  let cursor = offset;
  while (cursor < text.length) {
    const next = text.indexOf('```', cursor);
    if (next === -1) return -1;
    if (next === 0 || text[next - 1] === '\n') return next;
    cursor = next + 3;
  }
  return -1;
}

function matchCodeSpan(text, offset) {
  if (text[offset] !== '`' || text.slice(offset, offset + 3) === '```') return null;
  let ticks = 1;
  while (text[offset + ticks] === '`') ticks += 1;
  const marker = '`'.repeat(ticks);
  const close = text.indexOf(marker, offset + ticks);
  if (close === -1) return null;
  const end = close + ticks;
  return {
    end,
    node: {
      type: 'codeSpan',
      source: text.slice(offset, end),
      start: offset,
      end,
      body: text.slice(offset + ticks, close)
    }
  };
}

function matchInlineResource(text, offset, image) {
  if (image) {
    if (text[offset] !== '!' || text[offset + 1] !== '[') return null;
  } else if (text[offset] !== '[' || text[offset - 1] === '!') {
    return null;
  }

  const labelStart = offset + (image ? 2 : 1);
  const labelEnd = findBalanced(text, labelStart, '[', ']');
  if (labelEnd === -1 || text[labelEnd + 1] !== '(') return null;
  const targetStart = labelEnd + 2;
  const targetEnd = findBalanced(text, targetStart, '(', ')');
  if (targetEnd === -1) return null;
  const end = targetEnd + 1;
  return {
    end,
    node: {
      type: image ? 'image' : 'link',
      source: text.slice(offset, end),
      start: offset,
      end,
      label: text.slice(labelStart, labelEnd),
      target: text.slice(targetStart, targetEnd)
    }
  };
}

function findBalanced(text, start, open, close) {
  let depth = 0;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      if (depth === 0) return i;
      depth -= 1;
    }
    if (ch === '\n' && open !== '(') return -1;
  }
  return -1;
}

function matchRawHtml(text, offset) {
  if (text[offset] !== '<') return null;
  if (text.startsWith('<!--', offset)) {
    const close = text.indexOf('-->', offset + 4);
    if (close === -1) return null;
    const end = close + 3;
    return rawHtmlNode(text, offset, end);
  }
  const tag = text.slice(offset).match(/^<([A-Za-z][A-Za-z0-9:-]*)(?:\s[^>]*)?>/);
  if (!tag) return null;
  const openEnd = offset + tag[0].length;
  const closing = `</${tag[1]}>`;
  const close = text.indexOf(closing, openEnd);
  const end = close === -1 ? openEnd : close + closing.length;
  return rawHtmlNode(text, offset, end);
}

function rawHtmlNode(text, start, end) {
  return {
    end,
    node: {
      type: 'rawHtml',
      source: text.slice(start, end),
      start,
      end
    }
  };
}
