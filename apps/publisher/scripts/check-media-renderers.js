#!/usr/bin/env node
import assert from 'node:assert/strict';
import { markdownToHtml } from './build-tenants.js';

function render(source, mediaConfig = {}) {
  return markdownToHtml(source, { mediaConfig });
}

const video = render(`
# Video

\`\`\`media
type: video
src: assets/demo.mp4
title: Product demo
poster: assets/poster.jpg
captions: assets/demo.vtt
transcript: transcripts/demo.md
caption: Watch the product demo.
\`\`\`
`);

assert.equal(video.includes('<video controls preload="metadata" poster="assets/poster.jpg" aria-label="Product demo">'), true);
assert.equal(video.includes('<track kind="captions" src="assets/demo.vtt" label="Captions">'), true);
assert.equal(video.includes('href="transcripts/demo.md"'), true);

const audio = render(`
# Audio

\`\`\`media
type: audio
src: audio/episode.mp3
title: Episode audio
transcript: transcripts/episode.md
\`\`\`
`);

assert.equal(audio.includes('<audio controls preload="metadata" aria-label="Episode audio">'), true);
assert.equal(audio.includes('<source src="audio/episode.mp3">'), true);

const image = render(`
# Image

\`\`\`media
type: image
src: assets/default.jpg
portrait: assets/portrait.jpg
landscape: assets/landscape.jpg
alt: Product screenshot
caption: Responsive screenshot.
\`\`\`
`);

assert.equal(image.includes('<picture><source media="(orientation: portrait), (max-width: 700px)" srcset="assets/portrait.jpg">'), true);
assert.equal(image.includes('<source media="(orientation: landscape) and (min-width: 701px)" srcset="assets/landscape.jpg">'), true);
assert.equal(image.includes('<img src="assets/default.jpg" alt="Product screenshot" loading="lazy">'), true);

const hosted = render(`
# Hosted

\`\`\`media
type: embed
provider: youtube
id: abc123
title: Hosted walkthrough
\`\`\`
`, { providers: ['youtube'], load: 'click' });

assert.equal(hosted.includes('media-embed-load'), true);
assert.equal(hosted.includes('youtube-nocookie.com/embed/abc123'), true);
assert.equal(hosted.includes('data-media-title="Hosted walkthrough"'), true);
assert.equal(hosted.includes('data-media-sandbox="allow-scripts allow-same-origin allow-presentation"'), true);

const blocked = render(`
# Blocked

\`\`\`media
type: embed
provider: youtube
id: abc123
title: Blocked
\`\`\`
`, { providers: ['vimeo'] });

assert.equal(blocked.includes('Media unavailable.'), true);
assert.equal(blocked.includes('Hosted media provider is not allowed.'), true);

const immediate = render(`
# Immediate

\`\`\`media
type: embed
provider: vimeo
id: 12345
title: Vimeo demo
\`\`\`
`, { providers: ['vimeo'], load: 'immediate' });

assert.equal(immediate.includes('<iframe title="Vimeo demo"'), true);
assert.equal(immediate.includes('player.vimeo.com/video/12345'), true);
assert.equal(immediate.includes('loading="lazy"'), true);

console.log('Media renderer checks passed.');
