import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mainPath = path.join(root, pkg.main || '');
const schemaPath = path.resolve(root, '..', 'publisher', 'tenants.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const { validateJsonText, validateDocumentText } = require(path.join(root, 'src', 'validators.js'));
const { renderPreviewHtml } = require(path.join(root, 'src', 'preview.js'));

const requiredCommands = [
  'pagenary.validateActiveFile',
  'pagenary.validateWorkspace',
  'pagenary.openPreview'
];

if (!fs.existsSync(mainPath)) {
  throw new Error(`Extension main file is missing: ${pkg.main}`);
}

const commands = pkg.contributes?.commands?.map((entry) => entry.command) || [];
for (const command of requiredCommands) {
  if (!commands.includes(command)) {
    throw new Error(`Missing command contribution: ${command}`);
  }
}

for (const event of requiredCommands.map((command) => `onCommand:${command}`)) {
  if (!pkg.activationEvents?.includes(event)) {
    throw new Error(`Missing activation event: ${event}`);
  }
}

const validRegistryFindings = validateJsonText('{"tenants":[{"id":"docs","source":{"path":"tenants/docs"}}]}', 'tenants.json', schema);
if (validRegistryFindings.length !== 0) {
  throw new Error(`Expected valid tenant registry fixture, got ${validRegistryFindings.length} finding(s).`);
}

const invalidRegistryFindings = validateJsonText('{"tenants":[{"id":"Bad Id","source":{"type":"git"}}]}', 'tenants.json', schema);
if (invalidRegistryFindings.length < 2) {
  throw new Error('Expected invalid registry fixture to report tenant id and git URL findings.');
}

const invalidConfigFindings = validateJsonText('{"seo":{"noIndex":"yes"},"export":{"watermark":{"enabled":"yes"}}}', 'config.json', schema);
if (invalidConfigFindings.length < 2) {
  throw new Error('Expected invalid config fixture to report SEO and export findings.');
}

const richConfigFindings = validateJsonText(JSON.stringify({
  inlineLatex: { trust: true, maxExpand: 0 },
  latexPage: { profile: 'arbitrary-tex', allowShellEscape: true, pdf: { profile: 'html' } },
  richContent: {
    mermaid: { securityLevel: 'loose', executablePath: 'relative/mmdc', theme: 'unknown' },
    plantuml: { allowNetwork: true, includeProfile: 'PUBLIC', toolchainDigest: 'latest' }
  }
}), 'config.json', schema);
if (richConfigFindings.length < 11) {
  throw new Error(`Expected immutable rich-content configuration findings, got ${richConfigFindings.length}.`);
}

const markdownFindings = validateDocumentText(`Inline \\(x

\`\`\`plantuml
!includeurl https://example.com/a.puml
\`\`\`
`, 'guide.md', schema);
if (markdownFindings.length < 3) {
  throw new Error(`Expected delimiter, accessible-title, and unsafe-include findings, got ${markdownFindings.length}.`);
}
const latexFindings = validateDocumentText('\\write18{curl example.com}', 'page.tex', schema);
if (latexFindings.length < 2) {
  throw new Error(`Expected complete-document and unsafe LaTeX findings, got ${latexFindings.length}.`);
}

const previewHtml = renderPreviewHtml(`---
title: Fixture
---
# Hello

See [Guide](./guide.md).

\`\`\`json
{"ok": true}
\`\`\`

<script>alert(1)</script>
`, { title: 'Fixture Preview', nonce: 'test-nonce' });
if (!previewHtml.includes('Content-Security-Policy') || !previewHtml.includes("style-src 'nonce-test-nonce'")) {
  throw new Error('Preview output must include a restrictive CSP.');
}
if (!previewHtml.includes('<section class="frontmatter">') || !previewHtml.includes('<h1>Hello</h1>')) {
  throw new Error('Preview output must render frontmatter and headings.');
}
if (!previewHtml.includes('<a href="./guide.md">Guide</a>') || !previewHtml.includes('<pre><code>')) {
  throw new Error('Preview output must render links and code fences.');
}
if (previewHtml.includes('<script>alert(1)</script>')) {
  throw new Error('Preview output must escape raw script tags.');
}

const richPreview = renderPreviewHtml(`# Math
Inline \\(x^2\\).

\`\`\`mermaid title="Flow"
flowchart LR
  A --> B
\`\`\`
`, { title: 'Rich Preview', nonce: 'rich-nonce' });
if (!richPreview.includes('Reduced preview:') || !richPreview.includes('data-inline-latex') ||
    !richPreview.includes('data-renderer="mermaid"') || !richPreview.includes('External mermaid rendering is unavailable')) {
  throw new Error('Rich preview must preserve production syntax and report reduced external rendering honestly.');
}
const latexPreview = renderPreviewHtml('\\documentclass{article}\\begin{document}Hi\\end{document}', {
  title: 'LaTeX Preview', nonce: 'latex-nonce', languageId: 'latex'
});
if (!latexPreview.includes('data-renderer="latexPage"') || !latexPreview.includes('source becomes the page itself')) {
  throw new Error('LaTeX preview must identify complete-page mode and its reduced toolchain behavior.');
}

console.log('VS Code extension scaffold smoke check passed.');
