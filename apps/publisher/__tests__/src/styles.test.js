import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');

describe('styles.css', () => {
  const readCssFiles = async () => {
    const cssFiles = [
      path.join(PUBLISHER_ROOT, 'src', 'styles.css')
    ];
    const packagedSiteCss = path.join(PUBLISHER_ROOT, 'site', 'styles.css');
    try {
      await fsp.access(packagedSiteCss);
      cssFiles.push(packagedSiteCss);
    } catch {
      // site/ is generated during package/release builds and is not tracked.
    }
    return cssFiles;
  };

  test('rail TOC caps the viewport and scrolls only the heading list', async () => {
    for (const cssFile of await readCssFiles()) {
      const css = await fsp.readFile(cssFile, 'utf8');

      expect(css).toMatch(/\.doc-content > \.page-toc--rail > \.page-toc__disc\s*{[^}]*display: flex;[^}]*flex-direction: column;[^}]*max-height: calc\(100vh - 6rem\);[^}]*overflow: hidden;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__body\s*{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__controls,\s*\.doc-content > \.page-toc--rail \.page-toc__title\s*{[^}]*flex: 0 0 auto;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__list\s*{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow-y: auto;/s);
    }
  });

  test('mobile page-effect heroes and rail TOCs collapse controls into readable flow', async () => {
    for (const cssFile of await readCssFiles()) {
      const css = await fsp.readFile(cssFile, 'utf8');

      expect(css).toMatch(/@media \(max-width: 59\.99rem\)\s*{[^]*\.page-toc--rail,\s*\.page-toc--right\s*{[^}]*position: static;[^}]*width: auto;[^}]*height: auto;[^}]*pointer-events: auto;/s);
      expect(css).toMatch(/@media \(max-width: 59\.99rem\)\s*{[^]*\.page-toc--navstyle \.page-toc__title\s*{[^}]*pointer-events: auto;[^}]*cursor: pointer;/s);
      expect(css).toMatch(/@media \(max-width: 560px\)\s*{[^]*\.pe-hero-actions,\s*\.pe-banner-actions\s*{[^}]*flex-direction: column;[^}]*align-items: stretch;[^}]*width: 100%;/s);
      expect(css).toMatch(/@media \(max-width: 560px\)\s*{[^]*\.pe-cta\s*{[^}]*justify-content: center;[^}]*width: 100%;[^}]*white-space: normal;/s);
      expect(css).toMatch(/@media \(max-width: 560px\)\s*{[^]*\.bottom-nav__inner\s*{[^}]*flex-direction: column;[^}]*align-items: stretch;/s);
      expect(css).toMatch(/@media \(max-width: 560px\)\s*{[^]*\.bottom-nav \.bottom-nav-link\s*{[^}]*white-space: normal;[^}]*text-align: center;/s);
      expect(css).toMatch(/\.canvas\s*{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\);/s);
      expect(css).toMatch(/\.canvas > \*\s*{[^}]*grid-column: 1;[^}]*min-width: 0;/s);
      expect(css).toMatch(/@media \(max-width: 960px\)\s*{[^]*\.section\s*{[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*overflow: visible;/s);
    }
  });

  test('runtime mounts bottom navigation after content instead of a leading hero', async () => {
    const appJs = await fsp.readFile(path.join(PUBLISHER_ROOT, 'src', 'app.js'), 'utf8');

    expect(appJs).toContain('function getBottomNavMount()');
    expect(appJs).toContain("app.querySelector('section.doc, article.section, section:not(.pe-hero)')");
    expect(appJs).not.toContain("const section = app.querySelector('section') || app;");
  });

  test('no-JS root fallback keeps static navigation visible and open', async () => {
    const css = await fsp.readFile(path.join(PUBLISHER_ROOT, 'src', 'styles.css'), 'utf8');

    expect(css).toMatch(/\.has-js \.nav-static-fallback\s*{[^}]*display: none;/s);
    expect(css).toMatch(/html:not\(\.has-js\) \.mobile-menu-toggle\s*{[^}]*display: none;/s);
    expect(css).toMatch(/html:not\(\.has-js\),\s*html:not\(\.has-js\) body\s*{[^}]*height: auto;[^}]*overflow: auto;/s);
    expect(css).toMatch(/html:not\(\.has-js\) body\s*{[^}]*display: block;/s);
    expect(css).toMatch(/html:not\(\.has-js\) \.layout\s*{[^}]*height: auto;[^}]*overflow: visible;/s);
    expect(css).toMatch(/html:not\(\.has-js\) \.sidebar\s*{[^}]*display: block;[^}]*position: relative;[^}]*left: auto;[^}]*top: auto;[^}]*height: auto;[^}]*transform: none;/s);
    expect(css).toMatch(/html:not\(\.has-js\) \.canvas\s*{[^}]*height: auto;[^}]*overflow: visible;/s);
    expect(css).toMatch(/html:not\(\.has-js\) \.nav-sublist,\s*html:not\(\.has-js\) \.nav-sublist-nested,\s*html:not\(\.has-js\) \.nav-sublist-deep,\s*html:not\(\.has-js\) \.nav-sublist-ultra\s*{[^}]*display: grid;/s);
  });

  test('runtime replaces fallback-only nav with interactive nav', async () => {
    const appJs = await fsp.readFile(path.join(PUBLISHER_ROOT, 'src', 'app.js'), 'utf8');

    expect(appJs).toContain("nav.classList.remove('nav-static-fallback')");
  });

  test('runtime collapses right-side page TOC on portrait widths', async () => {
    const pageEffects = await fsp.readFile(path.join(PUBLISHER_ROOT, 'src', 'lib', 'page-effects.js'), 'utf8');

    expect(pageEffects).toContain("if (placement === 'right') {");
    expect(pageEffects).toContain("mq = window.matchMedia('(min-width: 60rem)')");
    expect(pageEffects).toContain('disc.open = mq.matches');
    expect(pageEffects).toContain("if (placement !== 'right' || (mq && mq.matches)) e.preventDefault();");
  });
});
