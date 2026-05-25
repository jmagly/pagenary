import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'security-best-practices';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
