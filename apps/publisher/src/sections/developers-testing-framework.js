import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-testing-framework';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
