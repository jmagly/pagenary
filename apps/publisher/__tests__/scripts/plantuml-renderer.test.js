import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRendererRegistry, renderRichContentNodes } from '../../scripts/lib/rich-content-adapters.js';
import {
  createPlantUmlAdapter,
  diagnosePlantUmlTool,
  expandContainedIncludes,
  sanitizePlantUmlSvg
} from '../../scripts/lib/plantuml-renderer.js';

describe('PlantUML build-time adapter', () => {
  let tmpDir;
  let fakePlantUml;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plantuml-renderer-'));
    fakePlantUml = path.join(tmpDir, 'fake-plantuml.mjs');
    fs.writeFileSync(fakePlantUml, `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
if (process.argv.includes('-version')) {
  process.stdout.write('PlantUML version 1.2026.6 (fake)\\n');
  process.exit(0);
}
if (process.env.PLANTUML_SECURITY_PROFILE !== 'SANDBOX') process.exit(17);
const outputDir = process.argv[process.argv.indexOf('-o') + 1];
const input = process.argv.at(-1);
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, path.basename(input, path.extname(input)) + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><metadata>timestamp</metadata><!-- generated --><script>alert(1)</script><g id="entity-123" onclick="bad()"><a href="https://bad.invalid"><text>Alice to Bob</text></a></g></svg>');
`);
    fs.chmodSync(fakePlantUml, 0o755);
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  test('renders through a bounded local command with SANDBOX and deterministic safe SVG', async () => {
    const adapter = createPlantUmlAdapter({ executablePath: fakePlantUml, tenantRoot: tmpDir, version: '1.2026.6' });
    const registry = createRendererRegistry();
    registry.register(adapter);
    const [result] = await renderRichContentNodes([{
      id: 'sequence', renderer: 'plantuml', body: '@startuml\nAlice -> Bob: hello\n@enduml'
    }], { registry, tenantRoot: tmpDir, failurePolicy: 'strict' });

    expect(result.html).toContain('<figure class="rich-content rich-content-plantuml"');
    expect(result.html).toContain('id="puml-');
    expect(result.html).not.toMatch(/script|onclick|https:\/\/bad/);
    expect(result.semanticText).toBe('Alice -> Bob: hello');
    expect(result.rendererMetadata.profile).toBe('SANDBOX');
    expect(result.rendererMetadata.cacheIdentity).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test('expands only contained local includes and records dependency hashes', async () => {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'shared'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'docs', 'shared', 'actors.puml'), 'actor Alice');
    const expanded = await expandContainedIncludes('!include shared/actors.puml\nAlice -> Bob', {
      tenantRoot: tmpDir,
      sourceRelativePath: 'docs/page.md'
    });

    expect(expanded.source).toContain('actor Alice');
    expect(expanded.dependencies).toEqual([{
      path: 'docs/shared/actors.puml', hash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/)
    }]);
  });

  test.each([
    '!includeurl https://example.invalid/a.puml',
    '!include <C4/C4_Context>',
    '!include ../secret.puml',
    '!import /tmp/external.puml'
  ])('rejects remote, external, or traversal include: %s', async (source) => {
    await expect(expandContainedIncludes(source, { tenantRoot: tmpDir }))
      .rejects.toMatchObject({ code: 'RTC_PLANTUML_INCLUDE_REJECTED' });
  });

  test('sanitizes unsafe SVG and produces stable IDs', () => {
    const unsafe = '<?xml version="1.0"?><svg><metadata>x</metadata><g id="unstable" style="fill:url(https://bad.invalid/x)"><a xlink:href="file:///etc/passwd"><text>ok</text></a></g><script/><foreignObject><p>bad</p></foreignObject></svg>';
    const first = sanitizePlantUmlSvg(unsafe, 'Alice -> Bob');
    expect(first).toBe(sanitizePlantUmlSvg(unsafe, 'Alice -> Bob'));
    expect(first).not.toMatch(/metadata|foreignObject|script|file:\/\/|https:\/\/|unstable/);
  });

  test('reports unavailable tools honestly and warn mode returns escaped source', async () => {
    const unavailable = await diagnosePlantUmlTool({ executablePath: path.join(tmpDir, 'missing-plantuml') });
    expect(unavailable.available).toBe(false);
    expect(unavailable.diagnostics[0].code).toMatch(/RTC_PLANTUML|ERR_RENDERER/);

    const registry = createRendererRegistry();
    registry.register(createPlantUmlAdapter({ executablePath: path.join(tmpDir, 'missing-plantuml'), tenantRoot: tmpDir }));
    const source = '@startuml\nAlice <script>alert(1)</script>\n@enduml';
    const [warned] = await renderRichContentNodes([{ renderer: 'plantuml', body: source }], {
      registry, tenantRoot: tmpDir, failurePolicy: 'warn'
    });
    expect(warned.html).toContain('&lt;script&gt;');
    expect(warned.html).not.toContain('<script>');
    expect(warned.diagnostics[0].severity).toBe('warning');

    await expect(renderRichContentNodes([{ renderer: 'plantuml', body: source }], {
      registry, tenantRoot: tmpDir, failurePolicy: 'strict'
    })).rejects.toThrow();
  });
});
