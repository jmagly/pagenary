/**
 * Export document composition utilities.
 * Pure functions - no DOM dependencies.
 */

/**
 * Compose a complete HTML export document from chapters.
 * @param {Array<{section: {title: string, summary?: string}, html: string}>} chapters - Array of chapter objects
 * @returns {string} Complete HTML document
 */
export function composeExportDocument(chapters) {
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
    <title>Docs Toolkit Export</title>
    <style>
      :root { color-scheme: light; font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      body { margin: 0 auto; padding: 2.5rem; max-width: 820px; color: #111; line-height: 1.6; }
      header { text-align: center; margin-bottom: 3rem; }
      h1 { font-size: 2.2rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
      .meta { color: #666; font-size: 0.9rem; }
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
      @media print {
        @page { size: A4; margin: 1in; }
        body { box-shadow: none; }
        header, .toc { break-after: avoid; }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Docs Toolkit</h1>
      <p class="meta">Generated ${new Date().toLocaleString()}</p>
    </header>
    <div class="toc">
      <h2>Table of Contents</h2>
      <ul>${toc || '<li>No sections</li>'}</ul>
    </div>
${body || '<p>No sections available.</p>'}
    <script>window.addEventListener('load', () => window.focus());</script>
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
