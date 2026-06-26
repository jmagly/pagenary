/**
 * Export document composition utilities.
 * Pure functions - no DOM dependencies.
 */

/**
 * Compose a complete HTML export document from chapters.
 * @param {Array<{section: {title: string, summary?: string}, html: string}>} chapters - Array of chapter objects
 * @param {object} [config={}] - Export branding configuration
 * @param {string} [config.title] - Document title
 * @param {string} [config.brandMark] - Primary brand text
 * @param {string} [config.brandSub] - Secondary brand text
 * @param {string} [config.tagline] - Brand tagline
 * @param {string|null} [config.logo] - Logo as data URI or null
 * @param {boolean} [config.showTagline=true] - Whether to show tagline
 * @param {boolean} [config.showDate=true] - Whether to show generation date
 * @returns {string} Complete HTML document
 */
export function composeExportDocument(chapters, config = {}) {
  const {
    title = 'Documentation Export',
    brandMark = 'Docs',
    brandSub = 'Toolkit',
    tagline = '',
    logo = null,
    showTagline = true,
    showDate = true
  } = config;

  const date = new Date().toLocaleString();

  // Build brand name with optional sub
  const brandName = brandSub
    ? `<span class="brand-mark">${brandMark}</span><span class="brand-sub">${brandSub}</span>`
    : brandMark;

  // Build header components
  const logoHtml = logo
    ? `<img src="${logo}" alt="" class="export-logo" aria-hidden="true" />`
    : '';

  const taglineHtml = showTagline && tagline
    ? `<p class="tagline">${tagline}</p>`
    : '';

  const dateHtml = showDate
    ? `<p class="meta">Generated ${date}</p>`
    : '';

  // Determine header class based on content
  const headerClass = logo ? 'export-header--logo-text' : 'export-header--text-only';

  const toc = chapters.map((chapter, index) => `
        <li>${index + 1}. ${chapter.section.title}</li>`).join('');
  const body = chapters.map((chapter, index) => `
      <section>
        <h2>${index + 1}. ${chapter.section.title}</h2>
        <p class="section-summary">${chapter.section.summary || ''}</p>
        <div class="section-body">
${chapter.html}
        </div>
      </section>`).join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root { color-scheme: light; font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      body { margin: 0 auto; padding: 2.5rem; max-width: 820px; color: #111; line-height: 1.6; }
      /* Export header styling */
      header { text-align: center; margin-bottom: 3rem; }
      .export-brand { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.5rem; }
      .export-header--logo-text .export-brand { flex-direction: row; }
      .export-header--text-only .export-brand { flex-direction: column; gap: 0; }
      .export-logo { max-height: 48px; width: auto; }
      h1 { font-size: 2.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin: 0; line-height: 1; }
      .brand-mark { font-weight: 700; }
      .brand-sub { font-weight: 400; opacity: 0.85; }
      .tagline { color: #666; font-size: 0.95rem; margin: 0.5rem 0 0 0; font-style: italic; }
      .meta { color: #666; font-size: 0.9rem; margin: 0.5rem 0 0 0; }
      .front-matter { margin-bottom: 2.5rem; }
      .toc { border: 1px solid rgba(0,0,0,0.1); padding: 1.5rem; margin-bottom: 2.5rem; background: rgba(0,0,0,0.02); }
      .toc h2 { margin-top: 0; letter-spacing: 0.12em; text-transform: uppercase; font-size: 0.95rem; }
      .toc ul { margin: 0; padding-left: 1.2rem; }
      .toc li { margin: 0.4rem 0; }
      section { page-break-inside: avoid; margin-bottom: 2.75rem; }
      h2 { font-size: 1.4rem; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 1px solid rgba(0,0,0,0.12); padding-bottom: 0.5rem; margin-bottom: 1rem; }
      .section-summary { color: #5a5a5a; font-size: 0.95rem; margin-top: 0; }
      .section-body { border-left: 1px solid rgba(0,0,0,0.1); padding-left: 1.25rem; }
      .card, .card-grid, .card-grid > *, .section-body > * { break-inside: avoid; }
      pre { background: rgba(0,0,0,0.05); padding: 1rem; border-radius: 4px; overflow-x: auto; }
      code { font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      /* Table styling */
      table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
      th, td { padding: 0.75rem 1rem; text-align: left; border: 1px solid rgba(0,0,0,0.15); }
      th { background: rgba(0,0,0,0.05); font-weight: 600; }
      tbody tr:nth-child(even) { background: rgba(0,0,0,0.02); }
      /* Spec table styling (legacy) */
      .spec-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
      .spec-table th, .spec-table td { padding: 0.75rem 1rem; text-align: left; border: 1px solid rgba(0,0,0,0.15); }
      .spec-table th { background: rgba(0,0,0,0.05); font-weight: 600; }
      .spec-table tr:nth-child(even) { background: rgba(0,0,0,0.02); }
      .spec-table td:first-child { width: 40%; }
      /* Layer stack styling */
      .layer-stack { display: flex; flex-direction: column; margin: 1.5rem 0; border: 2px solid #111; border-radius: 6px; overflow: hidden; }
      .layer-stack .layer { padding: 1rem 1.25rem; text-align: center; border-bottom: 1px solid rgba(0,0,0,0.15); }
      .layer-stack .layer:last-child { border-bottom: none; }
      .layer-stack .layer:first-child { background: rgba(0,0,0,0.02); }
      .layer-stack .layer:nth-child(2) { background: rgba(0,0,0,0.04); }
      .layer-stack .layer:nth-child(3) { background: rgba(0,0,0,0.06); }
      .layer-stack .layer-title { font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem; }
      .layer-stack .layer-desc, .layer-stack .layer-detail { font-size: 0.85rem; color: #666; }
      /* HTML block container */
      .html-block { margin: 1.5rem 0; }
      /* Box diagram styling */
      .box-diagram { border: 2px solid #111; border-radius: 6px; padding: 1.25rem; margin: 1.5rem 0; background: rgba(0,0,0,0.02); font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; white-space: pre-wrap; }
      .box-diagram .box-title { font-weight: 700; font-size: 1rem; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(0,0,0,0.15); }
      /* Syntax highlighting tokens */
      .token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6a737d; font-style: italic; }
      .token.punctuation { color: #24292e; }
      .token.property, .token.tag, .token.constant, .token.symbol, .token.deleted { color: #d73a49; }
      .token.boolean, .token.number { color: #005cc5; }
      .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted { color: #22863a; }
      .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string { color: #d73a49; }
      .token.atrule, .token.attr-value, .token.keyword { color: #d73a49; }
      .token.function, .token.class-name { color: #6f42c1; }
      .token.regex, .token.important, .token.variable { color: #e36209; }
      .token.important, .token.bold { font-weight: bold; }
      .token.italic { font-style: italic; }
      @media print {
        @page { size: A4; margin: 1in; }
        body { box-shadow: none; }
        .front-matter { break-after: page; page-break-after: always; }
        .toc { break-inside: avoid; page-break-inside: avoid; }
        h2 { break-after: avoid; page-break-after: avoid; }
        .export-logo { max-height: 36px; }
      }
    </style>
  </head>
  <body>
    <div class="front-matter">
      <header class="${headerClass}">
        <div class="export-brand">
          ${logoHtml}
          <h1>${brandName}</h1>
        </div>
        ${taglineHtml}
        ${dateHtml}
      </header>
      <div class="toc">
        <h2>Table of Contents</h2>
        <ul>${toc || '<li>No sections</li>'}</ul>
      </div>
    </div>
${body || '<p>No sections available.</p>'}
    <script type="module">
      import Prism from 'https://esm.sh/prismjs@1.29.0';
      await Promise.all([
        import('https://esm.sh/prismjs@1.29.0/components/prism-c'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-json'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-typescript'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-python'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-rust'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-go'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-bash'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-yaml'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-sql'),
        import('https://esm.sh/prismjs@1.29.0/components/prism-solidity'),
      ]);
      Prism.highlightAll();
      window.focus();
    </script>
  </body>
</html>`;
}

/**
 * Collect all exportable sections from a manifest.
 * Returns leaf sections (those with module paths) in navigation order.
 * @param {Array} manifest - Navigation manifest
 * @returns {Array} Flat array of exportable sections
 */
export function collectExportableSections(manifest) {
  const allSections = [];
  for (const section of manifest) {
    if (section.module) {
      allSections.push(section);
    }
    if (section.subsections) {
      for (const subsection of section.subsections) {
        if (subsection.module) {
          allSections.push(subsection);
        }
      }
    }
  }
  return allSections;
}
