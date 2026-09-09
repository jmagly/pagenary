import path from 'node:path';

// Registration uses enqueue events, including dynamic children. Discovering
// dynamic Node tests executes their parents, so this is not a side-effect-free list.
export function registeredNodeTests(events, { root = process.cwd(), laneId = 'node' } = {}) {
  const out = { cases: [], files: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, errors: [], complete: false };
  const stacks = new Map(), files = new Set(), ids = new Set();
  const fail = (code, message) => out.errors.push({ code, message });
  let summary;
  for (const event of events) {
    const d = event.data || {};
    if (event.type === 'test:summary' && !d.file) {
      if (summary) fail('DUPLICATE_SUMMARY', 'More than one Node summary');
      summary = d;
      continue;
    }
    if (!['test:enqueue', 'test:start'].includes(event.type)) continue;
    if (typeof d.file !== 'string' || !d.file || d.file.includes('\0')) {
      fail('MISSING_FILE', 'Registration requires an actual Node source path'); continue;
    }
    const file = path.relative(path.resolve(root), path.resolve(root, d.file)).split(path.sep).join('/');
    if (!file || file === '..' || file.startsWith('../') || path.isAbsolute(file) || file.includes('\\')) {
      fail('OUTSIDE_ROOT', 'Registration source is outside the target root'); continue;
    }
    // Node's process-isolation envelope announces the file itself, not a user test.
    if (event.type === 'test:enqueue' && d.name === file && d.nesting === 0 && d.line === 1 && d.column === 1) continue;
    if (!Number.isInteger(d.nesting) || d.nesting < 0 || typeof d.name !== 'string' || !d.name) {
      fail('INVALID_REGISTRATION', 'Registration lacks name or nesting'); continue;
    }
    const stack = stacks.get(file) || [];
    if (stack.length < d.nesting) fail('MISSING_ANCESTOR', `Missing registration ancestor for ${d.name}`);
    stack.length = d.nesting;
    const name = JSON.stringify([...stack, d.name]);
    stack.push(d.name); stacks.set(file, stack);
    if (event.type !== 'test:enqueue') continue;
    files.add(file);
    if (d.type === 'suite') continue;
    if (d.type !== 'test') { fail('UNKNOWN_TYPE', 'Unknown registration kind'); continue; }
    const id = JSON.stringify([laneId, file, name]);
    if (ids.has(id)) { fail('DUPLICATE_CASE', `Duplicate registration ${name}`); continue; }
    ids.add(id); out.cases.push({ id, file, name, status: 'unknown' });
  }
  out.files = [...files].sort().map(path => ({ path, status: 'unknown' }));
  out.summary.total = out.cases.length;
  if (!summary || !Number.isInteger(summary.counts?.tests)) fail('TRUNCATED_STREAM', 'Node registration stream lacks its final summary');
  else if (summary.counts.tests !== out.cases.length) fail('COUNT_MISMATCH', 'Registered cases differ from final Node population');
  if (!out.cases.length) fail('EMPTY_REPORT', 'No Node cases were registered');
  out.complete = out.errors.length === 0;
  return out;
}

export default async function* reporter(source) {
  const events = [];
  for await (const event of source) {
    if (['test:stdout', 'test:stderr', 'test:diagnostic'].includes(event.type)) {
      process.stderr.write(`${String(event.data?.message || '').replace(/\n$/, '')}\n`);
    } else events.push(event);
  }
  yield `${JSON.stringify(registeredNodeTests(events, {
    root: process.env.PAGENARY_TEST_ROOT || process.cwd(), laneId: process.env.PAGENARY_TEST_LANE || 'node',
  }))}\n`;
}
