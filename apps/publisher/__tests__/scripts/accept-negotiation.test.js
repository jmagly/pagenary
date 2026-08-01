import { parseAcceptHeader, prefersMarkdown } from '../../scripts/lib/accept-negotiation.js';

describe('Accept: text/markdown negotiation (#163)', () => {
  test.each([
    ['text/markdown', true],
    ['text/markdown; charset=utf-8', true],
    ['text/markdown, text/html;q=0.5', true],
    ['text/html, text/markdown;q=0.9', false],
    ['text/html;q=0.8, text/markdown;q=0.8', false],
    ['text/markdown;q=0, text/html;q=0.1', false],
    ['text/*;q=0.8, text/markdown;q=0', false],
    ['*/*', false],
    ['text/*', false],
    ['application/json', false],
    ['', false],
    [undefined, false]
  ])('%s -> Markdown preferred: %s', (header, expected) => {
    expect(prefersMarkdown(header)).toBe(expected);
  });

  it('parses quoted parameters, case, invalid quality values, and order', () => {
    const parsed = parseAcceptHeader('TEXT/MARKDOWN; profile="a,b"; q=0.7, text/html;q=bogus');
    expect(parsed).toEqual([
      { mediaType: 'text/markdown', quality: 0.7, parameters: { profile: 'a,b' }, order: 0 },
      { mediaType: 'text/html', quality: 0, parameters: {}, order: 1 }
    ]);
    expect(prefersMarkdown('TEXT/MARKDOWN; profile="a,b"; q=0.7, text/html;q=bogus')).toBe(true);
  });
});
