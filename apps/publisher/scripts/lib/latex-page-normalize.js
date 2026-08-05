const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'caption', 'cite', 'code',
  'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
  'main', 'math', 'merror', 'mfrac', 'mi', 'mmultiscripts', 'mn', 'mo', 'mover',
  'mpadded', 'mphantom', 'mprescripts', 'mroot', 'mrow', 'ms', 'mspace', 'msqrt',
  'mstyle', 'msub', 'msubsup', 'msup', 'mtable', 'mtd', 'mtext', 'mtr', 'munder',
  'munderover', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span',
  'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
  'tr', 'u', 'ul', 'var'
]);

export function normalizeLatexHtml(input) {
  let html = String(input ?? '');
  html = html.replace(/<!doctype[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i);
  if (body) html = body[1];
  html = html
    .replace(/<(script|style|iframe|object|embed|form|base|meta|link)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|base|meta|link)\b[^>]*\/?\s*>/gi, '')
    .replace(/<\/?([A-Za-z][\w:-]*)([^>]*)>/g, (whole, rawTag, rawAttrs) => {
      const closing = whole.startsWith('</');
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';
      if (closing) return `</${tag}>`;
      const attrs = sanitizeAttributes(rawAttrs, tag);
      return `<${tag}${attrs}>`;
    });
  return html.trim();
}

export function latexHtmlSemanticText(html) {
  return String(html ?? '')
    .replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, (math) => math.replace(/<[^>]+>/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
    .replace(/\s+/g, ' ').trim();
}

function sanitizeAttributes(value, tag) {
  const kept = [];
  for (const match of String(value).matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const name = match[1].toLowerCase();
    const raw = match[2] ?? match[3] ?? match[4] ?? '';
    if (name.startsWith('on') || name === 'style' || name === 'srcdoc') continue;
    if (!isAllowedAttribute(name, tag)) continue;
    if ((name === 'href' || name === 'src') && !safeUrl(raw)) continue;
    kept.push(`${name}="${escapeAttribute(raw)}"`);
  }
  return kept.length ? ` ${kept.join(' ')}` : '';
}

function isAllowedAttribute(name, tag) {
  if (name === 'class' || name === 'id' || name === 'title' || name === 'role' || name === 'lang' || name.startsWith('aria-')) return true;
  if (tag === 'a' && ['href', 'rel'].includes(name)) return true;
  if (tag === 'img' && ['src', 'alt', 'width', 'height', 'loading'].includes(name)) return true;
  if (tag === 'math' && ['display', 'xmlns'].includes(name)) return true;
  return ['colspan', 'rowspan', 'scope'].includes(name);
}

function safeUrl(value) {
  const decoded = String(value)
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => String.fromCodePoint(parseInt(hex || dec, hex ? 16 : 10)))
    .replace(/&colon;/gi, ':')
    .replace(/[\u0000-\u0020]/g, '')
    .toLowerCase();
  return !/^(?:javascript|data|vbscript|file):/.test(decoded) && !/^\/\//.test(decoded);
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
