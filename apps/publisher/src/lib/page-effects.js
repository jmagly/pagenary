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
