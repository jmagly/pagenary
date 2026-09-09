import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { aggregateTestEvents } from './node-reporter.mjs';

const root = path.resolve('/fixture');
const options = { root, laneId: 'qualification' };
const file = path.join(root, 'tests/example.test.js');
const start = (name, nesting = 0, source = file) => ({ type: 'test:start', data: { name, nesting, file: source } });
const end = (name, status = 'passed', nesting = 0, extra = {}) => ({ type: status === 'failed' ? 'test:fail' : 'test:pass',
  data: { name, nesting, file, details: { type: 'test', duration_ms: 2 }, ...(status === 'skipped' ? { skip: true } : {}), ...extra } });
const summary = (tests, passed, failed = 0, skipped = 0) => ({ type: 'test:summary', data: { success: failed === 0,
  counts: { tests, passed, failed, skipped, cancelled: 0, todo: 0 } } });

test('pass/fail/skip retain source attribution and exact conservative totals', () => {
  const result = aggregateTestEvents([start('pass'), end('pass'), start('fail'), end('fail', 'failed'),
    start('skip'), end('skip', 'skipped'), summary(3, 1, 1, 1)], options);
  assert.equal(result.complete, true);
  assert.deepEqual(result.summary, { total: 3, passed: 1, failed: 1, skipped: 1 });
  assert.deepEqual(result.files, [{ path: 'tests/example.test.js', status: 'failed' }]);
  assert.deepEqual(result.cases.map(c => c.status), ['passed', 'failed', 'skipped']);
  assert.ok(result.cases.every(c => c.file === 'tests/example.test.js' && c.durationMs === 2));
});

test('suites do not count as cases and duplicate leaf titles use ancestor identities', () => {
  const events = [];
  for (const name of ['one', 'two']) events.push(start(name), start('same', 1), end('same', 'passed', 1),
    end(name, 'passed', 0, { details: { type: 'suite' } }));
  events.push(summary(2, 2));
  const result = aggregateTestEvents(events, options);
  assert.equal(result.complete, true);
  assert.deepEqual(result.cases.map(c => c.name), ['["one","same"]', '["two","same"]']);
  assert.equal(new Set(result.cases.map(c => c.id)).size, 2);
  assert.deepEqual(aggregateTestEvents(events, options).cases, result.cases);
});

test('duplicate full identities and missing attribution cannot declare completeness', () => {
  const duplicate = aggregateTestEvents([start('same'), end('same'), start('same'), end('same'), summary(2, 2)], options);
  assert.equal(duplicate.complete, false);
  assert.ok(duplicate.errors.some(e => e.code === 'DUPLICATE_CASE'));
  const missing = aggregateTestEvents([start('missing', 0, null), end('missing', 'passed', 0, { file: null }), summary(1, 1)], options);
  assert.equal(missing.complete, false);
  assert.equal(missing.cases[0].file, null);
  assert.deepEqual(missing.files, []);
  assert.ok(missing.errors.some(e => e.code === 'MISSING_FILE'));
});

test('empty and truncated streams fail closed', () => {
  const empty = aggregateTestEvents([], options);
  assert.equal(empty.complete, false);
  assert.equal(empty.summary.total, 0);
  assert.ok(empty.errors.some(e => e.code === 'EMPTY_REPORT'));
  const truncated = aggregateTestEvents([start('pass'), end('pass')], options);
  assert.equal(truncated.complete, false);
  assert.ok(truncated.errors.some(e => e.code === 'TRUNCATED_STREAM'));
});

test('test parents remain cases while a suite failure remains file evidence', () => {
  const result = aggregateTestEvents([start('suite'), start('parent', 1), start('child', 2),
    end('child', 'passed', 2), end('parent', 'passed', 1),
    end('suite', 'failed', 0, { details: { type: 'suite' } }), summary(2, 2)], options);
  assert.equal(result.cases.length, 2);
  assert.equal(result.files[0].status, 'failed');
  assert.equal(result.complete, false);
  assert.ok(result.errors.some(e => e.code === 'CONTRADICTORY_SUCCESS'));
});

test('out-of-root paths and incorrect aggregate counts cannot be accepted', () => {
  const result = aggregateTestEvents([start('escape', 0, '/outside/test.js'),
    end('escape', 'passed', 0, { file: '/outside/test.js' }), summary(2, 2)], options);
  assert.equal(result.complete, false);
  assert.ok(result.errors.some(e => e.code === 'OUTSIDE_ROOT'));
  assert.ok(result.errors.some(e => e.code === 'COUNT_MISMATCH'));
});
