import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'tutorial-build-first-integration';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
