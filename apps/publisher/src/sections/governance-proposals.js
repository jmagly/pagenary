import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'governance-proposals';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
