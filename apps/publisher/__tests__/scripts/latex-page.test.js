import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {
  createLatexPageAdapter,
  inspectLatexPageRenderers,
  renderLatexPage
} from '../../scripts/lib/latex-page-adapter.js';
import { normalizeLatexHtml, latexHtmlSemanticText } from '../../scripts/lib/latex-page-normalize.js';
import { preflightLatexPage } from '../../scripts/lib/latex-page-preflight.js';
import { ensureLatexPageModule } from '../../scripts/build-tenants.js';

const root = path.resolve('/workspace/content');
const sourceFile = path.join(root, 'guides', 'page.tex');

describe('LaTeX full-page preflight', () => {
  test('recognizes a distinct .tex page and contained local dependencies', () => {
    const source = String.raw`\documentclass{article}
\usepackage{amsmath,graphicx}
\input{parts/intro}
\includegraphics{images/chart.png}
\bibliography{refs/library}
\begin{document}Semantic math: \(x^2\).\end{document}`;
    const existing = new Set([
      path.join(root, 'guides', 'parts', 'intro.tex'),
      path.join(root, 'guides', 'images', 'chart.png'),
      path.join(root, 'guides', 'refs', 'library.bib')
    ]);
    const result = preflightLatexPage(source, { contentRoot: root, sourceFile, fileExists: (file) => existing.has(file) });

    expect(result.ok).toBe(true);
    expect(result.dependencies.map((item) => item.relativePath)).toEqual([
      'guides/parts/intro.tex', 'guides/refs/library.bib', 'guides/images/chart.png'
    ]);
  });

  test.each([
    [String.raw`\immediate\write18{curl example.test}`, 'LATEX_UNSAFE_COMMAND'],
    [String.raw`\input{../../secret}`, 'LATEX_DEPENDENCY_OUTSIDE_ROOT'],
    [String.raw`\includegraphics{https://example.test/payload.svg}`, 'LATEX_UNSAFE_COMMAND'],
    [String.raw`\usepackage{minted}`, 'LATEX_PACKAGE_NOT_ALLOWED']
  ])('rejects dangerous input without invoking a TeX process', (source, expectedCode) => {
    const result = preflightLatexPage(source, { contentRoot: root, sourceFile, fileExists: () => false });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain(expectedCode);
  });

  test('rejects non-.tex full page sources', () => {
    const result = preflightLatexPage('text', { contentRoot: root, sourceFile: path.join(root, 'page.md') });
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LATEX_PAGE_TYPE_INVALID' })]));
  });
});

describe('LaTeX page normalization', () => {
  test('keeps semantic HTML and MathML while removing active content and unsafe URLs', () => {
    const output = normalizeLatexHtml(`<!doctype html><html><body>
      <article onclick="steal()"><h1>Proof</h1><math display="block"><mrow><mi>x</mi><mo>=</mo><mn>1</mn></mrow></math>
      <script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="figures/a.png" alt="Chart"></article>
    </body></html>`);
    expect(output).toContain('<article><h1>Proof</h1><math display="block">');
    expect(output).toContain('<img src="figures/a.png" alt="Chart">');
    expect(output).not.toMatch(/script|onclick|javascript/i);
    expect(latexHtmlSemanticText(output)).toContain('Proof x = 1 bad');
  });
});

describe('LaTeX page adapters', () => {
  test('materializes a distinct .tex page as a section module', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-latex-page-'));
    const sourcePath = path.join(temp, 'page.tex');
    const targetPath = path.join(temp, 'page.js');
    await fs.writeFile(sourcePath, '\\documentclass{article}\\begin{document}Hello\\end{document}');
    const runCommand = async (_command, args) => args[0] === '--version'
      ? { stdout: 'pandoc 3.1.3\n', stderr: '' }
      : { stdout: '<article><h1>Hello</h1><math><mi>x</mi></math></article>', stderr: '' };
    try {
      await ensureLatexPageModule(sourcePath, targetPath, {
        contentRoot: temp,
        latexPageConfig: { profile: 'portable-subset-v1', runCommand },
        renderDiagnostics: []
      });
      const generated = await fs.readFile(targetPath, 'utf8');
      expect(generated).toContain('section doc latex-page');
      expect(generated).toContain('portable-subset-v1');
      expect(generated).toContain('<article><h1>Hello</h1>');
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });

  test('defaults to standard-web-v1 and reports unavailable LaTeXML with source fallback', async () => {
    const runCommand = async () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; };
    const result = await renderLatexPage({ body: '\\begin{document}Hi\\end{document}', sourceFile }, {
      contentRoot: root,
      runCommand,
      fileExists: () => true
    });
    expect(result.html).toContain('rich-content-fallback');
    expect(result.diagnostics[0]).toMatchObject({ code: 'LATEX_RENDERER_UNAVAILABLE', profile: 'standard-web-v1' });
  });

  test('strict mode fails when the selected converter is unavailable', async () => {
    const runCommand = async () => { const error = new Error('missing'); error.code = 'ENOENT'; throw error; };
    await expect(renderLatexPage({ body: 'Hi', sourceFile }, {
      contentRoot: root, runCommand, fileExists: () => true, failurePolicy: 'strict'
    })).rejects.toMatchObject({ code: 'LATEX_RENDERER_UNAVAILABLE' });
  });

  test('portable subset invokes Pandoc without a shell and returns searchable semantic output', async () => {
    const calls = [];
    const runCommand = async (command, args, options) => {
      calls.push({ command, args, options });
      if (args[0] === '--version') return { stdout: 'pandoc 3.1.0\n', stderr: '' };
      return { stdout: '<main><h1>Result</h1><math><mi>x</mi></math></main>', stderr: '' };
    };
    const adapter = createLatexPageAdapter();
    const result = await adapter.render({ body: 'Result $x$', sourceFile }, {
      profile: 'portable-subset-v1', contentRoot: root, runCommand, fileExists: () => true
    });

    expect(calls[1]).toMatchObject({ command: 'pandoc', args: ['--from=latex', '--to=html5', '--mathml', '--wrap=none', sourceFile] });
    expect(calls[1].options).toMatchObject({ cwd: root, timeoutMs: 20000, maxOutputBytes: 4194304 });
    expect(calls[1].options.env).toEqual(expect.objectContaining({ HOME: root, SOURCE_DATE_EPOCH: '0' }));
    expect(result.semanticText).toBe('Result x');
    expect(result.rendererMetadata).toMatchObject({ profile: 'portable-subset-v1', portableSubset: true });
  });

  test('publishes availability metadata for semantic HTML and optional PDF profiles', async () => {
    const runCommand = async (command) => {
      if (command !== 'pandoc') { const error = new Error('missing'); error.code = 'ENOENT'; throw error; }
      return { stdout: 'pandoc 3.1.0\n', stderr: '' };
    };
    const status = await inspectLatexPageRenderers({ runCommand, contentRoot: root });
    expect(status.defaultProfile).toBe('standard-web-v1');
    expect(status.profiles['standard-web-v1']).toMatchObject({ command: 'latexmlc', available: false, semantic: true });
    expect(status.profiles['portable-subset-v1']).toMatchObject({ command: 'pandoc', available: true, output: 'html+mathml' });
    expect(status.profiles['pdf-v1']).toMatchObject({ command: 'tectonic', available: false, optional: true, output: 'pdf' });
  });
});
