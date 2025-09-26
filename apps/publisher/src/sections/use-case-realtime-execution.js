import { renderSectionTemplate } from './section-templates.js';

const SECTION_ID = 'use-case-realtime-execution';

export async function load() {
  return { html: renderSectionTemplate({ id: SECTION_ID }) };
}
