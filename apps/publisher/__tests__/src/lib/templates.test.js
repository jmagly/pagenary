/**
 * Tests for lib/templates.js (#90, ADR-016 phase 4)
 * Tests the ACTUAL source code - no logic duplication.
 */

import {
  TEMPLATE_SCHEMAS,
  TEMPLATE_REGISTRY,
  getTemplate,
  resolveTemplate,
  validateAgainstSchema,
  validateFrontmatter
} from '../../../src/lib/templates.js';

describe('lib/templates.js', () => {
  describe('registry', () => {
    test('ships post + guide reference templates', () => {
      expect(getTemplate('post')).toMatchObject({ id: 'post' });
      expect(getTemplate('guide')).toMatchObject({ id: 'guide' });
      expect(getTemplate('post').schema).toBe(TEMPLATE_SCHEMAS.post);
    });

    test('unknown template is null', () => {
      expect(getTemplate('nope')).toBeNull();
      expect(getTemplate(undefined)).toBeNull();
    });

    test('registry derived from schemas', () => {
      expect(Object.keys(TEMPLATE_REGISTRY).sort()).toEqual(['guide', 'post']);
    });
  });

  describe('resolveTemplate', () => {
    test('explicit declaration wins', () => {
      expect(resolveTemplate('post', 'blog/whatever')).toBe('post');
      expect(resolveTemplate('  guide  ', 'x')).toBe('guide');
    });

    test('falls back to inferred category when undeclared', () => {
      // inferCategory: getting-started -> 'guide'
      expect(resolveTemplate(undefined, 'getting-started-intro')).toBe('guide');
      // welcome -> 'welcome'
      expect(resolveTemplate('', 'welcome-overview')).toBe('welcome');
      // unknown id -> 'default'
      expect(resolveTemplate(null, 'totally-unknown')).toBe('default');
    });
  });

  describe('validateAgainstSchema', () => {
    test('passes when required present and types match', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, {
        title: 'Hi', date: '2026-06-01', tags: ['a', 'b']
      });
      expect(r).toEqual({ valid: true, errors: [] });
    });

    test('flags missing required field', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, { title: 'Hi' });
      expect(r.valid).toBe(false);
      expect(r.errors.join(' ')).toMatch(/missing required field "date"/);
    });

    test('flags wrong scalar type', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, { date: '2026-01-01', title: 42 });
      expect(r.valid).toBe(false);
      expect(r.errors.join(' ')).toMatch(/"title" must be of type string \(got number\)/);
    });

    test('flags bad date format', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, { date: 'last tuesday' });
      expect(r.valid).toBe(false);
      expect(r.errors.join(' ')).toMatch(/"date" must be a date/);
    });

    test('accepts ISO timestamp for date', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, { date: '2026-06-01T10:00:00Z' });
      expect(r.valid).toBe(true);
    });

    test('flags wrong array item type', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.post, { date: '2026-01-01', tags: ['ok', 7] });
      expect(r.valid).toBe(false);
      expect(r.errors.join(' ')).toMatch(/"tags\[1\]" must be of type string \(got number\)/);
    });

    test('flags array where scalar expected', () => {
      const r = validateAgainstSchema(TEMPLATE_SCHEMAS.guide, { title: ['nope'] });
      expect(r.valid).toBe(false);
      expect(r.errors.join(' ')).toMatch(/"title" must be of type string \(got array\)/);
    });

    test('empty schema is always valid', () => {
      expect(validateAgainstSchema(null, { anything: 1 })).toEqual({ valid: true, errors: [] });
    });
  });

  describe('validateFrontmatter', () => {
    test('unknown / schemaless template never gates', () => {
      expect(validateFrontmatter('default', {})).toEqual({ valid: true, errors: [] });
      expect(validateFrontmatter('nonexistent', { foo: 1 })).toEqual({ valid: true, errors: [] });
    });

    test('post requires date', () => {
      expect(validateFrontmatter('post', { title: 'x' }).valid).toBe(false);
      expect(validateFrontmatter('post', { date: '2026-06-01' }).valid).toBe(true);
    });

    test('guide requires title', () => {
      expect(validateFrontmatter('guide', {}).valid).toBe(false);
      expect(validateFrontmatter('guide', { title: 'Setup' }).valid).toBe(true);
    });
  });
});
