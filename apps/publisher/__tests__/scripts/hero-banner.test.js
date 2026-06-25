/**
 * Tests for the declarative hero / banner emitters (#54): the markup a
 * frontmatter `hero` / `banner` block produces using the `.pe-*` primitives.
 */

import { renderHeroMarkup, renderBannerMarkup } from '../../scripts/build-tenants.js';

describe('renderHeroMarkup', () => {
  test('returns empty string for non-object input', () => {
    expect(renderHeroMarkup(undefined)).toBe('');
    expect(renderHeroMarkup('assets/x.svg')).toBe(''); // string hero is the runtime post-image, not this
    expect(renderHeroMarkup([])).toBe('');
  });

  test('emits full-bleed, overlay, parallax hero with image, title, and CTAs', () => {
    const html = renderHeroMarkup({
      eyebrow: 'Page Effects',
      title: 'Heroes that earn the scroll',
      subtitle: 'Authored from frontmatter.',
      image: 'assets/images/aurora.svg',
      fullBleed: true,
      overlay: true,
      parallax: true,
      align: 'center',
      cta: [
        { label: 'Get started', href: '#go', style: 'primary' },
        { label: 'Docs', href: '#docs', style: 'ghost' }
      ]
    });
    expect(html).toContain('class="pe-hero pe-hero--full-bleed pe-hero--overlay"');
    expect(html).toContain('data-pe-parallax');
    expect(html).toContain('--pe-hero-image:url(assets/images/aurora.svg)');
    expect(html).toContain('<div class="pe-hero-bg" aria-hidden="true"></div>');
    expect(html).toContain('<div class="pe-hero-scrim" aria-hidden="true"></div>');
    expect(html).toContain('class="pe-hero-eyebrow">Page Effects<');
    expect(html).toContain('<h1 class="pe-hero-title">Heroes that earn the scroll</h1>');
    expect(html).toContain('data-pe-align="center"');
    expect(html).toContain('<a class="pe-cta pe-cta--primary" href="#go">Get started</a>');
    expect(html).toContain('<a class="pe-cta pe-cta--ghost" href="#docs">Docs</a>');
  });

  test('overlay defaults on when media is present and off otherwise', () => {
    expect(renderHeroMarkup({ title: 'T', image: 'a.svg' })).toContain('pe-hero--overlay');
    expect(renderHeroMarkup({ title: 'T' })).not.toContain('pe-hero--overlay');
  });

  test('overlay can be forced off even with media', () => {
    const html = renderHeroMarkup({ title: 'T', image: 'a.svg', overlay: false });
    expect(html).not.toContain('pe-hero--overlay');
    expect(html).not.toContain('pe-hero-scrim');
  });

  test('video background takes precedence over image', () => {
    const html = renderHeroMarkup({ title: 'T', video: 'assets/clip.mp4', poster: 'p.jpg' });
    expect(html).toContain('<video class="pe-hero-video" autoplay muted loop playsinline poster="p.jpg">');
    expect(html).toContain('<source src="assets/clip.mp4" />');
  });

  test('sticky modifier and align=start', () => {
    const html = renderHeroMarkup({ title: 'T', sticky: true, align: 'start' });
    expect(html).toContain('pe-hero--sticky');
    expect(html).toContain('data-pe-align="start"');
  });

  test('escapes text and sanitizes the image url', () => {
    const html = renderHeroMarkup({
      title: '<script>alert(1)</script>',
      image: 'a.svg") ; background:url(evil'
    });
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    // url()-breaking characters are stripped from the path (the inner url value
    // must contain none of ( ) " ' ; { } so it cannot break out of url(...)).
    const inner = html.match(/--pe-hero-image:url\(([^)]*)\)/)[1];
    expect(inner).not.toMatch(/[()"';{}]/);
    expect(inner).toContain('a.svg');
  });
});

describe('renderBannerMarkup', () => {
  test('returns empty string for non-object or contentless input', () => {
    expect(renderBannerMarkup(undefined)).toBe('');
    expect(renderBannerMarkup({})).toBe('');
  });

  test('emits a full-bleed CTA band with title, text, and a CTA', () => {
    const html = renderBannerMarkup({
      title: 'Ready to ship?',
      text: 'Spin up a tenant in minutes.',
      fullBleed: true,
      cta: [{ label: 'Start', href: '#start', style: 'primary' }]
    });
    expect(html).toContain('class="pe-banner pe-banner--full-bleed"');
    expect(html).toContain('<div class="pe-banner-inner">');
    expect(html).toContain('<p class="pe-banner-title">Ready to ship?</p>');
    expect(html).toContain('<p class="pe-banner-sub">Spin up a tenant in minutes.</p>');
    expect(html).toContain('<a class="pe-cta pe-cta--primary" href="#start">Start</a>');
  });
});
