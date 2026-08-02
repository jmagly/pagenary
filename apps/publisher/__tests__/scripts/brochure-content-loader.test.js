import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadBrochureContentModule } from '../../scripts/lib/brochure-content-loader.js';

const fixtureUrl = new URL('../../examples/portfolio-brochure/content.json', import.meta.url);

describe('brochureware content-module loader (#142)', () => {
  let dir;
  let fixture;
  beforeEach(async () => {
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-brochure-loader-'));
    fixture = JSON.parse(await fsp.readFile(fixtureUrl, 'utf8'));
  });
  afterEach(async () => fsp.rm(dir, { recursive: true, force: true }));

  test('loads and validates a tenant-local JS module', async () => {
    await fsp.writeFile(path.join(dir, 'content.mjs'), `export const pagenaryContent = ${JSON.stringify(fixture)};`);
    const result = await loadBrochureContentModule(dir, {
      brochureware: { contentModule: 'content.mjs' }
    }, { mode: 'react-spa' });
    expect(result.content.schemaVersion).toBe('pagenary.brochure.content.v1');
    expect(result.content.routeManifest).toHaveLength(7);
  });

  test('is a no-op for ordinary tenants', async () => {
    await expect(loadBrochureContentModule(dir, {}, { mode: 'static' })).resolves.toBeNull();
  });

  test('reports missing modules and invalid exports clearly', async () => {
    await expect(loadBrochureContentModule(dir, {
      brochureware: { contentModule: 'missing.mjs' }
    }, { mode: 'react-spa' })).rejects.toThrow(/not found: missing\.mjs/);
    await fsp.writeFile(path.join(dir, 'invalid.mjs'), 'export const unrelated = true;');
    await expect(loadBrochureContentModule(dir, {
      brochureware: { contentModule: 'invalid.mjs' }
    }, { mode: 'react-spa' })).rejects.toThrow(/must export pagenaryContent or default/);
  });

  test('rejects invalid content and routes TypeScript through the optional adapter', async () => {
    await fsp.writeFile(path.join(dir, 'invalid.json'), '{}');
    await expect(loadBrochureContentModule(dir, {
      brochureware: { contentModule: 'invalid.json' }
    }, { mode: 'react-spa' })).rejects.toThrow(/Invalid brochure content/);
    await fsp.writeFile(path.join(dir, 'content.ts'), 'export const pagenaryContent = {};');
    await expect(loadBrochureContentModule(dir, {
      brochureware: { contentModule: 'content.ts' }
    }, { mode: 'react-spa' })).rejects.toThrow(/React\/Vite adapter/);
  });
});
