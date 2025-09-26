import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'use-case-digital-auctions';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
