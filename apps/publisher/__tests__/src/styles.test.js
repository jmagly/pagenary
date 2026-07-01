import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHER_ROOT = path.resolve(__dirname, '../..');

describe('styles.css', () => {
  test('rail TOC caps the viewport and scrolls only the heading list', async () => {
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

    for (const cssFile of cssFiles) {
      const css = await fsp.readFile(cssFile, 'utf8');

      expect(css).toMatch(/\.doc-content > \.page-toc--rail > \.page-toc__disc\s*{[^}]*display: flex;[^}]*flex-direction: column;[^}]*max-height: calc\(100vh - 6rem\);[^}]*overflow: hidden;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__body\s*{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow: hidden;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__controls,\s*\.doc-content > \.page-toc--rail \.page-toc__title\s*{[^}]*flex: 0 0 auto;/s);
      expect(css).toMatch(/\.doc-content > \.page-toc--rail \.page-toc__list\s*{[^}]*flex: 1 1 auto;[^}]*min-height: 0;[^}]*overflow-y: auto;/s);
    }
  });
});
