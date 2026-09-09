import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// Explicit setup only. Test and conformance runners never install prerequisites.
const prefix = path.join(os.tmpdir(), 'pagenary-playwright');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const [command, argv] of [
  [npm, ['install', '--prefix', prefix, '--no-save', '--package-lock=false', 'playwright@1.55.1']],
  [process.execPath, [path.join(prefix, 'node_modules/playwright/cli.js'), 'install',
    ...(process.argv.includes('--with-deps') ? ['--with-deps'] : []), 'chromium']],
]) {
  const result = spawnSync(command, argv, { stdio: 'inherit', timeout: 600000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Browser setup failed (${result.status ?? result.signal})`);
}
console.log(`Pinned browser tooling ready: ${path.join(prefix, 'node_modules/playwright/index.mjs')}`);
