/**
 * Page-effects runtime core (#52) — the foundation for the page-effects toolkit
 * (#51): modern rich-hero / content-site patterns, layout-agnostic, opt-in, and
 * accessible.
 *
 * The SPA replaces the section DOM on every hash-route navigation, so effect
 * behaviors (reveal-on-scroll #53, hero parallax/sticky #54) must attach to the
 * freshly-rendered root and detach when the next section loads. This module owns
 * that lifecycle:
 *
 *   - `registerEffect(fn)` — effects opt in once at import time. `fn(root, ctx)`
 *     wires itself for the given render and returns an optional cleanup fn.
 *   - `initPageEffects(root)` — called by app.js after each section renders;
 *     tears down the previous render's effects, then runs every registered
 *     effect against the new root.
 *
 * Accessibility: `ctx.reducedMotion` reflects `prefers-reduced-motion` so effects
 * can skip motion and render the final state. Progressive enhancement relies on
 * `html.has-js` (set in index.html) — effect CSS that hides content pending JS is
 * scoped under it, so a JS-off page shows everything. A broken effect is isolated
 * and never breaks section rendering.
 */

const cleanups = [];
const effects = [];

export function prefersReducedMotion() {
  return Boolean(
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Register an effect initializer. Called once per effect module at import time.
 * @param {(root: Element, ctx: {reducedMotion: boolean}) => (void | (() => void))} fn
 */
export function registerEffect(fn) {
  if (typeof fn === 'function') effects.push(fn);
}

/** Tear down the previous render's effects (observers, listeners, etc.). */
export function teardownPageEffects() {
  while (cleanups.length) {
    const cleanup = cleanups.pop();
    try { cleanup(); } catch { /* a broken teardown must not block the next render */ }
  }
}

/**
 * (Re)initialize effects for a freshly-rendered section root. Safe to call on
 * every navigation; tears down prior effects first.
 * @param {Element} root
 */
export function initPageEffects(root) {
  teardownPageEffects();
  if (!root) return;
  const ctx = { reducedMotion: prefersReducedMotion() };
  for (const effect of effects) {
    try {
      const cleanup = effect(root, ctx);
      if (typeof cleanup === 'function') cleanups.push(cleanup);
    } catch { /* isolate a broken effect; never break section rendering */ }
  }
}

// ── Built-in effects (#53) ────────────────────────────────────────────────

/**
 * Reveal-on-scroll: add `.is-revealed` to `[data-reveal]` elements as they
 * enter the viewport. Under reduced-motion or without IntersectionObserver,
 * everything is revealed immediately (no motion). The base hidden state lives in
 * CSS scoped under `html.has-js` + a no-preference media query, so JS-off pages
 * are never hidden.
 */
function revealOnScroll(root, ctx) {
  const targets = root.querySelectorAll('[data-reveal]');
  if (!targets.length) return;
  if (ctx.reducedMotion || typeof IntersectionObserver !== 'function') {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  targets.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/**
 * Reading-progress bar (opt-in via `body[data-reading-progress]`). Tracks the
 * scroll container; presentational only (`aria-hidden`).
 */
function readingProgress() {
  if (!document.body.hasAttribute('data-reading-progress')) return;
  const scroller = document.querySelector('.canvas')
    || document.scrollingElement || document.documentElement;
  let bar = document.querySelector('.reading-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'reading-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="reading-progress-fill"></span>';
    document.body.appendChild(bar);
  }
  const fill = bar.querySelector('.reading-progress-fill');
  const update = () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (scroller.scrollTop / max) * 100)) : 0;
    fill.style.width = `${pct}%`;
  };
  update();
  scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  return () => {
    scroller.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

registerEffect(revealOnScroll);
registerEffect(readingProgress);
