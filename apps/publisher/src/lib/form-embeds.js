/**
 * Form-embed runtime (#91) — progressive enhancement for the static placeholders
 * emitted by the build (see form-providers.js).
 *
 * The build renders only a real link to the hosted form (JS-off complete). Here,
 * with JS, each `.form-embed` is upgraded:
 *   - inline → a provider iframe (carries an accessible `title`)
 *   - popup  → a real `<button>` (aria-label) that the provider script opens as a
 *              focus-trapping, Esc-closable modal
 * The provider script loads lazily and ONLY when a page actually uses that
 * provider (or a site-wide form is configured) — never unconditionally.
 *
 * Per-page embeds are wired by the `formEmbeds` page-effect (re-runs per section
 * render). The site-wide affordance (body-level, persistent) is wired once via
 * `initSiteForm()` from app.js boot.
 */

import { getFormProvider } from './form-providers.js';
import { registerEffect } from './page-effects.js';

const loadedProviders = new Set();

/** Load a provider's embed script once (idempotent across pages + navigations). */
function loadProviderScript(provider) {
  if (!provider || !provider.scriptSrc || loadedProviders.has(provider.id)) return;
  if (document.querySelector(`script[data-form-provider="${provider.id}"]`)) {
    loadedProviders.add(provider.id);
    return;
  }
  const s = document.createElement('script');
  s.src = provider.scriptSrc;
  s.async = true;
  s.setAttribute('data-form-provider', provider.id);
  document.head.appendChild(s);
  loadedProviders.add(provider.id);
}

/**
 * Enhance a single `.form-embed` container in place. Idempotent: a container that
 * is already enhanced is left untouched.
 * @param {Element} container
 * @returns {(() => void)|null} cleanup that reverts the enhancement, or null
 */
export function enhanceFormEmbed(container) {
  if (!container || container.dataset.formEnhanced === '1') return null;
  const provider = getFormProvider(container.dataset.formProvider);
  const id = container.dataset.formId;
  if (!provider || !id) return null;

  const mode = container.dataset.formMode === 'popup' ? 'popup' : 'inline';
  const title = container.dataset.formTitle || `${provider.label} form`;
  const button = container.dataset.formButton || 'Open form';

  container.dataset.formEnhanced = '1';
  const created = [];

  if (mode === 'inline') {
    const iframe = document.createElement('iframe');
    iframe.setAttribute(provider.embedAttr, provider.embedUrl(id));
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('title', title);
    iframe.className = 'form-embed__frame';
    iframe.width = '100%';
    container.appendChild(iframe);
    created.push(iframe);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'form-embed__button';
    btn.setAttribute(provider.openAttr, id);
    if (provider.openLayoutAttr) btn.setAttribute(provider.openLayoutAttr, 'modal');
    btn.setAttribute('aria-label', button);
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.textContent = button;
    container.appendChild(btn);
    created.push(btn);
  }

  container.classList.add('is-enhanced');
  loadProviderScript(provider);

  return () => {
    created.forEach((node) => node.remove());
    container.classList.remove('is-enhanced');
    delete container.dataset.formEnhanced;
  };
}

/**
 * Page-effect: enhance per-page form embeds within the freshly-rendered section.
 * Excludes the site-wide affordance (wired once by initSiteForm). Registered with
 * the page-effects runtime, so it re-runs on every navigation and tears down with
 * the section.
 * @param {Element} root
 * @returns {(() => void)|undefined}
 */
export function formEmbeds(root) {
  const scope = root && root.querySelector ? root : document;
  const els = Array.from(scope.querySelectorAll('.form-embed:not(.form-embed--site)'));
  const undo = els.map((el) => enhanceFormEmbed(el)).filter(Boolean);
  if (undo.length) return () => undo.forEach((fn) => fn());
}

/**
 * Wire the site-wide form affordance once (the build injects a persistent
 * `.form-embed--site` into the body when `siteForm` is configured). Idempotent.
 */
export function initSiteForm() {
  const el = document.querySelector('.form-embed--site');
  if (el) enhanceFormEmbed(el);
}

// Self-register the per-page effect (mirrors page-effects.js built-ins).
registerEffect(formEmbeds);
