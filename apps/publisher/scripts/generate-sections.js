#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SECTIONS_DIR = path.join(ROOT, 'src', 'sections');
const TEMPLATE_FILENAME = 'section-templates.js';

function buildModule(id) {
  return `import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = '${id}';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
`;
}

function synchronizeSections() {
  if (!fs.existsSync(SECTIONS_DIR)) {
    console.error('Sections directory not found:', SECTIONS_DIR);
    process.exit(1);
  }

  const entries = fs.readdirSync(SECTIONS_DIR).filter((file) => file.endsWith('.js') && file !== TEMPLATE_FILENAME);
  if (!entries.length) {
    console.warn('No sections found to synchronize.');
    return;
  }

  entries.forEach((file) => {
    const sectionId = file.replace(/\.js$/, '');
    const modulePath = path.join(SECTIONS_DIR, file);
    const nextContent = buildModule(sectionId);
    fs.writeFileSync(modulePath, nextContent, 'utf8');
    console.log(`Updated ${sectionId}`);
  });
}

synchronizeSections();
