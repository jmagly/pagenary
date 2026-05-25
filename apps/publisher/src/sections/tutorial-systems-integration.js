import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'tutorial-systems-integration';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
