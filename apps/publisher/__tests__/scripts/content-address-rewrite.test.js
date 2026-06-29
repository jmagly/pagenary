/**
 * Regression tests for content-address literal rewriting (build-tenants.js).
 *
 * Guards the directory-scoped basename rule: a bare `./x.js` import must resolve
 * to the hashed file in the SAME directory, never a same-named file in another
 * directory. This is the bug that broke the pagenary docs build — `lib/page-effects.js`
 * (runtime) and `sections/page-effects.js` (a PAGE-EFFECTS.md content page) share a
 * basename, and `lib/form-embeds.js`'s `./page-effects.js` was rewritten to the
 * section's hash, 404-ing at runtime.
 */

import { buildLiteralReplacements, replacementsForFile } from '../../scripts/build-tenants.js';

function applyAll(text, replacements) {
  for (const [from, to] of replacements) {
    text = text.split(from).join(to);
  }
  return text;
}

describe('content-address literal rewriting', () => {
  // lib/page-effects.js and sections/page-effects.js share a basename.
  const map = new Map([
    ['lib/page-effects.js', 'lib/page-effects.b19e.js'],
    ['sections/page-effects.js', 'sections/page-effects.a38e.js'],
    ['lib/form-embeds.js', 'lib/form-embeds.733c.js'],
    ['app.js', 'app.1234.js'],
    ['manifest.js', 'manifest.5678.js']
  ]);

  test('buildLiteralReplacements groups basenames by directory', () => {
    const built = buildLiteralReplacements(map);
    expect(built.baseByDir.get('lib')).toEqual(
      expect.arrayContaining([['page-effects.js', 'page-effects.b19e.js'], ['form-embeds.js', 'form-embeds.733c.js']])
    );
    expect(built.baseByDir.get('sections')).toEqual([['page-effects.js', 'page-effects.a38e.js']]);
    // top-level files live under dir '.'
    expect(built.baseByDir.get('.')).toEqual(
      expect.arrayContaining([['app.js', 'app.1234.js'], ['manifest.js', 'manifest.5678.js']])
    );
  });

  test('a lib file\'s ./page-effects.js resolves to the LIB hash, not the section', () => {
    const built = buildLiteralReplacements(map);
    const repl = replacementsForFile(built, 'lib/form-embeds.js');
    const src = "import { registerEffect } from './page-effects.js';";
    const out = applyAll(src, repl);
    expect(out).toBe("import { registerEffect } from './page-effects.b19e.js';");
    expect(out).not.toContain('a38e'); // never the sections hash
  });

  test('a section file\'s ./page-effects.js (if rewritten) resolves to the SECTION hash', () => {
    const built = buildLiteralReplacements(map);
    const repl = replacementsForFile(built, 'sections/page-effects.js');
    const out = applyAll("import x from './page-effects.js';", repl);
    expect(out).toBe("import x from './page-effects.b19e.js';".replace('b19e', 'a38e'));
  });

  test('qualified ../lib/foo imports rewrite regardless of consuming dir', () => {
    const m = new Map([['lib/blog-index.js', 'lib/blog-index.aaaa.js']]);
    const built = buildLiteralReplacements(m);
    const repl = replacementsForFile(built, 'sections/blog.js');
    const out = applyAll("import { loadBlogIndex } from '../lib/blog-index.js';", repl);
    expect(out).toBe("import { loadBlogIndex } from '../lib/blog-index.aaaa.js';");
  });

  test('../base resolves against the consuming file\'s parent directory', () => {
    // a file in lib/sub importing ../page-effects.js -> lib/page-effects.js
    const m = new Map([['lib/page-effects.js', 'lib/page-effects.b19e.js']]);
    const built = buildLiteralReplacements(m);
    const repl = replacementsForFile(built, 'lib/sub/thing.js');
    const out = applyAll("import x from '../page-effects.js';", repl);
    expect(out).toBe("import x from '../page-effects.b19e.js';");
  });

  test('a sibling basename from another directory does NOT leak into a file', () => {
    const built = buildLiteralReplacements(map);
    // index.html (dir '.') must not pick up lib/ or sections/ basename rules
    const repl = replacementsForFile(built, 'index.html');
    const out = applyAll('<script src="./page-effects.js"></script>', repl);
    // no top-level page-effects.js entry exists, so the bare ref is untouched
    expect(out).toBe('<script src="./page-effects.js"></script>');
  });
});
