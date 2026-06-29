/**
 * Template registry + frontmatter schemas (#90, ADR-016 phase 4).
 *
 * Promotes the informal per-section "category" (inferred from the id, see
 * `categories.js` + `section-templates.js`) into a first-class **template
 * registry**. A template is `{ id, schema? }`:
 *   - `id`     — the declared template name (`template: "<id>"`)
 *   - `schema` — optional JSON-Schema (a small subset) for the section's
 *                frontmatter. When present, the build validates each declaring
 *                section's frontmatter and fails with a precise error — the same
 *                way `check:seo` / `lint:content` gate.
 *
 * Templates and layouts (shells) are orthogonal: a `post` template can render in
 * the `blog` shell, a `guide` template in `docs`. Declaring a template is opt-in;
 * absent a declaration, `inferCategory(id)` remains the default (no regression).
 *
 * Pure module: no DOM, no Node. Imported by both the build and (potentially) the
 * runtime, so it stays dependency-free — the validator is a hand-rolled subset of
 * JSON Schema, not an external library.
 */

import { inferCategory } from './categories.js';

/**
 * Reference frontmatter schemas. The supported subset:
 *   { type:'object', required:[...], properties:{ <k>: { type, format?, items? } } }
 * where `type` ∈ string|number|boolean|array, string `format:'date'`, and array
 * `items:{ type }`. Additional frontmatter keys are always allowed.
 */
export const TEMPLATE_SCHEMAS = {
  // A blog post. `date` is required so the chronological index can sort it.
  post: {
    type: 'object',
    required: ['date'],
    properties: {
      title: { type: 'string' },
      date: { type: 'string', format: 'date' },
      summary: { type: 'string' },
      author: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } }
    }
  },
  // A docs guide. `title` is required so nav + metadata never fall back to the id.
  guide: {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' }
    }
  }
};

/** The template registry: id → { id, schema? }. */
export const TEMPLATE_REGISTRY = Object.fromEntries(
  Object.entries(TEMPLATE_SCHEMAS).map(([id, schema]) => [id, { id, schema }])
);

/**
 * Look up a registered template by id.
 * @param {string} id
 * @returns {{id:string, schema?:object}|null}
 */
export function getTemplate(id) {
  if (typeof id !== 'string') return null;
  return TEMPLATE_REGISTRY[id] || null;
}

/**
 * Resolve the active template id for a section: an explicit declaration wins;
 * otherwise fall back to the inferred category (today's default behavior).
 * @param {unknown} declared - declared template (frontmatter/manifest `template`)
 * @param {string}  sectionId
 * @returns {string}
 */
export function resolveTemplate(declared, sectionId) {
  if (typeof declared === 'string' && declared.trim()) return declared.trim();
  return inferCategory(sectionId);
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function isDateString(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  // Accept YYYY-MM-DD or a fuller ISO/Date-parseable timestamp.
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * Validate a value against one property schema. Returns an array of error
 * strings (empty = valid).
 * @param {string} key - property name (for messages)
 * @param {unknown} value
 * @param {object} propSchema - { type, format?, items? }
 * @returns {string[]}
 */
function validateProperty(key, value, propSchema) {
  const errors = [];
  if (!propSchema || typeof propSchema !== 'object') return errors;
  const actual = typeOf(value);

  if (propSchema.type && actual !== propSchema.type) {
    errors.push(`"${key}" must be of type ${propSchema.type} (got ${actual})`);
    return errors; // type mismatch — skip deeper checks
  }
  if (propSchema.type === 'string' && propSchema.format === 'date' && !isDateString(value)) {
    errors.push(`"${key}" must be a date (YYYY-MM-DD), got ${JSON.stringify(value)}`);
  }
  if (propSchema.type === 'array' && propSchema.items && propSchema.items.type) {
    value.forEach((item, i) => {
      const itemType = typeOf(item);
      if (itemType !== propSchema.items.type) {
        errors.push(`"${key}[${i}]" must be of type ${propSchema.items.type} (got ${itemType})`);
      }
    });
  }
  return errors;
}

/**
 * Validate a frontmatter object against a (subset) JSON Schema.
 * @param {object} schema
 * @param {object} data - parsed frontmatter
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgainstSchema(schema, data) {
  const errors = [];
  if (!schema || typeof schema !== 'object') return { valid: true, errors };
  const obj = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};

  for (const req of Array.isArray(schema.required) ? schema.required : []) {
    const v = obj[req];
    if (v === undefined || v === null || v === '') {
      errors.push(`missing required field "${req}"`);
    }
  }
  if (schema.properties && typeof schema.properties === 'object') {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (obj[key] === undefined || obj[key] === null) continue; // optional unless required (handled above)
      errors.push(...validateProperty(key, obj[key], propSchema));
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a section's frontmatter against its declared template's schema.
 * No-ops (valid) when the template is unknown or has no schema, so undeclared /
 * non-registry templates never gate the build.
 * @param {string} templateId
 * @param {object} frontmatter
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFrontmatter(templateId, frontmatter) {
  const template = getTemplate(templateId);
  if (!template || !template.schema) return { valid: true, errors: [] };
  return validateAgainstSchema(template.schema, frontmatter || {});
}
