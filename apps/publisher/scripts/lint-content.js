#!/usr/bin/env node
/**
 * Lightweight content linting for Docs Toolkit.
 * - scans source and docs for trailing whitespace or tab characters
 * - ensures files end with a newline
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const INCLUDE_DIRS = ['src', 'scripts', 'docs'];
const EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html', '.md', '.json']);
const IGNORED_FILES = new Set(['scripts/lint-content.js', 'scripts/seo-smoke.js']);

const issues = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT, fullPath);
    if (IGNORED_FILES.has(relPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      lintFile(fullPath, relPath);
    }
  }
}

function lintFile(fullPath, relPath) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\s$/.test(line)) {
      issues.push(`${relPath}:${index + 1} trailing whitespace`);
    }
    if (/\t/.test(line)) {
      issues.push(`${relPath}:${index + 1} tab character found`);
    }
  });
  if (!content.endsWith('\n')) {
    issues.push(`${relPath} missing terminating newline`);
  }
}

for (const dir of INCLUDE_DIRS) {
  const target = path.join(ROOT, dir);
  if (!fs.existsSync(target)) continue;
  walk(target);
}

if (issues.length) {
  console.error('Lint issues detected:\n');
  issues.forEach((issue) => console.error(` • ${issue}`));
  process.exit(1);
} else {
  console.log('Lint check passed.');
}
