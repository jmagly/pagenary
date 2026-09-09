import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { runManagedProcess } from '../scripts/lib/process-lifecycle.js';

export function createBuildWorkspace(packageRoot) {
  const parent = path.join(packageRoot, '.cache');
  // Inside the package for generated ESM/dependency resolution, but every write
  // (including build-tenants' internal dist and cache) is owned by this run.
  const root = path.join(parent, `test-build-${randomUUID()}`);
  let ownsRoot = false;
  const active = new Set();
  async function initialize() {
    await fsp.mkdir(parent, { recursive: true });
    await fsp.mkdir(root);
    ownsRoot = true;
    await fsp.mkdir(path.join(root, 'tenants'), { recursive: true });
    for (const id of ['tenant-alpha', 'tenant-beta']) {
      await fsp.cp(path.join(packageRoot, 'tenants', id), path.join(root, 'tenants', id), { recursive: true });
    }
    await fsp.mkdir(path.join(root, 'examples'), { recursive: true });
    await fsp.cp(path.join(packageRoot, 'examples', 'hybrid-react'), path.join(root, 'examples', 'hybrid-react'), { recursive: true });
  }
  async function stopChildren() {
    const outcomes = await Promise.allSettled([...active].map((child) => child.stop()));
    const failure = outcomes.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  async function run(args = [], env = {}, expectedCode = 0) {
    const result = await runManagedProcess(process.execPath, [path.join(packageRoot, 'scripts', 'build-tenants.js'), ...args], {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'development', GIT_CACHE_DIR: path.join(root, '.cache', 'git'), ...env }
    }, 45000, active);
    assert.equal(result.signal, null, `Build terminated by ${result.signal}: ${result.stderr}`);
    assert.equal(result.code, expectedCode, `Unexpected build exit (${result.code}):\n${result.stderr}\n${result.stdout}`);
    return result;
  }
  async function runRegistry(tenants, args = [], env = {}, expectedCode = 0) {
    const registryPath = path.join(root, `registry-${randomUUID()}.json`);
    try {
      await fsp.writeFile(registryPath, JSON.stringify({
        defaults: { source: { type: 'local', path: './tenants' }, target: { type: 'local', path: './dist' } },
        tenants
      }));
      return await run(['-r', registryPath, ...args], env, expectedCode);
    } finally { await fsp.rm(registryPath, { force: true }); }
  }
  async function dispose() {
    await stopChildren();
    if (ownsRoot) await fsp.rm(root, { recursive: true, force: true });
  }
  return { root, initialize, run, runRegistry, stopChildren, dispose };
}
