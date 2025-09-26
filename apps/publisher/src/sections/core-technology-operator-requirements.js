import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'core-technology-operator-requirements';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
