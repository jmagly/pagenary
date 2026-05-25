/**
 * Tests for lib/export.js
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  composeExportDocument,
  collectExportableSections
} from '../../../src/lib/export.js';

describe('lib/export.js', () => {
  describe('composeExportDocument', () => {
    test('generates valid HTML document structure', () => {
      const chapters = [
        { section: { title: 'Introduction', summary: 'Getting started guide' }, html: '<p>Welcome</p>' }
      ];
      const result = composeExportDocument(chapters);

      expect(result).toContain('<!doctype html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
      expect(result).toContain('<head>');
      expect(result).toContain('</head>');
      expect(result).toContain('<body>');
      expect(result).toContain('</body>');
    });

    test('includes meta viewport and charset', () => {
      const result = composeExportDocument([]);
      expect(result).toContain('<meta charset="utf-8"');
      expect(result).toContain('<meta name="viewport"');
    });

    test('generates table of contents from chapters', () => {
      const chapters = [
        { section: { title: 'First Section' }, html: '<p>Content 1</p>' },
        { section: { title: 'Second Section' }, html: '<p>Content 2</p>' },
        { section: { title: 'Third Section' }, html: '<p>Content 3</p>' }
      ];
      const result = composeExportDocument(chapters);

      expect(result).toContain('Table of Contents');
      expect(result).toContain('<li>1. First Section</li>');
      expect(result).toContain('<li>2. Second Section</li>');
      expect(result).toContain('<li>3. Third Section</li>');
    });

    test('generates section content with numbering', () => {
      const chapters = [
        { section: { title: 'Welcome', summary: 'Overview' }, html: '<p>Hello world</p>' },
        { section: { title: 'Setup', summary: 'Installation' }, html: '<p>Install steps</p>' }
      ];
      const result = composeExportDocument(chapters);

      expect(result).toContain('<h2>1. Welcome</h2>');
      expect(result).toContain('<h2>2. Setup</h2>');
      expect(result).toContain('<p class="section-summary">Overview</p>');
      expect(result).toContain('<p class="section-summary">Installation</p>');
      expect(result).toContain('<p>Hello world</p>');
      expect(result).toContain('<p>Install steps</p>');
    });

    test('handles empty chapters array', () => {
      const result = composeExportDocument([]);

      expect(result).toContain('No sections</li>');
      expect(result).toContain('No sections available.');
    });

    test('handles missing summary gracefully', () => {
      const chapters = [
        { section: { title: 'No Summary Section' }, html: '<p>Content</p>' }
      ];
      const result = composeExportDocument(chapters);

      expect(result).toContain('<p class="section-summary"></p>');
    });

    test('includes print styles', () => {
      const result = composeExportDocument([]);
      expect(result).toContain('@media print');
      expect(result).toContain('@page');
    });

    test('includes generated timestamp', () => {
      const result = composeExportDocument([]);
      expect(result).toContain('Generated');
    });

    test('includes title', () => {
      // The export header was intentionally branded in commit 87f817c
      // ("Add export branding and export options features"): the default
      // document title became "Documentation Export" and the <h1> now
      // renders the configurable brandMark/brandSub as dedicated spans
      // (the .brand-mark / .brand-sub hooks that applyBranding rewrites
      // per tenant). This test predates that feature and asserted the old
      // hardcoded "Docs Toolkit" header; it is updated here to assert the
      // shipped branded structure rather than weakened. Stripping the spans
      // from the source would remove a shipped, CSS-targeted feature.
      const result = composeExportDocument([]);
      expect(result).toContain('<title>Documentation Export</title>');
      expect(result).toContain('<span class="brand-mark">Docs</span>');
      expect(result).toContain('<span class="brand-sub">Toolkit</span>');
    });
  });

  describe('collectExportableSections', () => {
    test('collects leaf sections with module paths', () => {
      const manifest = [
        { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' },
        { id: 'setup', title: 'Setup', module: './sections/setup.js' }
      ];
      const result = collectExportableSections(manifest);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('welcome');
      expect(result[1].id).toBe('setup');
    });

    test('collects subsections from groups', () => {
      const manifest = [
        {
          id: 'getting-started',
          title: 'Getting Started',
          subsections: [
            { id: 'gs-intro', title: 'Introduction', module: './sections/gs-intro.js' },
            { id: 'gs-setup', title: 'Setup', module: './sections/gs-setup.js' }
          ]
        }
      ];
      const result = collectExportableSections(manifest);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('gs-intro');
      expect(result[1].id).toBe('gs-setup');
    });

    test('excludes groups without module (parent groups)', () => {
      const manifest = [
        {
          id: 'group',
          title: 'Group',
          // No module - this is a parent group
          subsections: [
            { id: 'child', title: 'Child', module: './sections/child.js' }
          ]
        }
      ];
      const result = collectExportableSections(manifest);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('child');
    });

    test('includes both leaf sections and subsections', () => {
      const manifest = [
        { id: 'welcome', title: 'Welcome', module: './sections/welcome.js' },
        {
          id: 'developers',
          title: 'Developers',
          subsections: [
            { id: 'dev-overview', title: 'Overview', module: './sections/dev-overview.js' },
            { id: 'dev-api', title: 'API', module: './sections/dev-api.js' }
          ]
        },
        { id: 'faq', title: 'FAQ', module: './sections/faq.js' }
      ];
      const result = collectExportableSections(manifest);

      expect(result).toHaveLength(4);
      expect(result.map(s => s.id)).toEqual(['welcome', 'dev-overview', 'dev-api', 'faq']);
    });

    test('preserves navigation order', () => {
      const manifest = [
        { id: 'third', title: 'Third', module: './sections/third.js' },
        { id: 'first', title: 'First', module: './sections/first.js' },
        { id: 'second', title: 'Second', module: './sections/second.js' }
      ];
      const result = collectExportableSections(manifest);

      expect(result[0].id).toBe('third');
      expect(result[1].id).toBe('first');
      expect(result[2].id).toBe('second');
    });

    test('handles empty manifest', () => {
      const result = collectExportableSections([]);
      expect(result).toHaveLength(0);
    });

    test('handles manifest with only groups (no leaf modules)', () => {
      const manifest = [
        {
          id: 'empty-group',
          title: 'Empty Group',
          subsections: []
        }
      ];
      const result = collectExportableSections(manifest);
      expect(result).toHaveLength(0);
    });

    test('skips subsections without module paths', () => {
      const manifest = [
        {
          id: 'group',
          title: 'Group',
          subsections: [
            { id: 'has-module', title: 'Has Module', module: './sections/has-module.js' },
            { id: 'no-module', title: 'No Module' } // Missing module
          ]
        }
      ];
      const result = collectExportableSections(manifest);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('has-module');
    });
  });
});

describe('export document scenarios', () => {
  test('single section export', () => {
    const chapters = [
      { section: { title: 'Quick Start', summary: 'Get up and running in 5 minutes' }, html: '<p>Step 1: Install</p>' }
    ];
    const result = composeExportDocument(chapters);

    expect(result).toContain('1. Quick Start');
    expect(result).toContain('Get up and running in 5 minutes');
    expect(result).toContain('Step 1: Install');
  });

  test('multi-chapter export with complex HTML', () => {
    const chapters = [
      {
        section: { title: 'API Reference', summary: 'REST API documentation' },
        html: `<pre><code>GET /api/users</code></pre>`
      },
      {
        section: { title: 'Examples', summary: 'Code samples' },
        html: `<div class="card"><h3>Example 1</h3><p>Sample code</p></div>`
      }
    ];
    const result = composeExportDocument(chapters);

    expect(result).toContain('GET /api/users');
    expect(result).toContain('class="card"');
    expect(result).toContain('Example 1');
  });

  test('collect and compose workflow', () => {
    const manifest = [
      { id: 'intro', title: 'Introduction', summary: 'Welcome', module: './sections/intro.js' },
      { id: 'guide', title: 'Guide', summary: 'How to use', module: './sections/guide.js' }
    ];

    const sections = collectExportableSections(manifest);
    expect(sections).toHaveLength(2);

    // Simulate loading content (in real app this would be dynamic)
    const chapters = sections.map(section => ({
      section,
      html: `<p>Content for ${section.id}</p>`
    }));

    const result = composeExportDocument(chapters);
    expect(result).toContain('1. Introduction');
    expect(result).toContain('2. Guide');
    expect(result).toContain('Content for intro');
    expect(result).toContain('Content for guide');
  });
});
