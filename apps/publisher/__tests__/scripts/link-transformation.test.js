/**
 * Unit tests for ADR-011: Internal Link Transformation
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: These functions are copied from build-tenants.js for testing.
// Ideally they would be refactored into a separate module and imported.

describe('Link Transformation (ADR-011)', () => {
  // Helper functions that match the implementation
  function isExternalLink(href) {
    if (!href) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      return true;
    }
    if (href.startsWith('//')) {
      return true;
    }
    return false;
  }

  function isFragmentOnly(href) {
    if (!href) return false;
    return href.startsWith('#');
  }

  function isMarkdownLink(href) {
    if (!href) return false;
    const pathname = href.split('#')[0].split('?')[0];
    const ext = path.extname(pathname).toLowerCase();
    return ext === '.md' || ext === '.markdown';
  }

  function normalizeLinkPath(linkPath) {
    if (!linkPath) return '';
    return linkPath
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/\/\.$/, '')
      .replace(/\/+$/, '');
  }

  function resolveLinkPath(linkPath, currentFilePath) {
    const currentDir = path.dirname(currentFilePath);
    let resolvedPath;

    if (linkPath.startsWith('/')) {
      resolvedPath = linkPath.slice(1);
    } else if (linkPath.startsWith('./')) {
      resolvedPath = path.join(currentDir, linkPath.slice(2));
    } else if (linkPath.startsWith('../')) {
      resolvedPath = path.join(currentDir, linkPath);
    } else {
      resolvedPath = path.join(currentDir, linkPath);
    }

    return path.normalize(resolvedPath).replace(/\\/g, '/').replace(/^\/|\/$/g, '');
  }

  const CONTENT_EXTENSIONS = ['.md', '.markdown', '.html', '.htm', '.js', '.mjs'];

  function pathToSectionId(resolvedPath) {
    if (!resolvedPath) return '';

    let withoutExt = resolvedPath;
    for (const ext of CONTENT_EXTENSIONS) {
      if (resolvedPath.toLowerCase().endsWith(ext)) {
        withoutExt = resolvedPath.slice(0, -ext.length);
        break;
      }
    }

    const normalized = withoutExt.replace(/\/index$/i, '');
    return normalized || '';
  }

  function generateSlug(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  describe('isExternalLink', () => {
    test('should identify http links as external', () => {
      expect(isExternalLink('http://example.com')).toBe(true);
      expect(isExternalLink('https://example.com')).toBe(true);
      expect(isExternalLink('HTTPS://EXAMPLE.COM')).toBe(true);
    });

    test('should identify mailto links as external', () => {
      expect(isExternalLink('mailto:user@example.com')).toBe(true);
    });

    test('should identify tel links as external', () => {
      expect(isExternalLink('tel:+1-555-1234')).toBe(true);
    });

    test('should identify protocol-relative URLs as external', () => {
      expect(isExternalLink('//cdn.example.com/asset')).toBe(true);
    });

    test('should identify data URIs as external', () => {
      expect(isExternalLink('data:image/png;base64,abc123')).toBe(true);
    });

    test('should identify javascript links as external', () => {
      expect(isExternalLink('javascript:void(0)')).toBe(true);
    });

    test('should identify relative paths as internal', () => {
      expect(isExternalLink('./sibling.md')).toBe(false);
      expect(isExternalLink('../parent/file.md')).toBe(false);
      expect(isExternalLink('/absolute/path.md')).toBe(false);
    });

    test('should identify fragment links as internal', () => {
      expect(isExternalLink('#section-anchor')).toBe(false);
    });

    test('should treat null/undefined as external', () => {
      expect(isExternalLink(null)).toBe(true);
      expect(isExternalLink(undefined)).toBe(true);
      expect(isExternalLink('')).toBe(true);
    });
  });

  describe('isFragmentOnly', () => {
    test('should identify fragment-only links', () => {
      expect(isFragmentOnly('#section')).toBe(true);
      expect(isFragmentOnly('#')).toBe(true);
      expect(isFragmentOnly('#my-heading')).toBe(true);
    });

    test('should not identify file links as fragment-only', () => {
      expect(isFragmentOnly('./file.md#section')).toBe(false);
      expect(isFragmentOnly('/path/file.md#section')).toBe(false);
    });

    test('should handle null/undefined', () => {
      expect(isFragmentOnly(null)).toBe(false);
      expect(isFragmentOnly(undefined)).toBe(false);
      expect(isFragmentOnly('')).toBe(false);
    });
  });

  describe('isMarkdownLink', () => {
    test('should identify .md files', () => {
      expect(isMarkdownLink('./file.md')).toBe(true);
      expect(isMarkdownLink('../path/file.md')).toBe(true);
      expect(isMarkdownLink('/absolute/file.md')).toBe(true);
    });

    test('should identify .markdown files', () => {
      expect(isMarkdownLink('./file.markdown')).toBe(true);
    });

    test('should handle anchors in markdown links', () => {
      expect(isMarkdownLink('./file.md#section')).toBe(true);
    });

    test('should not identify non-markdown files', () => {
      expect(isMarkdownLink('./file.html')).toBe(false);
      expect(isMarkdownLink('./file.js')).toBe(false);
      expect(isMarkdownLink('./file.txt')).toBe(false);
    });

    test('should handle null/undefined', () => {
      expect(isMarkdownLink(null)).toBe(false);
      expect(isMarkdownLink(undefined)).toBe(false);
      expect(isMarkdownLink('')).toBe(false);
    });
  });

  describe('normalizeLinkPath', () => {
    test('should normalize backslashes to forward slashes', () => {
      expect(normalizeLinkPath('path\\to\\file.md')).toBe('path/to/file.md');
    });

    test('should remove multiple slashes', () => {
      expect(normalizeLinkPath('path//to///file.md')).toBe('path/to/file.md');
    });

    test('should remove trailing slashes', () => {
      expect(normalizeLinkPath('path/to/dir/')).toBe('path/to/dir');
    });

    test('should handle empty/null input', () => {
      expect(normalizeLinkPath('')).toBe('');
      expect(normalizeLinkPath(null)).toBe('');
      expect(normalizeLinkPath(undefined)).toBe('');
    });
  });

  describe('resolveLinkPath', () => {
    // resolveLinkPath only resolves the path, it doesn't strip extensions
    // Extension stripping is done by pathToSectionId
    test('should resolve relative paths with ./', () => {
      expect(resolveLinkPath('./sibling.md', 'getting-started/intro.md'))
        .toBe('getting-started/sibling.md');
    });

    test('should resolve parent paths with ../', () => {
      expect(resolveLinkPath('../reference/api.md', 'getting-started/intro.md'))
        .toBe('reference/api.md');
    });

    test('should resolve absolute paths from content root', () => {
      expect(resolveLinkPath('/reference/api.md', 'getting-started/intro.md'))
        .toBe('reference/api.md');
    });

    test('should resolve implicit relative paths', () => {
      expect(resolveLinkPath('sibling.md', 'getting-started/intro.md'))
        .toBe('getting-started/sibling.md');
    });

    test('should handle deep nesting', () => {
      expect(resolveLinkPath('../../top/file.md', 'a/b/c/deep.md'))
        .toBe('a/top/file.md');
    });
  });

  describe('pathToSectionId', () => {
    test('should strip .md extension', () => {
      expect(pathToSectionId('getting-started/intro.md')).toBe('getting-started/intro');
    });

    test('should strip .markdown extension', () => {
      expect(pathToSectionId('path/file.markdown')).toBe('path/file');
    });

    test('should strip other content extensions', () => {
      expect(pathToSectionId('path/file.html')).toBe('path/file');
      expect(pathToSectionId('path/file.js')).toBe('path/file');
    });

    test('should normalize index files', () => {
      expect(pathToSectionId('getting-started/index.md')).toBe('getting-started');
      expect(pathToSectionId('getting-started/index')).toBe('getting-started');
    });

    test('should handle root index', () => {
      // Note: Root-level index.md becomes 'index' not empty string
      // This is intentional - empty string would be ambiguous
      // The /index pattern only matches dir/index not standalone index
      expect(pathToSectionId('index.md')).toBe('index');
      expect(pathToSectionId('index')).toBe('index');
      // But subdirectory index files normalize correctly
      expect(pathToSectionId('docs/index.md')).toBe('docs');
    });

    test('should handle empty input', () => {
      expect(pathToSectionId('')).toBe('');
      expect(pathToSectionId(null)).toBe('');
      expect(pathToSectionId(undefined)).toBe('');
    });
  });

  describe('generateSlug', () => {
    test('should lowercase text', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    test('should replace spaces with hyphens', () => {
      expect(generateSlug('multiple  spaces')).toBe('multiple-spaces');
    });

    test('should remove special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
    });

    test('should replace underscores with hyphens', () => {
      expect(generateSlug('hello_world')).toBe('hello-world');
    });

    test('should trim leading and trailing hyphens', () => {
      expect(generateSlug('-hello world-')).toBe('hello-world');
    });

    test('should handle empty input', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug(null)).toBe('');
      expect(generateSlug(undefined)).toBe('');
    });

    test('should handle complex headings', () => {
      expect(generateSlug('1. Introduction to ROKO')).toBe('1-introduction-to-roko');
      expect(generateSlug('Why ROKO?')).toBe('why-roko');
      expect(generateSlug('⏱️ Nanosecond Precision')).toBe('nanosecond-precision');
    });
  });

  describe('Full Link Transformation', () => {
    // Integration-style tests combining all functions
    function transformLink(href, currentPath, sectionIndex = null) {
      if (isExternalLink(href)) return href;
      if (isFragmentOnly(href)) return href;
      if (!isMarkdownLink(href)) return href;

      const hashIndex = href.indexOf('#');
      const pathname = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
      const fragment = hashIndex >= 0 ? href.slice(hashIndex) : '';

      const normalizedPath = normalizeLinkPath(pathname);
      const resolvedPath = resolveLinkPath(normalizedPath, currentPath);
      const sectionId = pathToSectionId(resolvedPath);

      return fragment ? `#${sectionId}${fragment}` : `#${sectionId}`;
    }

    test('should transform relative links', () => {
      expect(transformLink('./quick-start.md', 'getting-started/intro.md'))
        .toBe('#getting-started/quick-start');
    });

    test('should transform parent directory links', () => {
      expect(transformLink('../reference/api.md', 'getting-started/intro.md'))
        .toBe('#reference/api');
    });

    test('should preserve fragments', () => {
      expect(transformLink('./installation.md#prerequisites', 'getting-started/intro.md'))
        .toBe('#getting-started/installation#prerequisites');
    });

    test('should not transform external links', () => {
      expect(transformLink('https://example.com', 'any/path.md'))
        .toBe('https://example.com');
    });

    test('should not transform fragment-only links', () => {
      expect(transformLink('#local-section', 'any/path.md'))
        .toBe('#local-section');
    });

    test('should not transform non-markdown links', () => {
      expect(transformLink('./style.css', 'any/path.md'))
        .toBe('./style.css');
    });

    test('should handle deeply nested paths', () => {
      expect(transformLink('../../top/file.md', 'a/b/c/current.md'))
        .toBe('#a/top/file');
    });

    test('should handle absolute paths', () => {
      expect(transformLink('/docs/reference/api.md', 'any/deep/path.md'))
        .toBe('#docs/reference/api');
    });

    test('should handle index files', () => {
      expect(transformLink('./index.md', 'getting-started/intro.md'))
        .toBe('#getting-started');
      // Parent directory index resolves to 'index' (root level)
      expect(transformLink('../index.md', 'getting-started/intro.md'))
        .toBe('#index');
    });
  });
});
