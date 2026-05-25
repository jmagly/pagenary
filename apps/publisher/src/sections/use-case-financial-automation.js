import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'use-case-financial-automation';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
