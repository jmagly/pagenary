# Architecture Sketch: Pagenary VS Code Extension

## Placement

Create `apps/vscode-extension/` as an npm workspace package.

## Components

- `extension.ts`: activation, command registration, file watchers.
- `diagnostics/`: schema and Pagenary artifact validators that publish VS Code diagnostics.
- `preview/`: Markdown preview adapter and webview rendering shell.
- `fixtures/`: representative Pagenary Markdown, tenant config, manifest, and metadata samples.
- `test/`: extension activation, command, diagnostic, and preview smoke tests.

## Dependency Rule

The extension may depend on reusable Pagenary validation helpers or schemas. The publisher runtime must not import `vscode` or extension code.

## Security

Preview webviews must escape untrusted content and use a strict content security policy. Extension commands should not execute arbitrary tenant scripts.
