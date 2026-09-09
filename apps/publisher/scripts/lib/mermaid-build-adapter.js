import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { defineRendererAdapter } from './rich-content-adapters.js';
import { createRenderDiagnostic, fallbackHtmlForSource } from './rich-content-diagnostics.js';
import {
  RENDERER_SECURITY_BASELINES,
  buildScrubbedRendererEnv,
  deepFreeze,
  runRendererSubprocess
} from './renderer-security.js';
import authoringContract from './authoring-contract.js';

const { RICH_CONFIG } = authoringContract;

const VERSION = '11.16.0';
const DEFAULT_MAX_SOURCE_BYTES = RENDERER_SECURITY_BASELINES.mermaid.maxTextSize;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export function deterministicMermaidId(source, config = {}, renderIdentity = {}) {
  const digest = createHash('sha256')
    .update(String(source))
    .update('\0')
    .update(stableJson(config))
    .update('\0')
    .update(stableJson(renderIdentity))
    .digest('hex')
    .slice(0, 20);
  return `pagenary-mermaid-${digest}`;
}

export function sanitizeMermaidSvg(input, options = {}) {
  const maxOutputBytes = positiveInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES);
  let svg = String(input || '');
  if (Buffer.byteLength(svg, 'utf8') > maxOutputBytes) {
    throw mermaidError('MERMAID_OUTPUT_LIMIT', `Mermaid SVG exceeds the ${maxOutputBytes} byte output limit`);
  }
  if (!/^\s*<svg\b/i.test(svg)) {
    throw mermaidError('MERMAID_INVALID_SVG', 'Mermaid renderer did not return an SVG document');
  }

  // Mermaid is executed with securityLevel=strict. This second boundary removes
  // active SVG content before the result is admitted to a generated page.
  svg = svg
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:script|foreignObject|iframe|object|embed|audio|video)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, '')
    .replace(/\s+style\s*=\s*(["'])(?:(?!\1)[\s\S])*(?:url\s*\(|expression\s*\(|@import)[\s\S]*?\1/gi, '');

  if (/<\/?(?:script|foreignObject|iframe|object|embed)\b/i.test(svg) || /\son[a-z][\w:-]*\s*=/i.test(svg)) {
    throw mermaidError('MERMAID_UNSAFE_SVG', 'Mermaid SVG contains active content after sanitization');
  }
  return svg;
}

export function createMermaidBuildAdapter(options = {}) {
  const maxSourceBytes = positiveInteger(options.maxSourceBytes, DEFAULT_MAX_SOURCE_BYTES);
  const maxEdges = positiveInteger(options.maxEdges, RENDERER_SECURITY_BASELINES.mermaid.maxEdges);
  const maxOutputBytes = positiveInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES);
  const injectedRenderer = options.renderer || null;
  const configuredMermaid = {
    ...(options.config && typeof options.config === 'object' ? options.config : {}),
    ...(options.theme ? { theme: options.theme } : {})
  };
  const renderIdentity = deepFreeze({
    renderer: `@mermaid-js/mermaid-cli@${VERSION}`,
    outputFormat: 'svg',
    theme: String(configuredMermaid.theme || 'default'),
    fonts: normalizeFonts(options.fonts)
  });

  return defineRendererAdapter({
    id: 'mermaid',
    version: VERSION,
    profiles: ['build'],
    dependencies: () => [{ package: 'mermaid', version: VERSION }],
    cacheIdentity(node, context = {}) {
      const source = node.body || node.source || '';
      const config = secureConfig(context.mermaidConfig || configuredMermaid);
      return { source, config, ...renderIdentity, profile: 'build' };
    },
    async render(node, context = {}) {
      const source = String(node.body || node.source || '');
      enforceBounds(source, { maxSourceBytes, maxEdges });
      const config = secureConfig(context.mermaidConfig || configuredMermaid);
      const identity = { ...renderIdentity, theme: String(config.theme || 'default') };
      const id = deterministicMermaidId(source, config, identity);
      const renderer = injectedRenderer || context.mermaidRenderer || createCliRenderer(options);

      const rendered = await renderer({ id, source, config });
      const rawSvg = typeof rendered === 'string' ? rendered : rendered?.svg;
      const svg = decorateSvg(sanitizeMermaidSvg(rawSvg, { maxOutputBytes }), id);
      const caption = diagramCaption(node);
      const sourceFallback = fallbackHtmlForSource(source);
      const sourceDigest = sha256(source);
      const outputDigest = sha256(svg);
      const assetPath = `assets/rich-content/mermaid/${outputDigest.slice(0, 24)}.svg`;
      const html = `<figure class="rich-diagram rich-diagram--mermaid" data-renderer="mermaid" data-render-mode="build" data-render-id="${id}"><img src="./${assetPath}" alt="${escapeHtml(caption)}" aria-describedby="${id}-caption"><figcaption id="${id}-caption">${escapeHtml(caption)}</figcaption><details class="rich-diagram__source"><summary>Mermaid source</summary>${sourceFallback}</details></figure>`;

      return {
        html,
        assets: [{
          path: assetPath,
          bytes: Buffer.from(svg, 'utf8'),
          mimeType: 'image/svg+xml',
          integrity: `sha256:${outputDigest}`
        }],
        source,
        semanticText: `${caption}\n${source}`,
        searchText: `${caption}\n${source}`,
        dependencies: [{ package: 'mermaid', version: VERSION }],
        rendererMetadata: {
          renderer: 'mermaid',
          version: VERSION,
          profile: 'build',
          renderId: id,
          cacheIdentity: sha256(stableJson({ sourceDigest, config, version: VERSION, ...identity })),
          provenance: deepFreeze({
            schema: 'pagenary.rich-content.provenance.v1',
            renderer: `mermaid@${VERSION}`,
            mode: 'build',
            sourceDigest: `sha256:${sourceDigest}`,
            outputDigest: `sha256:${outputDigest}`
          })
        }
      };
    },
    diagnose(error, node) {
      return [createRenderDiagnostic({
        code: error?.code || 'MERMAID_RENDER_FAILED',
        severity: 'error',
        renderer: 'mermaid',
        profile: 'build',
        message: error?.message || 'Mermaid build-time rendering failed',
        location: node.location || null
      })];
    }
  });
}

function createCliRenderer(options) {
  const executablePath = assertAbsoluteExecutable(options.executablePath);
  const browserPath = assertAbsoluteExecutable(options.browserPath, 'Mermaid browser');
  return async ({ source, config }) => {
    const tempDir = await fs.mkdtemp(path.join(options.tempRoot || os.tmpdir(), 'pagenary-mermaid-'));
    try {
      const inputPath = path.join(tempDir, 'diagram.mmd');
      const outputPath = path.join(tempDir, 'diagram.svg');
      const configPath = path.join(tempDir, 'mermaid.json');
      const puppeteerPath = path.join(tempDir, 'puppeteer.json');
      await Promise.all([
        fs.writeFile(inputPath, source, { encoding: 'utf8', mode: 0o600 }),
        fs.writeFile(configPath, JSON.stringify(config), { encoding: 'utf8', mode: 0o600 }),
        fs.writeFile(puppeteerPath, JSON.stringify({ executablePath: browserPath, args: ['--disable-dev-shm-usage', '--no-sandbox'] }), { encoding: 'utf8', mode: 0o600 })
      ]);
      let result;
      try {
        result = await runRendererSubprocess({
          command: executablePath,
          args: ['-i', inputPath, '-o', outputPath, '-c', configPath, '-p', puppeteerPath, '--quiet', '--backgroundColor', 'transparent'],
          cwd: tempDir,
          env: buildScrubbedRendererEnv({ baseEnv: options.env || process.env }),
          trustedCommands: [executablePath],
          timeoutMs: positiveInteger(options.timeoutMs, 20_000),
          maxOutputBytes: 64 * 1024,
          maxErrorBytes: 64 * 1024
        });
      } catch (error) {
        throw mermaidError(error.code === 'ENOENT' ? 'MERMAID_BUILD_UNAVAILABLE' : 'MERMAID_RENDER_FAILED', `Bounded Mermaid CLI rendering failed: ${error.message}`);
      }
      if (result.code !== 0) {
        throw mermaidError('MERMAID_RENDER_FAILED', `Mermaid CLI exited with code ${result.code}: ${result.stderr.trim() || 'no diagnostic'}`);
      }
      let svg;
      try {
        svg = await fs.readFile(outputPath, 'utf8');
      } catch {
        throw mermaidError('MERMAID_RENDER_FAILED', 'Mermaid CLI did not produce an SVG output file');
      }
      return { svg };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  };
}

function assertAbsoluteExecutable(value, label = 'Mermaid CLI') {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw mermaidError('MERMAID_BUILD_UNAVAILABLE', `${label} requires a configured absolute executable path`);
  }
  return value;
}

function normalizeFonts(value) {
  return Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))].sort() : [];
}

function secureConfig(config = {}) {
  const authored = config && typeof config === 'object' ? config : {};
  if (authored.theme !== undefined && !RICH_CONFIG.mermaidThemes.includes(authored.theme)) {
    throw mermaidError('MERMAID_CONFIG_INVALID', `Mermaid theme must be one of ${RICH_CONFIG.mermaidThemes.join(', ')}`);
  }
  return deepFreeze({
    ...authored,
    startOnLoad: false,
    securityLevel: 'strict',
    look: 'classic',
    handDrawnSeed: 1,
    suppressErrorRendering: true,
    maxTextSize: RENDERER_SECURITY_BASELINES.mermaid.maxTextSize,
    maxEdges: RENDERER_SECURITY_BASELINES.mermaid.maxEdges,
    secure: [...RENDERER_SECURITY_BASELINES.mermaid.secure]
  });
}

function enforceBounds(source, limits) {
  if (!source.trim()) throw mermaidError('MERMAID_EMPTY_SOURCE', 'Mermaid source is empty');
  if (Buffer.byteLength(source, 'utf8') > limits.maxSourceBytes) {
    throw mermaidError('MERMAID_SOURCE_LIMIT', `Mermaid source exceeds the ${limits.maxSourceBytes} byte limit`);
  }
  // This deliberately over-counts arrows. Mermaid remains the syntax authority;
  // the estimate is only an inexpensive denial-of-service guard before parsing.
  const edgeCount = (source.match(/-->|---|==>|-.->|~~~|--o|--x/g) || []).length;
  if (edgeCount > limits.maxEdges) {
    throw mermaidError('MERMAID_EDGE_LIMIT', `Mermaid diagram exceeds the ${limits.maxEdges} edge limit`);
  }
}

function decorateSvg(svg, id) {
  return svg.replace(/^\s*<svg\b([^>]*)>/i, (_match, attributes) => {
    const clean = attributes
      .replace(/\s+(?:role|aria-labelledby|aria-label)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<svg${clean} role="img" aria-labelledby="${id}-caption">`;
  });
}

function diagramCaption(node) {
  return String(node.attributes?.title || node.title || node.meta?.title || 'Mermaid diagram').trim() || 'Mermaid diagram';
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function mermaidError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export const MERMAID_BUILD_DEFAULTS = deepFreeze({
  version: VERSION,
  maxSourceBytes: DEFAULT_MAX_SOURCE_BYTES,
  maxEdges: RENDERER_SECURITY_BASELINES.mermaid.maxEdges,
  maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES
});
