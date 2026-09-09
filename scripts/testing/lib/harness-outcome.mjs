/** Classify a completed standalone action without converting environment failures into evidence. */
export function classifyHarnessOutcome(state) {
  const errors = [];
  const fail = (code, message) => errors.push({ code, message });
  if (state.interrupted) fail('INTERRUPTED', 'Harness runner was interrupted');
  if (state.spawnError) fail('SPAWN_ERROR', state.spawnError.message);
  if (state.timedOut) fail('TIMEOUT', 'Harness exceeded its bounded runtime');
  if (state.signal) fail('SIGNAL', `Harness terminated by ${state.signal}`);
  // Prerequisite failures and explicit skips never qualify as mutation kills.
  if (/ERR_MODULE_NOT_FOUND|Cannot find module|No module named|Playwright is required|Executable doesn't exist|dist\/ not found/.test(state.tail)) fail('MISSING_PREREQUISITE', 'Harness stopped at an unavailable prerequisite; see raw diagnostics');
  if (/^.*(?:skipping browser|SKIP:|SKIPPED:).*$/im.test(state.tail)) fail('SKIPPED_HARNESS', 'Harness reported skipped work');
  const status = state.code === 0 && !errors.length ? 'passed' : 'failed';
  return { errors, status, complete: errors.length === 0, exitCode: status === 'passed' ? 0 : 1 };
}
