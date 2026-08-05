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

  test('materializes successful PlantUML output for static HTML consumers', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-puml-build-'));
    const distDir = path.join(root, 'dist');
    const executablePath = path.join(root, 'plantuml');
    await fs.writeFile(executablePath, `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const outputDir = process.argv[process.argv.indexOf('-o') + 1];
const input = process.argv.at(-1);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>Author to Publisher</text></svg>');
`, { mode: 0o700 });
    try {
      const output = await renderConfiguredBuildFences('```puml\nAuthor -> Publisher: build\n```', {
        richContentConfig: {
          failurePolicy: 'strict',
          plantuml: { enabled: true, executablePath, version: '1.2026.4' }
        },
        renderDiagnostics: [], contentRoot: root, currentPath: 'page.md', distDir
      });
      const { markdownToHtml } = await import('../../scripts/build-tenants.js');
      const html = markdownToHtml(output);
      const asset = html.match(/assets\/rich-content\/plantuml\/[a-f0-9]{24}\.svg/)?.[0];
      expect(asset).toBeTruthy();
      expect(html).toContain('<img src="./assets/rich-content/plantuml/');
      expect(html).not.toContain('language-puml');
      await expect(fs.readFile(path.join(distDir, asset), 'utf8')).resolves.toMatch(/<svg\b/);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
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
