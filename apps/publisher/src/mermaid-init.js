/**
 * Mermaid.js lazy-loading and rendering module
 * Only loads mermaid when diagrams are detected on the page
 */

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
  if (codeBlocks.length === 0) return;

  const mermaid = await loadMermaid();

  for (const codeBlock of codeBlocks) {
    const pre = codeBlock.parentElement;
    const definition = codeBlock.textContent;
    const id = generateId();

    try {
      const { svg } = await mermaid.render(id, definition);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';

      // Create controls
      const controls = document.createElement('div');
      controls.className = 'mermaid-controls';
      controls.innerHTML = `
        <button type="button" class="mermaid-btn mermaid-zoom-out" aria-label="Zoom out">−</button>
        <button type="button" class="mermaid-btn mermaid-zoom-reset" aria-label="Reset zoom">⊙</button>
        <button type="button" class="mermaid-btn mermaid-zoom-in" aria-label="Zoom in">+</button>
      `;

      // Create scrollable content area
      const content = document.createElement('div');
      content.className = 'mermaid-content';
      content.innerHTML = svg;

      wrapper.appendChild(controls);
      wrapper.appendChild(content);

      // Initialize zoom and pan state
      let scale = 1;
      const svgEl = content.querySelector('svg');
      let isDragging = false;
      let startX, startY, scrollLeft, scrollTop;

      const updateZoom = () => {
        if (svgEl) {
          svgEl.style.transform = `scale(${scale})`;
          svgEl.style.transformOrigin = 'top left';
        }
      };

      // Zoom controls
      controls.querySelector('.mermaid-zoom-in').addEventListener('click', () => {
        scale = Math.min(scale + 0.25, 3);
        updateZoom();
      });

      controls.querySelector('.mermaid-zoom-out').addEventListener('click', () => {
        scale = Math.max(scale - 0.25, 0.5);
        updateZoom();
      });

      controls.querySelector('.mermaid-zoom-reset').addEventListener('click', () => {
        scale = 1;
        updateZoom();
        content.scrollLeft = 0;
        content.scrollTop = 0;
      });

      // Click and drag to pan
      content.addEventListener('mousedown', (e) => {
        isDragging = true;
        content.style.cursor = 'grabbing';
        startX = e.pageX - content.offsetLeft;
        startY = e.pageY - content.offsetTop;
        scrollLeft = content.scrollLeft;
        scrollTop = content.scrollTop;
      });

      content.addEventListener('mouseleave', () => {
        isDragging = false;
        content.style.cursor = 'grab';
      });

      content.addEventListener('mouseup', () => {
        isDragging = false;
        content.style.cursor = 'grab';
      });

      content.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - content.offsetLeft;
        const y = e.pageY - content.offsetTop;
        content.scrollLeft = scrollLeft - (x - startX);
        content.scrollTop = scrollTop - (y - startY);
      });

      // Touch gesture support
      let lastTouchDistance = 0;

      content.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isDragging = true;
          startX = e.touches[0].pageX - content.offsetLeft;
          startY = e.touches[0].pageY - content.offsetTop;
          scrollLeft = content.scrollLeft;
          scrollTop = content.scrollTop;
        } else if (e.touches.length === 2) {
          // Pinch zoom start
          lastTouchDistance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
          );
        }
      }, { passive: true });

      content.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isDragging) {
          const x = e.touches[0].pageX - content.offsetLeft;
          const y = e.touches[0].pageY - content.offsetTop;
          content.scrollLeft = scrollLeft - (x - startX);
          content.scrollTop = scrollTop - (y - startY);
        } else if (e.touches.length === 2) {
          // Pinch zoom
          const distance = Math.hypot(
            e.touches[0].pageX - e.touches[1].pageX,
            e.touches[0].pageY - e.touches[1].pageY
          );
          if (lastTouchDistance > 0) {
            const delta = distance - lastTouchDistance;
            if (Math.abs(delta) > 10) {
              scale = Math.max(0.5, Math.min(3, scale + (delta > 0 ? 0.1 : -0.1)));
              updateZoom();
              lastTouchDistance = distance;
            }
          }
        }
      }, { passive: true });

      content.addEventListener('touchend', () => {
        isDragging = false;
        lastTouchDistance = 0;
      }, { passive: true });

      // Set initial cursor
      content.style.cursor = 'grab';

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
}
