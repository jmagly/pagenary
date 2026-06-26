/**
 * Blog index — a framework-free chronological post list for the blog layout
 * (`layout: "blog"`). Renders from a collection's already-emitted `index.json`
 * (see scripts/lib/collections-generator.js), so it reuses the existing
 * collections engine rather than re-deriving post metadata.
 *
 * Shipped as a section module (sections/blog.js re-exports load) only when a
 * tenant sets `layout: "blog"`; the build also injects a `blog` MANIFEST entry
 * so the standard router/nav/command-palette drive it — no changes to app.js.
 *
 * Progressive enhancement: pure markup, real <a>/<article>/<time> elements, no
 * motion. The Phase 2 transitions layer attaches separately and is opt-in.
 */

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  // Format in UTC so a date-only value (e.g. "2026-06-10", parsed as UTC
  // midnight) doesn't shift a day in negative-offset timezones.
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function routeHref(entry) {
  // Prefer the SPA section id (hash route); fall back to slug under the
  // collection if an older index.json predates the `id` field.
  if (entry.id) return `#${entry.id}`;
  if (entry.path && entry.path.startsWith('/#/')) return entry.path.slice(1);
  return `#${entry.slug || ''}`;
}

function renderCard(entry) {
  const href = routeHref(entry);
  const date = formatDate(entry.date);
  const readingLabel = entry.reading_label || (entry.reading_time ? `${entry.reading_time} min read` : '');
  const meta = [
    date ? `<time datetime="${esc(entry.date)}">${esc(date)}</time>` : '',
    entry.author ? `<span class="blog-card-author">${esc(entry.author)}</span>` : '',
    readingLabel ? `<span class="blog-card-readtime">${esc(readingLabel)}</span>` : ''
  ].filter(Boolean).join('<span class="blog-card-dot" aria-hidden="true">·</span>');

  const tags = Array.isArray(entry.tags) && entry.tags.length
    ? `<ul class="blog-card-tags">${entry.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';

  const hero = entry.hero
    ? `<a class="blog-card-hero" href="${esc(href)}" tabindex="-1" aria-hidden="true">` +
      `<img src="${esc(entry.hero)}" alt="" loading="lazy" /></a>`
    : '';

  return (
    `<article class="blog-card" data-reveal="up">` +
      hero +
      `<div class="blog-card-body">` +
        (meta ? `<p class="blog-card-meta">${meta}</p>` : '') +
        `<h2 class="blog-card-title"><a href="${esc(href)}">${esc(entry.title || entry.slug)}</a></h2>` +
        (entry.summary ? `<p class="blog-card-summary">${esc(entry.summary)}</p>` : '') +
        tags +
      `</div>` +
    `</article>`
  );
}

/**
 * @param {{collection: string, title?: string}} options
 *   collection — output dir of the collection (e.g. "posts"); its index.json
 *                lives at `<base>/<collection>/index.json`.
 */
export async function loadBlogIndex(options = {}) {
  const collection = String(options.collection || '').replace(/^\/+|\/+$/g, '');
  const title = options.title || 'Blog';

  let entries = [];
  let failed = false;
  try {
    const url = new URL(`${collection}/index.json`, document.baseURI);
    const res = await fetch(url.href, { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      entries = Array.isArray(data) ? data
        : (Array.isArray(data.posts) ? data.posts
          : (Array.isArray(data.entries) ? data.entries : []));
    } else {
      failed = true;
    }
  } catch {
    failed = true;
  }

  const cards = entries.length
    ? `<div class="blog-list">${entries.map(renderCard).join('')}</div>`
    : `<p class="blog-empty">${failed
        ? 'Posts are unavailable right now.'
        : 'No posts yet.'}</p>`;

  const html =
    `<section class="section blog-index" aria-label="${esc(title)}">` +
      `<header class="blog-index-head">` +
        `<h1>${esc(title)}</h1>` +
      `</header>` +
      cards +
    `</section>`;

  return { html };
}
