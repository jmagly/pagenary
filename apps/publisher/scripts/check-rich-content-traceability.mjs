#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authoringContract from './lib/authoring-contract.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const requirementsPath = path.join(repoRoot, '.aiwg/requirements/REQ-rich-technical-content.md');
const matrixPath = path.join(repoRoot, '.aiwg/requirements/traceability-rich-technical-content.md');
const requirements = fs.readFileSync(requirementsPath, 'utf8');
const matrix = fs.readFileSync(matrixPath, 'utf8');
const ids = [...new Set(requirements.match(/RTC-(?:FR|NFR)-\d{3}/g) || [])];
const errors = [];
if (ids.length === 0) errors.push('No rich-content requirement IDs found; traceability requires a nonempty requirement population.');

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

// RTC-FR-040 names both authoring aliases. Exercise the same shared contract
// used by build-tenants.js, so evidence rows cannot hide a lost implementation.
// This proves this narrow capability only; other rows remain documentary evidence.
if (ids.includes('RTC-FR-040')) {
  for (const language of ['plantuml', 'puml']) {
    const source = '```' + language + '\nAlice -> Bob: documented alias\n```';
    const matches = authoringContract.scanRichFences(source);
    const parsed = matches.length === 1
      ? authoringContract.parseRichFenceInfo(matches[0][1], matches[0][2])
      : null;
    if (!parsed || parsed.authored !== language || parsed.renderer !== 'plantuml') {
      errors.push(`RTC-FR-040: production authoring contract does not recognize ${language} as plantuml`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Rich-content traceability: ${ids.length}/${ids.length} requirements have one concrete evidence row.`);
