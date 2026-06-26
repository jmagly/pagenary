#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  estimateReadingLength,
  estimateReadingTime,
  parseFrontmatter
} from './lib/frontmatter.js';
import { generateCollections } from './lib/collections-generator.js';

const mixed = `# Technical Guide

This guide explains the deployment process with enough detail for operators.

![Architecture diagram](./diagram.png)

- Prepare the tenant
- Validate the build output
- Publish the static bundle

- [x] Draft copy
- [ ] Review accessibility

| Artifact | Purpose |
| --- | --- |
| index.html | Shell |
| search-index | Search |

\`\`\`bash
npm run build
npm run check
\`\`\`
`;

const length = estimateReadingLength(mixed);
assert.equal(length.minutes >= 1, true);
assert.equal(length.label.endsWith('min read') || length.label === '<1 min read', true);
assert.equal(length.proseWords > 20, true);
assert.equal(length.tableRows, 3);
assert.equal(length.codeBlocks, 1);
assert.equal(length.codeLines, 2);
assert.equal(length.imageCount, 1);
assert.deepEqual(length.checklist, { completed: 1, total: 2, percent: 50 });
assert.equal(estimateReadingTime(mixed), length.minutes);

const proseOnly = estimateReadingLength(Array(450).fill('word').join(' '));
assert.equal(proseOnly.minutes, 2);

const codeHeavy = estimateReadingLength(`Intro.\n\n\`\`\`js\n${Array(20).fill('const value = 1;').join('\n')}\n\`\`\``);
assert.equal(codeHeavy.minutes > estimateReadingLength('Intro.').minutes, true);

const tmp = await mkdtemp(path.join(os.tmpdir(), 'pagenary-reading-'));
try {
  const content = path.join(tmp, 'content');
  const posts = path.join(content, 'posts');
  const dist = path.join(tmp, 'dist');
  await mkdir(posts, { recursive: true });
  await writeFile(path.join(posts, 'launch.md'), `---
title: Launch Notes
date: 2026-06-26
reading:
  proseWpm: 225
progress:
  enabled: true
---

${mixed}
`, 'utf8');

  await generateCollections(dist, {
    title: 'Example',
    collections: [{ path: 'posts', route: '/posts', title: 'Posts', manifest: true }]
  }, content);

  const index = JSON.parse(await readFile(path.join(dist, 'posts', 'index.json'), 'utf8'));
  const post = index.posts[0];
  assert.equal(post.title, 'Launch Notes');
  assert.equal(post.reading_time, length.minutes);
  assert.equal(post.reading_label, length.label);
  assert.equal(post.reading_length.codeLines, 2);
  assert.equal(post.checklist_progress.percent, 50);
  assert.deepEqual(post.progress, { enabled: true });

  const { data } = parseFrontmatter(await readFile(path.join(posts, 'launch.md'), 'utf8'));
  assert.deepEqual(data.progress, { enabled: true });
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log('Reading metadata checks passed.');
