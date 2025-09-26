import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'core-technology-integrity-controls';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
