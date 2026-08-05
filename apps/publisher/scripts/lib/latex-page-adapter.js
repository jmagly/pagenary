import { constants as fsConstants } from 'node:fs';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defineRendererAdapter } from './rich-content-adapters.js';
import { fallbackHtmlForSource } from './rich-content-diagnostics.js';
import { normalizeLatexHtml, latexHtmlSemanticText, extractLatexPageMetadata } from './latex-page-normalize.js';
import { preflightLatexPage } from './latex-page-preflight.js';
import { runRendererSubprocess } from './renderer-security.js';

export const LATEX_PAGE_PROFILES = Object.freeze({
  'standard-web-v1': Object.freeze({ command: 'latexmlc', engine: 'LaTeXML', qualifiedVersion: '0.8.8', versionArgs: ['--VERSION'], semantic: true, output: 'html+mathml', documentMode: 'complete-document', fonts: ['Latin Modern'] }),
  'portable-subset-v1': Object.freeze({ command: 'pandoc', engine: 'Pandoc', qualifiedVersion: '3.1.3', semantic: true, output: 'html+mathml', documentMode: 'complete-document', fonts: [], subset: true }),
  'pdf-v1': Object.freeze({ command: 'tectonic', engine: 'Tectonic', qualifiedVersion: '0.16.9', semantic: false, output: 'pdf', documentMode: 'complete-document', fonts: ['Latin Modern'], optional: true })
});

export function createLatexPageAdapter(options = {}) {
  const defaultProfile = options.defaultProfile || 'standard-web-v1';
  return defineRendererAdapter({
    id: 'latexPage',
    version: 'standard-web-v1',
    profiles: Object.keys(LATEX_PAGE_PROFILES),
    validate(node, context) {
      const resolved = resolveInput(node, context);
      return preflightLatexPage(resolved.source, {
        contentRoot: resolved.contentRoot,
        sourceFile: resolved.sourceFile,
        allowedPackages: context.allowedPackages || options.allowedPackages,
        fileExists: context.fileExists || options.fileExists,
        ...preflightBounds(context, options)
      }).diagnostics;
    },
    async render(node, context) {
      const profile = context.profile || node.profile || defaultProfile;
      const definition = LATEX_PAGE_PROFILES[profile];
      if (!definition) throw latexError('LATEX_PROFILE_UNKNOWN', `Unknown LaTeX page profile: ${profile}`);
      if (profile === 'pdf-v1') {
        throw latexError('LATEX_PROFILE_NOT_HTML', 'pdf-v1 is optional output metadata and cannot replace semantic page HTML');
      }

      const input = resolveInput(node, context);
      const preflight = preflightLatexPage(input.source, {
        contentRoot: input.contentRoot,
        sourceFile: input.sourceFile,
        allowedPackages: context.allowedPackages || options.allowedPackages,
        fileExists: context.fileExists || options.fileExists,
        ...preflightBounds(context, options)
      });
      if (!preflight.ok) throw latexError(preflight.diagnostics[0].code, preflight.diagnostics[0].message);

      const runner = context.runCommand || options.runCommand || runBoundedCommand;
      const available = await commandAvailable(definition.command, definition.versionArgs, runner, context);
      if (!available) {
        throw latexError('LATEX_RENDERER_UNAVAILABLE', `${definition.command} is required for LaTeX profile ${profile} but is not available`);
      }
      const invocation = invocationFor(profile, input.sourceFile, preflight.dependencies);
      const result = await runner(invocation.command, invocation.args, commandOptions(input.contentRoot, context));
      if (profile === 'standard-web-v1' && latexmlReportedErrors(result.stderr)) {
        throw latexError('LATEX_CONVERSION_ERRORS', 'LaTeXML reported conversion errors');
      }
      let html = normalizeLatexHtml(result.stdout);
      if (!html) throw latexError('LATEX_EMPTY_OUTPUT', `${definition.command} produced no semantic HTML`);
      const materialized = await materializeLatexAssets(html, preflight.dependencies, context);
      html = materialized.html;
      const metadata = extractLatexPageMetadata(input.source, html);
      return {
        html,
        semanticText: latexHtmlSemanticText(html),
        searchText: latexHtmlSemanticText(html),
        source: input.source,
        metadata,
        dependencies: preflight.dependencies,
        assets: materialized.assets,
        rendererMetadata: {
          renderer: 'latexPage',
          version: await rendererVersion(definition.command, definition.versionArgs, runner, context),
          profile,
          engine: definition.engine,
          qualifiedVersion: definition.qualifiedVersion,
          output: definition.output,
          portableSubset: definition.subset === true,
          documentMode: definition.documentMode,
          packages: [...(context.allowedPackages || options.allowedPackages || preflightDefaultPackages())].sort(),
          fonts: [...definition.fonts],
          bounds: preflight.bounds
        }
      };
    },
    diagnose(error, node, context) {
      return [{
        code: error.code || 'LATEX_RENDER_FAILED',
        severity: 'error',
        renderer: 'latexPage',
        profile: context.profile || node.profile || defaultProfile,
        message: error.message || 'LaTeX page rendering failed'
      }];
    },
    dependencies(node, context) {
      const input = resolveInput(node, context);
      return preflightLatexPage(input.source, {
        contentRoot: input.contentRoot,
        sourceFile: input.sourceFile,
        allowedPackages: context.allowedPackages || options.allowedPackages,
        fileExists: context.fileExists || options.fileExists,
        ...preflightBounds(context, options)
      }).dependencies;
    },
    cacheIdentity(node, context) {
      const input = resolveInput(node, context);
      const profile = context.profile || node.profile || defaultProfile;
      const preflight = preflightLatexPage(input.source, {
        contentRoot: input.contentRoot,
        sourceFile: input.sourceFile,
        allowedPackages: context.allowedPackages || options.allowedPackages,
        fileExists: context.fileExists || options.fileExists,
        ...preflightBounds(context, options)
      });
      return {
        source: input.source,
        profile,
        converter: LATEX_PAGE_PROFILES[profile]?.command || null,
        toolchainDigest: context.toolchainDigest || options.toolchainDigest || null,
        allowedPackages: [...(context.allowedPackages || options.allowedPackages || [])].sort(),
        bounds: preflight.bounds,
        dependencies: preflight.dependencies.map(({ kind, relativePath, bytes, sha256 }) => ({
          kind, relativePath, bytes: bytes ?? null, sha256: sha256 || null
        }))
      };
    }
  });
}

async function materializeLatexAssets(html, dependencies, options = {}) {
  const assets = [];
  let output = String(html || '');
  const maxAssetBytes = bounded(options.maxOutputBytes, 4 * 1024 * 1024, 64 * 1024, 16 * 1024 * 1024);
  for (const dependency of dependencies.filter(({ kind }) => kind === 'graphic')) {
    let bytes = await fs.readFile(dependency.path);
    if (bytes.length > maxAssetBytes) throw latexError('LATEX_ASSET_OUTPUT_LIMIT', 'LaTeX graphic exceeds the configured output limit');
    const extension = safeAssetExtension(dependency.path);
    if (extension === '.svg') bytes = Buffer.from(sanitizeLatexSvg(bytes.toString('utf8')), 'utf8');
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const assetPath = `assets/rich-content/latex/${digest}${extension}`;
    const candidates = new Set([
      dependency.relativePath,
      path.basename(dependency.relativePath),
      dependency.relativePath.replace(/\.[^.]+$/, ''),
      path.basename(dependency.relativePath).replace(/\.[^.]+$/, '')
    ]);
    output = output.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (whole, prefix, value, suffix) => {
      const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
      return [...candidates].some((candidate) => normalized === candidate || normalized.endsWith(`/${candidate}`))
        ? `${prefix}./${assetPath}${suffix}`
        : whole;
    });
    assets.push({ path: assetPath, bytes, mimeType: mimeTypeForExtension(extension) });
  }
  return { html: output, assets };
}

function sanitizeLatexSvg(svg) {
  const clean = String(svg || '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(?:script|foreignObject|iframe|object|embed)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:href|xlink:href)\s*=\s*(["'])\s*(?:javascript:|data:text\/html)[\s\S]*?\1/gi, '');
  if (!/^\s*<svg\b/i.test(clean)) throw latexError('LATEX_ASSET_INVALID', 'LaTeX SVG asset is not a valid SVG document');
  return clean;
}

function safeAssetExtension(file) {
  const extension = path.extname(file).toLowerCase();
  return ['.svg', '.png', '.jpg', '.jpeg', '.pdf'].includes(extension) ? extension : '.bin';
}

function mimeTypeForExtension(extension) {
  return ({ '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf' })[extension] || 'application/octet-stream';
}

export async function inspectLatexPageRenderers(options = {}) {
  const runner = options.runCommand || runBoundedCommand;
  const profiles = {};
  for (const [profile, definition] of Object.entries(LATEX_PAGE_PROFILES)) {
    const available = await commandAvailable(definition.command, definition.versionArgs, runner, options);
    profiles[profile] = {
      command: definition.command,
      available,
      version: available ? await rendererVersion(definition.command, definition.versionArgs, runner, options) : null,
      output: definition.output,
      engine: definition.engine,
      qualifiedVersion: definition.qualifiedVersion,
      documentMode: definition.documentMode,
      fonts: [...definition.fonts],
      semantic: definition.semantic,
      optional: definition.optional === true
    };
  }
  return { defaultProfile: 'standard-web-v1', profiles };
}

export async function renderLatexPage(node, options = {}) {
  const adapter = createLatexPageAdapter(options);
  try {
    return await adapter.render(node, { ...options, adapter });
  } catch (error) {
    if ((options.failurePolicy || 'warn') === 'strict') throw error;
    const source = node.body || node.source || '';
    return {
      html: (options.failurePolicy || 'warn') === 'off' ? '' : fallbackHtmlForSource(source),
      semanticText: source,
      searchText: source,
      source,
      dependencies: [],
      diagnostics: adapter.diagnose(error, node, options),
      rendererMetadata: { renderer: 'latexPage', version: null, profile: options.profile || node.profile || 'standard-web-v1' }
    };
  }
}

export async function renderLatexPdf(node, options = {}) {
  const input = resolveInput(node, options);
  const preflight = preflightLatexPage(input.source, {
    contentRoot: input.contentRoot,
    sourceFile: input.sourceFile,
    allowedPackages: options.allowedPackages,
    fileExists: options.fileExists,
    ...preflightBounds(options)
  });
  if (!preflight.ok) throw latexError(preflight.diagnostics[0].code, preflight.diagnostics[0].message);
  const runner = options.runCommand || runBoundedCommand;
  if (!(await commandAvailable('tectonic', undefined, runner, options))) {
    throw latexError('LATEX_RENDERER_UNAVAILABLE', 'tectonic is required for optional pdf-v1 output but is not available');
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-tectonic-'));
  try {
    const rulesPath = path.join(tempDir, 'dependencies.mk');
    await runner('tectonic', [
      '-X', 'compile', '--untrusted', '--only-cached',
      '--outdir', tempDir,
      '--makefile-rules', rulesPath,
      input.sourceFile
    ], commandOptions(input.contentRoot, options));
    const pdfPath = path.join(tempDir, `${path.basename(input.sourceFile, '.tex')}.pdf`);
    const bytes = await fs.readFile(pdfPath);
    const maxPdfBytes = bounded(options.maxPdfBytes, 16 * 1024 * 1024, 64 * 1024, 64 * 1024 * 1024);
    if (bytes.length > maxPdfBytes) throw latexError('LATEX_PDF_OUTPUT_LIMIT', 'Tectonic PDF exceeds the configured output limit');
    return {
      bytes,
      mimeType: 'application/pdf',
      filename: path.basename(pdfPath),
      source: input.source,
      dependencies: preflight.dependencies,
      rendererMetadata: {
        renderer: 'latexPage',
        version: await rendererVersion('tectonic', undefined, runner, options),
        profile: 'pdf-v1',
        output: 'pdf',
        untrusted: true,
        onlyCached: true
      }
    };
  } catch (error) {
    if (error?.code) throw error;
    throw latexError('LATEX_PDF_RENDER_FAILED', 'Tectonic failed to produce the optional PDF sibling');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function runBoundedCommand(command, args, options = {}) {
  const executable = await resolveExecutable(command, options.env?.PATH || process.env.PATH || '');
  const result = await runRendererSubprocess({
    command: executable,
    args,
    cwd: options.cwd,
    env: options.env,
    timeoutMs: options.timeoutMs || 20_000,
    maxOutputBytes: options.maxOutputBytes || 4 * 1024 * 1024,
    maxErrorBytes: options.maxOutputBytes || 4 * 1024 * 1024,
    trustedCommands: [executable]
  });
  if (result.code !== 0) {
    throw latexError('LATEX_PROCESS_FAILED', `${path.basename(executable)} exited unsuccessfully`);
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

function latexmlReportedErrors(stderr) {
  const text = String(stderr || '');
  const status = text.match(/Status:conversion:(\d+)/i);
  if (status && Number(status[1]) >= 2) return true;
  return /Conversion complete:\s*(?:[1-9]\d*)\s+errors?\b/i.test(text);
}

async function resolveExecutable(command, commandPath) {
  const candidates = path.isAbsolute(command)
    ? [command]
    : String(commandPath).split(path.delimiter).filter(Boolean).flatMap((directory) => {
      const base = path.resolve(directory, command);
      if (process.platform !== 'win32') return [base];
      const extensions = String(process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean);
      return [base, ...extensions.map((extension) => `${base}${extension.toLowerCase()}`)];
    });
  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return await fs.realpath(candidate);
    } catch {
      // Try the next operator-provided PATH entry.
    }
  }
  const error = new Error(`Renderer command is not available: ${command}`);
  error.code = 'ENOENT';
  throw error;
}

function resolveInput(node = {}, context = {}) {
  const contentRoot = path.resolve(context.contentRoot || node.contentRoot || process.cwd());
  const sourceFile = path.resolve(node.sourceFile || node.file || path.join(contentRoot, 'page.tex'));
  return { source: String(node.body ?? node.source ?? ''), sourceFile, contentRoot };
}

function invocationFor(profile, sourceFile, dependencies = []) {
  if (profile === 'portable-subset-v1') {
    return { command: 'pandoc', args: ['--from=latex', '--to=html5', '--mathml', '--wrap=none', sourceFile] };
  }
  const args = ['--format=html5', '--strict', '--nocomments', '--nodefaultresources', '--log=/dev/null'];
  if (dependencies.some(({ kind }) => kind === 'bibliography')) args.push('--bibtex');
  return {
    command: 'latexmlc',
    // With no destination LaTeXML writes HTML to its stdout pipe. Passing
    // `--destination=-` creates a literal file named `-` instead.
    args: [...args, sourceFile]
  };
}

function commandOptions(contentRoot, options) {
  const inheritedPath = options.commandPath || process.env.PATH || '';
  return {
    cwd: contentRoot,
    timeoutMs: bounded(options.timeoutMs, 20_000, 1_000, 120_000),
    maxOutputBytes: bounded(options.maxOutputBytes, 4 * 1024 * 1024, 64 * 1024, 16 * 1024 * 1024),
    env: { PATH: inheritedPath, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', HOME: options.rendererHome || contentRoot, SOURCE_DATE_EPOCH: String(options.sourceDateEpoch || 0) }
  };
}

async function commandAvailable(command, versionArgs = ['--version'], runner, options) {
  try {
    await runner(command, versionArgs || ['--version'], commandOptions(options.contentRoot || process.cwd(), { ...options, timeoutMs: 3_000, maxOutputBytes: 64 * 1024 }));
    return true;
  } catch (error) {
    if (error && ['ENOENT', 'EACCES'].includes(error.code)) return false;
    return error?.code !== 'LATEX_TEST_UNAVAILABLE';
  }
}

async function rendererVersion(command, versionArgs = ['--version'], runner, options) {
  try {
    const result = await runner(command, versionArgs || ['--version'], commandOptions(options.contentRoot || process.cwd(), { ...options, timeoutMs: 3_000, maxOutputBytes: 64 * 1024 }));
    return String(result.stdout || result.stderr || '').split(/\r?\n/, 1)[0].trim() || 'unknown';
  } catch {
    return null;
  }
}

function bounded(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.trunc(number))) : fallback;
}

function preflightBounds(primary = {}, fallback = {}) {
  return Object.fromEntries([
    'maxSourceBytes', 'maxDependencyFiles', 'maxTotalInputBytes', 'maxRecursionDepth'
  ].map((key) => [key, primary[key] ?? fallback[key]]).filter(([, value]) => value != null));
}

function preflightDefaultPackages() {
  return ['amsmath', 'amssymb', 'array', 'booktabs', 'graphicx', 'hyperref', 'inputenc', 'mathtools', 'microtype', 'textcomp', 'url', 'xcolor'];
}

function latexError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
