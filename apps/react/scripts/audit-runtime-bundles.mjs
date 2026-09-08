import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReactTenant } from '../src/index.js';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'pagenary-graph-audit-'));
try {
  await symlink(fileURLToPath(new URL('../../../node_modules', import.meta.url)), path.join(temporary, 'node_modules'), 'dir');
  const entry = fileURLToPath(new URL('../src/docs-map/index.jsx', import.meta.url));
  await writeFile(path.join(temporary, 'graph.jsx'),
    `import { mountFortemiDocsMap } from ${JSON.stringify(entry)}; mountFortemiDocsMap();`);
  const distDir = path.join(temporary, 'dist');
  const result = await buildReactTenant({ tenantId: 'graph-audit', sourceDir: temporary, distDir,
    config: { docsMap: { renderer: 'fortemi-react' }, runtime: { fortemi: { tier: 'graph' } } },
    runtime: { entry: 'graph.jsx' } });
  let emittedBytes = 0;
  for (const asset of result.emittedAssets) {
    assert.doesNotMatch(asset.file, /\.wasm$|pglite|dataset|inference/i);
    const bytes = await readFile(path.join(distDir, asset.file));
    emittedBytes += bytes.length;
    if (asset.file.endsWith('.js')) {
      assert.doesNotMatch(bytes.toString(), /source-refresh|pagenary:published-pages|source_import_batch|DatasetIngestExecutor/);
    }
  }
  console.log(JSON.stringify({ tier: 'graph', emittedBytes, artifacts: result.emittedAssets.map((asset) => asset.file) }, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
