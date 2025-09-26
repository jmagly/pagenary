# SEO Strategy Notes

Docs Toolkit is primarily an internal enablement asset, but clean metadata keeps shared links professional and predictable.

## Core Actions
- Maintain a descriptive `<title>` and `<meta name="description">` in `src/index.html`.
- Keep manifest summaries concise—these values power link previews and the export document.
- Use human-readable, hyphenated IDs in `manifest.js` so hash URLs remain friendly.

## Hash Routing Considerations
- Hash routes (`#/page-id`) mean the host only serves `index.html`; the browser handles navigation.
- When sharing links, include the hash so teammates land directly on the intended section.
- Avoid uppercase or spaces in IDs to prevent encoding quirks.

## Optional Enhancements
- Add JSON-LD when tenant offerings need richer preview cards.
- Inject Open Graph/Twitter meta tags if the docs will be shared outside the reseller organization.
- Monitor for broken links or missing content using the lint script or a CI crawler.
