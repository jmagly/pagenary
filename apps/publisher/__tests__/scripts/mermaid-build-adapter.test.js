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
    expect(first.html).toContain('role="img"');
    expect(first.html).toContain('aria-labelledby="pagenary-mermaid-');
    expect(first.html).toContain('<figcaption');
    expect(first.html).toContain('Request flow');
    expect(first.html).toContain('<summary>Mermaid source</summary>');
    expect(first.semanticText).toContain('A --> B');
    expect(first.rendererMetadata).toMatchObject({ renderer: 'mermaid', version: '11.16.0', profile: 'build' });
    expect(first.rendererMetadata.provenance.sourceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.rendererMetadata.provenance.outputDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(calls[0].config).toMatchObject({
      theme: 'forest',
      securityLevel: 'strict',
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
    registry.register(createMermaidBuildAdapter({ maxSourceBytes: 8, renderer: async () => '<svg></svg>' }));

    await expect(renderRichContentNodes([node], {
      registry,
      profile: 'build',
      failurePolicy: 'strict'
    })).rejects.toMatchObject({ diagnostics: [expect.objectContaining({ code: 'MERMAID_SOURCE_LIMIT' })] });
  });
});
