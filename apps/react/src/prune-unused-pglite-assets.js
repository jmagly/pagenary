const ownsPgliteFile = (name) => /(?:^|\/)node_modules\/@electric-sql\/pglite\//.test(name.replaceAll('\\', '/'));

/** Vite emits WASM during transform, before Rollup removes unused DB imports. */
export function pruneUnusedPgliteAssets(tier) {
  return {
    name: 'pagenary-prune-unused-pglite-assets',
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        if (tier === 'pglite') return;
        const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
        // Never mask a retained database runtime. The normal tier audit must
        // reject it with its assets intact.
        if (chunks.some((chunk) => Object.entries(chunk.modules).some(([id, module]) =>
          ownsPgliteFile(id) && module.renderedLength > 0))) return;
        for (const [file, asset] of Object.entries(bundle)) {
          if (asset.type !== 'asset' || !asset.originalFileNames?.some(ownsPgliteFile)) continue;
          const basename = file.split('/').at(-1);
          const referenced = chunks.some((chunk) => chunk.referencedFiles.includes(file) || chunk.code.includes(basename)) ||
            Object.values(bundle).some((other) => other !== asset && other.type === 'asset' &&
              typeof other.source === 'string' && !other.fileName.endsWith('manifest.json') && other.source.includes(basename));
          if (!referenced) delete bundle[file];
        }
      }
    }
  };
}
