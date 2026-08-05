import { semanticHtml, semanticHtmlToText } from '../../src/lib/semantic-html.js';

const RICH_HTML = `
  <p>Formula
    <span class="katex">
      <span class="katex-mathml"><math><semantics><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow><annotation encoding="application/x-tex">x+y</annotation></semantics></math></span>
      <span class="katex-html" aria-hidden="true"><span><span>x</span><span>+</span><span>y</span></span></span>
    </span>
  </p>
  <figure class="rich-diagram"><svg><script>alert(1)</script><text>visual duplicate</text></svg><figcaption>Request flow</figcaption><details class="rich-diagram__source"><pre>graph TD; A--&gt;B</pre></details></figure>`;

describe('semantic rich-content extraction', () => {
  test('retains MathML and captions without visual or source duplicates', () => {
    const html = semanticHtml(RICH_HTML);
    expect(html).toContain('<math>');
    expect(html).toContain('Request flow');
    expect(html).not.toContain('katex-html');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('graph TD');
  });

  test('produces safe, searchable text once', () => {
    const text = semanticHtmlToText(RICH_HTML);
    expect(text).toContain('Formula x + y');
    expect(text).toContain('Request flow');
    expect(text).not.toContain('visual duplicate');
    expect(text).not.toContain('alert(1)');
    expect((text.match(/x \+ y/g) || [])).toHaveLength(1);
  });
});
