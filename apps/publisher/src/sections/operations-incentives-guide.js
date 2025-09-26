import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'operations-incentives-guide';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
