/**
 * Tests for lib/form-providers.js (#91)
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  FORM_PROVIDERS,
  getFormProvider,
  isFormProvider,
  formCspHosts,
  parseFormFenceConfig,
  normalizeFormConfig,
  renderFormEmbed
} from '../../../src/lib/form-providers.js';

describe('lib/form-providers.js', () => {
  describe('registry', () => {
    test('ships Tally as provider #1 with the embed seam fields', () => {
      const p = getFormProvider('tally');
      expect(p).toMatchObject({
        id: 'tally',
        scriptSrc: 'https://tally.so/widgets/embed.js',
        embedAttr: 'data-tally-src',
        openAttr: 'data-tally-open'
      });
      expect(p.hostedUrl('w4XyZ9')).toBe('https://tally.so/r/w4XyZ9');
      expect(p.embedUrl('w4XyZ9')).toContain('https://tally.so/embed/w4XyZ9');
      expect(p.cspHosts).toContain('tally.so');
    });

    test('isFormProvider gates the fence parser', () => {
      expect(isFormProvider('tally')).toBe(true);
      expect(isFormProvider('javascript')).toBe(false);
      expect(isFormProvider('box')).toBe(false);
      expect(isFormProvider(undefined)).toBe(false);
    });

    test('formCspHosts dedupes across providers', () => {
      expect(formCspHosts(['tally'])).toEqual(['tally.so']);
      expect(formCspHosts()).toEqual(expect.arrayContaining(['tally.so']));
    });
  });

  describe('parseFormFenceConfig', () => {
    test('parses key:value lines, stripping quotes', () => {
      const cfg = parseFormFenceConfig([
        'id: w4XyZ9',
        'mode: popup',
        'button: "Send feedback"',
        "title: 'Contact us'"
      ].join('\n'));
      expect(cfg).toEqual({
        id: 'w4XyZ9', mode: 'popup', button: 'Send feedback', title: 'Contact us'
      });
    });

    test('ignores blank / non kv lines', () => {
      expect(parseFormFenceConfig('\n# comment\nid: abc\n')).toEqual({ id: 'abc' });
    });
  });

  describe('normalizeFormConfig', () => {
    test('rejects unknown provider', () => {
      expect(normalizeFormConfig('nope', { id: 'x' })).toMatchObject({ ok: false });
    });
    test('requires id', () => {
      const r = normalizeFormConfig('tally', {});
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/missing required "id"/);
    });
    test('defaults mode to inline and supplies labels', () => {
      const r = normalizeFormConfig('tally', { id: 'abc' });
      expect(r.value).toMatchObject({ provider: 'tally', id: 'abc', mode: 'inline' });
      expect(r.value.title).toBeTruthy();
      expect(r.value.button).toBeTruthy();
    });
    test('honors popup mode + custom labels', () => {
      const r = normalizeFormConfig('tally', { id: 'abc', mode: 'popup', button: 'Hi', title: 'T' });
      expect(r.value).toMatchObject({ mode: 'popup', button: 'Hi', title: 'T' });
    });
  });

  describe('renderFormEmbed (static, progressive-enhancement markup)', () => {
    test('inline: container carries data attrs + a real hosted link, no iframe', () => {
      const html = renderFormEmbed('tally', { id: 'w4XyZ9', mode: 'inline', title: 'Survey' });
      expect(html).toContain('class="form-embed"');
      expect(html).toContain('data-form-provider="tally"');
      expect(html).toContain('data-form-id="w4XyZ9"');
      expect(html).toContain('data-form-mode="inline"');
      expect(html).toContain('href="https://tally.so/r/w4XyZ9"');
      expect(html).toContain('class="form-embed__fallback"');
      expect(html).not.toContain('<iframe'); // iframe is runtime-only
    });

    test('popup: fallback label is the button text', () => {
      const html = renderFormEmbed('tally', { id: 'abc', mode: 'popup', button: 'Send feedback' });
      expect(html).toContain('data-form-mode="popup"');
      expect(html).toContain('data-form-button="Send feedback"');
      expect(html).toContain('>Send feedback</a>');
    });

    test('site variant adds the floating class', () => {
      const html = renderFormEmbed('tally', { id: 'abc', mode: 'popup' }, { site: true });
      expect(html).toContain('form-embed form-embed--site');
    });

    test('escapes user text in attributes + content', () => {
      const html = renderFormEmbed('tally', { id: 'abc', mode: 'popup', button: 'A "B" <c>' });
      expect(html).toContain('data-form-button="A &quot;B&quot; &lt;c&gt;"');
      // Text content uses HTML escaping (quotes stay literal; angle brackets escape).
      expect(html).toContain('>A "B" &lt;c&gt;</a>');
      expect(html).not.toContain('<c>');
    });

    test('missing id yields an HTML comment, not broken markup', () => {
      const html = renderFormEmbed('tally', { mode: 'inline' });
      expect(html.startsWith('<!-- form-embed:')).toBe(true);
      expect(html).not.toContain('class="form-embed"');
    });

    test('unknown provider yields an HTML comment', () => {
      expect(renderFormEmbed('nope', { id: 'x' }).startsWith('<!-- form-embed:')).toBe(true);
    });
  });
});
