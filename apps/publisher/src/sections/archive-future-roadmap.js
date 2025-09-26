import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'archive-future-roadmap';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
