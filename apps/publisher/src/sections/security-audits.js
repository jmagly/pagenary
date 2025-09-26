import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'security-audits';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
