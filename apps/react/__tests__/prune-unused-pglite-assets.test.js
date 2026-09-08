import assert from 'node:assert/strict';
import test from 'node:test';
import { pruneUnusedPgliteAssets } from '../src/prune-unused-pglite-assets.js';

const asset = () => ({ type: 'asset', fileName: 'pglite.wasm', originalFileNames: ['/repo/node_modules/@electric-sql/pglite/dist/pglite.wasm'], source: new Uint8Array(5) });
const chunk = () => ({ type: 'chunk', fileName: 'entry.js', code: 'console.log("records")', modules: {}, referencedFiles: [] });
const prune = (bundle, tier = 'record') => pruneUnusedPgliteAssets(tier).generateBundle.handler({}, bundle);

test('prunes only database-owned assets with no rendered module or live reference', () => {
  const bundle = { 'pglite.wasm': asset(), 'entry.js': chunk(), 'user.wasm': { ...asset(), originalFileNames: ['/repo/user.wasm'] } };
  prune(bundle);
  assert.equal(bundle['pglite.wasm'], undefined);
  assert.ok(bundle['user.wasm']);
});
test('retained database modules, asset references, and Tier 3 preserve assets for the tier audit', () => {
  for (const reason of ['module', 'reference', 'code', 'tier']) {
    const bundle = { 'pglite.wasm': asset(), 'entry.js': chunk() };
    if (reason === 'module') bundle['entry.js'].modules['/repo/node_modules/@electric-sql/pglite/dist/index.js'] = { renderedLength: 1 };
    if (reason === 'reference') bundle['entry.js'].referencedFiles.push('pglite.wasm');
    if (reason === 'code') bundle['entry.js'].code = 'fetch("pglite.wasm")';
    prune(bundle, reason === 'tier' ? 'pglite' : 'record');
    assert.ok(bundle['pglite.wasm'], reason);
  }
});
