#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createLatexPageAdapter, renderLatexPdf } from '../../apps/publisher/scripts/lib/latex-page-adapter.js';
import { preflightLatexPage } from '../../apps/publisher/scripts/lib/latex-page-preflight.js';
import { createPlantUmlAdapter, diagnosePlantUmlTool } from '../../apps/publisher/scripts/lib/plantuml-renderer.js';
import { createMermaidBuildAdapter } from '../../apps/publisher/scripts/lib/mermaid-build-adapter.js';
import { runRendererSubprocess } from '../../apps/publisher/scripts/lib/renderer-security.js';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixtures = path.join(root, 'apps/publisher/__tests__/fixtures/latex-pages');
const javaPath = process.env.JAVA_PATH || '/usr/bin/java';
const jarPath = process.env.PLANTUML_JAR || '/opt/plantuml.jar';
const mermaidCliPath = process.env.MERMAID_CLI_PATH || '/opt/mermaid-cli/node_modules/.bin/mmdc';
const toolchainDigest = 'sha256:eeeb2887f90fbca52c03e96ec13a05a3138b8661fc437a72ab1e08822f071b57';

const versions = await probeVersions();
assert.match(versions.latexml, /0\.8\.8/);
assert.match(versions.plantuml, /1\.2026\.4/);
assert.match(versions.tectonic, /0\.16\.9/);
assert.match(versions.pandoc, /3\.1\.3/);
assert.match(versions.make4ht, /v0\.3m/);
assert.match(versions.mermaid, /11\.16\.0/);
assert.match(versions.texlive, /kpathsea version 6\.3\.5/);
assert.match(versions.fonts.latinModern, /Latin Modern Roman/i);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-external-renderers-'));
try {
  await fs.cp(fixtures, temp, { recursive: true });
  await assert.rejects(
    runRendererSubprocess({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)'],
      timeoutMs: 100,
      killGraceMs: 50,
      trustedCommands: [process.execPath]
    }),
    (error) => error?.code === 'ERR_RENDERER_TIMEOUT'
  );
  const latex = createLatexPageAdapter();
  const latexResults = [];
  for (const name of [
    '01-structure-math.tex',
    '02-crossrefs.tex',
    '03-bibliography.tex',
    '04-includes-assets.tex',
    '05-unicode-tables.tex',
    '07-custom-macros.tex'
  ]) {
    const sourceFile = path.join(temp, name);
    const source = await fs.readFile(sourceFile, 'utf8');
    const context = {
      contentRoot: temp,
      profile: 'standard-web-v1',
      timeoutMs: 60_000,
      maxOutputBytes: 8 * 1024 * 1024
    };
    const rendered = await latex.render({ source, sourceFile }, context);
    const repeated = await latex.render({ source, sourceFile }, context);
    assert.match(rendered.html, /<(?:article|main|section)\b/);
    assert.ok(rendered.semanticText.length > 20);
    assert.equal(rendered.rendererMetadata.profile, 'standard-web-v1');
    assert.match(rendered.rendererMetadata.version || '', /0\.8\.8/);
    assert.equal(repeated.html, rendered.html);
    assert.deepEqual(repeated.assets, rendered.assets);
    for (const asset of rendered.assets || []) {
      assert.match(asset.path, /^assets\/rich-content\/latex\/[a-f0-9]{24}\.(?:svg|png|jpe?g|pdf)$/);
      if (asset.mimeType === 'image/svg+xml') {
        assert.doesNotMatch(asset.bytes.toString('utf8'), /<script|\son[a-z]+=|javascript:/i);
      }
    }
    latexResults.push({
      fixture: name,
      htmlBytes: Buffer.byteLength(rendered.html),
      semanticBytes: Buffer.byteLength(rendered.semanticText),
      dependencies: rendered.dependencies.length,
      assets: rendered.assets.length
    });
  }
  assert.match(latexResults[0].fixture, /^01-/);
  const pdfSourceFile = path.join(temp, '01-structure-math.tex');
  const pdf = await renderLatexPdf({
    source: await fs.readFile(pdfSourceFile, 'utf8'),
    sourceFile: pdfSourceFile
  }, {
    contentRoot: temp,
    rendererHome: process.env.HOME,
    timeoutMs: 60_000,
    maxOutputBytes: 8 * 1024 * 1024
  });
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.ok(pdf.bytes.length > 1_000);
  assert.equal(pdf.rendererMetadata.untrusted, true);
  assert.equal(pdf.rendererMetadata.onlyCached, true);

  const hostile = await fs.readFile(path.join(temp, '06-policy-negative.tex'), 'utf8');
  const rejected = preflightLatexPage(hostile, {
    contentRoot: temp,
    sourceFile: path.join(temp, '06-policy-negative.tex')
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.diagnostics.some(({ code }) => code === 'LATEX_UNSAFE_COMMAND'));

  const unsupported = await fs.readFile(path.join(temp, '08-unsupported-package.tex'), 'utf8');
  const unsupportedResult = preflightLatexPage(unsupported, {
    contentRoot: temp,
    sourceFile: path.join(temp, '08-unsupported-package.tex')
  });
  assert.equal(unsupportedResult.ok, false);
  assert.ok(unsupportedResult.diagnostics.some(({ code }) => code === 'LATEX_PACKAGE_NOT_ALLOWED'));

  const malformedFile = path.join(temp, '09-malformed.tex');
  await assert.rejects(
    latex.render({ source: await fs.readFile(malformedFile, 'utf8'), sourceFile: malformedFile }, {
      contentRoot: temp,
      profile: 'standard-web-v1',
      timeoutMs: 60_000,
      maxOutputBytes: 8 * 1024 * 1024
    })
  );

  const converterBakeoff = await qualifyConverterCandidates(temp);

  const browserPath = await findPuppeteerBrowser();
  const mermaidCorpus = {
    flowchart: 'flowchart LR\n  Author --> Publisher\n  Publisher --> Page',
    sequence: 'sequenceDiagram\n  Author->>Publisher: Build\n  Publisher-->>Author: Page',
    class: 'classDiagram\n  Page <|-- Article\n  Page : +render()',
    state: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Published',
    er: 'erDiagram\n  PAGE ||--o{ ASSET : contains'
  };
  const mermaidResults = [];
  for (const theme of ['neutral', 'forest', 'dark']) {
    const mermaid = createMermaidBuildAdapter({
      executablePath: mermaidCliPath,
      browserPath,
      timeoutMs: 60_000,
      fonts: ['DejaVu Sans'],
      theme
    });
    for (const [family, body] of Object.entries(mermaidCorpus)) {
      const coldStarted = Date.now();
      const diagram = await mermaid.render({ body, attributes: { title: `${family} diagram` } });
      const coldMs = Date.now() - coldStarted;
      const repeatStarted = Date.now();
      const repeated = await mermaid.render({ body, attributes: { title: `${family} diagram` } });
      const repeatMs = Date.now() - repeatStarted;
      assert.ok(coldMs <= 60_000 && repeatMs <= 60_000);
      assert.match(diagram.html, /<img src="\.\/assets\/rich-content\/mermaid\/[a-f0-9]{24}\.svg"/);
      assert.equal(diagram.assets.length, 1);
      assert.deepEqual(repeated.assets[0].bytes, diagram.assets[0].bytes);
      assert.equal(repeated.rendererMetadata.cacheIdentity, diagram.rendererMetadata.cacheIdentity);
      const svg = diagram.assets[0].bytes.toString('utf8');
      assert.match(svg, /<svg\b/);
      assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+=|javascript:/i);
      const snapshot = await captureSvgSnapshot(browserPath, diagram.assets[0].bytes, temp, `${theme}-${family}`);
      mermaidResults.push({ theme, family, coldMs, repeatMs, svgBytes: diagram.assets[0].bytes.length, snapshot });
    }
  }
  const concurrentMermaid = createMermaidBuildAdapter({
    executablePath: mermaidCliPath,
    browserPath,
    timeoutMs: 60_000,
    fonts: ['DejaVu Sans'],
    theme: 'neutral'
  });
  const concurrentStarted = Date.now();
  const concurrentResults = await Promise.all(
    Object.entries(mermaidCorpus).slice(0, 3).map(([family, body]) =>
      concurrentMermaid.render({ body, attributes: { title: `${family} concurrent diagram` } }))
  );
  const concurrentMs = Date.now() - concurrentStarted;
  assert.equal(concurrentResults.length, 3);
  assert.ok(concurrentResults.every(({ assets }) => assets.length === 1));
  assert.ok(concurrentMs <= 60_000);

  const plantStatus = await diagnosePlantUmlTool({ jarPath, javaPath, version: '1.2026.4' });
  assert.equal(plantStatus.available, true);
  assert.equal(plantStatus.version, '1.2026.4');
  assert.equal(plantStatus.securityProfile, 'SANDBOX');

  const plant = createPlantUmlAdapter({
    jarPath, javaPath, version: '1.2026.4', graphvizVersion: '2.42.2',
    fonts: ['DejaVu Sans'], toolchainDigest
  });
  const plantUmlCorpus = {
    sequence: '@startuml\nactor Author\nAuthor -> Publisher: build\n@enduml',
    class: '@startuml\nclass Page\nclass Renderer\nPage --> Renderer\n@enduml',
    component: '@startuml\ncomponent Publisher\ndatabase Index\nPublisher --> Index\n@enduml',
    activity: '@startuml\nstart\n:Parse content;\n:Render page;\nstop\n@enduml',
    state: '@startuml\n[*] --> Draft\nDraft --> Published\nPublished --> [*]\n@enduml',
    er: '@startuml\nentity Page {\n  * id : string\n}\nentity Asset {\n  * path : string\n}\nPage ||--o{ Asset\n@enduml',
    json: '@startjson\n{"page":{"title":"Qualified","published":true}}\n@endjson',
    yaml: '@startyaml\npage:\n  title: Qualified\n  published: true\n@endyaml'
  };
  const plantUmlResults = [];
  for (const [family, body] of Object.entries(plantUmlCorpus)) {
    const diagram = await plant.render({ body, relativePath: `${family}.puml` }, { tenantRoot: temp });
    const repeated = await plant.render({ body, relativePath: `${family}.puml` }, { tenantRoot: temp });
    assert.match(diagram.html, /<img\s+src="\.\/assets\/rich-content\/plantuml\/[a-f0-9]{24}\.svg"/);
    assert.equal(diagram.assets.length, 1);
    const svg = diagram.assets[0].bytes.toString('utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script|\son[a-z]+=|javascript:/i);
    assert.doesNotMatch(svg, /<\?/);
    assert.equal(diagram.rendererMetadata.profile, 'SANDBOX');
    assert.deepEqual(diagram.rendererMetadata.toolchain, {
      plantuml: '1.2026.4', graphviz: '2.42.2', fonts: ['DejaVu Sans'], digest: toolchainDigest
    });
    assert.equal(repeated.html, diagram.html);
    assert.deepEqual(repeated.assets[0].bytes, diagram.assets[0].bytes);
    plantUmlResults.push({ family, svgBytes: diagram.assets[0].bytes.length });
  }
  const plantWithPng = createPlantUmlAdapter({
    jarPath, javaPath, version: '1.2026.4', pngFallback: true,
    graphvizVersion: '2.42.2', fonts: ['DejaVu Sans'], toolchainDigest
  });
  const pngFallback = await plantWithPng.render({
    body: plantUmlCorpus.sequence, relativePath: 'sequence-fallback.puml'
  }, { tenantRoot: temp });
  assert.equal(pngFallback.assets.length, 2);
  assert.equal(pngFallback.assets[1].mimeType, 'image/png');
  assert.deepEqual(
    pngFallback.assets[1].bytes.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  );

  console.log(JSON.stringify({
    result: 'PASS',
    versions,
    latex: latexResults,
    negativeLatex: {
      hostile: 'LATEX_UNSAFE_COMMAND',
      unsupportedPackage: 'LATEX_PACKAGE_NOT_ALLOWED',
      malformed: 'bounded converter rejection'
    },
    converterBakeoff,
    mermaid: { browserPath, diagrams: mermaidResults, concurrent: { diagrams: 3, budgetMs: 60_000, durationMs: concurrentMs } },
    plantuml: {
      profile: plantStatus.securityProfile,
      diagrams: plantUmlResults,
      pngFallbackBytes: pngFallback.assets[1].bytes.length
    },
    tectonic: { pdfBytes: pdf.bytes.length, profile: pdf.rendererMetadata.profile }
  }, null, 2));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}

async function probeVersions() {
  const latexml = await exec('latexmlc', ['--VERSION'], { encoding: 'utf8' });
  const plantuml = await exec(javaPath, ['-DPLANTUML_SECURITY_PROFILE=SANDBOX', '-jar', jarPath, '-version'], { encoding: 'utf8' });
  const tectonic = await exec('tectonic', ['--version'], { encoding: 'utf8' });
  const pandoc = await exec('pandoc', ['--version'], { encoding: 'utf8' });
  const make4ht = await exec('make4ht', ['--version'], { encoding: 'utf8' });
  const mermaid = await exec(mermaidCliPath, ['--version'], { encoding: 'utf8' });
  const texlive = await exec('kpsewhich', ['--version'], { encoding: 'utf8' });
  const latinModern = await exec('fc-match', ['--format=%{family}\\n', 'Latin Modern Roman'], { encoding: 'utf8' });
  return {
    latexml: firstLine(latexml.stdout || latexml.stderr),
    plantuml: firstLine(plantuml.stdout || plantuml.stderr),
    tectonic: firstLine(tectonic.stdout || tectonic.stderr),
    pandoc: firstLine(pandoc.stdout || pandoc.stderr),
    make4ht: firstLine(make4ht.stdout || make4ht.stderr),
    mermaid: firstLine(mermaid.stdout || mermaid.stderr),
    texlive: firstLine(texlive.stdout || texlive.stderr),
    fonts: { latinModern: firstLine(latinModern.stdout || latinModern.stderr) }
  };
}

async function findPuppeteerBrowser() {
  const cacheRoot = process.env.PUPPETEER_CACHE_DIR || '/opt/puppeteer-cache';
  const candidates = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(candidate);
      else if (entry.isFile() && (entry.name === 'chrome' || entry.name === 'chrome-headless-shell')) candidates.push(candidate);
    }
  }
  await walk(cacheRoot);
  assert.equal(candidates.length > 0, true, 'Pinned Puppeteer browser was not installed');
  return candidates.sort()[0];
}

async function captureSvgSnapshot(browserPath, svg, workDir, name) {
  const svgPath = path.join(workDir, `${name}.mermaid.svg`);
  const pngPath = path.join(workDir, `${name}.mermaid.png`);
  await fs.writeFile(svgPath, svg);
  await exec(browserPath, [
    '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
    '--window-size=1280,900', `--screenshot=${pngPath}`, `file://${svgPath}`
  ], { timeout: 30_000, maxBuffer: 1024 * 1024 });
  const png = await fs.readFile(pngPath);
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.ok(png.length > 1_000);
  return { bytes: png.length, sha256: createDigest(png) };
}

function createDigest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function qualifyConverterCandidates(workDir) {
  const names = [
    '01-structure-math.tex',
    '02-crossrefs.tex',
    '03-bibliography.tex',
    '04-includes-assets.tex',
    '05-unicode-tables.tex'
  ];
  const pandoc = [];
  const make4ht = [];
  for (const name of names) {
    const pandocOutput = `${path.parse(name).name}.pandoc.html`;
    const pandocRun = await runCandidate('pandoc', [
      '--from=latex', '--to=html5', '--mathml', '--wrap=none',
      '--citeproc', '--bibliography=_references.bib', name, '-o', pandocOutput
    ], workDir);
    assert.equal(pandocRun.exitCode, 0);
    const pandocHtml = await fs.readFile(path.join(workDir, pandocOutput), 'utf8');
    pandoc.push({ fixture: name, exitCode: 0, htmlBytes: Buffer.byteLength(pandocHtml) });

    const make4htRun = await runCandidate('make4ht', [
      '-u', '-f', 'html5', name, 'mathml'
    ], workDir);
    const make4htOutput = path.join(workDir, `${path.parse(name).name}.html`);
    const htmlBytes = make4htRun.exitCode === 0
      ? (await fs.stat(make4htOutput)).size
      : 0;
    const make4htLog = `${make4htRun.stdout}\n${make4htRun.stderr}`;
    make4ht.push({
      fixture: name,
      exitCode: make4htRun.exitCode,
      htmlBytes,
      failure: make4htRun.exitCode === 0
        ? null
        : /booktabs\.sty[^\n]*not found/i.test(make4htLog)
          ? 'LaTeX Error: booktabs.sty not found'
          : firstDiagnostic(make4htLog)
    });
  }
  assert.equal(make4ht.filter(({ exitCode }) => exitCode === 0).length, 4);
  assert.match(make4ht.at(-1)?.failure || '', /booktabs\.sty.*not found/i);
  return { pandoc, make4ht };
}

async function runCandidate(command, args, cwd) {
  try {
    const result = await exec(command, args, {
      cwd, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: Number.isInteger(error.code) ? error.code : 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message
    };
  }
}

function firstDiagnostic(value) {
  return String(value).split(/\r?\n/).find((line) => /error|fatal|not found/i.test(line))?.trim() || firstLine(value);
}

function firstLine(value) {
  return String(value).split(/\r?\n/).find(Boolean)?.trim() || '';
}
