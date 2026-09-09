import path from 'node:path';

/** Normalize Node's ordered reporter events, never infer cases from source files. */
export function aggregateTestEvents(events, { root = process.cwd(), laneId = 'node' } = {}) {
  const out = { cases: [], files: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, errors: [], complete: false };
  const problem = (code, message) => out.errors.push({ code, message });
  const stacks = new Map();
  const files = new Map();
  const ids = new Set();
  const rank = { skipped: 1, passed: 2, unknown: 3, failed: 4 };
  let terminalSummary;
  function sourceFile(value) {
    if (typeof value !== 'string' || !value || value.includes('\0') || value.includes('\\')) {
      problem('MISSING_FILE', 'Node event requires an attributable source file');
      return null;
    }
    const relative = path.relative(path.resolve(root), path.resolve(root, value));
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || /^[A-Za-z]:/.test(value)) {
      problem('OUTSIDE_ROOT', `Node source file is outside the configured root: ${value}`);
      return null;
    }
    return relative.split(path.sep).join('/');
  }
  function addFile(file, state) {
    if (file && (!files.has(file) || rank[state] > rank[files.get(file)])) files.set(file, state);
  }
  for (const event of events) {
    const data = event?.data || {};
    if (event.type === 'test:summary') {
      if (!data.file) {
        if (terminalSummary) problem('DUPLICATE_SUMMARY', 'More than one terminal Node summary');
        terminalSummary = data;
      }
      continue;
    }
    if (!['test:start', 'test:pass', 'test:fail'].includes(event.type)) continue;
    const file = sourceFile(data.file);
    const depth = data.nesting;
    if (!Number.isInteger(depth) || depth < 0 || typeof data.name !== 'string' || !data.name) {
      problem('INVALID_EVENT', 'Node test event requires a name and nonnegative nesting');
      continue;
    }
    const stackKey = file || data.file || null;
    const stack = stacks.get(stackKey) || [];
    if (event.type === 'test:start') {
      if (stack.length < depth) problem('MISSING_ANCESTOR', `Missing ancestor for ${data.name}`);
      stack.length = depth;
      stack.push(data.name);
      stacks.set(stackKey, stack);
      continue;
    }
    if (stack[depth] !== data.name) problem('MISSING_START', `Terminal result lacks matching start: ${data.name}`);
    const name = JSON.stringify([...stack.slice(0, depth), data.name]);
    const status = data.skip || data.todo ? 'skipped' : event.type === 'test:fail' ? 'failed' : 'passed';
    addFile(file, status);
    stack.length = depth;
    if (data.details?.type === 'suite') continue;
    if (data.details?.type !== 'test') problem('UNKNOWN_TEST_TYPE', `Node terminal lacks test/suite type: ${data.name}`);
    const id = JSON.stringify([laneId, file, name]);
    if (ids.has(id)) { problem('DUPLICATE_CASE', `Duplicate full test identity: ${name}`); continue; }
    ids.add(id);
    const item = { id, file, name, status };
    const duration = data.details?.duration_ms;
    if (duration !== undefined) {
      if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) problem('INVALID_DURATION', `Invalid duration for ${name}`);
      else item.durationMs = duration;
    }
    out.cases.push(item);
  }
  out.files = [...files].map(([path, status]) => ({ path, status })).sort((a, b) => a.path.localeCompare(b.path));
  out.summary.total = out.cases.length;
  for (const item of out.cases) out.summary[item.status]++;
  if (!out.cases.length) problem('EMPTY_REPORT', 'No individual test results were emitted');
  if (!terminalSummary) problem('TRUNCATED_STREAM', 'Node reporter stream lacks a terminal summary');
  else {
    const counts = terminalSummary.counts || {};
    const expected = { total: counts.tests, passed: counts.passed,
      failed: Number.isInteger(counts.failed) && Number.isInteger(counts.cancelled) ? counts.failed + counts.cancelled : undefined,
      skipped: Number.isInteger(counts.skipped) && Number.isInteger(counts.todo) ? counts.skipped + counts.todo : undefined };
    for (const [key, value] of Object.entries(expected)) {
      if (!Number.isInteger(value) || value !== out.summary[key]) problem('COUNT_MISMATCH', `Node ${key}: reported ${value}, observed ${out.summary[key]}`);
    }
    if (terminalSummary.success === true && out.files.some(file => file.status === 'failed')) problem('CONTRADICTORY_SUCCESS', 'Node success contradicts a retained failure');
    if (terminalSummary.success === false && !out.files.some(file => file.status === 'failed')) problem('UNATTRIBUTED_FAILURE', 'Node reports failure without an attributable failed test or suite');
  }
  out.complete = out.errors.length === 0;
  return out;
}

/** Use --test-reporter=<this file>; stdout is exclusively canonical JSON. */
export default async function* reporter(source) {
  const events = [];
  for await (const event of source) {
    if (['test:stdout', 'test:stderr', 'test:diagnostic'].includes(event.type)) {
      const message = String(event.data?.message || '');
      process.stderr.write(message.endsWith('\n') ? message : `${message}\n`);
    } else events.push(event);
  }
  yield `${JSON.stringify(aggregateTestEvents(events, {
    root: process.env.PAGENARY_TEST_ROOT || process.cwd(),
    laneId: process.env.PAGENARY_TEST_LANE || 'node',
  }))}\n`;
}
