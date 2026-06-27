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
 * scroll container; presentational only (`aria-hidden`). The hook may be added
 * by route metadata after startup, so the primitive stays mounted but hidden
 * until enabled.
 */
function readingProgress() {
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
    const enabled = document.body.hasAttribute('data-reading-progress');
    bar.hidden = !enabled;
    if (!enabled) {
      fill.style.width = '0';
      return;
    }
    const max = scroller.scrollHeight - scroller.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (scroller.scrollTop / max) * 100)) : 0;
    fill.style.width = `${pct}%`;
  };
  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(update)
    : null;
  if (observer) observer.observe(document.body, { attributes: true, attributeFilter: ['data-reading-progress'] });
  update();
  scroller.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  return () => {
    if (observer) observer.disconnect();
    scroller.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

/** The scroll container the SPA scrolls within (the canvas), with fallbacks. */
function scrollContainer() {
  return document.querySelector('.canvas')
    || document.scrollingElement || document.documentElement;
}

/**
 * Hero parallax (#54): translate `.pe-hero-bg` inside `[data-pe-parallax]` as
 * the scroll container moves, for a subtle depth effect. Gated on reduced-motion
 * and rAF; the translate is clamped to the layer's over-scan so an edge is never
 * revealed. With motion disabled (or the layer absent) the background is static.
 */
/**
 * Parallax (#54 hero, generalized in #75): `[data-pe-parallax]` drifts an element
 * against the scroll. Two shapes share one clamped implementation:
 *   - Hero: the element has a `.pe-hero-bg` child → that background layer moves
 *     (default speed 0.16, travel clamped to the hero's over-scan).
 *   - Any element: no `.pe-hero-bg` → the element itself moves, at a per-element
 *     speed from `data-pe-parallax="0.3"` (clamped to a safe 0–0.5 range so it
 *     never drifts far enough to disorient).
 * Motion only — fully skipped under `prefers-reduced-motion`, so the static layout
 * is the accessible final state.
 */
function parallax(root, ctx) {
  if (ctx.reducedMotion || typeof requestAnimationFrame !== 'function') return;
  const els = root.querySelectorAll('[data-pe-parallax]');
  if (!els.length) return;
  const scroller = scrollContainer();
  const SPEED_MAX = 0.5; // clamp per-element speed so drift stays gentle
  const layers = [];
  els.forEach((el) => {
    const bg = el.querySelector('.pe-hero-bg');
    const target = bg || el;             // hero moves its bg layer; anything else moves itself
    const raw = parseFloat(el.getAttribute('data-pe-parallax'));
    const speed = Number.isFinite(raw) ? Math.max(0, Math.min(SPEED_MAX, raw)) : 0.16;
    const maxFrac = bg ? 0.12 : 0.18;    // travel clamp as a fraction of element height
    layers.push({ el, target, speed, maxFrac });
  });
  if (!layers.length) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const sTop = scroller.scrollTop || 0;
    for (const { el, target, speed, maxFrac } of layers) {
      const offset = el.offsetTop - sTop; // element position within the scroller
      const max = el.clientHeight * maxFrac;
      const shift = Math.max(-max, Math.min(max, -offset * speed));
      target.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
    }
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  update();
  scroller.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  return () => {
    scroller.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}

/**
 * Sticky hero (#54): toggle `.is-stuck` on `.pe-hero--sticky` when it pins to
 * the top of the scroll container, so authors can restyle the pinned state. The
 * sticking itself is pure CSS (`position: sticky`); this only adds a class, so
 * it is motion-free and runs regardless of reduced-motion.
 */
function heroSticky(root) {
  const heroes = root.querySelectorAll('.pe-hero--sticky');
  if (!heroes.length || typeof requestAnimationFrame !== 'function') return;
  const scroller = scrollContainer();
  let ticking = false;
  const update = () => {
    ticking = false;
    // A sticky hero pins at the scroller's content-box top (its `top: 0` inset is
    // relative to the padding box), so account for the container's top padding.
    // Computed fresh each tick — capturing it once can read a pre-layout value.
    const cs = typeof getComputedStyle === 'function' ? getComputedStyle(scroller) : null;
    const padTop = cs ? (parseFloat(cs.paddingTop) || 0) : 0;
    const top = (scroller.getBoundingClientRect ? scroller.getBoundingClientRect().top : 0) + padTop;
    heroes.forEach((hero) => {
      const stuck = hero.getBoundingClientRect().top <= top + 1;
      hero.classList.toggle('is-stuck', stuck);
    });
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  update();
  scroller.addEventListener('scroll', onScroll, { passive: true });
  return () => scroller.removeEventListener('scroll', onScroll);
}

/**
 * Living scroll: with `data-living-scroll` set on the body, reveal a page's
 * content blocks as they enter the viewport — "content arriving as you read".
 * Layout-agnostic: works on any markdown page (docs or blog), not just posts.
 * `data-blog-living-scroll` is accepted as a back-compat alias for the original
 * blog-only flag. The hidden base state is CSS, scoped under the body flag +
 * `html.has-js` + no-preference, so JS-off and reduced-motion readers see the
 * full content immediately. Blocks already in view on load reveal at once (a
 * gentle entrance); the rest arrive on scroll. Scoped to `.doc.markdown` so card
 * indexes (which carry their own reveal) are untouched.
 */
function livingScroll(root, ctx) {
  if (!document.body.hasAttribute('data-living-scroll') &&
      !document.body.hasAttribute('data-blog-living-scroll')) return;
  const content = root.querySelector('.doc.markdown .doc-content');
  if (!content) return;
  const blocks = Array.from(content.children);
  if (!blocks.length) return;
  if (ctx.reducedMotion || typeof IntersectionObserver !== 'function') {
    blocks.forEach((el) => el.classList.add('is-living-revealed'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-living-revealed');
        io.unobserve(entry.target);
      }
    }
    // A negative bottom rootMargin is omitted on purpose: it would leave the
    // final block stranded in the excluded band at max scroll. Revealing on
    // entry (threshold 0) guarantees every block — including the last — reveals.
  }, { threshold: 0, rootMargin: '0px' });
  blocks.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/**
 * Accordion (#72): `.pe-accordion` styles native `<details>/<summary>`, so a
 * disclosure works keyboard-operable with zero JS. Adding `data-pe-single` to the
 * wrapper makes it single-open — opening one panel closes its siblings. That
 * grouping is a pure enhancement; with JS off every panel still opens and closes
 * independently (the content is never hidden behind the script). No motion, so
 * nothing to gate on reduced-motion.
 */
function accordion(root) {
  const groups = root.querySelectorAll('.pe-accordion[data-pe-single]');
  if (!groups.length) return;
  const bound = [];
  groups.forEach((group) => {
    const panels = Array.from(group.querySelectorAll(':scope > details'));
    panels.forEach((panel) => {
      const onToggle = () => {
        if (!panel.open) return;
        for (const other of panels) if (other !== panel) other.open = false;
      };
      panel.addEventListener('toggle', onToggle);
      bound.push([panel, onToggle]);
    });
  });
  return () => bound.forEach(([el, fn]) => el.removeEventListener('toggle', fn));
}

/**
 * Staggered reveal (#74): a `[data-reveal-stagger]` container sequences its
 * children's entrance — each child gets an incremental transition delay so they
 * arrive in a wave when the container scrolls into view. `data-reveal-stagger="80"`
 * sets the per-child step in ms (default 90). The hidden base state lives in CSS
 * scoped to `[data-reveal-stagger] > *` under `html.has-js` + no-preference, so
 * JS-off and reduced-motion readers see every child immediately. JS only assigns
 * the delay and flips `.is-revealed`.
 */
function staggeredReveal(root, ctx) {
  const groups = root.querySelectorAll('[data-reveal-stagger]');
  if (!groups.length) return;
  const stepOf = (g) => {
    const n = parseInt(g.getAttribute('data-reveal-stagger'), 10);
    return Number.isFinite(n) && n > 0 ? n : 90;
  };
  groups.forEach((g) => {
    const step = stepOf(g);
    Array.from(g.children).forEach((kid, i) => {
      kid.style.setProperty('--reveal-delay', `${i * step}ms`);
    });
  });
  if (ctx.reducedMotion || typeof IntersectionObserver !== 'function') {
    groups.forEach((g) => Array.from(g.children).forEach((k) => k.classList.add('is-revealed')));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        Array.from(entry.target.children).forEach((k) => k.classList.add('is-revealed'));
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  groups.forEach((g) => io.observe(g));
  return () => io.disconnect();
}

registerEffect(revealOnScroll);
registerEffect(staggeredReveal);
registerEffect(readingProgress);
registerEffect(parallax);
registerEffect(heroSticky);
registerEffect(livingScroll);
registerEffect(accordion);
