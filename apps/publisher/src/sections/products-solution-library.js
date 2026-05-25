import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'products-solution-library';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
