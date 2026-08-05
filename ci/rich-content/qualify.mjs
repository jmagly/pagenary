#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createLatexPageAdapter, renderLatexPdf } from '../../apps/publisher/scripts/lib/latex-page-adapter.js';
import { preflightLatexPage } from '../../apps/publisher/scripts/lib/latex-page-preflight.js';
import { createPlantUmlAdapter, diagnosePlantUmlTool } from '../../apps/publisher/scripts/lib/plantuml-renderer.js';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixtures = path.join(root, 'apps/publisher/__tests__/fixtures/latex-pages');
const javaPath = process.env.JAVA_PATH || '/usr/bin/java';
const jarPath = process.env.PLANTUML_JAR || '/opt/plantuml.jar';

const versions = await probeVersions();
assert.match(versions.latexml, /0\.8\.8/);
assert.match(versions.plantuml, /1\.2026\.4/);
assert.match(versions.tectonic, /0\.16\.9/);
assert.match(versions.pandoc, /3\.1\.3/);
assert.match(versions.make4ht, /v0\.3m/);

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-external-renderers-'));
try {
  await fs.cp(fixtures, temp, { recursive: true });
  const latex = createLatexPageAdapter();
  const latexResults = [];
  for (const name of [
    '01-structure-math.tex',
    '02-crossrefs.tex',
    '03-bibliography.tex',
    '04-includes-assets.tex',
    '05-unicode-tables.tex'
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
    latexResults.push({
      fixture: name,
      htmlBytes: Buffer.byteLength(rendered.html),
      semanticBytes: Buffer.byteLength(rendered.semanticText),
      dependencies: rendered.dependencies.length
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

  const converterBakeoff = await qualifyConverterCandidates(temp);

  const plantStatus = await diagnosePlantUmlTool({ jarPath, javaPath, version: '1.2026.4' });
  assert.equal(plantStatus.available, true);
  assert.equal(plantStatus.version, '1.2026.4');
  assert.equal(plantStatus.securityProfile, 'SANDBOX');

  const plant = createPlantUmlAdapter({ jarPath, javaPath, version: '1.2026.4' });
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
    assert.equal(repeated.html, diagram.html);
    assert.deepEqual(repeated.assets[0].bytes, diagram.assets[0].bytes);
    plantUmlResults.push({ family, svgBytes: diagram.assets[0].bytes.length });
  }
  const plantWithPng = createPlantUmlAdapter({
    jarPath, javaPath, version: '1.2026.4', pngFallback: true
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
    converterBakeoff,
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
  return {
    latexml: firstLine(latexml.stdout || latexml.stderr),
    plantuml: firstLine(plantuml.stdout || plantuml.stderr),
    tectonic: firstLine(tectonic.stdout || tectonic.stderr),
    pandoc: firstLine(pandoc.stdout || pandoc.stderr),
    make4ht: firstLine(make4ht.stdout || make4ht.stderr)
  };
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
