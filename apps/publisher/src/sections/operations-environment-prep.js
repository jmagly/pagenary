import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'operations-environment-prep';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
