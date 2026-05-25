import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'technical-whitepaper';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
