import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-api-reference';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
