import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-sdk-python';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
