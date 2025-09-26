import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'resources-brand-assets';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
