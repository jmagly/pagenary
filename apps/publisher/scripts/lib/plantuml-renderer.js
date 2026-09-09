import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { defineRendererAdapter } from './rich-content-adapters.js';
import { createRenderDiagnostic, escapeFallbackSource } from './rich-content-diagnostics.js';
import {
  RENDERER_SECURITY_BASELINES,
  RendererSecurityError,
  buildScrubbedRendererEnv,
  redactRendererDiagnostic,
  resolveContainedRendererPath,
  runRendererSubprocess
} from './renderer-security.js';
import authoringContract from './authoring-contract.js';

const { RICH_CONFIG } = authoringContract;

const INCLUDE_DIRECTIVE = /^\s*!(include|include_once)\s+(.+?)\s*$/gim;
const FORBIDDEN_INCLUDE = /^\s*!(includeurl|include_many|import)\b/im;
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const DEFAULT_LIMITS = Object.freeze({ maxSourceBytes: 131072, maxIncludes: 32, maxOutputBytes: 4 * 1024 * 1024 });

export class PlantUmlRendererError extends Error {
  constructor(message, { code = 'RTC_PLANTUML_FAILED', details } = {}) {
    super(message);
    this.name = 'PlantUmlRendererError';
    this.code = code;
    if (details) this.details = details;
  }
}

export function createPlantUmlAdapter(options = {}) {
  const tool = normalizeTool(options);
  const includeProfile = normalizeIncludeProfile(options.includeProfile);
  const toolchain = normalizeToolchain(options);
  const limits = {
    ...DEFAULT_LIMITS,
    ...(options.limits || {}),
    ...(options.maxSourceBytes == null ? {} : { maxSourceBytes: options.maxSourceBytes }),
    ...(options.maxIncludes == null ? {} : { maxIncludes: options.maxIncludes }),
    ...(options.maxOutputBytes == null ? {} : { maxOutputBytes: options.maxOutputBytes })
  };
  return defineRendererAdapter({
    id: 'plantuml',
    version: options.version || 'local',
    profiles: ['SANDBOX'],
    // Security validation remains in render so the shared failure-policy layer can
    // turn it into a warning fallback or a thrown strict-mode failure consistently.
    validate() { return []; },
    async render(node, context = {}) {
      const tenantRoot = path.resolve(context.tenantRoot || options.tenantRoot || process.cwd());
      const authoredSource = String(node.body ?? node.source ?? '');
      const envelopedSource = ensurePlantUmlEnvelope(authoredSource);
      const expanded = await expandContainedIncludes(envelopedSource, {
        tenantRoot,
        sourceRelativePath: node.relativePath || context.sourceRelativePath || null,
        limits,
        includeProfile
      });
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-plantuml-'));
      try {
        const inputPath = path.join(tempDir, 'diagram.puml');
        const outputDir = path.join(tempDir, 'out');
        await fs.mkdir(outputDir);
        await fs.writeFile(inputPath, expanded.source, { encoding: 'utf8', mode: 0o600 });

        await executePlantUml(tool, ['-tsvg', '-charset', 'UTF-8', '-o', outputDir, inputPath], {
          options, tempDir, tenantRoot
        });

        const svgPath = path.join(outputDir, 'diagram.svg');
        const svgBytes = await readBoundedOutput(svgPath, limits.maxOutputBytes, 'SVG');
        const svg = sanitizePlantUmlSvg(svgBytes.toString('utf8'), expanded.source);
        const semanticText = plantUmlSemanticText(expanded.source);
        const assetHash = sha256(svg);
        const assetPath = `assets/rich-content/plantuml/${assetHash.slice(0, 24)}.svg`;
        const assets = [{
          path: assetPath,
          bytes: Buffer.from(svg, 'utf8'),
          mimeType: 'image/svg+xml',
          integrity: `sha256:${assetHash}`
        }];
        let imageMarkup = `<img src="./${assetPath}" alt="${escapeFallbackSource(semanticText || 'PlantUML diagram')}">`;
        if (options.pngFallback === true) {
          await executePlantUml(tool, ['-tpng', '-charset', 'UTF-8', '-o', outputDir, inputPath], {
            options, tempDir, tenantRoot
          });
          const png = await readBoundedOutput(path.join(outputDir, 'diagram.png'), limits.maxOutputBytes, 'PNG');
          if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
            throw new PlantUmlRendererError('PlantUML did not produce a valid PNG fallback.', { code: 'RTC_PLANTUML_INVALID_PNG' });
          }
          const pngHash = sha256(png);
          const pngPath = `assets/rich-content/plantuml/${pngHash.slice(0, 24)}.png`;
          assets.push({ path: pngPath, bytes: png, mimeType: 'image/png', integrity: `sha256:${pngHash}` });
          imageMarkup = `<picture><source type="image/svg+xml" srcset="./${assetPath}"><img src="./${pngPath}" alt="${escapeFallbackSource(semanticText || 'PlantUML diagram')}"></picture>`;
        }
        return {
          html: `<figure class="rich-content rich-content-plantuml" data-renderer="plantuml">${imageMarkup}<figcaption class="sr-only">${escapeFallbackSource(semanticText || 'PlantUML diagram')}</figcaption></figure>`,
          assets,
          semanticText,
          searchText: semanticText,
          source: authoredSource,
          dependencies: expanded.dependencies,
          rendererMetadata: {
            renderer: 'plantuml',
            version: options.version || 'local',
            profile: RENDERER_SECURITY_BASELINES.plantuml.securityProfile,
            includeProfile,
            toolchain,
            cacheIdentity: plantUmlCacheIdentity({ source: expanded.source, dependencies: expanded.dependencies, version: options.version, pngFallback: options.pngFallback === true, includeProfile, toolchain })
          }
        };
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    },
    diagnose: diagnosePlantUmlError,
    dependencies(node, context = {}) {
      return scanPlantUmlIncludes(node.body ?? node.source ?? '', {
        includeProfile,
        tenantRoot: context.tenantRoot || options.tenantRoot,
        sourceRelativePath: node.relativePath || context.sourceRelativePath
      });
    },
    cacheIdentity(node) {
      return plantUmlCacheIdentity({
        source: node.body ?? node.source ?? '',
        version: options.version,
        pngFallback: options.pngFallback === true,
        includeProfile,
        toolchain
      });
    }
  });
}

export async function diagnosePlantUmlTool(options = {}) {
  let tool;
  try {
    tool = normalizeTool(options);
  } catch (error) {
    return { available: false, version: null, diagnostics: diagnosePlantUmlError(error) };
  }
  try {
    const invocation = buildInvocation(tool, ['-version']);
    const result = await runRendererSubprocess({
      ...invocation,
      env: buildScrubbedRendererEnv({
        baseEnv: options.env || process.env,
        overrides: { PLANTUML_SECURITY_PROFILE: 'SANDBOX' }
      }),
      trustedCommands: [invocation.command],
      ...boundedSubprocessOptions(options.subprocess)
    });
    const output = `${result.stdout}\n${result.stderr}`;
    const version = output.match(/PlantUML version\s+([^\s]+)/i)?.[1] || null;
    return {
      available: result.code === 0,
      version,
      securityProfile: 'SANDBOX',
      diagnostics: result.code === 0 ? [] : [createRenderDiagnostic({
        code: 'RTC_PLANTUML_UNAVAILABLE', renderer: 'plantuml',
        message: 'The configured local PlantUML tool did not pass its version check.'
      })]
    };
  } catch (error) {
    return { available: false, version: null, diagnostics: diagnosePlantUmlError(error) };
  }
}

export async function expandContainedIncludes(source, options = {}) {
  const tenantRoot = options.tenantRoot;
  if (!tenantRoot) throw new PlantUmlRendererError('PlantUML rendering requires a tenant root.', { code: 'RTC_PLANTUML_ROOT_REQUIRED' });
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  validateSource(source, limits);
  const includeProfile = normalizeIncludeProfile(options.includeProfile);
  if (INCLUDE_DIRECTIVE.test(String(source)) && includeProfile !== 'ALLOWLIST') {
    INCLUDE_DIRECTIVE.lastIndex = 0;
    throw new PlantUmlRendererError('Tenant-local PlantUML includes require the explicit ALLOWLIST profile.', {
      code: 'RTC_PLANTUML_INCLUDE_DISABLED'
    });
  }
  INCLUDE_DIRECTIVE.lastIndex = 0;
  const dependencies = [];
  const seen = new Set();
  const baseDir = options.sourceRelativePath ? path.posix.dirname(options.sourceRelativePath.replace(/\\/g, '/')) : '';

  async function expand(value, relativeDir) {
    const matches = [...String(value).matchAll(INCLUDE_DIRECTIVE)];
    let result = String(value);
    for (const match of matches) {
      const request = normalizeIncludeRequest(match[2]);
      const relativePath = path.posix.normalize(path.posix.join(relativeDir, request));
      let resolved;
      try {
        resolved = resolveContainedRendererPath(tenantRoot, relativePath);
      } catch (error) {
        throw new PlantUmlRendererError(`PlantUML include is not a contained tenant file: ${request}`, {
          code: 'RTC_PLANTUML_INCLUDE_REJECTED', details: { cause: error.code }
        });
      }
      if (seen.has(resolved)) throw new PlantUmlRendererError('PlantUML include cycle detected.', { code: 'RTC_PLANTUML_INCLUDE_CYCLE' });
      if (dependencies.length >= limits.maxIncludes) throw new PlantUmlRendererError('PlantUML include count exceeds the configured limit.', { code: 'RTC_PLANTUML_INCLUDE_LIMIT' });
      seen.add(resolved);
      const body = await fs.readFile(resolved, 'utf8');
      validateSource(body, limits);
      dependencies.push({ path: relativePath, hash: `sha256:${sha256(body)}` });
      const nested = await expand(body, path.posix.dirname(relativePath));
      result = result.replace(match[0], `' pagenary: begin include ${relativePath}\n${nested}\n' pagenary: end include ${relativePath}`);
      seen.delete(resolved);
    }
    validateSource(result, limits);
    return result;
  }
  return { source: await expand(String(source), baseDir), dependencies };
}

export function scanPlantUmlIncludes(source, options = {}) {
  validateSource(source, DEFAULT_LIMITS);
  const matches = [...String(source).matchAll(INCLUDE_DIRECTIVE)];
  if (matches.length && normalizeIncludeProfile(options.includeProfile) !== 'ALLOWLIST') {
    throw new PlantUmlRendererError('Tenant-local PlantUML includes require the explicit ALLOWLIST profile.', {
      code: 'RTC_PLANTUML_INCLUDE_DISABLED'
    });
  }
  return matches.map((match) => ({ path: normalizeIncludeRequest(match[2]) }));
}

export function ensurePlantUmlEnvelope(source) {
  const text = String(source).trim();
  const start = text.match(/^\s*@start([a-z0-9_-]+)\b/im);
  const end = text.match(/^\s*@end([a-z0-9_-]+)\b/im);
  if (start || end) {
    if (!start || !end || start[1].toLowerCase() !== end[1].toLowerCase()) {
      throw new PlantUmlRendererError('PlantUML start/end directives must be present and match.', {
        code: 'RTC_PLANTUML_ENVELOPE_INVALID'
      });
    }
    return text;
  }
  return `@startuml\n${text}\n@enduml`;
}

export function sanitizePlantUmlSvg(svg, source = '') {
  let clean = String(svg).replace(/<\?[\s\S]*?\?>/g, '').trim();
  if (!/^\s*<svg\b/i.test(clean) || /<!DOCTYPE/i.test(clean)) {
    throw new PlantUmlRendererError('PlantUML did not produce a safe SVG document.', { code: 'RTC_PLANTUML_INVALID_SVG' });
  }
  clean = clean
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])(?!#)[\s\S]*?\1/gi, '')
    .replace(/url\(\s*(['"]?)(?!#)[^)]+\1\s*\)/gi, 'none')
    .replace(/<metadata\b[\s\S]*?<\/metadata\s*>/gi, '')
    .trim();
  const prefix = `puml-${sha256(source).slice(0, 12)}-`;
  const idMap = new Map();
  clean = clean.replace(/\bid=(['"])([^'"]+)\1/g, (all, quote, id) => {
    const replacement = `${prefix}${idMap.size + 1}`;
    idMap.set(id, replacement);
    return `id=${quote}${replacement}${quote}`;
  });
  for (const [oldId, newId] of idMap) clean = clean.split(`#${oldId}`).join(`#${newId}`);
  return clean.replace(/>\s+</g, '><');
}

function normalizeTool(options) {
  const executablePath = options.executablePath || null;
  const jarPath = options.jarPath || null;
  if (Boolean(executablePath) === Boolean(jarPath)) {
    throw new PlantUmlRendererError('Configure exactly one local PlantUML executable path or JAR path.', { code: 'RTC_PLANTUML_UNAVAILABLE' });
  }
  if (executablePath) return { type: 'executable', executablePath: assertAbsolute(executablePath, 'PlantUML executable') };
  return {
    type: 'jar',
    jarPath: assertAbsolute(jarPath, 'PlantUML JAR'),
    javaPath: assertAbsolute(options.javaPath, 'Java executable')
  };
}

function buildInvocation(tool, args) {
  if (tool.type === 'executable') return { command: tool.executablePath, args };
  return { command: tool.javaPath, args: ['-DPLANTUML_SECURITY_PROFILE=SANDBOX', '-jar', tool.jarPath, ...args] };
}

async function executePlantUml(tool, args, { options, tempDir, tenantRoot }) {
  const invocation = buildInvocation(tool, args);
  const result = await runRendererSubprocess({
    ...invocation,
    cwd: tempDir,
    env: buildScrubbedRendererEnv({
      baseEnv: options.env || process.env,
      overrides: { PLANTUML_SECURITY_PROFILE: 'SANDBOX' }
    }),
    trustedCommands: [invocation.command],
    ...boundedSubprocessOptions(options.subprocess)
  });
  if (result.code !== 0) {
    throw new PlantUmlRendererError('Local PlantUML exited unsuccessfully.', {
      code: 'RTC_PLANTUML_PROCESS_FAILED',
      details: redactRendererDiagnostic({ exitCode: result.code, stderr: result.stderr }, {
        rootPaths: [tenantRoot, tempDir]
      })
    });
  }
}

async function readBoundedOutput(file, maxBytes, label) {
  const stat = await fs.stat(file);
  if (stat.size > maxBytes) {
    throw new PlantUmlRendererError(`PlantUML ${label} exceeds the configured output limit.`, {
      code: 'RTC_PLANTUML_OUTPUT_LIMIT'
    });
  }
  return fs.readFile(file);
}

function assertAbsolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new PlantUmlRendererError(`${label} path must be absolute.`, { code: 'RTC_PLANTUML_UNAVAILABLE' });
  }
  return value;
}

function validateSource(source, limits) {
  const text = String(source);
  if (Buffer.byteLength(text) > limits.maxSourceBytes) throw new PlantUmlRendererError('PlantUML source exceeds the configured byte limit.', { code: 'RTC_PLANTUML_SOURCE_LIMIT' });
  if (FORBIDDEN_INCLUDE.test(text)) throw new PlantUmlRendererError('Remote, bulk, and external PlantUML includes are disabled.', { code: 'RTC_PLANTUML_INCLUDE_REJECTED' });
  for (const match of text.matchAll(INCLUDE_DIRECTIVE)) normalizeIncludeRequest(match[2]);
}

function normalizeIncludeRequest(raw) {
  const request = String(raw).trim().replace(/^['"]|['"]$/g, '');
  if (!request || URL_SCHEME.test(request) || request.startsWith('<') || path.isAbsolute(request) || request.split(/[\\/]/).includes('..')) {
    throw new PlantUmlRendererError('PlantUML includes must be contained tenant-relative files.', { code: 'RTC_PLANTUML_INCLUDE_REJECTED' });
  }
  return request.replace(/\\/g, '/');
}

function plantUmlSemanticText(source) {
  return String(source).split(/\r?\n/)
    .filter((line) => !/^\s*(?:@start|@end|!|')/.test(line))
    .map((line) => line.replace(/\b(?:participant|actor|class|interface|entity|database|component|node|usecase)\s+/i, '').trim())
    .filter(Boolean).join(' ');
}

function plantUmlCacheIdentity({ source, dependencies = [], version = 'local', pngFallback = false, includeProfile = 'OFF', toolchain = {} }) {
  return `sha256:${sha256(JSON.stringify({ source: String(source), dependencies, version, securityProfile: 'SANDBOX', includeProfile, toolchain, format: pngFallback ? 'svg+png' : 'svg' }))}`;
}

function normalizeIncludeProfile(value) {
  const profile = value || 'OFF';
  if (!RICH_CONFIG.plantUmlIncludeProfiles.includes(profile)) {
    throw new PlantUmlRendererError('PlantUML includeProfile must be OFF or ALLOWLIST.', {
      code: 'RTC_PLANTUML_INCLUDE_PROFILE_INVALID'
    });
  }
  return profile;
}

function normalizeToolchain(options) {
  return Object.freeze({
    plantuml: String(options.version || 'local'),
    graphviz: String(options.graphvizVersion || 'operator-managed'),
    fonts: [...new Set((Array.isArray(options.fonts) ? options.fonts : []).map(String).filter(Boolean))].sort(),
    digest: String(options.toolchainDigest || 'operator-managed')
  });
}

function boundedSubprocessOptions(overrides = {}) {
  const baseline = RENDERER_SECURITY_BASELINES.subprocess;
  return {
    timeoutMs: Math.min(overrides?.timeoutMs ?? baseline.timeoutMs, baseline.timeoutMs),
    killGraceMs: Math.min(overrides?.killGraceMs ?? baseline.killGraceMs, baseline.killGraceMs),
    maxOutputBytes: Math.min(overrides?.maxOutputBytes ?? baseline.maxOutputBytes, baseline.maxOutputBytes),
    maxErrorBytes: Math.min(overrides?.maxErrorBytes ?? baseline.maxErrorBytes, baseline.maxErrorBytes)
  };
}

function diagnosePlantUmlError(error) {
  const safe = redactRendererDiagnostic({ message: error?.message || String(error), details: error?.details || {} });
  return [createRenderDiagnostic({
    code: error?.code || (error instanceof RendererSecurityError ? error.code : 'RTC_PLANTUML_FAILED'),
    severity: 'error', renderer: 'plantuml', profile: 'SANDBOX', message: safe.message, details: safe.details
  })];
}

function sha256(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
}
