import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'use-case-connected-devices';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
