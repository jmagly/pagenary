'use strict';

const RICH_FENCE_PATTERN = '^```(mermaid|plantuml|puml)([^\\n]*)\\n([\\s\\S]*?)^```\\s*$';
const RICH_CONFIG = Object.freeze({
  failurePolicies: Object.freeze(['warn', 'strict', 'off']),
  mermaidModes: Object.freeze(['runtime', 'build']),
  mermaidThemes: Object.freeze(['default', 'neutral', 'forest', 'dark', 'base']),
  plantUmlSecurityProfiles: Object.freeze(['SANDBOX']),
  plantUmlIncludeProfiles: Object.freeze(['OFF', 'ALLOWLIST'])
});

function scanRichFences(source) {
  return [...String(source || '').matchAll(new RegExp(RICH_FENCE_PATTERN, 'gmi'))];
}

function parseRichFenceInfo(language, metadata = '') {
  const authored = String(language || '').toLowerCase();
  const renderer = authored === 'puml' ? 'plantuml' : authored;
  const title = String(metadata).match(/\btitle=(?:"([^"]*)"|'([^']*)')/)?.slice(1).find((value) => value !== undefined) || '';
  return Object.freeze({ authored, renderer, title });
}

function hasRichAuthoringSyntax(source) {
  const text = String(source || '');
  return /\\[([]/.test(text) || scanRichFences(text).length > 0;
}

module.exports = { RICH_CONFIG, RICH_FENCE_PATTERN, hasRichAuthoringSyntax, parseRichFenceInfo, scanRichFences };
