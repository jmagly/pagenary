import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'operations-monitoring';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
