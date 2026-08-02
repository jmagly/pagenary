import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertBrochureContent } from './brochure-content.js';

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function loadBrochureContentModule(sourceDir, config = {}, runtime = {}) {
  const brochureware = config.brochureware;
  if (!brochureware || brochureware.enabled === false) return null;
  if (runtime.mode !== 'react-spa') throw new Error('brochureware contentModule requires runtime.mode "react-spa"');
  const relative = String(brochureware.contentModule || '').trim();
  if (!relative) throw new Error('brochureware.contentModule is required');
  const absolute = path.resolve(sourceDir, relative);
  if (!inside(sourceDir, absolute)) throw new Error('brochureware.contentModule must stay inside the tenant source directory');
  try { await fsp.access(absolute); } catch { throw new Error(`brochureware content module not found: ${relative}`); }

  const extension = path.extname(absolute).toLowerCase();
  if (extension === '.ts') {
    throw new Error('TypeScript brochureware modules must be compiled by the optional React/Vite adapter; point contentModule at its JS output');
  }
  let exported;
  if (extension === '.json') exported = JSON.parse(await fsp.readFile(absolute, 'utf8'));
  else {
    const module = await import(`${pathToFileURL(absolute).href}?pagenary=${Date.now()}`);
    exported = module.pagenaryContent ?? module.default;
  }
  if (!exported) throw new Error(`brochureware content module ${relative} must export pagenaryContent or default`);
  const result = assertBrochureContent(exported);
  return { ...result, modulePath: absolute };
}
