#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  isStrictAccessibilityEnabled,
  lintContentAccessibility,
  summarizeAccessibilityFindings
} from './lib/accessibility-linter.js';

function findingsFor(source) {
  return lintContentAccessibility(source, {
    file: 'content/example.md',
    route: 'example'
  });
}

const passing = findingsFor(`# Accessible page

## Overview

![Architecture diagram](./diagram.png)

[Read the configuration guide](./config.md)

| Name | Purpose |
| --- | --- |
| Site | Published output |

\`\`\`html
<iframe title="Product walkthrough" src="https://example.com/embed"></iframe>
\`\`\`
`);

assert.deepEqual(summarizeAccessibilityFindings(passing), { error: 0, warning: 0, info: 0 });

const warning = findingsFor(`# Warning page

## Overview

[Learn more](./details.md)

\`\`\`html
<button onclick="launch()">Launch</button>
\`\`\`
`);

assert.equal(warning.some((finding) => finding.rule === 'link-text' && finding.severity === 'warning'), true);
assert.equal(warning.some((finding) => finding.rule === 'risky-raw-html' && finding.severity === 'warning'), true);

const failing = findingsFor(`# Broken page

#### Skipped heading

![](./missing-alt.png)

[](./empty-link.md)

|  | Purpose |
| --- | --- |
| Site | Published output |

\`\`\`html
<iframe src="https://example.com/embed"></iframe>
<section id="duplicate"></section>
<div id="duplicate"></div>
\`\`\`
`);

assert.equal(failing.some((finding) => finding.rule === 'heading-order' && finding.severity === 'error'), true);
assert.equal(failing.some((finding) => finding.rule === 'image-alt' && finding.severity === 'error'), true);
assert.equal(failing.some((finding) => finding.rule === 'link-text' && finding.severity === 'error'), true);
assert.equal(failing.some((finding) => finding.rule === 'table-headers' && finding.severity === 'error'), true);
assert.equal(failing.some((finding) => finding.rule === 'iframe-title' && finding.severity === 'error'), true);
assert.equal(failing.some((finding) => finding.rule === 'duplicate-id' && finding.severity === 'error'), true);

assert.equal(isStrictAccessibilityEnabled({ accessibility: { strict: true } }), true);
assert.equal(isStrictAccessibilityEnabled({ accessibility: { strict: false } }), false);

const failingSummary = summarizeAccessibilityFindings(failing);
assert.equal(failingSummary.error >= 5, true);

console.log('Accessibility content linter checks passed.');
