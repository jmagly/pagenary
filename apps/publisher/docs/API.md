# Module Reference

## `app.js` – Shell Controller
- `navigate(id: string)` – Updates the hash and triggers a render.
- `handleRoute()` – Resolves the current section from the manifest and renders it.
- `loadSection(entry)` – Dynamically imports the module at `entry.module` and renders its HTML payload.
- `updateNavState(activeId)` – Applies `aria-current="page"` to the active navigation button.

## `manifest.js` – Navigation Registry
- `MANIFEST` – Ordered list of sections with `id`, `title`, `summary`, `module`.
- `DEFAULT_SECTION` – First item in the manifest; used when no hash is provided.
- `findSection(id)` – Helper to look up entries.

## Section Modules (`src/sections/*.js`)
Design contract:
```javascript
export async function load() {
  return {
    html: '<section>…</section>',
    afterRender(container?) {
      // optional enhancements
    }
  };
}
```
Keep modules pure. Fetch data or run additional logic inside `afterRender` if you need DOM access.

## `seo.js` – Metadata Helper
- `updateMetaTags({ title, description })` – Sets `document.title` and the meta description each time a section loads.

## Scripts
- `scripts/build.js` – Copies `src/` to `dist/`, optionally minifying JavaScript when Terser is installed.
- `scripts/serve.js` – Static file server for local preview with cache headers linked to dev/prod mode.
