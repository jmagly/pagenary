# ADR-012: Mermaid.js Diagram Support

## Status
PROPOSED

## Date
2024-12-04

## Context

Tenant content (e.g., roko-kb) includes Mermaid diagram definitions in markdown code blocks. Currently, these render as raw text rather than visual diagrams. We need to add mermaid.js support to transform code blocks into rendered SVG diagrams.

### Current State
- Markdown code blocks with `language-mermaid` class are output as `<pre><code class="language-mermaid">...</code></pre>`
- No mermaid.js library is loaded
- No runtime processing to convert mermaid blocks to diagrams
- The `afterRender` hook exists in app.js for post-render processing

### Content Analysis
Multiple tenant files contain mermaid diagrams:
- `articles/of-time-and-stamps.md` - flowchart diagram
- `archive/history.md` - 3 diagrams
- `archive/timerpc.md` - 1 diagram
- `archive/vision.md` - 1 diagram
- `archive/basilisk.md` - 2 diagrams
- `archive/historical.md` - 1 diagram

## Decision

Implement **lazy-loaded CDN-based mermaid.js** with runtime initialization.

### Approach

1. **Lazy Loading**: Only load mermaid.js when a page contains mermaid code blocks
2. **CDN Delivery**: Use esm.sh CDN for mermaid.js (consistent with zero-dependency philosophy - no build-time bundling)
3. **Runtime Detection**: After page render, detect `<code class="language-mermaid">` elements
4. **In-Place Rendering**: Replace code blocks with rendered SVG diagrams
5. **Theme Integration**: Use neutral theme with CSS variable integration for accent colors

### Implementation Details

#### 1. Mermaid Initialization Module (`src/mermaid-init.js`)
```javascript
let mermaidLoaded = false;
let mermaidPromise = null;

async function loadMermaid() {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import('https://esm.sh/mermaid@10/dist/mermaid.esm.min.mjs');
  const { default: mermaid } = await mermaidPromise;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'strict',
    flowchart: { htmlLabels: true, curve: 'basis' }
  });
  mermaidLoaded = true;
  return mermaid;
}

export async function renderMermaidBlocks(container) {
  const codeBlocks = container.querySelectorAll('code.language-mermaid');
  if (codeBlocks.length === 0) return;

  const mermaid = await loadMermaid();

  for (const codeBlock of codeBlocks) {
    const pre = codeBlock.parentElement;
    const definition = codeBlock.textContent;
    const id = `mermaid-${crypto.randomUUID().slice(0, 8)}`;

    try {
      const { svg } = await mermaid.render(id, definition);
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-diagram';
      wrapper.innerHTML = svg;
      pre.replaceWith(wrapper);
    } catch (err) {
      console.error('Mermaid render error:', err);
      pre.classList.add('mermaid-error');
    }
  }
}
```

#### 2. App.js Integration
After `app.innerHTML = payload.html`, call mermaid initialization:
```javascript
import { renderMermaidBlocks } from './mermaid-init.js';

// In showSection(), after setting innerHTML:
app.innerHTML = payload.html || '';
await renderMermaidBlocks(app);
```

#### 3. CSS Styling (`styles.css`)
```css
.mermaid-diagram {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
  overflow-x: auto;
}

.mermaid-diagram svg {
  max-width: 100%;
  height: auto;
}

.mermaid-error {
  border-left: 3px solid var(--accent, #e53935);
  background: rgba(229, 57, 53, 0.1);
}
```

## Alternatives Considered

### 1. Build-Time Rendering
- **Pros**: No runtime JS, faster page loads
- **Cons**: Requires puppeteer/playwright, complex build pipeline, increases build time significantly
- **Rejected**: Violates zero-dependency philosophy, adds substantial build complexity

### 2. Bundled Mermaid.js
- **Pros**: Works offline, no CDN dependency
- **Cons**: Adds ~2MB to bundle size (mermaid is large), increases initial load
- **Rejected**: Bloats bundle for feature that may not be used on all pages

### 3. Eager Loading (Always Load Mermaid)
- **Pros**: Simpler implementation
- **Cons**: Loads 2MB+ library even when no diagrams present
- **Rejected**: Wastes bandwidth for pages without diagrams

### 4. Web Component Approach
- **Pros**: Encapsulated, standards-based
- **Cons**: More complex, shadow DOM styling challenges
- **Rejected**: Overkill for this use case

## Consequences

### Positive
- Diagrams render correctly in tenant content
- Lazy loading means no impact on pages without diagrams
- CDN caching improves performance for repeat visits
- Maintains zero-dependency build philosophy
- Theme-aware styling integrates with tenant branding

### Negative
- Requires internet connection for first diagram load
- Brief flash of code before diagram renders (FOUC)
- CDN dependency for runtime (esm.sh)

### Mitigations
- FOUC: Add CSS to hide `.language-mermaid` initially, show after render
- CDN: esm.sh is highly reliable; fallback could be added if needed

## Implementation Plan

1. Create `src/mermaid-init.js` with lazy loading logic
2. Update `src/app.js` to call `renderMermaidBlocks()` after content load
3. Add mermaid CSS styles to `src/styles.css`
4. Fix content: Change ` ```mermaid.js ` to ` ```mermaid ` in roko-kb
5. Test with roko-kb article
6. Update build-tenants.js to copy mermaid-init.js to dist

## References

- [Mermaid.js Documentation](https://mermaid.js.org/)
- [esm.sh CDN](https://esm.sh/)
- ADR-003: Static JS Deployment Model
