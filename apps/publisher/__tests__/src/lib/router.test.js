/**
 * Tests for lib/router.js
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  currentSectionId,
  resolveTarget,
  resolveEntry
} from '../../../src/lib/router.js';

// Test data - simulates manifest structure
const TEST_SECTIONS = new Map([
  ['welcome-overview', { id: 'welcome-overview', title: 'Welcome', module: './sections/welcome-overview.js' }],
  ['getting-started', {
    id: 'getting-started',
    title: 'Getting Started',
    subsections: [
      { id: 'getting-started-introduction', title: 'Introduction', module: './sections/getting-started-introduction.js' },
      { id: 'getting-started-architecture-basics', title: 'Platform Fundamentals', module: './sections/getting-started-architecture-basics.js' }
    ]
  }],
  ['getting-started-introduction', { id: 'getting-started-introduction', title: 'Introduction', module: './sections/getting-started-introduction.js', parentId: 'getting-started' }],
  ['getting-started-architecture-basics', { id: 'getting-started-architecture-basics', title: 'Platform Fundamentals', module: './sections/getting-started-architecture-basics.js', parentId: 'getting-started' }],
  ['developers', {
    id: 'developers',
    title: 'Developers',
    subsections: [
      { id: 'developers-overview', title: 'Developer Hub', module: './sections/developers-overview.js' },
      { id: 'developers-sdks', title: 'Developers SDKs', module: './sections/developers-sdks.js' },
      { id: 'developers-api-reference', title: 'Developers API Reference', module: './sections/developers-api-reference.js' }
    ]
  }],
  ['developers-overview', { id: 'developers-overview', title: 'Developer Hub', module: './sections/developers-overview.js', parentId: 'developers' }],
  ['developers-sdks', { id: 'developers-sdks', title: 'Developers SDKs', module: './sections/developers-sdks.js', parentId: 'developers' }],
  ['developers-api-reference', { id: 'developers-api-reference', title: 'Developers API Reference', module: './sections/developers-api-reference.js', parentId: 'developers' }],
  ['guides', {
    id: 'guides',
    title: 'Guides',
    module: './sections/guides.js',
    subsections: [
      { id: 'guides-install', title: 'Install', module: './sections/guides-install.js' }
    ]
  }],
  ['guides-install', { id: 'guides-install', title: 'Install', module: './sections/guides-install.js', parentId: 'guides' }]
]);

const DEFAULT_SECTION = 'welcome-overview';

function findSection(id) {
  return TEST_SECTIONS.get(id) || null;
}

describe('lib/router.js', () => {
  describe('currentSectionId', () => {
    test('extracts section ID from hash', () => {
      expect(currentSectionId('#welcome-overview', DEFAULT_SECTION)).toBe('welcome-overview');
      expect(currentSectionId('#developers-api-reference', DEFAULT_SECTION)).toBe('developers-api-reference');
    });

    test('returns default section for empty hash', () => {
      expect(currentSectionId('', DEFAULT_SECTION)).toBe(DEFAULT_SECTION);
      expect(currentSectionId('#', DEFAULT_SECTION)).toBe(DEFAULT_SECTION);
    });

    test('handles hash with just the pound sign', () => {
      expect(currentSectionId('#', DEFAULT_SECTION)).toBe(DEFAULT_SECTION);
    });

    test('returns hash content even if section does not exist', () => {
      expect(currentSectionId('#non-existent', DEFAULT_SECTION)).toBe('non-existent');
    });
  });

  describe('resolveTarget', () => {
    test('resolves leaf section to itself', () => {
      const result = resolveTarget('welcome-overview', findSection);
      expect(result.targetId).toBe('welcome-overview');
      expect(result.parentId).toBeNull();
    });

    test('resolves subsection with parent reference', () => {
      const result = resolveTarget('getting-started-introduction', findSection);
      expect(result.targetId).toBe('getting-started-introduction');
      expect(result.parentId).toBe('getting-started');
    });

    test('resolves group to first subsection', () => {
      const result = resolveTarget('getting-started', findSection);
      expect(result.targetId).toBe('getting-started-introduction');
      expect(result.parentId).toBe('getting-started');
    });

    test('resolves authored group with module to itself', () => {
      const result = resolveTarget('guides', findSection);
      expect(result.targetId).toBe('guides');
      expect(result.parentId).toBeNull();
    });

    test('resolves developers group to first subsection', () => {
      const result = resolveTarget('developers', findSection);
      expect(result.targetId).toBe('developers-overview');
      expect(result.parentId).toBe('developers');
    });

    test('returns passed ID for non-existent section', () => {
      const result = resolveTarget('non-existent', findSection);
      expect(result.targetId).toBe('non-existent');
      expect(result.parentId).toBeNull();
    });
  });

  describe('resolveEntry', () => {
    test('resolves leaf section entry', () => {
      const result = resolveEntry('welcome-overview', findSection);
      expect(result).not.toBeNull();
      expect(result.entry.id).toBe('welcome-overview');
      expect(result.entry.title).toBe('Welcome');
      expect(result.targetId).toBe('welcome-overview');
      expect(result.parentId).toBeNull();
    });

    test('resolves subsection entry with parent', () => {
      const result = resolveEntry('developers-api-reference', findSection);
      expect(result).not.toBeNull();
      expect(result.entry.id).toBe('developers-api-reference');
      expect(result.parentId).toBe('developers');
    });

    test('resolves group to first subsection entry', () => {
      const result = resolveEntry('getting-started', findSection);
      expect(result).not.toBeNull();
      expect(result.entry.id).toBe('getting-started-introduction');
      expect(result.targetId).toBe('getting-started-introduction');
      expect(result.parentId).toBe('getting-started');
    });

    test('returns null for non-existent section', () => {
      const result = resolveEntry('non-existent', findSection);
      expect(result).toBeNull();
    });

    test('entry has module path for navigation', () => {
      const result = resolveEntry('developers-sdks', findSection);
      expect(result.entry.module).toBe('./sections/developers-sdks.js');
    });
  });
});

describe('navigation flow scenarios', () => {
  test('direct navigation to leaf section', () => {
    const sectionId = 'welcome-overview';
    const resolved = resolveEntry(sectionId, findSection);

    expect(resolved.targetId).toBe('welcome-overview');
    expect(resolved.entry.module).toBeDefined();
    expect(resolved.parentId).toBeNull();
  });

  test('navigation to subsection expands parent group', () => {
    const sectionId = 'getting-started-introduction';
    const resolved = resolveEntry(sectionId, findSection);

    expect(resolved.targetId).toBe('getting-started-introduction');
    expect(resolved.parentId).toBe('getting-started');
    expect(resolved.entry.module).toBeDefined();
  });

  test('clicking group header shows first subsection', () => {
    const groupId = 'developers';
    const resolved = resolveEntry(groupId, findSection);

    expect(resolved.targetId).toBe('developers-overview');
    expect(resolved.parentId).toBe('developers');
    expect(resolved.entry.id).toBe('developers-overview');
  });

  test('hash navigation simulates browser behavior', () => {
    const hash = '#developers-sdks';
    const sectionId = currentSectionId(hash, DEFAULT_SECTION);
    const resolved = resolveEntry(sectionId, findSection);

    expect(sectionId).toBe('developers-sdks');
    expect(resolved.entry.id).toBe('developers-sdks');
    expect(resolved.parentId).toBe('developers');
  });

  test('empty hash loads default section', () => {
    const hash = '';
    const sectionId = currentSectionId(hash, DEFAULT_SECTION);
    const resolved = resolveEntry(sectionId, findSection);

    expect(sectionId).toBe(DEFAULT_SECTION);
    expect(resolved.entry.id).toBe('welcome-overview');
  });

  test('invalid hash returns null entry', () => {
    const hash = '#invalid-section';
    const sectionId = currentSectionId(hash, DEFAULT_SECTION);
    const resolved = resolveEntry(sectionId, findSection);

    expect(sectionId).toBe('invalid-section');
    expect(resolved).toBeNull();
  });
});

describe('edge cases', () => {
  test('handles section ID with special characters in hash', () => {
    const hash = '#developers-api-reference';
    const sectionId = currentSectionId(hash, DEFAULT_SECTION);
    expect(sectionId).toBe('developers-api-reference');
  });

  test('resolveTarget handles undefined gracefully', () => {
    expect(() => resolveTarget(undefined, findSection)).not.toThrow();
    const result = resolveTarget(undefined, findSection);
    expect(result.targetId).toBeUndefined();
    expect(result.parentId).toBeNull();
  });

  test('resolveEntry handles empty string', () => {
    const result = resolveEntry('', findSection);
    expect(result).toBeNull();
  });

  test('nested navigation maintains parent context', () => {
    const first = resolveEntry('developers-overview', findSection);
    const second = resolveEntry('developers-sdks', findSection);
    const third = resolveEntry('developers-api-reference', findSection);

    expect(first.parentId).toBe('developers');
    expect(second.parentId).toBe('developers');
    expect(third.parentId).toBe('developers');
  });
});
