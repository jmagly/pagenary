(function bootstrapPagenaryShell() {
  const script = document.currentScript;
  const configuredBase = script?.dataset.base || '';
  const pathname = location.pathname || '/';
  const explicitBase = configuredBase.startsWith('/') ? configuredBase : '';
  const autoBase = pathname.endsWith('/') ? pathname : pathname.slice(0, pathname.lastIndexOf('/') + 1);
  const base = explicitBase || autoBase || '/';
  document.write(`<base href="${base.replace(/["<>]/g, '')}">`);
  document.documentElement.classList.add('has-js');
})();
