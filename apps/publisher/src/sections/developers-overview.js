import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-overview';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
