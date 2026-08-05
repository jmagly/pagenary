const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
]);

function isHidden(tag) {
  return /\saria-hidden\s*=\s*(?:"true"|'true'|true)(?:\s|\/?>)/i.test(tag);
}

function isDiagramSource(tag) {
  const classes = /\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
  return String(classes?.[1] || classes?.[2] || '').split(/\s+/).includes('rich-diagram__source');
}

/** Remove active and visual-only subtrees while retaining semantic content. */
export function semanticHtml(html, options = {}) {
  const source = String(html || '');
  const output = [];
  const stack = [];
  let suppressed = 0;
  let cursor = 0;
  for (const match of source.matchAll(/<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g)) {
    if (!suppressed) output.push(source.slice(cursor, match.index));
    const tag = match[0];
    const name = String(match[1] || '').toLowerCase();
    if (/^<\//.test(tag)) {
      const frame = stack.pop();
      if (frame?.suppressed) suppressed -= 1;
      if (!suppressed && !frame?.suppressed) output.push(options.keepTags === false ? ' ' : tag);
    } else if (!tag.startsWith('<!--')) {
      const suppress = suppressed > 0
        || ['script', 'style', 'template', 'svg', 'annotation'].includes(name)
        || isHidden(tag) || isDiagramSource(tag);
      const paired = !VOID_ELEMENTS.has(name) && !/\/\s*>$/.test(tag);
      if (paired) {
        stack.push({ name, suppressed: suppress && suppressed === 0 });
        if (suppress && suppressed === 0) suppressed += 1;
      }
      if (!suppress) output.push(options.keepTags === false ? ' ' : tag);
    }
    cursor = (match.index || 0) + tag.length;
  }
  if (!suppressed) output.push(source.slice(cursor));
  return output.join('');
}

export function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function semanticHtmlToText(html) {
  return decodeHtmlEntities(semanticHtml(html, { keepTags: false })).replace(/\s+/g, ' ').trim();
}
