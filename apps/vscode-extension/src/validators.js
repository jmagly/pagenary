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

function validateDocumentText(text, fileName, schema = {}) {
  if (/\.tex$/i.test(fileName)) return validateLatexText(text);
  if (/\.(?:md|markdown)$/i.test(fileName)) return validateMarkdownText(text);
  return validateJsonText(text, fileName, schema);
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
  if (config.inlineLatex) validateInlineLatexConfig(config.inlineLatex, [...basePath, 'inlineLatex'], findings);
  if (config.latexPage) validateLatexPageConfig(config.latexPage, [...basePath, 'latexPage'], findings);
  if (config.richContent) validateRichContentConfig(config.richContent, [...basePath, 'richContent'], findings);
  return findings;
}

function validateInlineLatexConfig(config, path, findings) {
  if (!isObject(config)) return findings.push(finding('`inlineLatex` must be an object.', path));
  booleanKeys(config, ['enabled', 'dollarDelimiters'], path, findings, 'inlineLatex');
  integerRange(config, 'maxSize', 1, 100, path, findings, 'inlineLatex');
  integerRange(config, 'maxExpand', 1, 10000, path, findings, 'inlineLatex');
  for (const forbidden of ['trust', 'strict', 'throwOnError']) {
    if (config[forbidden] !== undefined) findings.push(finding(`\`inlineLatex.${forbidden}\` is immutable and cannot be authored.`, [...path, forbidden]));
  }
}

function validateLatexPageConfig(config, path, findings) {
  if (!isObject(config)) return findings.push(finding('`latexPage` must be an object.', path));
  enumKey(config, 'profile', ['standard-web-v1', 'portable-subset-v1'], path, findings, 'latexPage');
  enumKey(config, 'failurePolicy', ['warn', 'strict', 'off'], path, findings, 'latexPage');
  integerRange(config, 'timeoutMs', 1000, 120000, path, findings, 'latexPage');
  integerRange(config, 'maxOutputBytes', 65536, 16777216, path, findings, 'latexPage');
  for (const forbidden of ['allowShellEscape', 'allowNetwork', 'allowPackageInstall', 'allowAbsolutePaths', 'allowParentTraversal']) {
    if (config[forbidden] !== undefined) findings.push(finding(`\`latexPage.${forbidden}\` is forbidden by the immutable security policy.`, [...path, forbidden]));
  }
  if (config.pdf !== undefined) {
    if (!isObject(config.pdf)) findings.push(finding('`latexPage.pdf` must be an object.', [...path, 'pdf']));
    else {
      booleanKeys(config.pdf, ['enabled'], [...path, 'pdf'], findings, 'latexPage.pdf');
      enumKey(config.pdf, 'profile', ['pdf-v1'], [...path, 'pdf'], findings, 'latexPage.pdf');
      enumKey(config.pdf, 'failurePolicy', ['warn', 'strict'], [...path, 'pdf'], findings, 'latexPage.pdf');
      integerRange(config.pdf, 'maxPdfBytes', 65536, 67108864, [...path, 'pdf'], findings, 'latexPage.pdf');
    }
  }
}

function validateRichContentConfig(config, path, findings) {
  if (!isObject(config)) return findings.push(finding('`richContent` must be an object.', path));
  enumKey(config, 'failurePolicy', ['warn', 'strict', 'off'], path, findings, 'richContent');
  if (config.mermaid !== undefined) {
    if (!isObject(config.mermaid)) findings.push(finding('`richContent.mermaid` must be an object.', [...path, 'mermaid']));
    else {
      enumKey(config.mermaid, 'mode', ['runtime', 'build'], [...path, 'mermaid'], findings, 'richContent.mermaid');
      integerRange(config.mermaid, 'maxSourceBytes', 1, 50000, [...path, 'mermaid'], findings, 'richContent.mermaid');
      integerRange(config.mermaid, 'maxEdges', 1, 500, [...path, 'mermaid'], findings, 'richContent.mermaid');
      integerRange(config.mermaid, 'maxOutputBytes', 65536, 4194304, [...path, 'mermaid'], findings, 'richContent.mermaid');
      for (const key of ['securityLevel', 'secure', 'startOnLoad']) {
        if (config.mermaid[key] !== undefined) findings.push(finding(`\`richContent.mermaid.${key}\` is immutable.`, [...path, 'mermaid', key]));
      }
    }
  }
  if (config.plantuml !== undefined) {
    if (!isObject(config.plantuml)) findings.push(finding('`richContent.plantuml` must be an object.', [...path, 'plantuml']));
    else {
      booleanKeys(config.plantuml, ['enabled', 'pngFallback'], [...path, 'plantuml'], findings, 'richContent.plantuml');
      enumKey(config.plantuml, 'securityProfile', ['SANDBOX'], [...path, 'plantuml'], findings, 'richContent.plantuml');
      integerRange(config.plantuml, 'maxSourceBytes', 1, 131072, [...path, 'plantuml'], findings, 'richContent.plantuml');
      integerRange(config.plantuml, 'maxIncludes', 0, 32, [...path, 'plantuml'], findings, 'richContent.plantuml');
      integerRange(config.plantuml, 'maxOutputBytes', 65536, 4194304, [...path, 'plantuml'], findings, 'richContent.plantuml');
      for (const key of ['allowNetwork', 'allowUrlIncludes', 'allowAbsoluteIncludes']) {
        if (config.plantuml[key] !== undefined) findings.push(finding(`\`richContent.plantuml.${key}\` is forbidden.`, [...path, 'plantuml', key]));
      }
    }
  }
}

function validateMarkdownText(text) {
  const findings = [];
  const source = String(text || '');
  for (const delimiter of [['\\(', '\\)'], ['\\[', '\\]']]) {
    if (countToken(source, delimiter[0]) !== countToken(source, delimiter[1])) {
      findings.push(finding(`Unbalanced inline LaTeX delimiters: ${delimiter.join(' … ')}`, []));
    }
  }
  const fences = [...source.matchAll(/^```(mermaid|plantuml|puml)\b([^\n]*)\n([\s\S]*?)^```\s*$/gmi)];
  for (const match of fences) {
    const renderer = match[1].toLowerCase();
    const metadata = match[2];
    if (!/\btitle=(?:"[^"]+"|'[^']+')/.test(metadata)) {
      findings.push(finding(`${renderer} fence needs a quoted title for an accessible alternative.`, []));
    }
    if (renderer !== 'mermaid' && /!(?:include|includeurl|include_many)\s+(?:https?:|\/|\.\.)/i.test(match[3])) {
      findings.push(finding('PlantUML fence contains a forbidden remote, absolute, or parent include.', []));
    }
  }
  return findings;
}

function validateLatexText(text) {
  const findings = [];
  const source = String(text || '');
  if (!/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/.test(source)) findings.push(finding('Complete LaTeX page needs `\\documentclass{…}`.', []));
  if (!/\\begin\{document\}/.test(source) || !/\\end\{document\}/.test(source)) findings.push(finding('Complete LaTeX page needs matching document environment markers.', []));
  if (/\\(?:immediate\s*)?\\write18|\\(?:openout|openin|read|write)\b|\bhttps?:\/\//i.test(source)) findings.push(finding('LaTeX page contains forbidden shell, file-I/O, or network syntax.', []));
  return findings;
}

function validateSeoConfig(seo, path, findings) {
  if (!seo || typeof seo !== 'object' || Array.isArray(seo)) {
    findings.push(finding('`seo` must be an object.', path));
    return;
  }
  if (seo.discoverabilityProfile !== undefined && !['standard', 'open', 'limited', 'locked'].includes(seo.discoverabilityProfile)) {
    findings.push(finding('`seo.discoverabilityProfile` must be one of `standard`, `open`, `limited`, or `locked`.', [...path, 'discoverabilityProfile']));
  }
  for (const key of ['enabled', 'generateSitemap', 'generateStaticPages', 'generateRobotsTxt', 'generateLlmsTxt', 'generateCorpusArtifacts', 'noIndex']) {
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
  if (seo.aiCrawlers) {
    if (typeof seo.aiCrawlers !== 'object' || Array.isArray(seo.aiCrawlers)) {
      findings.push(finding('`seo.aiCrawlers` must be an object.', [...path, 'aiCrawlers']));
    } else {
      for (const key of ['search', 'aiInput', 'aiTrain']) {
        if (seo.aiCrawlers[key] !== undefined && typeof seo.aiCrawlers[key] !== 'boolean') {
          findings.push(finding(`\`seo.aiCrawlers.${key}\` must be a boolean.`, [...path, 'aiCrawlers', key]));
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

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function booleanKeys(value, keys, path, findings, label) {
  for (const key of keys) if (value[key] !== undefined && typeof value[key] !== 'boolean') {
    findings.push(finding(`\`${label}.${key}\` must be a boolean.`, [...path, key]));
  }
}

function enumKey(value, key, allowed, path, findings, label) {
  if (value[key] !== undefined && !allowed.includes(value[key])) {
    findings.push(finding(`\`${label}.${key}\` must be one of ${allowed.map((item) => `\`${item}\``).join(', ')}.`, [...path, key]));
  }
}

function integerRange(value, key, minimum, maximum, path, findings, label) {
  if (value[key] !== undefined && (!Number.isInteger(value[key]) || value[key] < minimum || value[key] > maximum)) {
    findings.push(finding(`\`${label}.${key}\` must be an integer from ${minimum} through ${maximum}.`, [...path, key]));
  }
}

function countToken(source, token) {
  return source.split(token).length - 1;
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
  validateDocumentText,
  validateJsonText,
  validateTenantRegistry,
  validateTenantConfig,
  validateMarkdownText,
  validateLatexText
};
