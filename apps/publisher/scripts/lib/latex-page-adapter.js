import { execFile as nodeExecFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { defineRendererAdapter } from './rich-content-adapters.js';
import { fallbackHtmlForSource } from './rich-content-diagnostics.js';
import { normalizeLatexHtml, latexHtmlSemanticText } from './latex-page-normalize.js';
import { preflightLatexPage } from './latex-page-preflight.js';

const execFile = promisify(nodeExecFile);
export const LATEX_PAGE_PROFILES = Object.freeze({
  'standard-web-v1': Object.freeze({ command: 'latexmlc', semantic: true, output: 'html+mathml' }),
  'portable-subset-v1': Object.freeze({ command: 'pandoc', semantic: true, output: 'html+mathml', subset: true }),
  'pdf-v1': Object.freeze({ command: 'tectonic', semantic: false, output: 'pdf', optional: true })
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
        fileExists: context.fileExists || options.fileExists
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
        fileExists: context.fileExists || options.fileExists
      });
      if (!preflight.ok) throw latexError(preflight.diagnostics[0].code, preflight.diagnostics[0].message);

      const runner = context.runCommand || options.runCommand || runBoundedCommand;
      const available = await commandAvailable(definition.command, runner, context);
      if (!available) {
        throw latexError('LATEX_RENDERER_UNAVAILABLE', `${definition.command} is required for LaTeX profile ${profile} but is not available`);
      }
      const invocation = invocationFor(profile, input.sourceFile);
      const result = await runner(invocation.command, invocation.args, commandOptions(input.contentRoot, context));
      const html = normalizeLatexHtml(result.stdout);
      if (!html) throw latexError('LATEX_EMPTY_OUTPUT', `${definition.command} produced no semantic HTML`);
      return {
        html,
        semanticText: latexHtmlSemanticText(html),
        searchText: latexHtmlSemanticText(html),
        source: input.source,
        dependencies: preflight.dependencies,
        rendererMetadata: {
          renderer: 'latexPage',
          version: await rendererVersion(definition.command, runner, context),
          profile,
          output: definition.output,
          portableSubset: definition.subset === true
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
      return preflightLatexPage(input.source, { contentRoot: input.contentRoot, sourceFile: input.sourceFile }).dependencies;
    },
    cacheIdentity(node, context) {
      const input = resolveInput(node, context);
      return { source: input.source, profile: context.profile || node.profile || defaultProfile };
    }
  });
}

export async function inspectLatexPageRenderers(options = {}) {
  const runner = options.runCommand || runBoundedCommand;
  const profiles = {};
  for (const [profile, definition] of Object.entries(LATEX_PAGE_PROFILES)) {
    const available = await commandAvailable(definition.command, runner, options);
    profiles[profile] = {
      command: definition.command,
      available,
      version: available ? await rendererVersion(definition.command, runner, options) : null,
      output: definition.output,
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

export async function runBoundedCommand(command, args, options = {}) {
  const result = await execFile(command, args, {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeoutMs || 20_000,
    maxBuffer: options.maxOutputBytes || 4 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    encoding: 'utf8'
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '' };
}

function resolveInput(node = {}, context = {}) {
  const contentRoot = path.resolve(context.contentRoot || node.contentRoot || process.cwd());
  const sourceFile = path.resolve(node.sourceFile || node.file || path.join(contentRoot, 'page.tex'));
  return { source: String(node.body ?? node.source ?? ''), sourceFile, contentRoot };
}

function invocationFor(profile, sourceFile) {
  if (profile === 'portable-subset-v1') {
    return { command: 'pandoc', args: ['--from=latex', '--to=html5', '--mathml', '--wrap=none', sourceFile] };
  }
  return {
    command: 'latexmlc',
    args: ['--format=html5', '--nodefaultresources', '--destination=-', sourceFile]
  };
}

function commandOptions(contentRoot, options) {
  const inheritedPath = options.commandPath || process.env.PATH || '';
  return {
    cwd: contentRoot,
    timeoutMs: bounded(options.timeoutMs, 20_000, 1_000, 120_000),
    maxOutputBytes: bounded(options.maxOutputBytes, 4 * 1024 * 1024, 64 * 1024, 16 * 1024 * 1024),
    env: { PATH: inheritedPath, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', HOME: contentRoot, SOURCE_DATE_EPOCH: String(options.sourceDateEpoch || 0) }
  };
}

async function commandAvailable(command, runner, options) {
  try {
    await runner(command, ['--version'], commandOptions(options.contentRoot || process.cwd(), { ...options, timeoutMs: 3_000, maxOutputBytes: 64 * 1024 }));
    return true;
  } catch (error) {
    if (error && ['ENOENT', 'EACCES'].includes(error.code)) return false;
    return error?.code !== 'LATEX_TEST_UNAVAILABLE';
  }
}

async function rendererVersion(command, runner, options) {
  try {
    const result = await runner(command, ['--version'], commandOptions(options.contentRoot || process.cwd(), { ...options, timeoutMs: 3_000, maxOutputBytes: 64 * 1024 }));
    return String(result.stdout || result.stderr || '').split(/\r?\n/, 1)[0].trim() || 'unknown';
  } catch {
    return null;
  }
}

function bounded(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.trunc(number))) : fallback;
}

function latexError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
