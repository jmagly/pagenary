import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertBrochureContent } from '../../scripts/lib/brochure-content.js';
import { generateBrochureArtifacts } from '../../scripts/lib/brochure-generator.js';
import { normalizeBlogIndex } from '../../../blog-client/src/index.js';
import { assertAiwgFortemiChunkManifest, assertAiwgFortemiChunkPart } from '../../src/vendor/fortemi-aiwg-index.js';

const fixtureUrl = new URL('../../examples/portfolio-brochure/content.json', import.meta.url);

describe('brochureware route coverage and corpus emission (#143 #144)', () => {
  let content;
  let dir;
  beforeEach(async () => {
    content = JSON.parse(await fsp.readFile(fixtureUrl, 'utf8'));
    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-brochure-artifacts-'));
  });
  afterEach(async () => fsp.rm(dir, { recursive: true, force: true }));

  test('emits semantic snapshots, extracts, corpus, JSON-LD, and complete coverage', async () => {
    assertBrochureContent(content);
    const result = await generateBrochureArtifacts(dir, content);
    expect(result.report).toMatchObject({ declared_routes: 7, public_routes: 7, complete_routes: 7, missing: [] });
    for (const route of content.routeManifest) {
      const html = await fsp.readFile(path.join(dir, `brochure/pages/${route.id}.html`), 'utf8');
      expect(html).toContain('<main>');
      expect(html).toContain('application/ld+json');
      expect(JSON.parse(await fsp.readFile(path.join(dir, `brochure/routes/${route.id}.json`), 'utf8'))).toMatchObject({ id: route.id, path: route.path });
    }
    const lines = (await fsp.readFile(path.join(dir, 'documents.jsonl'), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(7);
    expect(lines.map(JSON.parse).every((doc) => doc.schema_version === 'pagenary.brochure.artifacts.v1')).toBe(true);
    expect(JSON.parse(await fsp.readFile(path.join(dir, 'content-index.json'), 'utf8')).documents).toHaveLength(7);
    expect(await fsp.readFile(path.join(dir, 'sitemap.xml'), 'utf8')).toContain('https://northstar.example/services');
    expect(await fsp.readFile(path.join(dir, 'llms.txt'), 'utf8')).toContain('# Services');
    const offers = JSON.parse(await fsp.readFile(path.join(dir, 'brochure/offers.json'), 'utf8'));
    expect(offers.schema_version).toBe('pagenary.portfolio-brochure.offers.v1');
    expect(offers.items[0]).toMatchObject({ id: 'strategy', showPrice: false });
    const updates = JSON.parse(await fsp.readFile(path.join(dir, 'brochure/updates.json'), 'utf8'));
    expect(normalizeBlogIndex(updates)).toHaveLength(1);
    const searchManifest = JSON.parse(await fsp.readFile(path.join(dir, 'search-index/manifest.json'), 'utf8'));
    assertAiwgFortemiChunkManifest(searchManifest);
    expect(searchManifest.total).toBe(7);
    const searchPart = JSON.parse(await fsp.readFile(path.join(dir, `search-index/${searchManifest.parts[0].href}`), 'utf8'));
    assertAiwgFortemiChunkPart(searchPart, searchManifest.parts[0], searchManifest);
    expect(searchPart.items[0]).toHaveProperty('facets');
  });

  test('is deterministic and excludes private routes', async () => {
    content.routeManifest[1].extractPolicy = 'private';
    const first = await generateBrochureArtifacts(dir, content);
    const secondDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-brochure-artifacts-b-'));
    const second = await generateBrochureArtifacts(secondDir, content);
    expect(first.report.public_routes).toBe(6);
    expect(await fsp.readFile(path.join(dir, 'documents.jsonl')))
      .toEqual(await fsp.readFile(path.join(secondDir, 'documents.jsonl')));
    await expect(fsp.access(path.join(dir, 'brochure/pages/about.html'))).rejects.toThrow();
    await fsp.rm(secondDir, { recursive: true, force: true });
  });
});
