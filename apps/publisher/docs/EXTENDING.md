# Extending Docs Toolkit

This project is meant to be forked or templated per reseller. Everything lives in vanilla modules, so extending it is a matter of editing a handful of files.

## Add a New Page Type
1. Update `section-templates.js` with a new category configuration (summary + render function).
2. Create a section file in `src/sections/` that imports `renderSectionTemplate` and sets `SECTION_ID` to match the slug you want.
3. Register the slug inside `src/manifest.js` under the appropriate group (or create a new group entry).

Run `npm run sync:docs` to regenerate the boilerplate module if you want to reapply the standard wrapper.

## Override Styling
- Adjust global tokens and typographic scale in `src/styles.css`.
- Use existing utility classes (`doc-content`, `doc-grid`, etc.) when adding new markup blocks.
- Keep the high-contrast palette for accessibility unless brand guidelines state otherwise; test color contrast if you change it.

## Inject Dynamic Data
While the bundle is static, section modules can directly fetch remote JSON or call APIs. Recommended approach:

```js
export async function load() {
  const res = await fetch('https://api.example.com/tenant/metrics.json');
  const metrics = await res.json();

  return {
    html: renderCustomTemplate(metrics)
  };
}
```

Keep requests idempotent and cache-friendly—most hosts allow short-lived fetches if end users need fresh stats.

## Internationalisation
- Duplicate `manifest.js` with translated summaries or hydrate labels at runtime via a locale switcher.
- Wrap static strings in template helpers so copy updates stay centralized.

## Automation Ideas
- Add a content pipeline that transforms Markdown into HTML and swaps it into templates.
- Integrate accessibility scans (axe, pa11y) into CI alongside the provided lint/SEO scripts.
