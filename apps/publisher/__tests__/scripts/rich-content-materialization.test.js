import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { materializeRichContentAssets, renderConfiguredBuildFences } from '../../scripts/build-tenants.js';

describe('rich-content fence materialization', () => {
  test('keeps Mermaid fences for the default local runtime mode', async () => {
    const source = '```mermaid\ngraph TD\n A-->B\n```';
    await expect(renderConfiguredBuildFences(source, {
      richContentConfig: { mermaid: { mode: 'runtime' } }
    })).resolves.toBe(source);
  });

  test('normalizes Mermaid fence metadata to the runtime language class', async () => {
    const { markdownToHtml } = await import('../../scripts/build-tenants.js');
    const html = markdownToHtml('```mermaid title="Request flow"\ngraph TD\n A-->B\n```');
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain('data-title="Request flow"');
    expect(html).not.toContain('language-mermaid title');
  });

  test('routes the puml alias through PlantUML preprocessing', async () => {
    const diagnostics = [];
    const output = await renderConfiguredBuildFences('# Heading\n\n```puml\n@startuml\nA -> B\n@enduml\n```', {
      richContentConfig: { failurePolicy: 'warn', plantuml: { enabled: true } },
      renderDiagnostics: diagnostics,
      contentRoot: process.cwd(),
      currentPath: 'page.md'
    });
    expect(output).toContain('rich-content-fallback');
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        renderer: 'plantuml', severity: 'warning', profile: 'SANDBOX',
        location: { file: 'page.md', line: 3, column: 1 }
      })
    ]));
  });

  test('build mode degrades to visible source and diagnostics without a configured CLI', async () => {
    const diagnostics = [];
    const output = await renderConfiguredBuildFences('```mermaid\ngraph TD\n A-->B\n```', {
      richContentConfig: { failurePolicy: 'warn', mermaid: { mode: 'build' } },
      renderDiagnostics: diagnostics,
      contentRoot: process.cwd(),
      currentPath: 'page.md'
    });
    expect(output).toContain('```html');
    expect(output).toContain('rich-content-fallback');
    expect(output).toContain('graph TD');
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MERMAID_BUILD_UNAVAILABLE', severity: 'warning' })
    ]));
  });

  test('strict build mode fails when the renderer is unavailable', async () => {
    await expect(renderConfiguredBuildFences('```mermaid\ngraph TD\n A-->B\n```', {
      richContentConfig: { failurePolicy: 'strict', mermaid: { mode: 'build' } },
      renderDiagnostics: [],
      contentRoot: process.cwd(),
      currentPath: 'page.md'
    })).rejects.toThrow(/configured absolute executable path/i);
  });

  test('writes only contained content-addressed renderer assets', async () => {
    const distDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-rich-assets-'));
    try {
      await materializeRichContentAssets([{
        path: 'assets/rich-content/plantuml/abc123.svg',
        bytes: Buffer.from('<svg/>')
      }], distDir);
      await expect(fs.readFile(path.join(distDir, 'assets/rich-content/plantuml/abc123.svg'), 'utf8'))
        .resolves.toBe('<svg/>');
      await expect(materializeRichContentAssets([{
        path: '../escape.svg', bytes: Buffer.from('unsafe')
      }], distDir)).rejects.toThrow(/unsafe asset path/);
    } finally {
      await fs.rm(distDir, { recursive: true, force: true });
    }
  });
});
