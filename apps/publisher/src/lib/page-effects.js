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
 * Smoothly scroll a container to a target offset. Native `scrollTo({behavior:
 * 'smooth'})` is unreliable on the nested `.canvas` scroller (it's silently
 * dropped in some engines), so animate `scrollTop` directly via rAF. Under
 * reduced motion (or without rAF) it jumps instantly.
 */
function smoothScrollTo(scroller, target, instant) {
  target = Math.max(0, target);
  // Cancel any animation already in flight on this scroller, or stacked rAF loops
  // fight each other and the longest-running target wins.
  if (scroller._peScrollRaf) { cancelAnimationFrame(scroller._peScrollRaf); scroller._peScrollRaf = 0; }
  if (instant || typeof requestAnimationFrame !== 'function') {
    scroller.scrollTop = target;
    return;
  }
  const start = scroller.scrollTop;
  const dist = target - start;
  if (Math.abs(dist) < 2) { scroller.scrollTop = target; return; }
  const duration = Math.min(600, Math.max(220, Math.abs(dist) * 0.5));
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  let startTs = null;
  const step = (ts) => {
    if (startTs === null) startTs = ts;
    const p = Math.min(1, (ts - startTs) / duration);
    scroller.scrollTop = start + dist * easeOutCubic(p);
    scroller._peScrollRaf = p < 1 ? requestAnimationFrame(step) : 0;
  };
  scroller._peScrollRaf = requestAnimationFrame(step);
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

/**
 * Figure zoom (#76): `[data-pe-zoom]` (usually a `<figure>`) lets a reader enlarge
 * its image in a modal. The base figure is plain markup, so with JS off the image
 * is fully visible at normal size — zoom is a pure enhancement. The effect wraps
 * the image in a real `<button>` (keyboard-activatable) and opens a native
 * `<dialog>` via `showModal()`, so the browser supplies the focus trap, Esc-to-
 * close, and inert backdrop; native dialogs restore focus to the trigger on close.
 * No autoplaying motion — the open is instant, nothing to gate on reduced-motion.
 */
function openZoom(img) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pe-zoom-dialog';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pe-zoom-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  const big = document.createElement('img');
  big.src = img.currentSrc || img.src;
  big.alt = img.alt || '';
  dialog.append(close, big);
  document.body.appendChild(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // backdrop
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
  close.focus();
}

function figureZoom(root) {
  if (typeof HTMLDialogElement !== 'function') return; // no native dialog → leave the plain figure
  const figs = root.querySelectorAll('[data-pe-zoom]');
  if (!figs.length) return;
  const undo = [];
  figs.forEach((fig) => {
    const img = fig.matches('img') ? fig : fig.querySelector('img');
    if (!img || img.closest('.pe-zoom-trigger')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pe-zoom-trigger';
    btn.setAttribute('aria-label', `Enlarge image${img.alt ? `: ${img.alt}` : ''}`);
    img.replaceWith(btn);
    btn.appendChild(img);
    const onClick = () => openZoom(img);
    btn.addEventListener('click', onClick);
    undo.push(() => { btn.removeEventListener('click', onClick); btn.replaceWith(img); });
  });
  return () => undo.forEach((fn) => fn());
}

/**
 * On-this-page TOC + scroll-spy (#73): when the tenant opts in via `pageToc`
 * (build sets `data-page-toc="rail"|"top"` on the body), auto-generate an
 * "On this page" nav from the page's `h2`/`h3` headings and highlight the active
 * one as the reader scrolls. Headings get slugged ids; links scroll the heading
 * into the `.canvas` scroller and move focus to it (no hash change, so the SPA
 * router is untouched). Skipped on short pages (`data-page-toc-min`, default 3).
 * The TOC is a JS enhancement — with JS off the article content is complete and
 * unchanged; only the convenience nav is absent.
 */
function tocSlug(text, used) {
  let base = String(text || '').toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function pageToc(root, ctx) {
  const placement = document.body.dataset.pageToc;
  if (placement !== 'rail' && placement !== 'top') return;
  const content = root.querySelector('.doc.markdown .doc-content');
  if (!content) return;
  // Article headings only — exclude the async Fortemi metadata panel and headings
  // that live inside decorative/demo widgets (hero, banner, card grid, snap,
  // scrolly), which are widget content rather than the page's outline.
  const headings = Array.from(content.querySelectorAll('h2, h3'))
    .filter((h) => !h.closest('.doc-fortemi-panel, .pe-hero, .pe-banner, .pe-card-grid, .pe-snap, .pe-scrolly'));
  const minRaw = parseInt(document.body.dataset.pageTocMin, 10);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? minRaw : 3;
  if (headings.length < min) return;

  const used = new Set();
  content.querySelectorAll('[id]').forEach((el) => used.add(el.id));

  const scroller = scrollContainer();
  // Track our own programmatic scrolls so the scroll-spy doesn't resync the
  // prev/next cursor mid-animation (which would make rapid clicks drift).
  let programmaticScroll = false;
  let progTimer = 0;
  const scrollToHeading = (h) => {
    programmaticScroll = true;
    if (progTimer) clearTimeout(progTimer);
    progTimer = setTimeout(() => { programmaticScroll = false; }, ctx.reducedMotion ? 60 : 720);
    // Position relative to the scroller via rects — offsetTop is unreliable
    // because headings inside positioned containers have varied offsetParents.
    const top = scroller.scrollTop + (h.getBoundingClientRect().top - scroller.getBoundingClientRect().top) - 12;
    smoothScrollTo(scroller, top, ctx.reducedMotion);
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  };

  // Structure: <nav><details><summary>On this page</summary><div>
  //   <prev/next controls> <ol>links</ol></div></details></nav>
  // The <details> is open on wide viewports (a persistent rail) and collapsed on
  // narrow/portrait (an expandable menu), so it never crowds small screens.
  const nav = document.createElement('nav');
  nav.className = `page-toc page-toc--${placement}`;
  nav.setAttribute('aria-label', 'On this page');
  const disc = document.createElement('details');
  disc.className = 'page-toc__disc';
  const summary = document.createElement('summary');
  summary.className = 'page-toc__title';
  const summaryLabel = document.createElement('span');
  summaryLabel.className = 'page-toc__title-text';
  summaryLabel.textContent = 'On this page';
  summary.appendChild(summaryLabel);
  // Pin toggle (wide rail only). Pinned (default) keeps the panel open in the
  // gutter; unpinned collapses it to a right-edge handle that peeks on hover and
  // lets the content go full-width. Persisted per-reader.
  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.className = 'page-toc__pin';
  pinBtn.innerHTML = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">'
    + '<path fill="currentColor" d="M9.4 1 8 2.4l.5.6-2.9 2.9-2-.4-1.4 1.4 2.9 2.9L1 14.9 5 11l2.9 2.9 1.4-1.4-.4-2 2.9-2.9.6.5L13.9 6.6 9.4 1z"/></svg>';
  summary.appendChild(pinBtn);
  const tbody = document.createElement('div');
  tbody.className = 'page-toc__body';

  const controls = document.createElement('div');
  controls.className = 'page-toc__controls';
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'page-toc__btn';
  prevBtn.innerHTML = '<span aria-hidden="true">↑</span> Prev';
  prevBtn.setAttribute('aria-label', 'Previous section');
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'page-toc__btn';
  nextBtn.innerHTML = 'Next <span aria-hidden="true">↓</span>';
  nextBtn.setAttribute('aria-label', 'Next section');
  controls.append(prevBtn, nextBtn);

  const list = document.createElement('ol');
  const links = [];
  const linkFor = new Map();
  const indexOf = new Map();
  headings.forEach((h, i) => {
    if (!h.id) h.id = tocSlug(h.textContent, used);
    indexOf.set(h, i);
    const li = document.createElement('li');
    li.className = h.tagName === 'H3' ? 'page-toc__item page-toc__item--sub' : 'page-toc__item';
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent || '';
    const onClick = (e) => { e.preventDefault(); e.stopPropagation(); navCursor = i; updateButtons(); scrollToHeading(h); };
    a.addEventListener('click', onClick);
    li.appendChild(a);
    list.appendChild(li);
    links.push({ a, onClick });
    linkFor.set(h, a);
  });
  tbody.append(controls, list);
  disc.append(summary, tbody);
  nav.appendChild(disc);
  content.insertBefore(nav, content.firstChild);

  let current = null;
  // navCursor is the heading prev/next operate from. It follows the scroll-spy on
  // manual scroll, but prev/next mutate it directly so rapid clicks step exactly
  // one heading each — independent of how fast the smooth scroll / scroll-spy
  // catch up (which is why button-driven nav never drifts).
  let navCursor = -1;
  const updateButtons = () => {
    prevBtn.disabled = navCursor <= 0;
    nextBtn.disabled = navCursor < 0 || navCursor >= headings.length - 1;
  };
  const setActive = (h) => {
    if (h !== current) {
      current = h;
      for (const { a } of links) a.removeAttribute('aria-current');
      const a = linkFor.get(h);
      if (a) a.setAttribute('aria-current', 'true');
    }
    // Resync the cursor to the reading position only on a manual scroll.
    if (!programmaticScroll) { navCursor = headings.indexOf(h); updateButtons(); }
  };

  const onPrev = () => {
    if (navCursor < 0) navCursor = headings.indexOf(current);
    if (navCursor > 0) { navCursor -= 1; updateButtons(); scrollToHeading(headings[navCursor]); }
  };
  const onNext = () => {
    if (navCursor < 0) navCursor = headings.indexOf(current);
    if (navCursor < headings.length - 1) { navCursor += 1; updateButtons(); scrollToHeading(headings[navCursor]); }
  };
  prevBtn.addEventListener('click', onPrev);
  nextBtn.addEventListener('click', onNext);

  // Scroll-spy by position against the `.canvas` scroller (deterministic, and
  // consistent with the click-scroll math above — IntersectionObserver's viewport
  // band is unreliable here because the page scrolls inside `.canvas`, not the
  // document). The current heading is the last one whose top has scrolled within
  // ~96px of the scroller's top edge.
  let ticking = false;
  const update = () => {
    ticking = false;
    const sTop = scroller.getBoundingClientRect().top;
    let active = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top - sTop <= 96) active = h; else break;
    }
    setActive(active);
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  update();
  scroller.addEventListener('scroll', onScroll, { passive: true });

  // Open as a persistent rail on wide; collapse to an expandable menu on narrow.
  const mq = window.matchMedia('(min-width: 60rem)');
  const syncOpen = () => { disc.open = mq.matches; };
  syncOpen();
  if (mq.addEventListener) mq.addEventListener('change', syncOpen);

  // Pin/unpin the wide rail. Pinned (default) holds it open in the gutter;
  // unpinned collapses it to a right-edge handle that peeks on hover and lets the
  // content go full-width. State persists per reader.
  let tocPinned = true;
  try { tocPinned = window.localStorage.getItem('pagenary:toc-pinned') !== 'false'; } catch (_) { /* private mode */ }
  const applyPin = () => {
    nav.classList.toggle('is-unpinned', !tocPinned);
    pinBtn.setAttribute('aria-pressed', String(tocPinned));
    pinBtn.title = tocPinned ? 'Unpin — let the panel auto-hide' : 'Pin the panel open';
  };
  const onPin = (e) => {
    e.preventDefault();
    e.stopPropagation();
    tocPinned = !tocPinned;
    try { window.localStorage.setItem('pagenary:toc-pinned', String(tocPinned)); } catch (_) { /* private mode */ }
    applyPin();
  };
  pinBtn.addEventListener('click', onPin);
  applyPin();

  return () => {
    scroller.removeEventListener('scroll', onScroll);
    if (mq.removeEventListener) mq.removeEventListener('change', syncOpen);
    prevBtn.removeEventListener('click', onPrev);
    nextBtn.removeEventListener('click', onNext);
    pinBtn.removeEventListener('click', onPin);
    links.forEach(({ a, onClick }) => a.removeEventListener('click', onClick));
    nav.remove();
  };
}

/**
 * Scrollytelling (#78): a `.pe-scrolly` block pairs a sticky `.pe-scrolly__stage`
 * with a column of `[data-pe-step]` content steps. As each step scrolls into the
 * active zone, the stage's matching layer (`.pe-scrolly__stage [data-pe-step]`)
 * becomes active (crossfade). Built from sticky layout + the same rect-based
 * active-element detection as scroll-spy — no bespoke animation engine. JS-off:
 * the steps are ordinary readable content and the stage shows its layers
 * statically; the stage swap is a pure enhancement. The crossfade is gated under
 * no-preference in CSS, so reduced-motion swaps instantly.
 */
function scrollytelling(root, ctx) {
  const blocks = root.querySelectorAll('.pe-scrolly');
  if (!blocks.length) return;
  const scroller = scrollContainer();
  const cleanups = [];
  blocks.forEach((block) => {
    const steps = Array.from(block.querySelectorAll('.pe-scrolly__steps [data-pe-step]'));
    const layers = Array.from(block.querySelectorAll('.pe-scrolly__stage [data-pe-step]'));
    if (!steps.length || !layers.length) return;
    let current = null;
    const activate = (val) => {
      if (val === current) return;
      current = val;
      layers.forEach((l) => l.classList.toggle('is-active', l.dataset.peStep === val));
    };
    activate(steps[0].dataset.peStep);
    let ticking = false;
    const update = () => {
      ticking = false;
      const sTop = scroller.getBoundingClientRect().top;
      const line = scroller.clientHeight * 0.45; // a step is current once it passes mid-upper view
      let active = steps[0];
      for (const s of steps) {
        if (s.getBoundingClientRect().top - sTop <= line) active = s; else break;
      }
      activate(active.dataset.peStep);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => scroller.removeEventListener('scroll', onScroll));
  });
  return () => cleanups.forEach((fn) => fn());
}

registerEffect(revealOnScroll);
registerEffect(staggeredReveal);
registerEffect(figureZoom);
registerEffect(pageToc);
registerEffect(scrollytelling);
registerEffect(readingProgress);
registerEffect(parallax);
registerEffect(heroSticky);
registerEffect(livingScroll);
registerEffect(accordion);
