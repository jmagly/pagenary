import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertTierOneGraphOnly } from '../src/index.js';

test('Tier-1 artifact audit accepts graph-only JavaScript', async (t) => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-react-audit-'));
  t.after(() => fs.rm(outDir, { recursive: true, force: true }));
  await fs.writeFile(path.join(outDir, 'index.js'), 'console.log("graph only")');
  await assertTierOneGraphOnly(outDir, [{ file: 'assets/react/index.js', isEntry: true }]);
});

test('Tier-1 artifact audit rejects database imports and WASM', async (t) => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-react-audit-'));
  t.after(() => fs.rm(outDir, { recursive: true, force: true }));
  await fs.writeFile(path.join(outDir, 'index.js'), 'import "@electric-sql/pglite"');
  await assert.rejects(
    assertTierOneGraphOnly(outDir, [
      { file: 'assets/react/index.js', isEntry: true },
      { file: 'assets/react/pglite.wasm', isEntry: false },
    ]),
    /database artifacts\/imports/,
  );
});
