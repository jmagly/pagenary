import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'operations-sync-setup';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
