import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createMermaidBuildAdapter,
  deterministicMermaidId,
  sanitizeMermaidSvg
} from '../../scripts/lib/mermaid-build-adapter.js';
import { createRendererRegistry, renderRichContentNodes } from '../../scripts/lib/rich-content-adapters.js';

const node = {
  type: 'fence',
  renderer: 'mermaid',
  body: 'flowchart LR\n  A --> B',
  attributes: { title: 'Request flow' },
  location: { start: { line: 4, column: 1 } }
};

describe('Mermaid build-time adapter', () => {
  test('produces deterministic accessible output, cache identity, and provenance', async () => {
    const calls = [];
    const renderer = async (input) => {
      calls.push(input);
      return { svg: `<svg id="${input.id}" aria-label="old"><g><text>A to B</text></g></svg>` };
    };
    const adapter = createMermaidBuildAdapter({ renderer });

    const first = await adapter.render(node, { mermaidConfig: { theme: 'forest', securityLevel: 'loose' } });
    const second = await adapter.render(node, { mermaidConfig: { theme: 'forest' } });

    expect(first.html).toBe(second.html);
    expect(first.html).toContain('<figure class="rich-diagram rich-diagram--mermaid"');
    expect(first.html).toContain('<img src="./assets/rich-content/mermaid/');
    expect(first.html).toContain('aria-describedby="pagenary-mermaid-');
    expect(first.html).toContain('<figcaption');
    expect(first.html).toContain('Request flow');
    expect(first.html).toContain('<summary>Mermaid source</summary>');
    expect(first.semanticText).toContain('A --> B');
    expect(first.rendererMetadata).toMatchObject({ renderer: 'mermaid', version: '11.16.0', profile: 'build' });
    expect(first.rendererMetadata.provenance.sourceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.rendererMetadata.provenance.outputDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.assets).toHaveLength(1);
    expect(first.assets[0]).toMatchObject({ mimeType: 'image/svg+xml', integrity: expect.stringMatching(/^sha256:[a-f0-9]{64}$/) });
    expect(first.assets[0].path).toMatch(/^assets\/rich-content\/mermaid\/[a-f0-9]{24}\.svg$/);
    expect(calls[0].config).toMatchObject({
      theme: 'forest',
      securityLevel: 'strict',
      look: 'classic',
      handDrawnSeed: 1,
      startOnLoad: false,
      suppressErrorRendering: true
    });
    expect(Object.isFrozen(calls[0].config)).toBe(true);
  });

  test('uses stable source and config hashes for IDs', () => {
    expect(deterministicMermaidId('A --> B', { theme: 'default' }))
      .toBe(deterministicMermaidId('A --> B', { theme: 'default' }));
    expect(deterministicMermaidId('A --> C', { theme: 'default' }))
      .not.toBe(deterministicMermaidId('A --> B', { theme: 'default' }));
    expect(deterministicMermaidId('A --> B', { theme: 'default' }, { fonts: ['A'] }))
      .not.toBe(deterministicMermaidId('A --> B', { theme: 'default' }, { fonts: ['B'] }));
  });

  test('removes active SVG content and unsafe attributes', () => {
    const clean = sanitizeMermaidSvg('<svg onclick="steal()"><script>alert(1)</script><a href="javascript:go()"><text>x</text></a><foreignObject>bad</foreignObject></svg>');
    expect(clean).not.toMatch(/script|foreignObject|onclick|javascript:/i);
    expect(clean).not.toMatch(/alert\(1\)|bad/);
    expect(clean).toContain('<text>x</text>');
  });

  test('warn mode returns escaped source fallback when no browser DOM is available', async () => {
    const registry = createRendererRegistry();
    registry.register(createMermaidBuildAdapter());
    const [result] = await renderRichContentNodes([
      { ...node, body: 'flowchart LR\n  <script> --> B' }
    ], { registry, profile: 'build', failurePolicy: 'warn' });

    expect(result.diagnostics[0]).toMatchObject({ code: 'MERMAID_BUILD_UNAVAILABLE', severity: 'warning' });
    expect(result.html).toContain('&lt;script&gt;');
    expect(result.html).not.toContain('<script>');
  });

  test('strict mode fails the build and source bounds fail before renderer execution', async () => {
    const registry = createRendererRegistry();
    let rendererCalls = 0;
    registry.register(createMermaidBuildAdapter({ maxSourceBytes: 8, renderer: async () => { rendererCalls++; return '<svg></svg>'; } }));

    await expect(renderRichContentNodes([node], {
      registry,
      profile: 'build',
      failurePolicy: 'strict'
    })).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: 'MERMAID_SOURCE_LIMIT' })] });
    expect(rendererCalls).toBe(0);
  });

  test('bounds CLI execution and removes its temporary workspace after failure', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-mermaid-test-'));
    const command = path.join(tempRoot, 'slow-mmdc');
    await fs.writeFile(command, '#!/bin/sh\nexec sleep 2\n', { mode: 0o700 });
    try {
      const registry = createRendererRegistry();
      registry.register(createMermaidBuildAdapter({
        executablePath: command,
        browserPath: '/bin/true',
        timeoutMs: 25,
        tempRoot
      }));
      await expect(renderRichContentNodes([node], {
        registry,
        profile: 'build',
        failurePolicy: 'strict'
      })).rejects.toMatchObject({
        diagnostics: [expect.objectContaining({
          code: 'MERMAID_RENDER_FAILED',
          message: expect.stringMatching(/exceeded timeout budget/)
        })]
      });
      expect(await fs.readdir(tempRoot)).toEqual(['slow-mmdc']);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
