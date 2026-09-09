#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const galleryRoot = path.join(packageRoot, 'examples/syntax-gallery');
const inventory = JSON.parse(fs.readFileSync(path.join(galleryRoot, 'syntax-inventory.json'), 'utf8'));
if (!Array.isArray(inventory?.features) || inventory.features.length === 0) {
  throw new Error('Syntax inventory must declare a nonempty features array.');
}
const helpAnchors = markdownAnchors(fs.readFileSync(path.join(packageRoot, 'docs/SUPPORTED-SYNTAX.md'), 'utf8'));
const failures = [];
const ids = new Set();

for (const feature of inventory.features || []) {
  if (!feature?.id || ids.has(feature.id)) failures.push(`duplicate or missing feature id: ${feature?.id || '<missing>'}`);
  ids.add(feature?.id);
  const examplePath = path.resolve(galleryRoot, feature?.example || '');
  if (!contained(galleryRoot, examplePath) || !fs.existsSync(examplePath)) {
    failures.push(`${feature?.id}: missing contained example ${feature?.example || '<missing>'}`);
    continue;
  }
  if (!helpAnchors.has(feature.help)) failures.push(`${feature.id}: missing help anchor #${feature.help}`);
  const source = fs.readFileSync(examplePath, 'utf8');
  if (feature.example.endsWith('.md')) {
    if (!markdownAnchors(source).has(feature.anchor)) failures.push(`${feature.id}: missing example anchor #${feature.anchor}`);
  } else if (!source.toLowerCase().includes(`\\section{${feature.anchor.replaceAll('-', ' ')}}`)) {
    failures.push(`${feature.id}: missing LaTeX section ${feature.anchor}`);
  }
}

if (failures.length) {
  console.error(`Syntax coverage: ${ids.size}/${inventory.features?.length || 0} entries checked; ${failures.length} gap(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Syntax coverage: ${ids.size}/${inventory.features.length} supported features have a functional example and help section.`);
}

function markdownAnchors(source) {
  return new Set([...source.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1])));
}

function slug(value) {
  return String(value).toLowerCase().replace(/[`*_()[\]{}]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
