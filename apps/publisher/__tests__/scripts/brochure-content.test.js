import fsp from 'node:fs/promises';
import { assertBrochureContent, validateBrochureContent } from '../../scripts/lib/brochure-content.js';

const fixtureUrl = new URL('../../examples/portfolio-brochure/content.json', import.meta.url);

describe('pagenary.brochure.content.v1 (#141)', () => {
  let fixture;
  beforeAll(async () => { fixture = JSON.parse(await fsp.readFile(fixtureUrl, 'utf8')); });

  test('accepts the portfolio fixture and preserves presentation/extensions data', () => {
    const result = assertBrochureContent(fixture);
    expect(result.warnings).toEqual([]);
    expect(result.content.entities.offers[0].showPrice).toBe(false);
    expect(result.content.extensions['northstar.example/brand']).toEqual({ tone: 'direct' });
  });

  test.each([
    ['duplicate id', (copy) => copy.routeManifest.push({ ...copy.routeManifest[0], path: '/other' }), /duplicate route id/],
    ['duplicate path', (copy) => copy.routeManifest.push({ ...copy.routeManifest[0], id: 'other' }), /duplicate route path/],
    ['dangling ref', (copy) => copy.routeManifest[0].entityRefs.push('projects.missing'), /dangling entity ref/],
    ['invalid canonical', (copy) => { copy.site.canonicalUrl = 'javascript:alert(1)'; }, /absolute HTTP/],
    ['unsafe route', (copy) => { copy.routeManifest[0].path = '/../secret'; }, /safe absolute route/],
    ['unsafe output', (copy) => { copy.routeManifest[0].prerender.output = '../secret.html'; }, /safe relative output/],
    ['missing public metadata', (copy) => { delete copy.routeManifest[0].summary; }, /require title and summary/]
  ])('hard-fails %s', (_name, mutate, expected) => {
    const copy = structuredClone(fixture);
    mutate(copy);
    expect(() => assertBrochureContent(copy)).toThrow(expected);
  });

  test('warns for documented extension-policy cases without dropping data', () => {
    const copy = structuredClone(fixture);
    copy.experimentalTenantField = { retained: true };
    copy.entities.projects.push({ id: 'unused', title: 'Unused' });
    const result = validateBrochureContent(copy);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('unknown top-level field preserved'),
      'unused entity: projects.unused'
    ]));
    expect(result.content.experimentalTenantField).toEqual({ retained: true });
  });
});
