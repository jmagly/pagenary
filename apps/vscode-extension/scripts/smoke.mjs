import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const require = createRequire(import.meta.url);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const mainPath = path.join(root, pkg.main || '');
const schemaPath = path.resolve(root, '..', 'publisher', 'tenants.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const { validateJsonText } = require(path.join(root, 'src', 'validators.js'));
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

console.log('VS Code extension scaffold smoke check passed.');
