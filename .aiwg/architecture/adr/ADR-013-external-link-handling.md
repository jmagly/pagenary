# ADR-013: External Link Handling

## Status
ACCEPTED

## Date
2025-12-07

## Context

Documentation sites frequently link to external resources such as:
- API documentation on third-party platforms
- Related tools and libraries
- Reference materials and standards
- Community resources and discussions

These external links present both user experience and security considerations:

1. **Navigation Disruption**: Clicking an external link that opens in the same tab causes users to lose their place in the documentation, requiring back-button navigation to return.

2. **Security Vulnerabilities**: Without proper attributes, external links can be exploited via:
   - **Tabnapping attacks**: The linked page can use `window.opener` to redirect the original tab to a phishing site
   - **Referrer leaking**: The Referer header may expose internal URLs or user state to external sites

3. **Visual Ambiguity**: Users cannot distinguish between internal navigation (which keeps them on-site) and external links (which take them elsewhere) without visual indicators.

### Current Implementation Points

External links are handled in three locations:

1. **Build Script** (`scripts/build-tenants.js`): The `parseInlineMarkdown()` function processes markdown links and adds security attributes to external URLs.

2. **Navigation** (`src/app.js`): The `createExternalLink()` function handles manifest entries with `url` property for nav-level external links.

3. **CSS Styling** (`src/styles.css`): Visual indicators are applied via pseudo-elements for content links and inline icons for navigation links.

## Decision

All external links (URLs with `http://` or `https://` protocol) automatically receive:

1. **New tab behavior**: `target="_blank"` attribute
2. **Security attributes**: `rel="noopener noreferrer"`
3. **Visual indicator**: Arrow icon (↗) displayed via CSS or inline markup

This behavior applies consistently across:
- Markdown content links (build-time transformation)
- Navigation manifest entries (runtime rendering)
- Raw HTML content (manual authoring required)

### Implementation Details

#### Build-Time (parseInlineMarkdown)

```javascript
// Links: [label](href)
output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
  const resolvedHref = linkContext
    ? transformInternalLink(href, linkContext)
    : href;
  // External links open in new tab by default
  const isExternal = /^https?:\/\//i.test(resolvedHref);
  const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeAttribute(resolvedHref)}"${attrs}>${escapeHtml(label)}</a>`;
});
```

#### Runtime (createExternalLink)

```javascript
function createExternalLink(item, className) {
  const link = document.createElement('a');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = `${className} nav-external`;
  link.title = item.summary || item.title;
  link.innerHTML = `
    <span class="nav-title">${item.title}<span class="nav-external-icon" aria-label="(opens in new tab)">↗</span></span>
    ${item.summary ? `<span class="nav-summary">${item.summary}</span>` : ''}
  `;
  return link;
}
```

#### CSS Visual Indicator

```css
/* External link indicator in content */
.doc-content a[target="_blank"]::after {
  content: " \2197";  /* ↗ arrow */
  font-size: 0.75em;
  opacity: 0.6;
}

/* Exclude styled CTA buttons from auto-indicator */
.doc-content a.external-cta[target="_blank"]::after {
  content: none;
}
```

### Detection Pattern

External links are identified by matching the `https?://` protocol pattern:

```javascript
const isExternal = /^https?:\/\//i.test(href);
```

This pattern:
- Matches `http://` and `https://` URLs
- Is case-insensitive (`/i` flag)
- Does NOT match protocol-relative URLs (`//example.com`)
- Does NOT match other protocols (`mailto:`, `tel:`, `javascript:`, etc.)

## Rationale

### Security: noopener

The `noopener` attribute prevents the linked page from accessing `window.opener`:

```javascript
// Without noopener, the external page can do:
window.opener.location = 'https://phishing-site.com';
```

This attack (tabnapping) can redirect users to a convincing phishing page after they've clicked away.

### Privacy: noreferrer

The `noreferrer` attribute prevents the browser from sending the Referer header:

```http
// Without noreferrer, external sites receive:
Referer: https://docs.example.com/internal/page#section-id
```

This can expose:
- Internal page structure
- Hash-based navigation state
- Potentially sensitive URL parameters

### UX: target="_blank"

Opening external links in new tabs:
- Preserves user's reading position
- Allows quick reference without losing context
- Follows common documentation site conventions

### UX: Visual Indicator (↗)

The arrow icon:
- Signals that clicking will leave the current site
- Is a widely recognized convention for external links
- Uses a subtle size (0.75em) and opacity (0.6) to avoid visual clutter

## Consequences

### Positive

- **Consistent Security**: All external links are protected against tabnapping and referrer leaking without requiring author action
- **Predictable UX**: Users can rely on external links always opening in new tabs
- **No Special Syntax**: Authors use standard markdown `[text](url)` syntax
- **Automatic Visual Indication**: External links are visually distinguished without manual markup
- **Accessibility**: Icon includes `aria-label` for screen readers (nav links)

### Negative

- **No Same-Tab Option**: Authors cannot opt individual external links to open in the same tab
- **Consistent but Rigid**: All http/https links treated as external, even if pointing to same domain
- **Raw HTML Requires Manual Attributes**: Only markdown links receive automatic transformation

### Mitigations

- **Same-Tab Workaround**: If truly needed, authors can use raw HTML without `target="_blank"`
- **Same-Domain Links**: Use relative paths for same-site links (`./page.md`) which are transformed to hash-based internal navigation
- **HTML Content**: Document the expected attributes for HTML content authors

## Alternatives Considered

### Alternative 1: Opt-In External Link Syntax

Use special syntax like `[text](url){:external}` to mark links as external.

**Rejected because:**
- Non-standard markdown (breaks GitHub preview)
- Burden on content authors to remember syntax
- Inconsistent behavior if author forgets annotation
- Security gap when annotation is omitted

### Alternative 2: Runtime Transformation

Add `target="_blank"` and `rel` attributes via JavaScript after page load.

**Rejected because:**
- Flash of unstyled links before transformation
- Performance overhead on every page view
- Accessibility concerns (attributes not present in initial HTML)
- Complexity of DOM traversal

### Alternative 3: Allow Author Override

Provide syntax to disable new-tab behavior: `[text](url){:same-tab}`.

**Rejected because:**
- Re-introduces tabnapping risk for opted-out links
- Complicates build logic
- Unclear use case for same-tab external links in documentation
- YAGNI (You Ain't Gonna Need It)

### Alternative 4: No Visual Indicator

Apply security attributes without visual differentiation.

**Rejected because:**
- Users cannot predict link behavior
- Violates principle of least surprise
- Accessibility guidelines recommend indicating external links

## Relationship to Other ADRs

- **ADR-011** (Internal Link Transformation): Complements this ADR by handling internal links; the `isExternalLink()` check determines which handling applies
- **ADR-003** (Static JS Deployment): Build-time transformation aligns with static deployment philosophy
- **ADR-002** (Zero Dependency Philosophy): CSS-based indicators avoid additional JavaScript dependencies

## References

- [OWASP: Tabnapping](https://owasp.org/www-community/attacks/Reverse_Tabnabbing)
- [MDN: Link types - noopener](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/noopener)
- [MDN: Link types - noreferrer](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/noreferrer)
- [WCAG 2.1 G201: Giving users advanced warning when opening a new window](https://www.w3.org/TR/WCAG20-TECHS/G201.html)
