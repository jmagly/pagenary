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

describe('markdownToHtml responsive image media blocks (#121)', () => {
  it('renders portrait and landscape image variants as native picture sources', () => {
    const html = markdownToHtml([
      '# Responsive image',
      '',
      '```media',
      'type: image',
      'src: assets/default.jpg',
      'portrait: assets/portrait.jpg',
      'landscape: assets/landscape.jpg',
      'alt: Dashboard overview',
      'caption: Choose the best composition for the viewport.',
      '```'
    ].join('\n'));

    expect(html).toContain('<figure class="media-block media-block--image">');
    expect(html).toContain('<picture>');
    expect(html).toContain('<source media="(orientation: portrait), (max-width: 700px)" srcset="assets/portrait.jpg">');
    expect(html).toContain('<source media="(orientation: landscape) and (min-width: 701px)" srcset="assets/landscape.jpg">');
    expect(html).toContain('<img src="assets/default.jpg" alt="Dashboard overview" loading="lazy">');
    expect(html).toContain('<figcaption>Choose the best composition for the viewport.</figcaption>');
  });

  it('falls back to the default image when responsive variants are omitted', () => {
    const html = markdownToHtml([
      '# Image',
      '',
      '```media',
      'type: image',
      'src: assets/default.jpg',
      'alt: Default only',
      '```'
    ].join('\n'));

    expect(html).toContain('<figure class="media-block media-block--image"><img src="assets/default.jpg" alt="Default only" loading="lazy"></figure>');
    expect(html).not.toContain('<picture>');
    expect(html).not.toContain('<source');
  });

  it('keeps legacy markdown images unchanged', () => {
    const html = markdownToHtml('![Legacy alt](assets/legacy.jpg)');
    expect(html).toContain('<img src="assets/legacy.jpg" alt="Legacy alt">');
    expect(html).not.toContain('<picture>');
  });
});

describe('inline images/links with entities in attributes (#138)', () => {
  it('renders an image whose alt contains an apostrophe (docs.aiwg.io regression)', () => {
    const html = markdownToHtml(
      "![An operator's control console for AI coding agents: glowing dashboard panels and orchestration nodes wired to a central hub with a clear stop/approve control.](/assets/blog/2026-6-aiwg-june-2026-report.png)"
    );
    expect(html).toContain('<img src="/assets/blog/2026-6-aiwg-june-2026-report.png"');
    expect(html).toContain('alt="An operator&#39;s control console');
    // The failure mode: the whole tag left escaped and shipped as visible text.
    expect(html).not.toContain('&lt;img');
  });

  it('renders an image whose src contains a querystring ampersand', () => {
    const html = markdownToHtml('![Chart](/assets/chart.png?w=800&fmt=webp)');
    expect(html).toContain('<img src="/assets/chart.png?w=800&amp;fmt=webp" alt="Chart">');
    expect(html).not.toContain('&lt;img');
  });

  it('renders a link whose href contains a querystring ampersand', () => {
    const html = markdownToHtml('See [the dashboard](https://example.com/board?a=1&b=2) for details.');
    expect(html).toContain('<a href="https://example.com/board?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">the dashboard</a>');
    expect(html).not.toContain('&lt;a href');
  });

  it('leaves entity-free images and links unchanged', () => {
    const html = markdownToHtml('![Plain](/img/plain.png) and [docs](#overview)');
    expect(html).toContain('<img src="/img/plain.png" alt="Plain">');
    expect(html).toContain('<a href="#overview">docs</a>');
  });

  it('renders an image whose alt contains an ampersand and quotes', () => {
    const html = markdownToHtml('![Q&A "quoted"](/img/qa.png)');
    expect(html).toContain('<img src="/img/qa.png" alt="Q&amp;A &quot;quoted&quot;">');
    expect(html).not.toContain('&lt;img');
  });
});
