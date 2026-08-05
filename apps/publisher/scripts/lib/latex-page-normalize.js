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

export function extractLatexPageMetadata(source, html) {
  const text = String(source || '');
  const semanticText = latexHtmlSemanticText(html);
  const title = texField(text, 'title') || headingText(html, 'h1') || null;
  const summary = environmentText(text, 'abstract') || firstParagraphText(html) || null;
  const language = htmlAttribute(html, 'lang') || babelLanguage(text) || null;
  const wordCount = semanticText ? semanticText.split(/\s+/u).filter(Boolean).length : 0;
  return {
    title,
    summary,
    language,
    author: texField(text, 'author') || null,
    date: texField(text, 'date') || null,
    headings: [...String(html || '').matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
      level: Number(match[1]),
      id: /\bid=(?:"([^"]+)"|'([^']+)')/i.exec(match[2])?.slice(1).find(Boolean) || null,
      text: latexHtmlSemanticText(match[3])
    })),
    landmarks: [...new Set([...String(html || '').matchAll(/<(article|main|section|aside)\b/gi)].map((match) => match[1].toLowerCase()))],
    figures: countTags(html, 'figure'),
    tables: countTags(html, 'table'),
    footnotes: (String(html || '').match(/\b(?:footnote|ltx_note)\b/gi) || []).length,
    citations: countTags(html, 'cite'),
    wordCount,
    readingMinutes: wordCount ? Math.max(1, Math.ceil(wordCount / 200)) : 0
  };
}

function texField(source, command) {
  const match = new RegExp(`\\\\${command}\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}`, 'i').exec(source);
  return match ? cleanTexText(match[1]) : null;
}

function environmentText(source, environment) {
  const match = new RegExp(`\\\\begin\\{${environment}\\}([\\s\\S]*?)\\\\end\\{${environment}\\}`, 'i').exec(source);
  return match ? cleanTexText(match[1]) : null;
}

function cleanTexText(value) {
  return String(value || '')
    .replace(/\\\\(?:textbf|textit|emph|texttt)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\\\[A-Za-z@]+\*?(?:\[[^\]]*\])?/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ').trim() || null;
}

function headingText(html, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(String(html || ''));
  return match ? latexHtmlSemanticText(match[1]) : null;
}

function firstParagraphText(html) {
  const match = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(String(html || ''));
  return match ? latexHtmlSemanticText(match[1]) : null;
}

function htmlAttribute(html, name) {
  const match = new RegExp(`<(?:article|main|section)\\b[^>]*\\b${name}=(?:"([^"]+)"|'([^']+)')`, 'i').exec(String(html || ''));
  return match?.slice(1).find(Boolean) || null;
}

function babelLanguage(source) {
  return /\\usepackage\s*\[([^\]]+)\]\s*\{babel\}/i.exec(source)?.[1].split(',')[0].trim() || null;
}

function countTags(html, tag) {
  return (String(html || '').match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
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
