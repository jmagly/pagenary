import { lintContentAccessibility } from '../../scripts/lib/accessibility-linter.js';

describe('accessibility content fence parsing', () => {
  test('does not lint live-looking markup inside a quadruple-fenced example', () => {
    const content = [
      '# Examples',
      '',
      '````markdown',
      '```html',
      '<img src="demo.png">',
      '<a href="javascript:void(0)">Demo</a>',
      '```',
      '',
      '| | Value |',
      '|---|---|',
      '| Example | One |',
      '````'
    ].join('\n');

    expect(lintContentAccessibility(content, { file: 'examples.md' })).toEqual([]);
  });

  test('still lints direct HTML fences', () => {
    const content = ['```html', '<img src="demo.png">', '```'].join('\n');
    expect(lintContentAccessibility(content, { file: 'live.md' })).toEqual([
      expect.objectContaining({ rule: 'image-alt', severity: 'error' })
    ]);
  });

  test('ignores inline code and ordinary JavaScript prose while checking real tags', () => {
    const content = [
      'A plain `<img>` remains simple. Do not execute JavaScript:',
      '',
      '<a href="javascript:void(0)">Unsafe</a>'
    ].join('\n');
    expect(lintContentAccessibility(content, { file: 'inline.md' })).toEqual([
      expect.objectContaining({ rule: 'risky-raw-html', severity: 'warning', line: 3 })
    ]);
  });

  test.each([
    {
      name: 'decorative interactive image',
      body: '```media\ntype: image\nsrc: diagram.png\nalt: ""\nzoom: true\n```',
      rule: 'image-decoration-conflict'
    },
    {
      name: 'unsupported interactive image format',
      body: '```media\ntype: image\nsrc: photo.webp?size=large\nalt: Product photo\nzoom: true\n```',
      rule: 'image-viewport-format'
    },
    {
      name: 'linked interactive image',
      body: '```media\ntype: image\nsrc: diagram.svg\nalt: Architecture\nzoom: true\nlink: /architecture\n```',
      rule: 'image-viewport-link'
    }
  ])('reports actionable diagnostics for $name', ({ body, rule }) => {
    expect(lintContentAccessibility(body, { file: 'viewport.md' })).toEqual(
      expect.arrayContaining([expect.objectContaining({ rule, severity: 'error' })])
    );
  });

  test('accepts responsive interactive image sources with query strings and fragments', () => {
    const body = [
      '```media',
      'type: image',
      'src: default.jpg?rev=2',
      'portrait: portrait.png#mobile',
      'landscape: landscape.svg?rev=3#wide',
      'alt: Responsive architecture',
      'zoom: true',
      '```'
    ].join('\n');
    expect(lintContentAccessibility(body, { file: 'responsive.md' }))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ rule: 'image-viewport-format' })]));
  });
});
