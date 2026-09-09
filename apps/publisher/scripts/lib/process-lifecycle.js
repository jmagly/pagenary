import { spawn } from 'node:child_process';

// Register close/error tracking immediately, before any readiness or cleanup wait.
export function startManagedProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    ...options,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  let spawnError;
  let closed = false;
  let stopped;
  child.stdout.on('data', (data) => { stdout = (stdout + data).slice(-8 * 1024 * 1024); });
  child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-8 * 1024 * 1024); });
  child.on('error', (error) => { spawnError = error; });
  const completion = new Promise((resolve) => child.once('close', (code, signal) => {
    closed = true;
    resolve({ code, signal, stdout, stderr, error: spawnError });
  }));
  function signalTree(signal) {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  async function wait(timeoutMs) {
    let timer;
    try {
      return await Promise.race([
        completion,
        new Promise((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); })
      ]);
    } finally { clearTimeout(timer); }
  }
  function stop() {
    if (stopped) return stopped;
    stopped = (async () => {
      if (closed) return completion;
      signalTree('SIGTERM');
      let result = await wait(1000);
      if (!result) {
        signalTree('SIGKILL');
        result = await wait(3000);
      }
      if (!result) throw new Error(`Child ${child.pid} did not close after SIGKILL`);
      return result;
    })();
    return stopped;
  }
  async function waitForOutput(pattern, timeoutMs = 10000) {
    let timer;
    let onData;
    try {
      return await Promise.race([
        new Promise((resolve) => {
          onData = () => {
            const match = stdout.match(pattern);
            if (match) resolve(match);
          };
          child.stdout.on('data', onData);
          onData();
        }),
        completion.then((result) => {
          throw new Error(`Child exited before readiness (${result.code ?? result.signal}): ${result.error?.message || result.stderr}`);
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Child readiness timed out: ${stderr}`)), timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
      child.stdout.off('data', onData);
    }
  }
  return { child, completion, wait, stop, waitForOutput };
}

export async function runManagedProcess(command, args, options = {}, timeoutMs = 45000, active = new Set()) {
  const process = startManagedProcess(command, args, options);
  active.add(process);
  try {
    const result = await process.wait(timeoutMs);
    if (!result) {
      const stopped = await process.stop();
      throw new Error(`Child exceeded ${timeoutMs}ms: ${stopped.stderr}`);
    }
    if (result.error) throw result.error;
    return result;
  } finally {
    await process.stop();
    active.delete(process);
  }
}

export async function startPreviewServer(script, options = {}) {
  const server = startManagedProcess(process.execPath, [script, '--dev'], {
    ...options,
    env: { ...process.env, ...options.env, PORT: '0', HOST: '127.0.0.1' }
  });
  try {
    const match = await server.waitForOutput(/Serving dist at http:\/\/127\.0\.0\.1:(\d+) /);
    const port = Number(match[1]);
    if (!(port > 0 && port <= 65535)) throw new Error('Server did not report its bound port');
    return { ...server, origin: `http://127.0.0.1:${port}` };
  } catch (error) {
    await server.stop();
    throw error;
  }
}

// A single request deadline covers headers and subsequent body consumption.
export function fetchWithDeadline(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
}
