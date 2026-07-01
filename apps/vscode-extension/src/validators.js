'use strict';

const TENANT_ID_FALLBACK = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

function validateJsonText(text, fileName, schema = {}) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return [jsonParseFinding(err)];
  }

  if (isTenantRegistry(data, fileName)) {
    return validateTenantRegistry(data, schema);
  }
  return validateTenantConfig(data);
}

function isTenantRegistry(data, fileName = '') {
  return Array.isArray(data?.tenants) || /(^|[\\/])tenants(?:\.[\w-]+)?\.json$/i.test(fileName);
}

function validateTenantRegistry(data, schema = {}) {
  const findings = [];
  const tenantPattern = resolveTenantIdPattern(schema);

  if (!Array.isArray(data.tenants)) {
    findings.push(finding('Tenant registry must define a `tenants` array.', ['tenants']));
    return findings;
  }

  data.tenants.forEach((tenant, index) => {
    const path = ['tenants', index];
    if (!tenant || typeof tenant !== 'object' || Array.isArray(tenant)) {
      findings.push(finding('Tenant entry must be an object.', path));
      return;
    }
    if (typeof tenant.id !== 'string' || !tenantPattern.test(tenant.id)) {
      findings.push(finding('Tenant `id` must match the Pagenary tenant id pattern.', [...path, 'id']));
    }
    validateSource(tenant.source, [...path, 'source'], findings);
    if (tenant.config) {
      findings.push(...validateTenantConfig(tenant.config, [...path, 'config']));
    }
  });

  return findings;
}

function validateSource(source, path, findings) {
  if (source === undefined) return;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    findings.push(finding('Tenant `source` must be an object.', path));
    return;
  }
  if (source.type === 'git') {
    if (typeof source.url !== 'string' || !source.url.trim()) {
      findings.push(finding('Git tenant source requires a non-empty `url`.', [...path, 'url']));
    }
    return;
  }
  if (source.type && source.type !== 'local') {
    findings.push(finding('Tenant source `type` must be `local` or `git`.', [...path, 'type']));
  }
  if (typeof source.path !== 'string' || !source.path.trim()) {
    findings.push(finding('Local tenant source requires a non-empty `path`.', [...path, 'path']));
  }
}

function validateTenantConfig(config, basePath = []) {
  const findings = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return [finding('Tenant config must be a JSON object.', basePath)];
  }

  if (config.seo) validateSeoConfig(config.seo, [...basePath, 'seo'], findings);
  if (config.export) validateExportConfig(config.export, [...basePath, 'export'], findings);
  return findings;
}

function validateSeoConfig(seo, path, findings) {
  if (!seo || typeof seo !== 'object' || Array.isArray(seo)) {
    findings.push(finding('`seo` must be an object.', path));
    return;
  }
  for (const key of ['enabled', 'generateSitemap', 'generateStaticPages', 'generateRobotsTxt', 'noIndex']) {
    if (seo[key] !== undefined && typeof seo[key] !== 'boolean') {
      findings.push(finding(`\`seo.${key}\` must be a boolean.`, [...path, key]));
    }
  }
  if (seo.robots) {
    if (typeof seo.robots !== 'object' || Array.isArray(seo.robots)) {
      findings.push(finding('`seo.robots` must be an object.', [...path, 'robots']));
    } else {
      for (const key of ['allow', 'disallow']) {
        if (seo.robots[key] !== undefined && !isStringArray(seo.robots[key])) {
          findings.push(finding(`\`seo.robots.${key}\` must be an array of strings.`, [...path, 'robots', key]));
        }
      }
      for (const key of ['sitemap', 'blockAll']) {
        if (seo.robots[key] !== undefined && typeof seo.robots[key] !== 'boolean') {
          findings.push(finding(`\`seo.robots.${key}\` must be a boolean.`, [...path, 'robots', key]));
        }
      }
    }
  }
}

function validateExportConfig(exportConfig, path, findings) {
  if (!exportConfig || typeof exportConfig !== 'object' || Array.isArray(exportConfig)) {
    findings.push(finding('`export` must be an object.', path));
    return;
  }
  if (exportConfig.enabled !== undefined && typeof exportConfig.enabled !== 'boolean') {
    findings.push(finding('`export.enabled` must be a boolean.', [...path, 'enabled']));
  }
  if (exportConfig.scopes !== undefined) {
    if (!Array.isArray(exportConfig.scopes) || exportConfig.scopes.some((scope) => !['page', 'site'].includes(scope))) {
      findings.push(finding('`export.scopes` must contain only `page` and/or `site`.', [...path, 'scopes']));
    }
  }
  if (exportConfig.watermark !== undefined) {
    const watermark = exportConfig.watermark;
    const valid = typeof watermark === 'string'
      || (watermark && typeof watermark === 'object' && !Array.isArray(watermark)
        && (watermark.enabled === undefined || typeof watermark.enabled === 'boolean')
        && typeof watermark.text === 'string');
    if (!valid) {
      findings.push(finding('`export.watermark` must be a string or `{ enabled, text }` object.', [...path, 'watermark']));
    }
  }
}

function resolveTenantIdPattern(schema) {
  const pattern = schema?.definitions?.tenant?.properties?.id?.pattern;
  if (!pattern) return TENANT_ID_FALLBACK;
  return new RegExp(pattern);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function jsonParseFinding(err) {
  const match = /position (\d+)/i.exec(err.message || '');
  return {
    message: `Invalid JSON: ${err.message}`,
    path: [],
    offset: match ? Number(match[1]) : 0
  };
}

function finding(message, path) {
  return { message, path };
}

module.exports = {
  validateJsonText,
  validateTenantRegistry,
  validateTenantConfig
};
