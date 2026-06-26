/**
 * Tests for scripts/lib/search-index-generator.js — build-time index emission.
 * Runs the real generator against a temp dist dir containing section modules,
 * then validates the emitted artifacts with the REAL vendored validators.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { generateSearchIndex } from '../../scripts/lib/search-index-generator.js';
import {
  validateAiwgFortemiChunkManifest,
  validateAiwgFortemiChunkPart,
  assertAiwgFortemiChunkManifest
} from '../../src/vendor/fortemi-aiwg-index.js';

async function makeFixture() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-search-'));
  const sectionsDir = path.join(dir, 'sections');
  await fsp.mkdir(sectionsDir, { recursive: true });
  await fsp.writeFile(
    path.join(sectionsDir, 'welcome.js'),
    'export async function load() { return { html: "<h1>Welcome</h1><p>Landing hub for tenants.</p>" }; }\n'
  );
  await fsp.writeFile(
    path.join(sectionsDir, 'developers.js'),
    'export async function load() { return { html: "<h1>Developers</h1><p>SDKs, APIs and engineering workflows.</p>" }; }\n'
  );
  // Intentionally broken module: generator must degrade to title/summary.
  await fsp.writeFile(
    path.join(sectionsDir, 'broken.js'),
    'throw new Error("boom");\n'
  );
  return dir;
}

const MANIFEST = [
  { id: 'welcome', title: 'Welcome', summary: 'Landing', module: './sections/welcome.js' },
  {
    id: 'guides',
    title: 'Guides',
    subsections: [
      { id: 'developers', title: 'Developers', summary: 'APIs', module: './sections/developers.js' },
      { id: 'broken', title: 'Broken', summary: 'fallback text', module: './sections/broken.js' }
    ]
  }
];

describe('search-index-generator', () => {
  let dir;
  afterEach(async () => {
    if (dir) await fsp.rm(dir, { recursive: true, force: true });
    dir = null;
  });

  test('emits a valid chunked index from materialized sections', async () => {
    dir = await makeFixture();
    const summary = await generateSearchIndex(dir, MANIFEST, { tenantId: 'fixture', partSize: 2 });
    expect(summary.total).toBe(3); // welcome, developers, broken

    const indexDir = path.join(dir, 'search-index');
    const manifest = JSON.parse(fs.readFileSync(path.join(indexDir, 'manifest.json'), 'utf8'));
    expect(validateAiwgFortemiChunkManifest(manifest).valid).toBe(true);
    expect(manifest.parts.length).toBe(2); // partSize 2 over 3 records
    const metadata = JSON.parse(fs.readFileSync(path.join(indexDir, 'metadata.json'), 'utf8'));
    expect(metadata.schema_version).toBe('pagenary.fortemi.metadata.v1');
    expect(metadata.pages.map((page) => page.section_id)).toEqual(['broken', 'developers', 'welcome']);
    expect(metadata.pages.find((page) => page.section_id === 'developers').text).toBeUndefined();

    let items = [];
    for (const ref of manifest.parts) {
      const part = JSON.parse(fs.readFileSync(path.join(indexDir, ref.href), 'utf8'));
      expect(validateAiwgFortemiChunkPart(part, ref, manifest).valid).toBe(true);
      items = items.concat(part.items);
    }
    expect(items).toHaveLength(3);

    // Every record carries at least title/summary text. (Full module-body
    // extraction is exercised by the real spawned build in build-tenants.test.js;
    // the jest vm-modules sandbox cannot dynamically import temp ESM files.)
    const developers = items.find((item) => item.id === 'docs:page:developers');
    expect(developers.text).toContain('APIs');
    expect(developers.source.locator).toBe('#developers');
    expect(developers.source.locator).not.toContain('#/');

    // Broken module degrades to title/summary, never crashes the build.
    const broken = items.find((item) => item.id === 'docs:page:broken');
    expect(broken.text).toContain('fallback text');
  });

  test('is deterministic across runs (byte-identical manifest)', async () => {
    dir = await makeFixture();
    // Warm the module registry once before the two measured runs. Under jest's
    // --experimental-vm-modules loader (jest >=30) the FIRST dynamic import() of
    // a temp ESM section is misclassified ("Unexpected export statement in CJS
    // module") and degrades to title/summary, while a SECOND import of the same
    // path succeeds and extracts the module body — a sandbox-only cold/warm
    // asymmetry that does NOT occur in the real Node build (scripts/build-tenants.js,
    // exercised end-to-end in build-tenants.test.js). Warming first makes both
    // measured runs extract identical text, so this asserts the generator's
    // determinism contract rather than jest's import cache.
    await generateSearchIndex(dir, MANIFEST, { tenantId: 'fixture', partSize: 2 });
    await generateSearchIndex(dir, MANIFEST, { tenantId: 'fixture', partSize: 2 });
    const first = fs.readFileSync(path.join(dir, 'search-index', 'manifest.json'), 'utf8');
    await generateSearchIndex(dir, MANIFEST, { tenantId: 'fixture', partSize: 2 });
    const second = fs.readFileSync(path.join(dir, 'search-index', 'manifest.json'), 'utf8');
    expect(second).toBe(first);
  });

  test('removes stale parts when the corpus shrinks', async () => {
    dir = await makeFixture();
    // First build with tiny parts -> many part files.
    await generateSearchIndex(dir, MANIFEST, { tenantId: 'fixture', partSize: 1 });
    const before = (await fsp.readdir(path.join(dir, 'search-index'))).filter((f) => f.startsWith('part-'));
    expect(before.length).toBe(3);
    // Rebuild with a single section -> only one part should remain.
    await generateSearchIndex(dir, [MANIFEST[0]], { tenantId: 'fixture', partSize: 100 });
    const after = (await fsp.readdir(path.join(dir, 'search-index'))).filter((f) => f.startsWith('part-'));
    expect(after).toEqual(['part-0000.json']);
  });

  // #25: the build-time validation gate calls assertAiwgFortemiChunkManifest on the
  // emitted manifest and re-throws as a clear build failure. Confirm that assertion
  // — the gate's primitive — rejects a malformed artifact so an invalid index can
  // never ship silently. (The valid-artifact path is covered by the emit test above.)
  test('contract assertion rejects a malformed manifest (build-time gate primitive)', () => {
    expect(() => assertAiwgFortemiChunkManifest({ not: 'a manifest' })).toThrow();
    expect(() => assertAiwgFortemiChunkManifest(null)).toThrow();
  });
});
