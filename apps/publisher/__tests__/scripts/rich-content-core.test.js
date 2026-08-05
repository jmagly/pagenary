import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  createRendererRegistry,
  defineRendererAdapter,
  normalizeRenderResult,
  renderRichContentNodes
} from '../../scripts/lib/rich-content-adapters.js';
import {
  buildRendererCacheIdentity,
  RendererCache
} from '../../scripts/lib/rich-content-cache.js';
import {
  createRenderDiagnostic,
  escapeFallbackSource,
  resolveFailurePolicy,
  sanitizeDiagnostic
} from '../../scripts/lib/rich-content-diagnostics.js';
import { tokenizeRichContent } from '../../scripts/lib/rich-content-tokenizer.js';

describe('rich-content protected tokenizer', () => {
  test('emits source-aware typed nodes and protects code, HTML, links, images, and special fences', () => {
    const source = [
      'Intro \\(x+y\\) text with `\\(not math\\)` and [\\(label\\)](/math).',
      '',
      '![\\(alt\\)](/diagram.svg)',
      '',
      '<div data-formula="\\(attribute\\)">raw</div>',
      '',
      '```mermaid title="Flow"',
      'graph TD',
      '  A-->B',
      '```',
      '',
      '```js',
      'const example = "\\\\(not rich\\\\)";',
      '```',
      ''
    ].join('\n');

    const { nodes, diagnostics } = tokenizeRichContent(source);
    expect(diagnostics).toEqual([]);

    const byType = (type) => nodes.filter((node) => node.type === type);
    expect(byType('prose').some((node) => node.source.includes('\\(x+y\\)'))).toBe(true);
    expect(byType('codeSpan')).toHaveLength(1);
    expect(byType('link')).toHaveLength(1);
    expect(byType('image')).toHaveLength(1);
    expect(byType('rawHtml')).toHaveLength(1);
    expect(byType('fence')).toHaveLength(2);

    const mermaid = byType('fence').find((node) => node.renderer === 'mermaid');
    expect(mermaid).toMatchObject({
      type: 'fence',
      renderer: 'mermaid',
      info: 'mermaid title="Flow"',
      body: 'graph TD\n  A-->B'
    });
    expect(mermaid.location.start).toEqual({ line: 7, column: 1, offset: source.indexOf('```mermaid') });
    expect(mermaid.location.end.line).toBe(10);
  });

  test('reports unterminated fences with sanitized source location instead of swallowing the rest of the document', () => {
    const { nodes, diagnostics } = tokenizeRichContent('Before\n\n```plantuml\nAlice -> Bob\n');
    expect(nodes.some((node) => node.type === 'fence' && node.renderer === 'plantuml')).toBe(true);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'RTC_TOKEN_UNTERMINATED_FENCE',
      severity: 'error',
      renderer: 'plantuml',
      location: { start: { line: 3, column: 1 } }
    });
  });
});

describe('rich-content adapter registry', () => {
  test('validates adapters and normalizes render payloads from source-aware nodes', async () => {
    const registry = createRendererRegistry();
    const adapter = defineRendererAdapter({
      id: 'mock',
      version: '1.0.0',
      profiles: ['test'],
      validate(node) {
        return node.body.includes('bad')
          ? [createRenderDiagnostic({ code: 'MOCK_BAD', severity: 'error', message: 'Bad mock node' })]
          : [];
      },
      dependencies(node) {
        return [{ type: 'include', path: 'includes/shared.mock', digest: `sha256:${node.body.length}` }];
      },
      cacheIdentity(node, context) {
        return { source: node.body, profile: context.profile };
      },
      async render(node, context) {
        return {
          html: `<figure data-mock="${context.profile}">${node.body}</figure>`,
          semanticText: `mock ${node.body}`,
          source: node.source,
          dependencies: this.dependencies(node, context),
          diagnostics: [],
          rendererMetadata: { renderer: this.id, version: this.version, profile: context.profile }
        };
      },
      diagnose(error) {
        return [createRenderDiagnostic({ code: 'MOCK_THROWN', severity: 'error', message: error.message })];
      }
    });

    registry.register(adapter);
    const source = '```mock\nhello\n```';
    const { nodes } = tokenizeRichContent(source, { specialFences: ['mock'] });
    const results = await renderRichContentNodes(nodes, { registry, profile: 'test', tenantId: 'docs' });

    expect(registry.available()).toEqual([{ id: 'mock', version: '1.0.0', profiles: ['test'] }]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      html: '<figure data-mock="test">hello</figure>',
      semanticText: 'mock hello',
      rendererMetadata: { renderer: 'mock', version: '1.0.0', profile: 'test' },
      dependencies: [{ type: 'include', path: 'includes/shared.mock', digest: 'sha256:5' }],
      diagnostics: []
    });

    const normalized = normalizeRenderResult({ html: '<b>x</b>' }, { adapter, node: nodes[0], profile: 'test' });
    expect(normalized).toMatchObject({
      html: '<b>x</b>',
      semanticText: '',
      assets: [],
      dependencies: [],
      diagnostics: [],
      rendererMetadata: { renderer: 'mock', version: '1.0.0', profile: 'test' }
    });
  });

  test('serves warm adapter results without another renderer invocation', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-render-adapter-cache-'));
    const cache = new RendererCache({ rootDir: dir });
    const registry = createRendererRegistry();
    let invocations = 0;
    registry.register(defineRendererAdapter({
      id: 'cached-mock',
      version: '1.0.0',
      cacheIdentity: (node) => ({ body: node.body, option: 'stable' }),
      async render(node) {
        invocations++;
        return {
          html: `<p>${node.body}</p>`,
          assets: [{ path: 'assets/result.bin', bytes: Buffer.from('binary-result') }],
          semanticText: node.body
        };
      }
    }));
    const node = { renderer: 'cached-mock', body: 'same input', source: 'same input', location: { line: 1, column: 1 } };
    const options = { registry, cache, tenantId: 'docs', pageId: 'intro', profile: 'default' };

    const [cold] = await renderRichContentNodes([node], options);
    const [warm] = await renderRichContentNodes([node], options);

    expect(invocations).toBe(1);
    expect(cold.rendererMetadata.cacheStatus).toBe('miss');
    expect(warm.rendererMetadata.cacheStatus).toBe('hit');
    expect(warm.assets[0].bytes).toEqual(Buffer.from('binary-result'));
  });

  test('renders successfully when the optional cache is unavailable', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-render-cache-bypass-'));
    const blockedRoot = path.join(temp, 'not-a-directory');
    await fs.writeFile(blockedRoot, 'file blocks cache directory');
    const registry = createRendererRegistry();
    registry.register(defineRendererAdapter({
      id: 'cache-bypass', version: '1.0.0', async render() { return { html: '<p>rendered</p>' }; }
    }));

    const [result] = await renderRichContentNodes([
      { renderer: 'cache-bypass', body: 'input', source: 'input' }
    ], {
      registry,
      cache: new RendererCache({ rootDir: blockedRoot }),
      tenantId: 'docs',
      pageId: 'intro'
    });

    expect(result.html).toBe('<p>rendered</p>');
    expect(result.rendererMetadata.cacheStatus).toBe('bypass');
  });

  test('turns adapter failures into escaped fallback payloads in warn mode', async () => {
    const registry = createRendererRegistry();
    registry.register(defineRendererAdapter({
      id: 'mock',
      version: '1.0.0',
      async render() {
        throw new Error('failed at /srv/private/secret.tex with TOKEN=abc123');
      }
    }));

    const { nodes } = tokenizeRichContent('```mock\n<a>unsafe</a>\n```', { specialFences: ['mock'] });
    const [result] = await renderRichContentNodes(nodes, {
      registry,
      profile: 'default',
      failurePolicy: 'warn',
      workspaceRoot: '/srv/vmshare/dev-inbox/jmagly/pagenary'
    });

    expect(result.html).toBe('<pre class="rich-content-fallback"><code>&lt;a&gt;unsafe&lt;/a&gt;</code></pre>');
    expect(result.diagnostics[0].message).not.toContain('/srv/private');
    expect(result.diagnostics[0].message).not.toContain('abc123');
    expect(result.diagnostics[0]).toMatchObject({ code: 'RTC_RENDER_FAILED', severity: 'warning', renderer: 'mock' });
  });
});

describe('rich-content cache identity and storage', () => {
  test('cache identities are deterministic and include tenant, source, config, dependencies, and renderer metadata', () => {
    const base = {
      tenantId: 'tenant-a',
      pageId: 'intro',
      renderer: { id: 'mock', version: '1.0.0' },
      profile: 'default',
      source: 'graph TD',
      config: { b: true, a: 1 },
      theme: { name: 'light' },
      fonts: ['system'],
      outputFormat: 'html',
      securityProfile: 'SANDBOX',
      dependencies: [{ path: 'b.txt', digest: 'sha256:b' }, { path: 'a.txt', digest: 'sha256:a' }]
    };

    const one = buildRendererCacheIdentity(base);
    const two = buildRendererCacheIdentity({
      ...base,
      config: { a: 1, b: true },
      dependencies: [{ digest: 'sha256:a', path: 'a.txt' }, { digest: 'sha256:b', path: 'b.txt' }]
    });
    const differentTenant = buildRendererCacheIdentity({ ...base, tenantId: 'tenant-b' });

    expect(one.key).toBe(two.key);
    expect(one.key).toMatch(/^sha256-[a-f0-9]{64}$/);
    expect(differentTenant.key).not.toBe(one.key);
    expect(one.material.tenantId).toBe('tenant-a');
  });

  test('cache reads validate metadata/content hash and recover from malformed entries', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-render-cache-'));
    const cache = new RendererCache({ rootDir: dir });
    const identity = buildRendererCacheIdentity({
      tenantId: 'tenant-a',
      pageId: 'intro',
      renderer: { id: 'mock', version: '1.0.0' },
      source: 'hello'
    });
    const payload = { html: '<p>Hello</p>', semanticText: 'Hello', diagnostics: [] };

    await cache.write(identity, payload);
    await expect(cache.read(identity)).resolves.toMatchObject({ status: 'hit', payload });

    const entryPath = cache.entryPath(identity);
    const parsed = JSON.parse(await fs.readFile(entryPath, 'utf8'));
    parsed.payload.html = '<p>poisoned</p>';
    await fs.writeFile(entryPath, JSON.stringify(parsed), 'utf8');

    await expect(cache.read(identity)).resolves.toMatchObject({
      status: 'miss',
      reason: 'content-hash-mismatch'
    });
  });

  test('isolates tenants and ignores interrupted partial writes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-render-cache-isolation-'));
    const cache = new RendererCache({ rootDir: dir });
    const base = { pageId: 'intro', renderer: { id: 'mock', version: '1.0.0' }, source: 'same source' };
    const tenantA = buildRendererCacheIdentity({ ...base, tenantId: 'tenant-a' });
    const tenantB = buildRendererCacheIdentity({ ...base, tenantId: 'tenant-b' });

    await cache.write(tenantA, { html: '<p>Tenant A</p>' });
    await fs.writeFile(path.join(dir, `.${tenantB.key}.interrupted.tmp`), '{"partial":', 'utf8');

    await expect(cache.read(tenantA)).resolves.toMatchObject({ status: 'hit', payload: { html: '<p>Tenant A</p>' } });
    await expect(cache.read(tenantB)).resolves.toMatchObject({ status: 'miss', reason: 'not-found' });
  });

  test('concurrent writes publish one complete atomic entry and clean temporary files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-render-cache-concurrent-'));
    const cache = new RendererCache({ rootDir: dir });
    const identity = buildRendererCacheIdentity({
      tenantId: 'tenant-a', pageId: 'intro', renderer: { id: 'mock', version: '1.0.0' }, source: 'same source'
    });
    const payloads = Array.from({ length: 12 }, (_, index) => ({ html: `<p>${index}</p>`, index }));

    await Promise.all(payloads.map((payload) => cache.write(identity, payload)));
    const result = await cache.read(identity);
    expect(result.status).toBe('hit');
    expect(payloads).toContainEqual(result.payload);
    expect((await fs.readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });
});

describe('rich-content diagnostics', () => {
  test('sanitizes diagnostics, escapes fallback source, and prevents page policy from weakening platform policy', () => {
    const diagnostic = sanitizeDiagnostic(createRenderDiagnostic({
      code: 'RTC_SECRET_PATH',
      severity: 'error',
      renderer: 'latexPage',
      message: 'Read failed at /srv/vmshare/dev-inbox/jmagly/pagenary/content/doc.tex and /home/user/.ssh/id_rsa token=abcdef123456',
      location: {
        file: '/srv/vmshare/dev-inbox/jmagly/pagenary/content/doc.tex',
        start: { line: 4, column: 3, offset: 18 },
        end: { line: 4, column: 12, offset: 27 }
      }
    }), { workspaceRoot: '/srv/vmshare/dev-inbox/jmagly/pagenary' });

    expect(diagnostic.message).toContain('content/doc.tex');
    expect(diagnostic.message).not.toContain('/home/user');
    expect(diagnostic.message).not.toContain('abcdef123456');
    expect(diagnostic.location.file).toBe('content/doc.tex');
    expect(escapeFallbackSource('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');

    expect(resolveFailurePolicy({ platformPolicy: 'warn', pagePolicy: 'off' })).toBe('warn');
    expect(resolveFailurePolicy({ platformPolicy: 'warn', pagePolicy: 'strict' })).toBe('strict');
  });
});
