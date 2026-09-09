import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { classifyHarnessOutcome } from './lib/harness-outcome.mjs';

// A standalone assertion script is one file-level test, not an inferred count
// of assertions or source declarations. Discovery registers that exact action.
export async function runHarness({ root = process.cwd(), file, argv, cwd = '.', mode = 'execution', timeoutMs = 1200000, name = 'standalone harness', diagnostic = () => {} }) {
  const out = { cases: [], files: [], summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, errors: [], complete: false };
  const fail = (code, message) => out.errors.push({ code, message });
  let exitCode = 2;
  try {
    if (!['execution', 'discovery'].includes(mode)) throw new Error('Mode must be execution or discovery');
    if (typeof file !== 'string' || !file || path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error('File must be target-relative');
    const canonicalRoot = await fs.realpath(root), absolute = await fs.realpath(path.resolve(root, file));
    if (!absolute.startsWith(`${canonicalRoot}${path.sep}`) || !(await fs.stat(absolute)).isFile()) throw new Error('Harness must be an owned regular file');
    if (!Array.isArray(argv) || !argv.length || argv.some(x => typeof x !== 'string' || !x || x.includes('\0'))) throw new Error('Harness requires explicit argv');
    const workingDirectory = await fs.realpath(path.resolve(root, cwd));
    if (workingDirectory !== canonicalRoot && !workingDirectory.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error('Harness cwd escapes target');
    // The declared action must actually name the registered harness. A successful
    // unrelated command cannot become evidence for a candidate file.
    if (!argv.slice(1).some(arg => path.resolve(workingDirectory, arg) === absolute)) throw new Error('Command does not invoke its registered harness');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('Invalid timeout');
    const item = { id: JSON.stringify(['harness', file, name]), file, name, status: 'unknown' };
    out.cases.push(item); out.files.push({ path: file, status: 'unknown' }); out.summary.total = 1;
    if (mode === 'discovery') { out.complete = true; return { result: out, exitCode: 0 }; }
    const state = await new Promise(resolve => {
      let timedOut = false, interrupted = false, spawnError, tail = '', escalation;
      const child = spawn(argv[0], argv.slice(1), { cwd: workingDirectory, env: { ...process.env, SMOKE_REQUIRE: '1' }, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
      const kill = signal => { try { if (process.platform !== 'win32') process.kill(-child.pid, signal); else child.kill(signal); } catch (e) { if (e.code !== 'ESRCH') diagnostic(e.message); } };
      const interrupt = () => { interrupted = true; kill('SIGTERM'); escalation = setTimeout(() => kill('SIGKILL'), 500); };
      process.on('SIGTERM', interrupt); process.on('SIGINT', interrupt);
      const timer = setTimeout(() => { timedOut = true; kill('SIGTERM'); escalation = setTimeout(() => kill('SIGKILL'), 1000); }, timeoutMs);
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { const text = chunk.toString(); tail = (tail + text).slice(-65536); diagnostic(text); });
      child.on('error', error => { spawnError = error; });
      child.on('close', (code, signal) => { clearTimeout(timer); clearTimeout(escalation); process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt); resolve({ code, signal, timedOut, interrupted, spawnError, tail }); });
    });
    const outcome = classifyHarnessOutcome(state);
    out.errors.push(...outcome.errors);
    item.status = outcome.status;
    out.files[0].status = item.status; out.summary[item.status] = 1;
    out.complete = outcome.complete;
    exitCode = outcome.exitCode;
  } catch (error) { fail('INVALID_HARNESS', error.message); }
  return { result: out, exitCode };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), split = args.indexOf('--');
  const flags = args.slice(0, split < 0 ? args.length : split), opts = {};
  for (let i = 0; i < flags.length; i += 2) opts[flags[i].replace(/^--/, '')] = flags[i + 1];
  const { result, exitCode } = await runHarness({ file: opts.file, cwd: opts.cwd, mode: opts.mode, name: opts.name,
    timeoutMs: opts.timeout ? Number(opts.timeout) : undefined, argv: split < 0 ? [] : args.slice(split + 1), diagnostic: text => process.stderr.write(text) });
  process.stdout.write(`${JSON.stringify(result)}\n`); process.exitCode = exitCode;
}
