'use strict';

function renderPreviewHtml(markdown, { title = 'Pagenary Preview', nonce = '', languageId = 'markdown' } = {}) {
  const parsed = splitFrontmatter(markdown);
  const isLatexPage = languageId === 'latex' || languageId === 'tex';
  const body = isLatexPage ? renderLatexPagePreview(parsed.body) : renderMarkdown(parsed.body);
  const reduced = isLatexPage || /\\[([]|```(?:mermaid|plantuml|puml)\b/i.test(parsed.body)
    ? '<aside class="preview-notice" role="note"><strong>Reduced preview:</strong> rich content uses production delimiters and fences, but external converters and browser Mermaid are not executed in the editor webview. Run a Pagenary build for final output.</aside>'
    : '';
  const frontmatter = parsed.frontmatter
    ? `<section class="frontmatter"><h2>Frontmatter</h2><pre>${escapeHtml(parsed.frontmatter)}</pre></section>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${escapeHtml(nonce)}';" />
  <title>${escapeHtml(title)}</title>
  <style nonce="${escapeHtml(nonce)}">
    body { color: #1f2933; font: 16px/1.55 system-ui, sans-serif; margin: 0; padding: 2rem; }
    main { max-width: 780px; margin: 0 auto; }
    pre { background: #f4f6f8; border: 1px solid #d9e2ec; border-radius: 4px; overflow-x: auto; padding: 1rem; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .frontmatter { border: 1px solid #d9e2ec; border-radius: 4px; margin-bottom: 2rem; padding: 1rem; }
    .frontmatter h2 { font-size: 0.9rem; letter-spacing: 0; margin-top: 0; text-transform: uppercase; }
    .preview-notice { background: #eff6ff; border: 1px solid #93c5fd; border-radius: 4px; margin-bottom: 1rem; padding: .75rem; }
    .rich-preview { border-left: 4px solid #64748b; padding-left: 1rem; }
    .math-preview { font-family: ui-serif, Georgia, serif; }
    a { color: #0f62fe; }
  </style>
</head>
<body>
  <main>
    ${reduced}
    ${frontmatter}
    <article>${body}</article>
  </main>
</body>
</html>`;
}

function splitFrontmatter(markdown) {
  const text = String(markdown || '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { frontmatter: '', body: text };
  return {
    frontmatter: match[1],
    body: text.slice(match[0].length)
  };
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const out = [];
  let paragraph = [];
  let code = [];
  let inCode = false;
  let codeInfo = '';

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushCode() {
    const renderer = /^(mermaid|plantuml|puml)\b/i.exec(codeInfo)?.[1]?.toLowerCase();
    if (renderer) {
      const title = /\btitle=(?:"([^"]+)"|'([^']+)')/.exec(codeInfo);
      out.push(`<figure class="rich-preview" data-renderer="${renderer}"><figcaption>${escapeHtml(title?.[1] || title?.[2] || `${renderer} diagram`)}</figcaption><p>External ${renderer} rendering is unavailable in reduced preview.</p><pre><code>${escapeHtml(code.join('\n'))}</code></pre></figure>`);
    } else out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
    codeInfo = '';
  }

  for (const line of lines) {
    const fence = /^```(.*)$/.exec(line);
    if (fence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
        codeInfo = fence[1].trim();
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      out.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }
  if (inCode) flushCode();
  flushParagraph();
  return out.join('\n') || '<p>No preview content.</p>';
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = String(href).startsWith('javascript:') ? '#' : href;
      return `<a href="${escapeAttribute(safeHref)}">${label}</a>`;
    })
    .replace(/\\\((.+?)\\\)/g, '<span class="math-preview" data-inline-latex>$1</span>')
    .replace(/\\\[(.+?)\\\]/g, '<span class="math-preview" data-display-latex>$1</span>');
}

function renderLatexPagePreview(source) {
  return `<section class="rich-preview" data-renderer="latexPage"><h1>Complete LaTeX page</h1><p>LaTeXML/Pandoc and optional Tectonic are not executed in reduced preview. This source becomes the page itself in a production build.</p><pre><code>${escapeHtml(source)}</code></pre></section>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

module.exports = { renderPreviewHtml, renderMarkdown, renderLatexPagePreview, splitFrontmatter };
