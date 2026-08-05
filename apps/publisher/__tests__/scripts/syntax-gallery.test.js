import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { markdownToHtml } from '../../scripts/build-tenants.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const galleryRoot = path.join(packageRoot, 'examples/syntax-gallery');
const docsPath = path.join(packageRoot, 'docs/SUPPORTED-SYNTAX.md');
const inventory = JSON.parse(fs.readFileSync(path.join(galleryRoot, 'syntax-inventory.json'), 'utf8'));

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[`*_()[\]{}]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function markdownAnchors(source) {
  return new Set([...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1])));
}

describe('supported syntax gallery (#178)', () => {
  it('maps unique supported features to existing example and help anchors', () => {
    const ids = inventory.features.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(40);

    const helpAnchors = markdownAnchors(fs.readFileSync(docsPath, 'utf8'));
    for (const feature of inventory.features) {
      const examplePath = path.join(galleryRoot, feature.example);
      expect(fs.existsSync(examplePath)).toBe(true);
      expect(helpAnchors.has(feature.help)).toBe(true);
      const source = fs.readFileSync(examplePath, 'utf8');
      if (feature.example.endsWith('.md')) {
        expect(markdownAnchors(source).has(feature.anchor)).toBe(true);
      } else {
        const latexSection = feature.anchor.replaceAll('-', ' ');
        expect(source.toLowerCase()).toContain(`\\section{${latexSection}}`);
      }
    }
  });

  it('keeps an explicit baseline for every currently supported authoring family', () => {
    const ids = new Set(inventory.features.map((feature) => feature.id));
    const baseline = [
      'frontmatter', 'headings', 'paragraphs', 'strong', 'emphasis-asterisk',
      'emphasis-underscore', 'inline-code', 'tooltip-span', 'links', 'autolinks',
      'document-mentions', 'images', 'zoom-image', 'unordered-lists', 'blockquotes',
      'tables', 'horizontal-rule', 'code-fence', 'box-fence', 'raw-html-fence',
      'html-comments', 'hero', 'banner-cta', 'inline-latex-parentheses',
      'inline-latex-dollar-opt-in', 'inline-latex-display-brackets',
      'inline-latex-display-dollars', 'inline-latex-macros',
      'inline-latex-protected-contexts', 'mermaid-fence', 'plantuml-fence',
      'puml-fence-alias', 'media-image', 'media-responsive-image',
      'media-accessible-viewport', 'media-audio', 'media-video', 'media-hosted',
      'media-json-definition', 'tally-form', 'complete-latex-page'
    ];
    expect([...ids].sort()).toEqual([...baseline].sort());
  });

  it('renders representative syntax as functional output', () => {
    const markdown = fs.readFileSync(path.join(galleryRoot, 'content/markdown.md'), 'utf8');
    const media = fs.readFileSync(path.join(galleryRoot, 'content/media-forms.md'), 'utf8');
    const math = fs.readFileSync(path.join(galleryRoot, 'content/inline-latex.md'), 'utf8');
    const markdownHtml = markdownToHtml(markdown);
    const mediaHtml = markdownToHtml(media);
    const mathHtml = markdownToHtml(math, { inlineLatex: { macros: { '\\RR': '\\mathbb{R}' } } });

    expect(markdownHtml).toContain('<table>');
    expect(markdownHtml).toContain('<blockquote>');
    expect(markdownHtml).toContain('class="content-box"');
    expect(markdownHtml).toContain('data-image-viewport');
    expect(mediaHtml).toContain('<picture>');
    expect(mediaHtml).toContain('<audio controls');
    expect(mediaHtml).toContain('<video controls');
    expect(mediaHtml).toContain('data-media-src=');
    expect(mediaHtml).toContain('data-form-provider="tally"');
    expect(mathHtml).toContain('class="katex"');
    expect(mathHtml).toContain('class="katex-display"');
  });

  it('contains no accidental remote renderer or CDN dependency', () => {
    const files = fs.readdirSync(path.join(galleryRoot, 'content'))
      .filter((name) => /\.(?:md|tex)$/.test(name));
    const source = files.map((name) => fs.readFileSync(path.join(galleryRoot, 'content', name), 'utf8')).join('\n');
    const urls = [...source.matchAll(/https?:\/\/[^\s)>]+/g)].map((match) => match[0]);
    const intentional = urls.filter((url) =>
      url.startsWith('https://example.com') ||
      url.startsWith('https://git.integrolabs.net')
    );
    expect(urls).toEqual(intentional);
    expect(source).not.toMatch(/kroki|plantuml\.com|mermaid\.live|cdn\.jsdelivr|unpkg\.com/i);
  });

  it('is registered in the examples build', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(packageRoot, 'examples/recipes.tenants.json'), 'utf8'));
    expect(registry.tenants).toContainEqual(expect.objectContaining({
      id: 'syntax-gallery',
      source: { type: 'local', path: './examples/syntax-gallery' }
    }));
  });

  it('builds through the real tenant pipeline without optional external renderers', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pagenary-syntax-gallery-'));
    try {
      const output = path.join(temporary, 'dist');
      const registryPath = path.join(temporary, 'tenants.json');
      fs.writeFileSync(registryPath, JSON.stringify({
        tenants: [{
          id: 'syntax-gallery-ci',
          source: { type: 'local', path: galleryRoot },
          target: { type: 'local', path: output }
        }]
      }));
      const result = spawnSync(process.execPath, [
        path.join(packageRoot, 'scripts/build-tenants.js'),
        '--registry', registryPath,
        'syntax-gallery-ci'
      ], {
        cwd: packageRoot,
        encoding: 'utf8',
        timeout: 30000
      });
      expect(`${result.stdout}\n${result.stderr}`).toContain('Tenant syntax-gallery-ci ready');
      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(output, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(output, 'sections/inline-latex.js'))).toBe(true);
      expect(fs.existsSync(path.join(output, 'sections/latex-page.js'))).toBe(true);
      const emitted = fs.readFileSync(path.join(output, 'sections/inline-latex.js'), 'utf8');
      expect(emitted).toContain('katex-mathml');
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }, 35000);
});
