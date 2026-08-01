import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  extractAuthoredMarkdownFromModule,
  generateMarkdownArtifacts,
  htmlToMarkdown,
  resolveMarkdownDeliveryConfig
} from '../../scripts/lib/markdown-delivery.js';

describe('Markdown delivery artifacts (#163)', () => {
  let distDir;

  beforeEach(async () => {
    distDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pagenary-markdown-'));
  });

  afterEach(async () => {
    await fsp.rm(distDir, { recursive: true, force: true });
  });

  it('converts semantic HTML while removing chrome', () => {
    const markdown = htmlToMarkdown(`
      <nav><button>Export</button></nav>
      <article><h1>Install</h1><p>Use <strong>Pagenary</strong>.</p>
      <pre><code class="language-js">const x = 1 &lt; 2;</code></pre>
      <table><tr><th>Name</th><th>Value</th></tr><tr><td>Mode</td><td>Fast</td></tr></table>
      <figure><img src="diagram.png" alt="Request flow"><figcaption>System flow.</figcaption>
      <div class="media-description">The API calls storage.</div></figure>
      <p>Read <a href="#reference">the reference</a>.</p></article>
    `);
    expect(markdown).toContain('# Install');
    expect(markdown).toContain('**Pagenary**');
    expect(markdown).toContain('```js\nconst x = 1 < 2;\n```');
    expect(markdown).toContain('| Name | Value |');
    expect(markdown).toContain('![Request flow](diagram.png)');
    expect(markdown).toContain('_System flow._');
    expect(markdown).toContain('The API calls storage.');
    expect(markdown).toContain('[the reference](#reference)');
    expect(markdown).not.toContain('Export');
    expect(markdown).not.toContain('<nav');
  });

  it('extracts sanitized authored Markdown embedded in a section module', () => {
    const encoded = Buffer.from('# X\n\nBody.\n', 'utf8').toString('base64');
    const module = `// pagenary-authored-markdown-base64: ${encoded}\nexport async function load(){ return { html: "<h1>X</h1>" }; }`;
    expect(extractAuthoredMarkdownFromModule(module)).toBe('# X\n\nBody.\n');
  });

  it('uses the rendered main snapshot for dynamic modules without embedded HTML', async () => {
    const manifest = [{ id: 'dynamic', title: 'Dynamic page', module: './sections/dynamic.js' }];
    await fsp.mkdir(path.join(distDir, 'sections'), { recursive: true });
    await fsp.mkdir(path.join(distDir, 'pages'), { recursive: true });
    await fsp.writeFile(path.join(distDir, 'manifest.js'), `export const MANIFEST = ${JSON.stringify(manifest)};\n`);
    await fsp.writeFile(path.join(distDir, 'sections/dynamic.js'), 'export async function load(){ return fetch("/data.json"); }\n');
    await fsp.writeFile(path.join(distDir, 'pages/dynamic.html'),
      '<header>Site chrome</header><main><h1>Rendered route</h1><p>Dynamic body.</p></main><footer>Footer chrome</footer>');

    const result = await generateMarkdownArtifacts(distDir, { markdownDelivery: { enabled: true } });
    const markdown = await fsp.readFile(path.join(distDir, 'markdown/dynamic.md'), 'utf8');
    expect(result.generated).toBe(1);
    expect(markdown).toContain('# Rendered route');
    expect(markdown).toContain('Dynamic body.');
    expect(markdown).not.toContain('Site chrome');
    expect(markdown).not.toContain('Footer chrome');
  });

  it('generates stable representations and route metadata for all section fixture types', async () => {
    const entries = [
      ['guide', 'Guide', 'guide.js'],
      ['html', 'HTML page', 'html.js'],
      ['generated', 'Generated page', 'generated.js'],
      ['posts/story', 'Collection story', 'story.js'],
      ['react', 'React snapshot', 'react.js']
    ];
    const manifest = entries.map(([id, title, module]) => ({ id, title, summary: `${title} summary`, module: `./sections/${module}` }));
    Object.assign(manifest[3], {
      author: 'Example Author',
      date: '2026-07-25',
      reading_label: '3 min read',
      tags: ['release', 'accessibility']
    });
    await fsp.mkdir(path.join(distDir, 'sections'));
    await fsp.writeFile(path.join(distDir, 'manifest.js'), `export const MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`);
    await fsp.writeFile(path.join(distDir, 'sections/guide.js'),
      `export async function load(){return {html:"<h1>Rendered guide</h1>",authoredMarkdown:"# Authored guide\\n\\nSee [HTML](#html).\\n"};}`);
    for (const [, title, module] of entries.slice(1)) {
      await fsp.writeFile(path.join(distDir, 'sections', module),
        `export async function load(){return {html:${JSON.stringify(`<section><h1>${title}</h1><p>Fixture body.</p></section>`)}};}`);
    }

    const config = { basePath: '/docs', markdownDelivery: { enabled: true, observability: { responseHeader: true } } };
    const first = await generateMarkdownArtifacts(distDir, config);
    const guideBefore = await fsp.readFile(path.join(distDir, 'markdown/guide.md'), 'utf8');
    const routesBefore = await fsp.readFile(path.join(distDir, 'markdown-routes.json'), 'utf8');
    const second = await generateMarkdownArtifacts(distDir, config);
    expect(first.generated).toBe(5);
    expect(second.generated).toBe(5);
    expect(await fsp.readFile(path.join(distDir, 'markdown/guide.md'), 'utf8')).toBe(guideBefore);
    expect(await fsp.readFile(path.join(distDir, 'markdown-routes.json'), 'utf8')).toBe(routesBefore);
    expect(guideBefore).toContain('# Authored guide');
    expect(guideBefore).toContain('[HTML](/docs/pages/html.html)');
    const story = await fsp.readFile(path.join(distDir, 'markdown/posts--story.md'), 'utf8');
    expect(story).toContain('# Collection story');
    expect(story).toContain('> Collection story summary');
    expect(story).toContain('- **Author:** Example Author');
    expect(story).toContain('- **Date:** 2026-07-25');
    expect(story).toContain('- **Reading time:** 3 min read');
    expect(story).toContain('- **Tags:** release, accessibility');
    const routes = JSON.parse(routesBefore);
    expect(routes.routes['/']).toEqual(routes.routes['/pages/guide.html']);
    expect(routes.routes['/pages/posts--story']).toEqual(routes.routes['/pages/posts--story.html']);
    expect(routes.observability.responseHeader).toBe(true);
  });

  it('is opt-in and removes stale output for noIndex and restrictive profiles', async () => {
    await fsp.mkdir(path.join(distDir, 'markdown'));
    await fsp.writeFile(path.join(distDir, 'markdown/stale.md'), 'private');
    await fsp.writeFile(path.join(distDir, 'markdown-routes.json'), '{}');
    expect(resolveMarkdownDeliveryConfig({ markdownDelivery: { enabled: true } }).enabled).toBe(true);
    expect(resolveMarkdownDeliveryConfig({ seo: { discoverabilityProfile: 'limited' }, markdownDelivery: { enabled: true } }).enabled).toBe(false);
    expect(resolveMarkdownDeliveryConfig({ seo: { noIndex: true }, markdownDelivery: { enabled: true } }).enabled).toBe(false);
    await generateMarkdownArtifacts(distDir, { seo: { discoverabilityProfile: 'locked' }, markdownDelivery: { enabled: true } });
    await expect(fsp.stat(path.join(distDir, 'markdown'))).rejects.toThrow();
    await expect(fsp.stat(path.join(distDir, 'markdown-routes.json'))).rejects.toThrow();
  });
});
