let mounted;
let pending = false;
async function mountAuthoring() {
  const element = document.getElementById('dataset-authoring-root');
  const route = window.location.hash.replace(/^#\/?/, '');
  if (!element || route && route !== 'authoring') {
    if (mounted) {
      const previous = mounted;
      mounted = null;
      previous.unmount();
      await previous.runtime.close();
    }
    return;
  }
  if (pending || mounted?.element === element) return;
  pending = true;
  try {
    const [{ createPagenaryRecordRuntime }, { mountDatasetImport }] = await Promise.all([
      import('@pagenary/react/record-runtime'), import('@pagenary/react/dataset')
    ]);
    if (!element.isConnected) return;
    mounted?.unmount();
    if (mounted) await mounted.runtime.close();
    const runtime = await createPagenaryRecordRuntime(
      { tier: 'record', namespace: 'dataset-authoring-example', storage: 'idb' }, { tenantId: 'dataset-authoring-example' }
    );
    mounted = { element, runtime, unmount: mountDatasetImport(element, { runtime }) };
  } catch {
    element.textContent = 'The import controls could not load. Reload this route to try again.';
  } finally { pending = false; }
}
window.addEventListener('hashchange', () => requestAnimationFrame(mountAuthoring));
new MutationObserver(() => requestAnimationFrame(mountAuthoring)).observe(document.body, { childList: true, subtree: true });
mountAuthoring();
