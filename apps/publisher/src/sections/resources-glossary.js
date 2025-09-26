import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'resources-glossary';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
