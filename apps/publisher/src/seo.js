const DEFAULT_TITLE = 'Documentation';
const DESCRIPTION_TAG = 'meta[name="description"]';

/**
 * Encode a section ID for use in a static-page filename (mirror of the
 * build-time encodePathForFilename: replace "/" with "--").
 * @param {string} sectionId
 * @returns {string}
 */
function encodePathForFilename(sectionId) {
  return String(sectionId).replace(/\//g, '--');
}

/**
 * Ensure a meta tag exists with the given selector, creating it if needed.
 * @param {string} selector - CSS selector for the meta tag
 * @param {Function} creator - Function that creates the element if not found
 * @returns {HTMLElement} The meta tag element
 */
function ensureMeta(selector, creator) {
  let el = document.querySelector(selector);
  if (!el) {
    el = creator();
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Set or create a meta tag by property attribute (for og: and twitter: tags)
 * @param {string} attr - Attribute name ('property' or 'name')
 * @param {string} value - Attribute value (e.g., 'og:title')
 * @param {string} content - Content value
 */
function setMeta(attr, value, content) {
  const el = ensureMeta(
    `meta[${attr}="${value}"]`,
    () => {
      const meta = document.createElement('meta');
      meta.setAttribute(attr, value);
      return meta;
    }
  );
  el.setAttribute('content', content);
}

/**
 * Set or create a link tag by rel attribute
 * @param {string} rel - Rel value (e.g., 'canonical')
 * @param {string} href - Href value
 */
function setLink(rel, href) {
  const el = ensureMeta(
    `link[rel="${rel}"]`,
    () => {
      const link = document.createElement('link');
      link.setAttribute('rel', rel);
      return link;
    }
  );
  el.setAttribute('href', href);
}

/**
 * Update all SEO meta tags for the current section.
 * Called on every route change to keep meta tags in sync with content.
 *
 * @param {object} opts
 * @param {string} [opts.title] - Page title
 * @param {string} [opts.description] - Page description
 * @param {string} [opts.siteTitle] - Site title (overrides DEFAULT_TITLE)
 * @param {string} [opts.siteUrl] - Base URL for canonical/og:url (e.g., 'https://docs.aiwg.io')
 * @param {string} [opts.sectionId] - Section ID; canonical points at its static snapshot
 * @param {string} [opts.ogImage] - Absolute social share image URL
 */
export function updateMetaTags({ title, description, siteTitle, siteUrl, sectionId, ogImage }) {
  const brand = siteTitle || DEFAULT_TITLE;
  const pageTitle = title ? `${title} · ${brand}` : brand;
  document.title = pageTitle;

  // Description
  const desc = description || '';
  setMeta('name', 'description', desc);

  // Open Graph
  setMeta('property', 'og:title', title || brand);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:type', 'article');

  // Twitter Card — large card when a share image is available
  setMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', title || brand);
  setMeta('name', 'twitter:description', desc);

  // Social share image (#16)
  if (ogImage) {
    setMeta('property', 'og:image', ogImage);
    setMeta('name', 'twitter:image', ogImage);
  }

  // Canonical + og:url — for a section, point at the crawlable static snapshot
  // (/pages/<id>.html), not the SPA #hash route which crawlers fold into the
  // homepage. The home route canonicalizes to the site root. See #17.
  if (siteUrl) {
    const canonical = sectionId
      ? `${siteUrl}/pages/${encodePathForFilename(sectionId)}.html`
      : siteUrl;
    setLink('canonical', canonical);
    setMeta('property', 'og:url', canonical);
  }
}
