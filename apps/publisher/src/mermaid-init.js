/**
 * Mermaid.js lazy-loading and rendering module
 * Only loads mermaid when diagrams are detected on the page
 */

import { enhancePanZoomViewport } from './lib/pan-zoom.js';

let mermaidPromise = null;

/**
 * Lazily load mermaid.js from CDN
 * @returns {Promise<object>} The mermaid module
 */
async function loadMermaid() {
  if (mermaidPromise) return mermaidPromise;

  mermaidPromise = (async () => {
    const { default: mermaid } = await import('https://esm.sh/mermaid@10/dist/mermaid.esm.min.mjs');
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      flowchart: {
        htmlLabels: true,
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
  })();

  return mermaidPromise;
}

/**
 * Generate a unique ID for mermaid diagrams
 * @returns {string} A unique identifier
 */
function generateId() {
  return 'mermaid-' + Math.random().toString(36).slice(2, 10);
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

  for (const codeBlock of codeBlocks) {
    const pre = codeBlock.parentElement;
    const definition = codeBlock.textContent;
    const id = generateId();

    try {
      const { svg } = await mermaid.render(id, definition);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';

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
