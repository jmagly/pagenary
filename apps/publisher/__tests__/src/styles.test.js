import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runManagedProcess } from '../../scripts/lib/process-lifecycle.js';

const publisher = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const engines = (process.env.PAGENARY_STYLE_BROWSERS || 'chromium').split(',');
let report;

beforeAll(async () => {
  const result = await runManagedProcess(process.execPath, [path.join(publisher, 'scripts/smoke-styles.mjs')], {
    cwd: publisher, env: { ...process.env, PAGENARY_PUBLISHER_ROOT: publisher }
  }, 120000);
  if (result.code !== 0 || result.signal !== null) {
    throw new Error(`Style browser qualification failed (code=${result.code}, signal=${result.signal})\n${result.stderr}\n${result.stdout}`);
  }
  report = JSON.parse(result.stdout.trim().split('\n').at(-1));
  expect(report.complete).toBe(true);
  expect(report.stylesheets).toContain('src/styles.css');
  expect(report.checks).toHaveLength(engines.length * report.stylesheets.length * 7);
}, 130000);

function checked(name) {
  for (const stylesheet of report.stylesheets) {
  for (const engine of engines) {
    expect(report.checks.filter(check => check.name === `${stylesheet}/${engine}: ${name}`))
      .toEqual([{ name: `${stylesheet}/${engine}: ${name}`, status: 'passed' }]);
  }
  }
}

describe('actual browser layout and progressive navigation', () => {
  test('rail TOC caps the viewport and scrolls the heading list', () => checked('rail scroll containment'));
  test('mobile heroes and controls use readable computed flow', () => checked('mobile action layout'));
  test('runtime mounts bottom nav after content and replaces static nav', () => checked('runtime navigation'));
  test('right TOC responds to viewport changes and user expansion', () => checked('responsive TOC state'));
  test('no-JavaScript fallback navigation stays visible and expanded', () => checked('no-JavaScript navigation'));
  test('generated static snapshot scrolls with JavaScript disabled', () => checked('generated snapshot no-JavaScript scrolling'));
  test('generated RSS parses as XML and preserves escaped authored data', () => checked('RSS XML validity and escaped data'));
});
