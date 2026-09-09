import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runHarness } from './harness-runner.mjs';
import { registeredNodeTests } from './node-discovery.mjs';
import { classifyHarnessOutcome } from './lib/harness-outcome.mjs';

async function fixture(t, source) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pagenary-runner-qualification-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'harness.mjs'), source);
  return { root, file: 'harness.mjs', argv: [process.execPath, 'harness.mjs'], timeoutMs: 1000 };
}

test('standalone registration never runs its action and execution retains diagnostics', async t => {
  const options = await fixture(t, 'console.log("actual assertion script"); if(process.env.SMOKE_REQUIRE !== "1") throw Error("strict mode missing");');
  let raw = '';
  const registered = await runHarness({ ...options, mode: 'discovery', diagnostic: text => raw += text });
  assert.equal(registered.exitCode, 0); assert.equal(raw, '');
  assert.deepEqual(registered.result.summary, { total: 1, passed: 0, failed: 0, skipped: 0 });
  assert.equal(registered.result.cases[0].status, 'unknown');
  const executed = await runHarness({ ...options, diagnostic: text => raw += text });
  assert.equal(executed.exitCode, 0); assert.equal(executed.result.complete, true);
  assert.equal(executed.result.summary.passed, 1); assert.match(raw, /actual assertion script/);
  assert.equal(executed.result.cases[0].id, registered.result.cases[0].id);
});

test('assertion failures remain failures, while missing prerequisites remain incomplete', async t => {
  const options = await fixture(t, 'import assert from "node:assert/strict"; assert.equal(1, 2);');
  const failed = await runHarness(options);
  assert.equal(failed.exitCode, 1); assert.equal(failed.result.complete, true);
  assert.equal(failed.result.summary.failed, 1);
  await writeFile(path.join(options.root, options.file), 'import "this-package-must-not-exist-pagenary";');
  const missing = await runHarness(options);
  assert.equal(missing.exitCode, 1); assert.equal(missing.result.complete, false);
  assert.ok(missing.result.errors.some(e => e.code === 'MISSING_PREREQUISITE'));
});

test('empty registration, unrelated actions, skips and timeouts cannot pass', async t => {
  const options = await fixture(t, 'console.log("SKIP: unavailable");');
  for (const override of [{ file: 'absent.mjs' }, { argv: [process.execPath, '-e', 'process.exit(0)'] }]) {
    const result = await runHarness({ ...options, ...override });
    assert.notEqual(result.exitCode, 0); assert.equal(result.result.complete, false);
  }
  const skipped = await runHarness(options);
  assert.equal(skipped.result.complete, false); assert.equal(skipped.exitCode, 1);
  await writeFile(path.join(options.root, options.file), 'setInterval(() => {}, 1000);');
  const timeout = await runHarness({ ...options, timeoutMs: 100 });
  assert.equal(timeout.exitCode, 1); assert.equal(timeout.result.complete, false);
  assert.ok(timeout.result.errors.some(e => e.code === 'TIMEOUT'));
});

test('Node discovery observes actual enqueue registrations including dynamic children', async t => {
  const options = await fixture(t, 'import {test,describe,it} from "node:test"; describe("group",()=>{it("same",()=>{});}); test("parent",async t=>{await t.test("same",()=>{});});');
  const reporter = fileURLToPath(new URL('./node-discovery.mjs', import.meta.url));
  const childEnv = { ...process.env }; delete childEnv.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, options.file], {
    cwd: options.root, encoding: 'utf8', timeout: 10000, env: { ...childEnv, PAGENARY_TEST_ROOT: options.root, PAGENARY_TEST_LANE: 'probe' },
  });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.complete, true, JSON.stringify(result.errors));
  assert.deepEqual(new Set(result.cases.map(c => c.name)), new Set(['["group","same"]', '["parent"]', '["parent","same"]']));
  assert.equal(result.summary.total, 3);
  assert.ok(result.cases.every(c => c.status === 'unknown' && c.file === 'harness.mjs'));
});

test('Node registration requires genuine enqueue events and a matching final population', () => {
  const file = path.resolve('fixture.mjs');
  const start = { type: 'test:start', data: { name: 'observed', file, nesting: 0 } };
  const summary = { type: 'test:summary', data: { counts: { tests: 1 } } };
  assert.equal(registeredNodeTests([start, summary]).complete, false);
  assert.equal(registeredNodeTests([]).complete, false);
  const enqueue = { type: 'test:enqueue', data: { name: 'observed', file, nesting: 0, type: 'test' } };
  assert.equal(registeredNodeTests([enqueue, summary]).complete, true);
  assert.equal(registeredNodeTests([enqueue, enqueue, summary]).complete, false);
});

test('completed harness outcomes preserve exit failures and distinguish incomplete evidence', () => {
  const normal = { code: 0, signal: null, tail: '', timedOut: false, interrupted: false };
  assert.deepEqual(classifyHarnessOutcome(normal), { errors: [], status: 'passed', complete: true, exitCode: 0 });
  assert.deepEqual(classifyHarnessOutcome({ ...normal, code: 1 }), { errors: [], status: 'failed', complete: true, exitCode: 1 });
  for (const [override, code] of [
    [{ interrupted: true }, 'INTERRUPTED'],
    [{ spawnError: new Error('spawn failed') }, 'SPAWN_ERROR'],
    [{ timedOut: true }, 'TIMEOUT'],
    [{ signal: 'SIGTERM' }, 'SIGNAL'],
    [{ tail: 'ERR_MODULE_NOT_FOUND' }, 'MISSING_PREREQUISITE'],
    [{ tail: 'SKIP: unavailable' }, 'SKIPPED_HARNESS']
  ]) {
    const result = classifyHarnessOutcome({ ...normal, ...override });
    assert.equal(result.status, 'failed');
    assert.equal(result.complete, false);
    assert.equal(result.exitCode, 1);
    assert.deepEqual(result.errors.map(error => error.code), [code]);
  }
});
