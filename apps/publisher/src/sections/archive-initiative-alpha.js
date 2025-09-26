import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'archive-initiative-alpha';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
