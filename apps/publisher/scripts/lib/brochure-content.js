const SCHEMA_VERSION = 'pagenary.brochure.content.v1';
const ENTITY_GROUPS = ['profile', 'offers', 'projects', 'experience', 'updates', 'testimonials', 'links'];
const EXTRACT_POLICIES = new Set(['public', 'private', 'none']);
const ROUTE_ROLES = new Set(['home', 'about', 'work', 'services', 'updates', 'contact', 'machine-readable']);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function safeRoutePath(value) {
  return typeof value === 'string' && value.startsWith('/') &&
    !value.includes('\\') && !value.split('/').includes('..') &&
    !value.includes('\0') && !value.includes('?') && !value.includes('#');
}

function entityEntries(group, value) {
  if (Array.isArray(value)) return value.map((item) => [item?.id, item]);
  if (object(value) && group === 'profile') return [[value.id || 'primary', value]];
  if (object(value)) return Object.entries(value).map(([id, item]) => [id, { id, ...item }]);
  return [];
}

export function validateBrochureContent(input) {
  const errors = [];
  const warnings = [];
  if (!object(input)) return { valid: false, errors: ['content module export must be an object'], warnings, content: null };
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);

  const site = input.site;
  if (!object(site)) errors.push('site must be an object');
  else {
    for (const field of ['title', 'description', 'canonicalUrl', 'language']) {
      if (typeof site[field] !== 'string' || !site[field].trim()) errors.push(`site.${field} is required`);
    }
    if (site.canonicalUrl) {
      try {
        const url = new URL(site.canonicalUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch { errors.push('site.canonicalUrl must be an absolute HTTP(S) URL'); }
    }
    if (!site.socialImage) warnings.push('site.socialImage is recommended');
  }

  const entities = object(input.entities) ? input.entities : {};
  if (!object(input.entities)) errors.push('entities must be an object');
  const entityIds = new Set();
  for (const group of ENTITY_GROUPS) {
    for (const [id, item] of entityEntries(group, entities[group])) {
      if (!id || !object(item)) {
        errors.push(`entities.${group} entries require an id and object value`);
        continue;
      }
      const ref = `${group}.${id}`;
      if (entityIds.has(ref)) errors.push(`duplicate entity ref: ${ref}`);
      entityIds.add(ref);
    }
  }

  if (!Array.isArray(input.routeManifest) || input.routeManifest.length === 0) {
    errors.push('routeManifest must contain at least one route');
  }
  const ids = new Set();
  const paths = new Set();
  const usedRefs = new Set();
  for (const [index, route] of (input.routeManifest || []).entries()) {
    const prefix = `routeManifest[${index}]`;
    if (!object(route)) { errors.push(`${prefix} must be an object`); continue; }
    if (!route.id || typeof route.id !== 'string') errors.push(`${prefix}.id is required`);
    else if (ids.has(route.id)) errors.push(`duplicate route id: ${route.id}`);
    else ids.add(route.id);
    if (!safeRoutePath(route.path)) errors.push(`${prefix}.path must be a safe absolute route path`);
    else if (paths.has(route.path)) errors.push(`duplicate route path: ${route.path}`);
    else paths.add(route.path);
    if (!ROUTE_ROLES.has(route.role)) errors.push(`${prefix}.role is invalid`);
    if (!EXTRACT_POLICIES.has(route.extractPolicy)) errors.push(`${prefix}.extractPolicy is invalid`);
    if (route.extractPolicy === 'public') {
      if (!route.title || !route.summary) errors.push(`${prefix} public routes require title and summary`);
      if (!object(route.prerender) || !route.prerender.kind) errors.push(`${prefix} public routes require prerender.kind`);
    }
    if (route.prerender?.output && (!safeRoutePath(`/${route.prerender.output}`) || route.prerender.output.startsWith('/'))) {
      errors.push(`${prefix}.prerender.output must be a safe relative output path`);
    }
    for (const ref of route.entityRefs || []) {
      usedRefs.add(ref);
      if (!entityIds.has(ref)) errors.push(`${prefix} has dangling entity ref: ${ref}`);
    }
    if (!route.summary) warnings.push(`${prefix}.summary is recommended`);
  }
  for (const ref of entityIds) if (!usedRefs.has(ref)) warnings.push(`unused entity: ${ref}`);

  const allowed = new Set(['schemaVersion', 'templateClass', 'site', 'entities', 'routeManifest', 'extensions']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) warnings.push(`unknown top-level field preserved: ${key}`);
  return { valid: errors.length === 0, errors, warnings, content: input };
}

export function assertBrochureContent(input) {
  const result = validateBrochureContent(input);
  if (!result.valid) throw new Error(`Invalid brochure content:\n${result.errors.map((item) => `- ${item}`).join('\n')}`);
  return result;
}

export { ENTITY_GROUPS, ROUTE_ROLES, SCHEMA_VERSION };
