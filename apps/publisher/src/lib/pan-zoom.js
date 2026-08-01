const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const PAN_STEP = 48;

export function clampViewportScale(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function midpoint(points) {
  return {
    x: (points[0].clientX + points[1].clientX) / 2,
    y: (points[0].clientY + points[1].clientY) / 2
  };
}

function distance(points) {
  return Math.hypot(
    points[0].clientX - points[1].clientX,
    points[0].clientY - points[1].clientY
  );
}

function controlButton(className, label, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pan-zoom-btn ${className}`;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  return button;
}

/**
 * Progressively enhance an existing content region with shared pan/zoom controls.
 * The target remains ordinary readable markup when JavaScript is unavailable.
 */
export function enhancePanZoomViewport({ container, viewport, target, label = 'Interactive content' }) {
  if (!container || !viewport || !target || container.dataset.panZoomEnhanced === 'true') return () => {};

  container.dataset.panZoomEnhanced = 'true';
  container.classList.add('pan-zoom');
  viewport.classList.add('pan-zoom-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', `${label}. Use arrow keys to pan.`);

  const controls = document.createElement('div');
  controls.className = 'pan-zoom-controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', `${label} zoom controls`);
  const zoomOut = controlButton('pan-zoom-out', 'Zoom out', '\u2212');
  const reset = controlButton('pan-zoom-reset', 'Reset view', '\u2299');
  const zoomIn = controlButton('pan-zoom-in', 'Zoom in', '+');
  const status = document.createElement('output');
  status.className = 'pan-zoom-status';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  controls.append(zoomOut, reset, zoomIn, status);
  container.insertBefore(controls, viewport);

  const abort = new AbortController();
  const { signal } = abort;
  const pointers = new Map();
  let scale = 1;
  let drag = null;
  let pinch = null;

  const render = (announce = false) => {
    target.style.setProperty('--pan-zoom-scale', String(scale));
    target.style.transform = `scale(${scale})`;
    target.style.transformOrigin = 'top left';
    zoomOut.disabled = scale <= MIN_SCALE;
    zoomIn.disabled = scale >= MAX_SCALE;
    viewport.classList.toggle('is-zoomed', scale !== 1);
    const text = `${Math.round(scale * 100)}%`;
    status.value = text;
    status.textContent = text;
    status.setAttribute('aria-live', announce ? 'polite' : 'off');
  };

  const setScale = (next, point = null, announce = true) => {
    const bounded = clampViewportScale(next);
    if (bounded === scale) return;
    const rect = viewport.getBoundingClientRect();
    const localX = point ? point.x - rect.left : viewport.clientWidth / 2;
    const localY = point ? point.y - rect.top : viewport.clientHeight / 2;
    const contentX = (viewport.scrollLeft + localX) / scale;
    const contentY = (viewport.scrollTop + localY) / scale;
    scale = bounded;
    render(announce);
    viewport.scrollLeft = Math.max(0, contentX * scale - localX);
    viewport.scrollTop = Math.max(0, contentY * scale - localY);
  };

  const resetView = () => {
    scale = 1;
    render(true);
    viewport.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  };

  zoomIn.addEventListener('click', () => setScale(scale + SCALE_STEP), { signal });
  zoomOut.addEventListener('click', () => setScale(scale - SCALE_STEP), { signal });
  reset.addEventListener('click', resetView, { signal });

  viewport.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const amount = event.shiftKey ? PAN_STEP * 2 : PAN_STEP;
    const delta = {
      ArrowLeft: [-amount, 0], ArrowRight: [amount, 0],
      ArrowUp: [0, -amount], ArrowDown: [0, amount]
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    viewport.scrollBy({ left: delta[0], top: delta[1], behavior: 'auto' });
  }, { signal });

  viewport.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, event);
    viewport.setPointerCapture?.(event.pointerId);
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      if (event.pointerType !== 'touch' || scale !== 1) viewport.classList.add('is-panning');
    } else if (pointers.size === 2) {
      const pair = [...pointers.values()];
      pinch = { distance: distance(pair), scale, point: midpoint(pair) };
      drag = null;
      viewport.classList.add('is-panning');
    }
  }, { signal });

  viewport.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      event.preventDefault();
      const pair = [...pointers.values()];
      const currentDistance = distance(pair);
      if (pinch?.distance) setScale(pinch.scale * (currentDistance / pinch.distance), midpoint(pair), false);
    } else if (drag) {
      if (event.pointerType === 'touch' && scale === 1) return;
      event.preventDefault();
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    }
  }, { signal });

  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      drag = null;
      viewport.classList.remove('is-panning');
    }
  };
  viewport.addEventListener('pointerup', endPointer, { signal });
  viewport.addEventListener('pointercancel', endPointer, { signal });
  viewport.addEventListener('lostpointercapture', endPointer, { signal });

  render();
  return () => {
    abort.abort();
    controls.remove();
    viewport.classList.remove('pan-zoom-viewport', 'is-panning', 'is-zoomed');
    viewport.removeAttribute('role');
    viewport.removeAttribute('aria-label');
    viewport.removeAttribute('tabindex');
    target.style.removeProperty('--pan-zoom-scale');
    target.style.removeProperty('transform');
    target.style.removeProperty('transform-origin');
    container.classList.remove('pan-zoom');
    delete container.dataset.panZoomEnhanced;
  };
}

export function initImageViewports(root = document) {
  const cleanup = [];
  root.querySelectorAll('[data-image-viewport]').forEach((figure) => {
    const image = figure.querySelector('img');
    if (!image || image.alt === '' || image.closest('a, button')) return;
    let viewport = figure.querySelector('.image-viewport-content');
    if (!viewport) {
      const media = image.closest('picture') || image;
      viewport = document.createElement('div');
      viewport.className = 'image-viewport-content';
      media.replaceWith(viewport);
      viewport.appendChild(media);
    }
    const explicitLabel = figure.getAttribute('data-image-viewport-label');
    const caption = figure.querySelector('figcaption')?.textContent?.trim();
    cleanup.push(enhancePanZoomViewport({
      container: figure,
      viewport,
      target: image.closest('picture') || image,
      label: explicitLabel || caption || 'Image viewer'
    }));
  });
  return () => cleanup.forEach((fn) => fn());
}
