#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const requirementsPath = path.join(repoRoot, '.aiwg/requirements/REQ-rich-technical-content.md');
const matrixPath = path.join(repoRoot, '.aiwg/requirements/traceability-rich-technical-content.md');
const requirements = fs.readFileSync(requirementsPath, 'utf8');
const matrix = fs.readFileSync(matrixPath, 'utf8');
const ids = [...new Set(requirements.match(/RTC-(?:FR|NFR)-\d{3}/g) || [])];
const errors = [];

for (const id of ids) {
  const rows = matrix.split(/\r?\n/).filter((line) => line.startsWith(`| ${id} |`));
  if (rows.length !== 1) {
    errors.push(`${id}: expected exactly one evidence row, found ${rows.length}`);
    continue;
  }
  const cells = rows[0].split('|').slice(2, -1).map((cell) => cell.trim());
  if (cells.length < 1 || cells.some((cell) => !cell || /\b(?:todo|tbd|pending)\b/i.test(cell))) {
    errors.push(`${id}: evidence row is empty or unresolved`);
  }
}

const unknown = [...new Set(matrix.match(/RTC-(?:FR|NFR)-\d{3}/g) || [])]
  .filter((id) => !ids.includes(id));
if (unknown.length) errors.push(`unknown requirement IDs: ${unknown.join(', ')}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Rich-content traceability: ${ids.length}/${ids.length} requirements have one concrete evidence row.`);
