import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_RENDERER_ENV_ALLOWLIST,
  IMMUTABLE_RENDERER_PATHS,
  RENDERER_SECURITY_BASELINES,
  RendererSecurityError,
  buildScrubbedRendererEnv,
  mergeRendererSecurityProfile,
  redactRendererDiagnostic,
  resolveContainedRendererPath,
  runRendererSubprocess
} from '../../scripts/lib/renderer-security.js';

describe('mergeRendererSecurityProfile', () => {
  test('keeps Mermaid 11.16 strict baseline immutable against authored overrides', () => {
    const { profile, rejectedAuthoredPaths } = mergeRendererSecurityProfile({
      operatorOverrides: {
        mermaid: {
          theme: 'neutral'
        }
      },
      authoredOverrides: {
        mermaid: {
          securityLevel: 'loose',
          startOnLoad: true,
          theme: 'forest',
          maxEdges: 9999
        }
      }
    });

    expect(profile.mermaid.version).toBe('11.16.0');
    expect(profile.mermaid.securityLevel).toBe('strict');
    expect(profile.mermaid.startOnLoad).toBe(false);
    expect(profile.mermaid.maxEdges).toBe(RENDERER_SECURITY_BASELINES.mermaid.maxEdges);
    expect(profile.mermaid.theme).toBe('forest');
    expect(rejectedAuthoredPaths).toEqual([
      'mermaid.securityLevel',
      'mermaid.startOnLoad',
      'mermaid.maxEdges'
    ]);
    expect(IMMUTABLE_RENDERER_PATHS).toContain('mermaid.securityLevel');
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.mermaid)).toBe(true);
  });
});

describe('buildScrubbedRendererEnv', () => {
  test('keeps only safe allowlisted environment keys', () => {
    const env = buildScrubbedRendererEnv({
      baseEnv: {
        PATH: '/usr/bin',
        LANG: 'C.UTF-8',
        HOME: '/tmp/home',
        GITHUB_TOKEN: 'ghs-secret',
        AWS_SECRET_ACCESS_KEY: 'aws-secret',
        CUSTOM_FLAG: 'drop-me'
      },
      allowEnv: DEFAULT_RENDERER_ENV_ALLOWLIST,
      overrides: {
        LC_ALL: 'C.UTF-8'
      }
    });

    expect(env).toEqual({
      PATH: '/usr/bin',
      LANG: 'C.UTF-8',
      HOME: '/tmp/home',
      LC_ALL: 'C.UTF-8'
    });
  });

  test('rejects secret-bearing override keys', () => {
    expect(() => buildScrubbedRendererEnv({
      baseEnv: { PATH: '/usr/bin' },
      overrides: { API_TOKEN: 'secret' }
    })).toThrow(RendererSecurityError);
  });
});

describe('resolveContainedRendererPath', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-security-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('accepts contained files and contained symlinks', () => {
    const docsDir = path.join(tmpDir, 'docs');
    const nestedDir = path.join(tmpDir, 'nested');
    fs.mkdirSync(docsDir);
    fs.mkdirSync(nestedDir);
    fs.writeFileSync(path.join(docsDir, 'page.tex'), 'ok');
    fs.writeFileSync(path.join(nestedDir, 'inside.tex'), 'ok');
    fs.symlinkSync(nestedDir, path.join(tmpDir, 'nested-link'), 'dir');

    expect(resolveContainedRendererPath(tmpDir, 'docs/page.tex')).toBe(path.join(docsDir, 'page.tex'));
    expect(resolveContainedRendererPath(tmpDir, 'nested-link/inside.tex')).toBe(path.join(nestedDir, 'inside.tex'));
    expect(resolveContainedRendererPath(tmpDir, 'nested-link/new.tex', { allowMissingLeaf: true }))
      .toBe(path.join(nestedDir, 'new.tex'));
  });

  test('rejects traversal, URL-like paths, and symlink escapes', () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-security-outside-'));
    try {
    fs.mkdirSync(path.join(tmpDir, 'docs'));
    fs.symlinkSync(outsideDir, path.join(tmpDir, 'escape-link'), 'dir');

    expect(() => resolveContainedRendererPath(tmpDir, '../secret.tex')).toThrow(/tenant root/i);
    expect(() => resolveContainedRendererPath(tmpDir, '/etc/passwd')).toThrow(/tenant-relative/i);
    expect(() => resolveContainedRendererPath(tmpDir, 'https://example.com/diagram.puml')).toThrow(/tenant-relative/i);
    expect(() => resolveContainedRendererPath(tmpDir, 'escape-link/secrets.txt')).toThrow(/escapes tenant root/i);

    } finally { fs.rmSync(outsideDir, { recursive: true, force: true }); }
  });
});

describe('runRendererSubprocess', () => {
  test('runs only explicitly allowlisted commands', async () => {
    const result = await runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("ok\\n")'],
      env: buildScrubbedRendererEnv({
        baseEnv: { PATH: process.env.PATH, LANG: 'C.UTF-8', GITHUB_TOKEN: 'hidden' }
      }),
      trustedCommands: [process.execPath]
    });

    expect(result).toEqual({
      code: 0,
      signal: null,
      stdout: 'ok\n',
      stderr: ''
    });
  });

  test('rejects an existing command outside an existing trusted allowlist', async () => {
    await expect(runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("should not execute")'],
      trustedCommands: [fileURLToPath(import.meta.url)]
    })).rejects.toMatchObject({ code: 'ERR_RENDERER_UNTRUSTED_COMMAND' });
  });

  test('rejects a missing trusted allowlist entry', async () => {
    await expect(runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("x")'],
      trustedCommands: [path.join(path.dirname(process.execPath), 'definitely-not-node')]
    })).rejects.toMatchObject({ code: 'ERR_RENDERER_TRUSTED_COMMAND' });
  });

  test('terminates subprocesses that exceed the timeout budget', async () => {
    await expect(runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 2000)'],
      timeoutMs: 100,
      killGraceMs: 25,
      trustedCommands: [process.execPath]
    })).rejects.toMatchObject({ code: 'ERR_RENDERER_TIMEOUT' });
  });

  test('terminates subprocesses that exceed the output budget', async () => {
    await expect(runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'process.stdout.write("x".repeat(2048))'],
      maxOutputBytes: 128,
      killGraceMs: 25,
      trustedCommands: [process.execPath]
    })).rejects.toMatchObject({ code: 'ERR_RENDERER_OUTPUT_LIMIT' });
  });
});

describe('redactRendererDiagnostic', () => {
  test('redacts tenant paths, generic absolute paths, and secrets without losing structure', () => {
    const tenantRoot = path.join(os.tmpdir(), 'tenant-root');
    const diagnostic = {
      message: `failed to read ${tenantRoot}/content/page.tex with GITHUB_TOKEN=abc123 and /home/test/.ssh/id_rsa`,
      detail: 'https://renderer.local/render?token=abc123'
    };

    const redacted = redactRendererDiagnostic(diagnostic, {
      rootPaths: [tenantRoot],
      secretValues: ['abc123']
    });

    expect(redacted).toEqual({
      message: 'failed to read <tenant-root>/content/page.tex with GITHUB_TOKEN=<redacted> and <abs-path>',
      detail: 'https://renderer.local/render?token=<redacted>'
    });
  });
});
