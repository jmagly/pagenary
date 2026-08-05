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
- `Pagenary: Open Markdown Preview` (also accepts complete `.tex` pages)

`Pagenary: Validate Active File` recognizes JSON configuration, Markdown, and
complete `.tex` pages. It reports tenant/schema shapes, rich-renderer profiles
and bounds, immutable security options, unbalanced inline-LaTeX delimiters,
missing diagram alternatives, unsafe PlantUML includes, incomplete LaTeX
documents, and forbidden TeX operations. `Pagenary: Validate Workspace` applies
the same checks to registries, configs, manifests, Markdown, and `.tex` files.

The preview is script-disabled and preserves Pagenary delimiter/fence semantics.
Publisher preprocessing, editor validation, and preview all consume the same
`@pagenary/authoring-contract` fence scanner, alias/title parser, and renderer
configuration enums; the VSIX packages that exact module beside the extension.
It displays inline-LaTeX placeholders and titled Mermaid/PlantUML source with an
explicit reduced-preview notice. It never pretends to run Mermaid, LaTeXML,
Pandoc, PlantUML, or Tectonic inside the editor; run the normal Pagenary build for
final rendering. Complete `.tex` files are identified as page sources rather
than Markdown. This keeps unavailable external toolchains honest and ordinary
extension startup dependency-free.

## Packaging

`npm run package --workspace @pagenary/vscode-extension` writes a local `.vsix`
under `apps/vscode-extension/dist/`. This dependency-free packager is sufficient
for local scaffold verification. Marketplace publishing requirements are tracked
in #102 and should verify the current Microsoft Marketplace and Open VSX flows
before release.

See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for local install notes,
Marketplace/Open VSX preparation, token handling, current limitations, and links
to the supporting planning artifacts.
