import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'archive-timeline-overview';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
