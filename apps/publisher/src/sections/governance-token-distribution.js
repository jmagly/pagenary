import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'governance-token-distribution';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
