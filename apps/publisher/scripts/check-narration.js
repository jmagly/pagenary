#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildNarration,
  extractNarrationTextFromMarkdown,
  ensureMarkdownModule
} from './build-tenants.js';

const fixture = `---
title: Narrated Guide
narration: true
---

# Guide Heading

Introductory prose with [a useful link](./guide.md).

![System diagram](./diagram.png)

- First list item
- Second list item

| Step | Result |
| --- | --- |
| Build | Published site |

\`\`\`js
console.log('excluded from narration');
\`\`\`

\`\`\`media
type: narration
title: Existing narration metadata
caption: Human voiceover
\`\`\`
`;

const text = extractNarrationTextFromMarkdown(fixture);
assert.equal(text.includes('Narrated Guide'), true);
assert.equal(text.includes('Guide Heading'), true);
assert.equal(text.includes('a useful link'), true);
assert.equal(text.includes('System diagram'), true);
assert.equal(text.includes('First list item'), true);
assert.equal(text.includes('Build Published site'), true);
assert.equal(text.includes('console.log'), false);
assert.equal(text.includes('Existing narration metadata'), true);

const tmp = await mkdtemp(path.join(os.tmpdir(), 'pagenary-narration-'));
try {
  const preview = await buildNarration(fixture, {
    route: 'guides/intro',
    distDir: tmp,
    narrationConfig: { enabled: true, provider: 'preview', voice: 'reviewer', language: 'en-US' }
  });
  assert.equal(preview.html.includes('Narration text preview generated for review'), true);
  assert.equal(preview.artifact.textPath.startsWith('narration/guides--intro.'), true);
  assert.equal(preview.artifact.textPath.endsWith('.txt'), true);
  assert.equal(preview.artifact.generated, true);

  const previewText = await readFile(path.join(tmp, preview.artifact.textPath), 'utf8');
  assert.equal(previewText.trim(), text);

  const previewManifest = JSON.parse(await readFile(path.join(tmp, preview.artifact.manifestPath), 'utf8'));
  assert.equal(previewManifest.hash, preview.artifact.hash);
  assert.equal(previewManifest.voice, 'reviewer');
  assert.equal(previewManifest.language, 'en-US');

  const repeat = await buildNarration(fixture, {
    route: 'guides/intro',
    distDir: tmp,
    narrationConfig: { enabled: true, provider: 'preview', voice: 'reviewer', language: 'en-US' }
  });
  assert.equal(repeat.artifact.textPath, preview.artifact.textPath);

  const changedVoice = await buildNarration(fixture, {
    route: 'guides/intro',
    distDir: tmp,
    narrationConfig: { enabled: true, provider: 'preview', voice: 'editor', language: 'en-US' }
  });
  assert.notEqual(changedVoice.artifact.textPath, preview.artifact.textPath);

  const attached = await buildNarration(fixture.replace('narration: true', 'narration:\n  src: audio/guide.mp3\n  duration: 4:02\n  download: true'), {
    route: 'guides/intro',
    distDir: tmp,
    narrationConfig: { enabled: false },
    mediaConfig: {}
  });
  assert.equal(attached.html.includes('<audio controls preload="metadata" aria-label="Listen to Narrated Guide">'), true);
  assert.equal(attached.html.includes('<source src="audio/guide.mp3">'), true);
  assert.equal(attached.html.includes('Duration: 4:02'), true);
  assert.equal(attached.html.includes('href="audio/guide.mp3" download'), true);
  assert.equal(attached.html.includes(`href="${attached.artifact.textPath}"`), true);

  const providerUnavailable = await buildNarration(fixture, {
    route: 'guides/intro',
    distDir: tmp,
    narrationConfig: { enabled: true, provider: 'hosted-tts' }
  });
  assert.equal(providerUnavailable.artifact.status, 'provider-unavailable');
  assert.equal(providerUnavailable.html.includes('not configured for build-time generation'), true);

  const empty = await buildNarration('---\nnarration: true\n---\n', {
    route: 'empty',
    distDir: tmp,
    narrationConfig: {}
  });
  assert.equal(empty.artifact.status, 'empty-text');
  assert.equal(empty.html.includes('No narration text was extracted'), true);

  const sourcePath = path.join(tmp, 'wired.md');
  const targetPath = path.join(tmp, 'sections', 'wired.js');
  await writeFile(sourcePath, fixture, 'utf8');
  await ensureMarkdownModule(sourcePath, targetPath, {
    currentPath: 'wired.md',
    contentRoot: tmp,
    route: 'wired',
    distDir: tmp,
    mediaConfig: {},
    narrationConfig: { enabled: true, provider: 'preview' }
  });
  const moduleSource = await readFile(targetPath, 'utf8');
  assert.equal(moduleSource.includes('Narration text preview generated for review'), true);
  assert.equal(moduleSource.includes('narration/wired.'), true);
  assert.equal(moduleSource.includes('<section class=\\"section doc markdown\\"'), true);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log('Narration checks passed.');
