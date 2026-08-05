(function redirectStaticSnapshotToSpa() {
  const target = document.currentScript?.dataset.spaUrl;
  if (target) window.location.replace(target);
})();
