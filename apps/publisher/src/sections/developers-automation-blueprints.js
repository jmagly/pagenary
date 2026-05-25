import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'developers-automation-blueprints';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
