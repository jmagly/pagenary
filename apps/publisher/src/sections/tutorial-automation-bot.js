import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'tutorial-automation-bot';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
