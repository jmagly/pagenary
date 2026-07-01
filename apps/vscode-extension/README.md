# Pagenary VS Code Extension

This workspace contains the VS Code-compatible extension scaffold for Pagenary
authoring tools.

## Development

```bash
npm run test --workspace @pagenary/vscode-extension
npm run package --workspace @pagenary/vscode-extension
```

The current scaffold contributes commands for:

- `Pagenary: Validate Active File`
- `Pagenary: Validate Workspace`
- `Pagenary: Open Markdown Preview`

`Pagenary: Validate Active File` parses the active JSON file and reports
Pagenary diagnostics for tenant registries and tenant config files. `Pagenary:
Validate Workspace` scans common Pagenary JSON artifacts such as `tenants.json`,
`*.tenants.json`, `config.json`, and `manifest.json` and publishes diagnostics in
one command-driven pass. Validation reuses the publisher tenant schema for the
tenant id contract and validates current SEO and export control shapes.

`Pagenary: Open Markdown Preview` opens a script-disabled webview preview for the
active Markdown file. The initial preview path covers frontmatter display,
headings, paragraphs, inline code, links, and fenced code blocks. Fuller
extension lifecycle tests and distribution documentation continue in #101 and
#102.

## Packaging

`npm run package --workspace @pagenary/vscode-extension` writes a local `.vsix`
under `apps/vscode-extension/dist/`. This dependency-free packager is sufficient
for local scaffold verification. Marketplace publishing requirements are tracked
in #102 and should verify the current Microsoft Marketplace and Open VSX flows
before release.

See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for local install notes,
Marketplace/Open VSX preparation, token handling, current limitations, and links
to the supporting planning artifacts.
