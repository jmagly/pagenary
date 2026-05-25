import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'resources-research-papers';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
