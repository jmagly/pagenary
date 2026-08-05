import {
  protectInlineLatex,
  resolveInlineLatexConfig
} from '../../scripts/lib/inline-latex.js';
import { markdownToHtml } from '../../scripts/build-tenants.js';

describe('inline LaTeX', () => {
  test('renders KaTeX HTML and MathML for inline and display delimiters', () => {
    const html = markdownToHtml([
      'Euler: \\(e^{i\\pi}+1=0\\).',
      '',
      '\\[\\int_0^1 x^2 \\, dx = \\frac{1}{3}\\]',
      '',
      '$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$$'
    ].join('\n'));

    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain('<math');
    expect(html).toContain('aria-hidden="true"');
  });

  test('keeps single-dollar syntax opt-in', () => {
    expect(markdownToHtml('Price: $20; expression: $x+1$.')).not.toContain('class="katex"');
    expect(markdownToHtml('Expression: $x+1$.', {
      inlineLatex: { dollarDelimiters: true }
    })).toContain('class="katex"');
  });

  test('supports page-scoped macros without leaking them between pages', () => {
    const configured = markdownToHtml('\\(\\RR\\)', {
      inlineLatex: { macros: { '\\RR': '\\mathbb{R}' } }
    });
    const nextPage = markdownToHtml('\\(\\RR\\)');

    expect(configured).toContain('mathbb');
    expect(configured).not.toContain('katex-error');
    expect(nextPage).toContain('mathcolor="#cc0000"');
    expect(nextPage).not.toContain('mathbb');
  });

  test('protects fences, code spans, raw HTML, and link/image destinations', () => {
    const source = [
      '`\\(code\\)` and \\(math\\)',
      '',
      '```text',
      '\\(fenced\\)',
      '```',
      '',
      '<span>\\(raw\\)</span>',
      '[\\(label\\)](https://example.test/\\(destination\\))',
      '![alt](images/\\(destination\\).png)'
    ].join('\n');
    const rendered = protectInlineLatex(source);

    expect(rendered.source).toContain('`\\(code\\)`');
    expect(rendered.source).toContain('\\(fenced\\)');
    expect(rendered.source).toContain('<span>\\(raw\\)</span>');
    expect(rendered.source).toContain('https://example.test/\\(destination\\)');
    expect(rendered.source).toContain('images/\\(destination\\).png');
    expect(rendered.source.match(/PAGENARYLATEX\d+TOKEN/g)).toHaveLength(2);
  });

  test('bounds resource controls and emits source-located diagnostics on strict errors', () => {
    expect(resolveInlineLatexConfig({ maxSize: Infinity, maxExpand: 999999 })).toMatchObject({
      maxSize: 20,
      maxExpand: 10000,
      throwOnError: false
    });
    const diagnostics = [];
    const html = markdownToHtml('Before \\(\\notacommand{x}\\) after.', {
      inlineLatex: { throwOnError: true, maxSize: 3, maxExpand: 4 },
      renderDiagnostics: diagnostics
    });

    expect(html).toContain('\\notacommand');
    expect(html).not.toContain('class="katex"');
    expect(diagnostics).toEqual([expect.objectContaining({
      code: 'INLINE_LATEX_RENDER_FAILED',
      severity: 'error',
      location: { line: 1, column: 8, offset: 7 }
    })]);
  });

  test('frontmatter can enable dollar delimiters and define page macros', () => {
    const html = markdownToHtml([
      '---',
      'inlineLatex:',
      '  dollarDelimiters: true',
      '  macros:',
      '    "\\\\vect": "\\\\mathbf{#1}"',
      '---',
      '$\\vect{x}$'
    ].join('\n'));

    expect(html).toContain('class="katex"');
    expect(html).toContain('mathbf');
  });
});
