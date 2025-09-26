import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'governance-overview';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
