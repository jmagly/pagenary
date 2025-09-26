import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'tutorial-operations-onboarding';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
