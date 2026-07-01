'use strict';

function renderPreviewHtml(markdown, { title = 'Pagenary Preview', nonce = '' } = {}) {
  const parsed = splitFrontmatter(markdown);
  const body = renderMarkdown(parsed.body);
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
    a { color: #0f62fe; }
  </style>
</head>
<body>
  <main>
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

  function flushParagraph() {
    if (!paragraph.length) return;
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushCode() {
    out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
  }

  for (const line of lines) {
    if (/^```/.test(line)) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
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
    });
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

module.exports = { renderPreviewHtml, renderMarkdown, splitFrontmatter };
