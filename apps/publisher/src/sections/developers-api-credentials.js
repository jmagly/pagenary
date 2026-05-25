import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-api-credentials';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
