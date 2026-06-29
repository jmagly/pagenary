/**
 * Form-embed provider seam (#91).
 *
 * An opt-in framework for embedding third-party hosted forms (feedback, contact,
 * waitlist, "was this helpful?") in published sites — without authors hand-pasting
 * provider embed markup. A generic **provider registry** describes each host; the
 * build renders a static, progressively-enhanced placeholder, and the runtime
 * (form-embeds.js) lazy-loads the provider script and wires the inline iframe or
 * popup modal. Adding a provider is a single registry entry — the authoring
 * surface (a fenced block whose id is the provider) and the runtime are generic.
 *
 * Tally is provider #1. Pagenary is static (no server); the form posts to the
 * provider. Form ids are public — never secrets.
 *
 * Pure module: no DOM, no Node. Imported by both the build (static markup) and
 * the runtime (script src, embed/open attributes), so it stays dependency-free.
 *
 * Provider descriptor shape:
 *   {
 *     id,                       // fence id + data-form-provider value
 *     label,                    // human name (docs / fallback)
 *     scriptSrc,                // provider embed script; loaded ONLY when used
 *     cspHosts: string[],       // hosts a tenant must allow in script-src/frame-src
 *     hostedUrl(id),            // canonical hosted form URL (JS-off fallback link)
 *     embedUrl(id),             // inline iframe src
 *     embedAttr,                // attr the script scans for inline iframes
 *     openAttr,                 // attr the script wires for popup triggers
 *     openLayoutAttr?           // optional: attr selecting the popup layout
 *   }
 */

/** Escape a value for use in an HTML attribute (double-quoted). */
function escAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a value for use in HTML text content. */
function escHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** The provider registry: fence id → descriptor. */
export const FORM_PROVIDERS = {
  tally: {
    id: 'tally',
    label: 'Tally',
    scriptSrc: 'https://tally.so/widgets/embed.js',
    cspHosts: ['tally.so'],
    hostedUrl: (id) => `https://tally.so/r/${encodeURIComponent(id)}`,
    embedUrl: (id) =>
      `https://tally.so/embed/${encodeURIComponent(id)}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`,
    embedAttr: 'data-tally-src',
    openAttr: 'data-tally-open',
    openLayoutAttr: 'data-tally-layout'
  }
};

/**
 * Look up a registered form provider by id (fence name).
 * @param {string} id
 * @returns {object|null}
 */
export function getFormProvider(id) {
  if (typeof id !== 'string') return null;
  return FORM_PROVIDERS[id] || null;
}

/** True if `id` names a registered form provider (used by the fence parser). */
export function isFormProvider(id) {
  return getFormProvider(id) !== null;
}

/** The de-duplicated set of CSP hosts across all (or named) providers. */
export function formCspHosts(providerIds) {
  const ids = Array.isArray(providerIds) && providerIds.length
    ? providerIds
    : Object.keys(FORM_PROVIDERS);
  const hosts = new Set();
  for (const id of ids) {
    const p = getFormProvider(id);
    if (p) for (const h of p.cspHosts || []) hosts.add(h);
  }
  return Array.from(hosts);
}

/**
 * Parse a form fenced-block body into a config object. The body is a small set
 * of `key: value` lines (optionally quoted), e.g.
 *   id: w4XyZ9
 *   mode: inline
 *   button: "Send feedback"
 * @param {string} text
 * @returns {object}
 */
export function parseFormFenceConfig(text) {
  const cfg = {};
  for (const line of String(text == null ? '' : text).split('\n')) {
    const m = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    cfg[m[1]] = v;
  }
  return cfg;
}

/**
 * Normalize a parsed/explicit form config against a provider.
 * @returns {{ ok: boolean, error?: string, value?: object }}
 */
export function normalizeFormConfig(providerId, config = {}) {
  const provider = getFormProvider(providerId);
  if (!provider) return { ok: false, error: `unknown form provider "${providerId}"` };
  const id = typeof config.id === 'string' ? config.id.trim() : '';
  if (!id) return { ok: false, error: `form "${providerId}" missing required "id"` };
  const mode = config.mode === 'popup' ? 'popup' : 'inline';
  const title = (typeof config.title === 'string' && config.title.trim()) || `${provider.label} form`;
  const button = (typeof config.button === 'string' && config.button.trim()) || 'Open form';
  return { ok: true, value: { provider: providerId, id, mode, title, button } };
}

/**
 * Render the static, progressively-enhanced form-embed placeholder. The static
 * markup is ONLY a real link to the hosted form, so a JS-off page (or one whose
 * provider script hasn't resolved) is complete and the form reachable. The
 * runtime swaps in the iframe (inline) or popup button (popup) and hides the
 * link. Returns '' (or an HTML comment) when the config is unusable, so a bad
 * block never emits broken embed markup.
 *
 * @param {string} providerId
 * @param {object} config - { id, mode?, title?, button? }
 * @param {object} [opts] - { site?: boolean } site-wide affordance variant
 * @returns {string} HTML
 */
export function renderFormEmbed(providerId, config = {}, opts = {}) {
  const norm = normalizeFormConfig(providerId, config);
  if (!norm.ok) return `<!-- form-embed: ${escHtml(norm.error)} -->`;
  const { provider, id, mode, title, button } = norm.value;
  const p = getFormProvider(providerId);
  const hosted = p.hostedUrl(id);
  const siteClass = opts.site ? ' form-embed--site' : '';
  // The fallback label is the popup button text, or for inline a generic "open".
  const fallbackLabel = mode === 'popup' ? button : `Open ${title}`;
  return [
    `<div class="form-embed${siteClass}" data-form-provider="${escAttr(provider)}" ` +
      `data-form-id="${escAttr(id)}" data-form-mode="${escAttr(mode)}" ` +
      `data-form-title="${escAttr(title)}" data-form-button="${escAttr(button)}">`,
    `  <a class="form-embed__fallback" href="${escAttr(hosted)}" target="_blank" rel="noopener noreferrer">${escHtml(fallbackLabel)}</a>`,
    `</div>`
  ].join('\n');
}
