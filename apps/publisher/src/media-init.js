/**
 * Progressive enhancement for hosted media embeds.
 *
 * Build output contains a real button and fallback transcript/source link. This
 * module only swaps an allowlisted placeholder into an iframe after activation,
 * so third-party providers do not load until the reader asks for them.
 */
export function initMediaEmbeds(container) {
  if (!container) return;
  const buttons = container.querySelectorAll('.media-embed-load[data-media-src]');
  buttons.forEach((button) => {
    if (button.dataset.mediaReady === 'true') return;
    button.dataset.mediaReady = 'true';
    button.addEventListener('click', () => {
      const src = button.dataset.mediaSrc || '';
      const title = button.dataset.mediaTitle || button.textContent.trim() || 'Embedded media';
      if (!src) return;
      const iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.title = title;
      iframe.loading = 'lazy';
      iframe.allowFullscreen = true;
      iframe.sandbox = button.dataset.mediaSandbox || 'allow-scripts allow-same-origin allow-presentation';
      iframe.referrerPolicy = button.dataset.mediaReferrer || 'strict-origin-when-cross-origin';
      button.replaceWith(iframe);
    });
  });
}
