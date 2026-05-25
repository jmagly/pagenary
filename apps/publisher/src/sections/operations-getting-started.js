import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'operations-getting-started';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
