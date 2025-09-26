import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'core-technology-data-definitions';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
