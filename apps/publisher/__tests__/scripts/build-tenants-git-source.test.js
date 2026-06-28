/**
 * Regression coverage for the build-tenants git-source security fixes.
 *
 * #80 — shell-injection safety: git commands are executed as argv arrays via
 *       spawn(cmd, args) with no shell, and credentials are masked in logged
 *       command strings. execWithRetry rejects any non-array (shell-string)
 *       command before it can reach spawn.
 * #81 — GIT_CREDENTIALS: withGitCredentials() transforms an https source URL
 *       into a credential-bearing URL when GIT_CREDENTIALS is set, and leaves
 *       SSH / already-authenticated / non-https URLs untouched.
 */

import {
  execWithRetry,
  withGitCredentials,
  maskAuthSegment
} from '../../scripts/build-tenants.js';

describe('build-tenants git source — shell-injection safety (#80)', () => {
  test('execWithRetry refuses a shell-string command (argv arrays only)', async () => {
    // A string would be the classic `sh -c "<interpolated>"` injection vector.
    await expect(execWithRetry('git clone https://x; rm -rf /'))
      .rejects.toThrow(/expected an argument array/);
  });

  test('execWithRetry refuses an empty command', async () => {
    await expect(execWithRetry([])).rejects.toThrow(/expected an argument array/);
  });

  test('maskAuthSegment hides embedded credentials in logged commands', () => {
    expect(maskAuthSegment('https://user:t0ken@github.com/org/repo.git'))
      .toBe('https://***@github.com/org/repo.git');
    // Non-credential segments pass through untouched.
    expect(maskAuthSegment('git')).toBe('git');
    expect(maskAuthSegment('https://github.com/org/repo.git'))
      .toBe('https://github.com/org/repo.git');
  });
});

describe('build-tenants GIT_CREDENTIALS support (#81)', () => {
  const ORIGINAL = process.env.GIT_CREDENTIALS;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GIT_CREDENTIALS;
    else process.env.GIT_CREDENTIALS = ORIGINAL;
  });

  test('embeds credentials into an https URL when GIT_CREDENTIALS is set', () => {
    process.env.GIT_CREDENTIALS = 'alice:s3cr3t';
    expect(withGitCredentials('https://git.example.com/org/repo.git'))
      .toBe('https://alice:s3cr3t@git.example.com/org/repo.git');
  });

  test('URL-encodes special characters in the credentials', () => {
    process.env.GIT_CREDENTIALS = 'alice:p@ss/wo:rd';
    // split(':', 2) → username "alice", password "p@ss/wo" (first colon splits);
    // the password is percent-encoded so the URL stays well-formed.
    const out = withGitCredentials('https://git.example.com/org/repo.git');
    expect(out).toBe('https://alice:p%40ss%2Fwo@git.example.com/org/repo.git');
    expect(out.startsWith('https://alice:')).toBe(true);
  });

  test('leaves an SSH/git URL untouched', () => {
    process.env.GIT_CREDENTIALS = 'alice:s3cr3t';
    expect(withGitCredentials('git@github.com:org/repo.git'))
      .toBe('git@github.com:org/repo.git');
  });

  test('does not double-apply when the URL already carries credentials', () => {
    process.env.GIT_CREDENTIALS = 'alice:s3cr3t';
    const url = 'https://bob:other@git.example.com/org/repo.git';
    expect(withGitCredentials(url)).toBe(url);
  });

  test('is a no-op when GIT_CREDENTIALS is unset', () => {
    delete process.env.GIT_CREDENTIALS;
    expect(withGitCredentials('https://git.example.com/org/repo.git'))
      .toBe('https://git.example.com/org/repo.git');
  });

  test('is a no-op when GIT_CREDENTIALS is malformed (no colon)', () => {
    process.env.GIT_CREDENTIALS = 'tokenonly';
    expect(withGitCredentials('https://git.example.com/org/repo.git'))
      .toBe('https://git.example.com/org/repo.git');
  });
});
