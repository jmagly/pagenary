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
});
