import React from 'react';
import { createRoot } from 'react-dom/client';
import { mountFortemiDocsMap } from '@pagenary/react/docs-map';

const ROUTE_ID = 'diagnostics';
let root = null;
let mountedElement = null;

function DiagnosticsPanel() {
  return (
    <div className="react-diagnostics-panel" data-testid="react-diagnostics-panel">
      <h2>React diagnostics online</h2>
      <p>
        This panel was built by the optional @pagenary/react adapter and mounted
        into an authored Pagenary fallback route.
      </p>
      <dl>
        <div>
          <dt>Runtime mode</dt>
          <dd>hybrid</dd>
        </div>
        <div>
          <dt>Artifacts</dt>
          <dd>sitemap, snapshots, llms.txt, search, Docs Map, and collections</dd>
        </div>
      </dl>
    </div>
  );
}

function shouldMount() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return !hash || hash === ROUTE_ID;
}

function mountDiagnostics() {
  const element = document.getElementById('react-diagnostics-root');
  if (!element || !shouldMount()) return;
  if (root && mountedElement === element) return;
  if (root) root.unmount();
  mountedElement = element;
  root = createRoot(element);
  root.render(<DiagnosticsPanel />);
}

window.addEventListener('hashchange', () => {
  window.requestAnimationFrame(mountDiagnostics);
});

const observer = new MutationObserver(() => {
  window.requestAnimationFrame(mountDiagnostics);
});
observer.observe(document.body, { childList: true, subtree: true });
mountDiagnostics();
mountFortemiDocsMap();
