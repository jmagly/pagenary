import fs from 'node:fs';
import { createHash } from 'node:crypto';
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
  const realpath = options.realpath || fs.realpathSync;
  const realContentRoot = safeRealpath(contentRoot, realpath) || contentRoot;
  const sourceFile = options.sourceFile ? path.resolve(options.sourceFile) : path.join(contentRoot, 'page.tex');
  const allowPackages = new Set(options.allowedPackages || DEFAULT_LATEX_PACKAGE_ALLOWLIST);
  const diagnostics = [];
  const dependencies = [];
  const text = String(source ?? '');
  const bounds = {
    maxSourceBytes: bounded(options.maxSourceBytes, 1024 * 1024, 1024, 8 * 1024 * 1024),
    maxDependencyFiles: bounded(options.maxDependencyFiles, 128, 1, 1024),
    maxTotalInputBytes: bounded(options.maxTotalInputBytes, 8 * 1024 * 1024, 1024, 64 * 1024 * 1024),
    maxRecursionDepth: bounded(options.maxRecursionDepth, 16, 1, 64)
  };
  const sourceBytes = Buffer.byteLength(text);

  if (path.extname(sourceFile).toLowerCase() !== '.tex') {
    diagnostics.push(error('LATEX_PAGE_TYPE_INVALID', 'Full LaTeX pages must use the .tex extension'));
  }
  if (sourceBytes > bounds.maxSourceBytes) {
    diagnostics.push(error('LATEX_SOURCE_SIZE_LIMIT', 'LaTeX source exceeds the configured input-size limit'));
  }
  if (!/\\documentclass(?:\s*\[[^\]]*\])?\s*\{[^}]+\}/i.test(text)
      || !/\\begin\s*\{document\}/i.test(text)
      || !/\\end\s*\{document\}/i.test(text)) {
    diagnostics.push(error('LATEX_DOCUMENT_INCOMPLETE', 'LaTeX page must be a complete document with documentclass and document boundaries'));
  }
  if (!contained(contentRoot, sourceFile)) {
    diagnostics.push(error('LATEX_SOURCE_OUTSIDE_ROOT', 'LaTeX source must be contained by the configured content root'));
  } else {
    const realSource = safeRealpath(sourceFile, realpath);
    if (realSource && !contained(realContentRoot, realSource)) {
      diagnostics.push(error('LATEX_SOURCE_SYMLINK_ESCAPE', 'LaTeX source resolves outside the configured content root'));
    }
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
      inspectDependency(value.trim(), command, {
        contentRoot, realContentRoot, sourceFile, dependencies, diagnostics,
        fileExists: options.fileExists, realpath, bounds
      });
      }
    }
  }

  if (dependencies.length > bounds.maxDependencyFiles) {
    diagnostics.push(error('LATEX_DEPENDENCY_COUNT_LIMIT', 'LaTeX page exceeds the configured dependency-file limit'));
  }
  // Follow tenant-contained TeX includes to bound the graph before conversion.
  // Custom virtual-file test hooks remain direct-only unless they also provide
  // readFile, avoiding accidental host reads for synthetic paths.
  const readFile = options.readFile || (!options.fileExists ? fs.readFileSync : null);
  if (readFile) {
    const visited = new Set([path.resolve(sourceFile)]);
    inspectNestedTexDependencies(dependencies.filter(({ kind }) => kind === 'tex'), 1, {
      contentRoot, realContentRoot, dependencies, diagnostics, fileExists: options.fileExists,
      realpath, bounds, readFile, visited, allowedPackages: [...allowPackages]
    });
  }

  let totalInputBytes = sourceBytes;
  for (const dependency of dependencies) {
    try { totalInputBytes += fs.statSync(dependency.path).size; } catch { /* existence already diagnosed */ }
  }
  if (totalInputBytes > bounds.maxTotalInputBytes) {
    diagnostics.push(error('LATEX_TOTAL_INPUT_LIMIT', 'LaTeX page and dependencies exceed the configured total-input limit'));
  }

  return { ok: !diagnostics.some((item) => item.severity === 'error'), diagnostics, dependencies, bounds, totalInputBytes };
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
  const realResolved = safeRealpath(resolved, state.realpath) || resolved;
  if (!contained(state.realContentRoot, realResolved)) {
    state.diagnostics.push(error('LATEX_DEPENDENCY_SYMLINK_ESCAPE', `${command.kind} dependency resolves outside the content root`));
    return;
  }
  const dependency = {
    kind: command.kind,
    path: realResolved,
    relativePath: path.relative(state.realContentRoot, realResolved).replace(/\\/g, '/')
  };
  try {
    const bytes = fs.readFileSync(realResolved);
    dependency.bytes = bytes.length;
    dependency.sha256 = createHash('sha256').update(bytes).digest('hex');
  } catch { /* virtual files can supply existence without host bytes */ }
  state.dependencies.push(dependency);
  return realResolved;
}

function inspectNestedTexDependencies(queue, depth, state) {
  if (queue.length === 0) return;
  if (depth > state.bounds.maxRecursionDepth) {
    state.diagnostics.push(error('LATEX_RECURSION_LIMIT', 'LaTeX include graph exceeds the configured recursion limit'));
    return;
  }
  const next = [];
  for (const dependency of queue) {
    const resolved = path.resolve(dependency.path);
    if (state.visited.has(resolved)) continue;
    state.visited.add(resolved);
    let text;
    try { text = String(state.readFile(resolved, 'utf8')); } catch { continue; }
    for (const [pattern, label] of FORBIDDEN) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) state.diagnostics.push(error('LATEX_UNSAFE_COMMAND', `Included LaTeX source contains forbidden ${label}`));
    }
    for (const match of text.matchAll(/\\(?:usepackage|RequirePackage)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g)) {
      for (const name of match[1].split(',').map((value) => value.trim()).filter(Boolean)) {
        if (!/^[A-Za-z0-9_-]+$/.test(name) || !new Set(state.allowedPackages || DEFAULT_LATEX_PACKAGE_ALLOWLIST).has(name)) {
          state.diagnostics.push(error('LATEX_PACKAGE_NOT_ALLOWED', `Included LaTeX package is not allowlisted: ${name}`));
        }
      }
    }
    for (const command of DEPENDENCY_COMMANDS) {
      for (const match of text.matchAll(command.regex)) {
        const values = command.split ? match[1].split(',') : [match[1]];
        for (const value of values) {
          const before = state.dependencies.length;
          inspectDependency(value.trim(), command, { ...state, sourceFile: resolved });
          if (command.kind === 'tex' && state.dependencies.length > before) {
            const nested = state.dependencies.at(-1);
            if (state.visited.has(path.resolve(nested.path))) {
              state.diagnostics.push(error('LATEX_DEPENDENCY_CYCLE', 'LaTeX include graph contains a dependency cycle'));
            } else {
              next.push(nested);
            }
          }
        }
      }
    }
    if (state.dependencies.length > state.bounds.maxDependencyFiles) {
      state.diagnostics.push(error('LATEX_DEPENDENCY_COUNT_LIMIT', 'LaTeX page exceeds the configured dependency-file limit'));
      return;
    }
  }
  inspectNestedTexDependencies(next, depth + 1, state);
}

function safeRealpath(value, realpath) {
  try { return path.resolve(realpath(value)); } catch { return null; }
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function bounded(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.trunc(number))) : fallback;
}

function error(code, message) {
  return { code, severity: 'error', renderer: 'latexPage', message };
}
