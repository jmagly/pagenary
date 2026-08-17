import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const docsRoot = path.join(packageRoot, 'docs');
const tenantRoot = path.join(packageRoot, 'tenants/pagenary');

const pages = [
  ['styles-install', 'STYLES-INSTALL.md'],
  ['styles-configure', 'STYLES-CONFIGURE.md'],
  ['styles-author', 'STYLES-AUTHOR.md'],
  ['styles-contribute', 'STYLES-CONTRIBUTE.md']
];

describe('Styles documentation learning path', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(tenantRoot, 'manifest.json'), 'utf8'));
  const styles = manifest.sections.find((section) => section.id === 'styles');

  test('registers all four searchable pages in navigation', () => {
    expect(styles?.title).toBe('Styles');
    expect(styles.sections.map(({ id, file }) => [id, file])).toEqual(pages);
    for (const [, file] of pages) {
      expect(fs.realpathSync(path.join(tenantRoot, 'content', file))).toBe(path.join(docsRoot, file));
    }
  });

  test('keeps human and agent paths on the same integrity and acceptance gates', () => {
    const corpus = pages.map(([, file]) => fs.readFileSync(path.join(docsRoot, file), 'utf8')).join('\n');
    for (const expected of [
      'https://catalog.pagenary.com/',
      'https://preview.catalog.pagenary.com/',
      'https://git.integrolabs.net/roctinam/pagenary-styles',
      'SHA256SUMS',
      'style.json',
      'provenance',
      'compatibility',
      'license',
      'keyboard',
      'mobile',
      'light/dark',
      'rollback',
      'npm test'
    ]) expect(corpus).toContain(expected);

    for (const recipe of ['install', 'upgrade', 'author', 'contribute']) {
      expect(corpus).toContain(`Agent recipe: ${recipe}`);
    }
    expect(corpus.match(/Do not invent/g)?.length).toBeGreaterThanOrEqual(4);
    expect(corpus.match(/Preserve unrelated\s+work/gi)?.length).toBeGreaterThanOrEqual(4);
    expect(corpus).toContain('GitHub is a publication mirror');
  });

  test('uses generic example identities rather than catalog source branding', () => {
    const authoredExamples = [
      fs.readFileSync(path.join(docsRoot, 'STYLES-AUTHOR.md'), 'utf8'),
      fs.readFileSync(path.join(docsRoot, 'STYLES-CONTRIBUTE.md'), 'utf8')
    ].join('\n');
    expect(authoredExamples).toContain('example-style');
    expect(authoredExamples).toContain('no source-project branding');
  });
});
