import {
  buildShareHref,
  buildShareTargets,
  normalizeShareConfig,
  resolveSharePayload,
  shouldUseNativeShare
} from '../../../src/lib/share.js';

describe('share helpers', () => {
  test('disabled config renders no targets', () => {
    expect(buildShareTargets({ enabled: false, services: ['x'] })).toEqual([]);
  });

  test('enabled config filters unknown services and keeps copy/email baseline', () => {
    const targets = buildShareTargets({ enabled: true, services: ['linkedin', 'bogus'] });
    expect(targets.map((target) => target.id)).toEqual(['copy', 'linkedin', 'email']);
  });

  test('custom service templates are encoded from page payload metadata', () => {
    const [target] = buildShareTargets({
      enabled: true,
      services: [{ id: 'community', label: 'Community', urlTemplate: 'https://community.example/share?url={url}&title={title}&desc={description}' }]
    }).filter((item) => item.id === 'community');
    const href = buildShareHref(target, {
      title: 'A&B',
      url: 'https://docs.example/pages/a b.html',
      description: 'One & two'
    });
    expect(href).toBe('https://community.example/share?url=https%3A%2F%2Fdocs.example%2Fpages%2Fa%20b.html&title=A%26B&desc=One%20%26%20two');
  });

  test('payload prefers static canonical URL when available', () => {
    const payload = resolveSharePayload({
      entry: { id: 'guide/install', title: 'Install', summary: 'Start here', staticUrl: 'https://docs.example/pages/guide--install.html' },
      siteConfig: { siteTitle: 'Docs', siteUrl: 'https://docs.example' },
      locationHref: 'https://preview.example/#guide/install'
    });
    expect(payload).toEqual({
      title: 'Install · Docs',
      text: 'Start here',
      description: 'Start here',
      url: 'https://docs.example/pages/guide--install.html'
    });
  });

  test('native share is auto-limited to touch-like devices', () => {
    const config = normalizeShareConfig({ enabled: true, native: 'auto' });
    const navigatorRef = { share() {} };
    expect(shouldUseNativeShare({ config, navigatorRef, maxTouchPoints: 0 })).toBe(false);
    expect(shouldUseNativeShare({ config, navigatorRef, maxTouchPoints: 1 })).toBe(true);
  });
});
