import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'welcome-overview';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
