import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_LATEX_PACKAGE_ALLOWLIST = Object.freeze([
  'amsmath', 'amssymb', 'array', 'booktabs', 'graphicx', 'hyperref', 'inputenc',
  'mathtools', 'microtype', 'textcomp', 'url', 'xcolor'
]);

const FORBIDDEN = [
  [/\\(?:immediate\s*)?\\write18\b/i, 'shell escape (write18)'],
  [/\\(?:input|include)\s*\{?\s*\|/i, 'pipe input'],
  [/\\(?:openout|write|read|openin)\b/i, 'direct file I/O'],
  [/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{\s*(?:shellesc|catchfile|verbatim)\s*\}/i, 'unsafe package'],
  [/\b(?:https?|ftp):\/\//i, 'network URL']
];

const DEPENDENCY_COMMANDS = [
  { kind: 'tex', regex: /\\(?:input|include)\s*\{([^}]+)\}/g, extensions: ['', '.tex'] },
  { kind: 'bibliography', regex: /\\bibliography\s*\{([^}]+)\}/g, extensions: ['', '.bib'], split: true },
  { kind: 'bibliography', regex: /\\addbibresource(?:\[[^\]]*\])?\s*\{([^}]+)\}/g, extensions: ['', '.bib'] },
  { kind: 'graphic', regex: /\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]+)\}/g, extensions: ['', '.pdf', '.png', '.jpg', '.jpeg', '.svg'] }
];

export function preflightLatexPage(source, options = {}) {
  const contentRoot = path.resolve(options.contentRoot || process.cwd());
  const sourceFile = options.sourceFile ? path.resolve(options.sourceFile) : path.join(contentRoot, 'page.tex');
  const allowPackages = new Set(options.allowedPackages || DEFAULT_LATEX_PACKAGE_ALLOWLIST);
  const diagnostics = [];
  const dependencies = [];
  const text = String(source ?? '');

  if (path.extname(sourceFile).toLowerCase() !== '.tex') {
    diagnostics.push(error('LATEX_PAGE_TYPE_INVALID', 'Full LaTeX pages must use the .tex extension'));
  }
  if (!contained(contentRoot, sourceFile)) {
    diagnostics.push(error('LATEX_SOURCE_OUTSIDE_ROOT', 'LaTeX source must be contained by the configured content root'));
  }
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(text)) diagnostics.push(error('LATEX_UNSAFE_COMMAND', `LaTeX source contains forbidden ${label}`));
  }

  for (const match of text.matchAll(/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) {
    for (const name of match[1].split(',').map((value) => value.trim()).filter(Boolean)) {
      if (!/^[A-Za-z0-9_-]+$/.test(name) || !allowPackages.has(name)) {
        diagnostics.push(error('LATEX_PACKAGE_NOT_ALLOWED', `LaTeX package is not allowlisted: ${name}`));
      }
    }
  }

  for (const command of DEPENDENCY_COMMANDS) {
    for (const match of text.matchAll(command.regex)) {
      const values = command.split ? match[1].split(',') : [match[1]];
      for (const value of values) {
        inspectDependency(value.trim(), command, { contentRoot, sourceFile, dependencies, diagnostics, fileExists: options.fileExists });
      }
    }
  }

  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics, dependencies };
}

function inspectDependency(value, command, state) {
  if (!value || /[{}\\#$%]/.test(value) || /^[A-Za-z][A-Za-z+.-]*:/.test(value) || path.isAbsolute(value)) {
    state.diagnostics.push(error('LATEX_DEPENDENCY_INVALID', `Invalid ${command.kind} dependency reference`));
    return;
  }
  const base = path.resolve(path.dirname(state.sourceFile), value);
  if (!contained(state.contentRoot, base)) {
    state.diagnostics.push(error('LATEX_DEPENDENCY_OUTSIDE_ROOT', `${command.kind} dependency escapes the content root`));
    return;
  }
  const candidates = command.extensions.map((extension) => base.endsWith(extension) ? base : `${base}${extension}`);
  const exists = state.fileExists || fs.existsSync;
  const resolved = candidates.find((candidate) => exists(candidate));
  if (!resolved) {
    state.diagnostics.push(error('LATEX_DEPENDENCY_MISSING', `${command.kind} dependency was not found: ${path.basename(value)}`));
    return;
  }
  state.dependencies.push({ kind: command.kind, path: resolved, relativePath: path.relative(state.contentRoot, resolved).replace(/\\/g, '/') });
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function error(code, message) {
  return { code, severity: 'error', renderer: 'latexPage', message };
}
