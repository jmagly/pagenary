import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'getting-started-performance-overview';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
