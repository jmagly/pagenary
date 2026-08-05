/**
 * Mermaid.js lazy-loading and rendering module
 * Only loads mermaid when diagrams are detected on the page
 */

import { enhancePanZoomViewport } from './lib/pan-zoom.js';

let mermaidPromise = null;

/**
 * Lazily load the exact Mermaid runtime vendored by the publisher build.
 * @returns {Promise<object>} The mermaid module
 */
async function loadMermaid() {
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = new Promise((resolve, reject) => {
    if (globalThis.mermaid) {
      resolve(globalThis.mermaid);
      return;
    }
    const script = document.createElement('script');
    script.src = new URL('./vendor/mermaid/mermaid.min.js', import.meta.url).href;
    script.async = true;
    script.addEventListener('load', () => {
      if (!globalThis.mermaid) {
        reject(new Error('Local Mermaid runtime loaded without exposing its API'));
        return;
      }
      resolve(globalThis.mermaid);
    }, { once: true });
    script.addEventListener('error', () => reject(new Error('Unable to load local Mermaid runtime')), { once: true });
    document.head.appendChild(script);
  }).then((mermaid) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      suppressErrorRendering: true,
      maxTextSize: 50000,
      maxEdges: 500,
      deterministicIds: true,
      deterministicIDSeed: 'pagenary',
      flowchart: {
        htmlLabels: false,
        curve: 'basis',
        nodeSpacing: 30,
        rankSpacing: 50,
        padding: 15,
        useMaxWidth: true
      },
      themeVariables: {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px'
      }
    });
    return mermaid;
  });

  return mermaidPromise;
}

/**
 * Generate a unique ID for mermaid diagrams
 * @returns {string} A unique identifier
 */
function generateId(definition, index) {
  let hash = 2166136261;
  const value = `${index}\u0000${definition}`;
  for (let cursor = 0; cursor < value.length; cursor += 1) {
    hash ^= value.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  return `mermaid-${(hash >>> 0).toString(36)}`;
}

/**
 * Render all mermaid code blocks within a container
 * @param {HTMLElement} container - The container to search for mermaid blocks
 */
export async function renderMermaidBlocks(container) {
  const codeBlocks = container.querySelectorAll('code.language-mermaid');
  if (codeBlocks.length === 0) return () => {};

  const mermaid = await loadMermaid();
  const cleanup = [];

  for (const [index, codeBlock] of [...codeBlocks].entries()) {
    const pre = codeBlock.parentElement;
    const definition = codeBlock.textContent;
    const title = codeBlock.dataset.title || 'Mermaid diagram';
    const id = generateId(definition, index);

    try {
      const { svg } = await mermaid.render(id, definition);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';
      wrapper.setAttribute('role', 'figure');
      wrapper.setAttribute('aria-label', title);

      // Create scrollable content area
      const content = document.createElement('div');
      content.className = 'mermaid-content';
      content.innerHTML = svg;

      wrapper.appendChild(content);
      const svgEl = content.querySelector('svg');
      if (svgEl) cleanup.push(enhancePanZoomViewport({ container: wrapper, viewport: content, target: svgEl, label: 'Diagram' }));

      pre.replaceWith(wrapper);
    } catch (err) {
      console.error('Mermaid render error:', err);
      // Add error class but keep original code visible for debugging
      pre.classList.add('mermaid-error');
      // Add error message before the code block
      const errorMsg = document.createElement('div');
      errorMsg.className = 'mermaid-error-message';
      errorMsg.textContent = 'Diagram failed to render: ' + err.message;
      pre.insertAdjacentElement('beforebegin', errorMsg);
    }
  }
  return () => cleanup.forEach((fn) => fn());
}
