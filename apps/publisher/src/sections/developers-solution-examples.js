import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-solution-examples';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
