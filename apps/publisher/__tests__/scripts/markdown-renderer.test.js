/**
 * Regression tests for the markdown renderer's frontmatter handling.
 *
 * #19: the renderer was leaking YAML frontmatter into the rendered HTML as
 * <hr>/<p>… text above the first heading. #18 made frontmatter mandatory on
 * collection posts, which made every collection post a tenant authors render
 * a block of raw YAML at the top of the published page.
 *
 * Fix: wire the existing parseFrontmatter() helper (already used by the
 * collections generator) into markdownToHtml() so every caller of the
 * renderer strips frontmatter before producing HTML.
 */

import { markdownToHtml } from '../../scripts/build-tenants.js';

describe('markdownToHtml frontmatter handling (#19)', () => {
  it('strips YAML frontmatter and renders only the body', () => {
    const input = [
      '---',
      'title: "How AIWG builds your customized system prompt"',
      'slug: "2026-5-how-aiwg-builds-your-system-prompt"',
      'date: "2026-05-26"',
      'summary: "An explainer."',
      '---',
      '',
      '# How AIWG builds your prompt',
      '',
      'First paragraph body.',
      '',
    ].join('\n');

    const html = markdownToHtml(input);

    // No raw frontmatter keys should appear as paragraph text.
    expect(html).not.toMatch(/<p>\s*title:\s*&quot;/i);
    expect(html).not.toMatch(/<p>\s*slug:\s*&quot;/i);
    expect(html).not.toMatch(/<p>\s*date:\s*&quot;/i);
    expect(html).not.toMatch(/<p>\s*summary:\s*&quot;/i);

    // The fence itself should not render as <hr>.
    // (Body has no `---` so any <hr> here means the fence leaked.)
    expect(html).not.toMatch(/<hr\b/);

    // The body must render.
    expect(html).toMatch(/<h1[^>]*>How AIWG builds your prompt<\/h1>/);
    expect(html).toContain('First paragraph body.');
  });

  it('is a no-op when no frontmatter is present', () => {
    const input = [
      '# Plain heading',
      '',
      'Body text only.',
      '',
    ].join('\n');

    const html = markdownToHtml(input);
    expect(html).toMatch(/<h1[^>]*>Plain heading<\/h1>/);
    expect(html).toContain('Body text only.');
  });

  it('preserves horizontal rules inside the body (only the opening fence is stripped)', () => {
    const input = [
      '---',
      'title: "T"',
      '---',
      '',
      '# T',
      '',
      'Before rule.',
      '',
      '---',
      '',
      'After rule.',
      '',
    ].join('\n');

    const html = markdownToHtml(input);
    expect(html).not.toMatch(/<p>\s*title:/i);
    expect(html).toMatch(/<h1[^>]*>T<\/h1>/);
    expect(html).toContain('Before rule.');
    expect(html).toContain('After rule.');
    // The body's mid-document `---` should become an <hr>.
    expect(html).toMatch(/<hr\b/);
  });
});

describe('markdownToHtml HTML comment stripping', () => {
  it('removes single-line and multi-line HTML comments from the body', () => {
    const html = markdownToHtml([
      '# Title',
      '',
      '<!-- an authoring note -->',
      'Visible paragraph.',
      '',
      '<!-- a multi-line',
      'comment that spans',
      'several lines -->',
      '',
      'Another paragraph.'
    ].join('\n'));
    expect(html).toContain('Visible paragraph.');
    expect(html).toContain('Another paragraph.');
    expect(html).not.toContain('authoring note');
    expect(html).not.toContain('multi-line');
    expect(html).not.toContain('<!--');
    expect(html).not.toContain('-->');
  });

  it('preserves an HTML comment shown inside a fenced code block', () => {
    const html = markdownToHtml([
      '# Title',
      '',
      '```html',
      '<!-- this is example code -->',
      '<p>hi</p>',
      '```'
    ].join('\n'));
    // The code example must still show the literal comment (escaped).
    expect(html).toContain('this is example code');
  });
})
