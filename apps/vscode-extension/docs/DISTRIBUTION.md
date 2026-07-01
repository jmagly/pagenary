# Pagenary Extension Distribution

This guide covers local development, local VSIX packaging, and future publishing
preparation for the Pagenary VS Code-compatible extension.

## Local Development

Run from the repository root:

```bash
npm run test --workspace @pagenary/vscode-extension
npm run package --workspace @pagenary/vscode-extension
```

The test command runs:

- `scripts/smoke.mjs` for package metadata, command contributions, validation
  fixtures, preview rendering, and CSP checks.
- `scripts/activation-smoke.mjs` for mocked VS Code activation, command
  registration, diagnostics, workspace validation, and preview command wiring.

## Local Packaging

```bash
npm run package --workspace @pagenary/vscode-extension
```

The package command writes:

```text
apps/vscode-extension/dist/pagenary-vscode-extension-0.0.1.vsix
```

The dependency-free packager is intended for local scaffold verification and
review installs. Before public publishing, verify the current Microsoft
Marketplace and Open VSX requirements and decide whether to switch to the
official packaging tools.

## Install From VSIX

In VS Code-compatible editors that support VSIX installation, install the file
from `apps/vscode-extension/dist/` through the editor's extension UI or command
palette. Do not commit personal install tokens, publisher tokens, or generated
credentials.

## Publishing Tracks

### Microsoft VS Code Marketplace

Use the official VS Code publishing flow when the project is ready for public
release:

- Documentation: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Expected concerns: publisher identity, personal access token, extension
  manifest validation, license metadata, README quality, and versioning.

Secrets must stay outside the repository. Use local environment variables,
secret stores, or CI secrets when automation is introduced.

### Open VSX

Use Open VSX for editors that consume the Open VSX registry:

- Documentation: https://github.com/eclipse/openvsx/wiki/Publishing-Extensions
- Expected concerns: namespace ownership, access token, compatible extension
  metadata, and registry-specific validation.

Keep Microsoft Marketplace and Open VSX instructions separate because accounts,
tokens, validation, and publication commands differ.

## Current Limitations

- Diagnostics currently cover tenant registry/config JSON and selected SEO/export
  contract shapes.
- Workspace validation scans common JSON artifact names and is intentionally
  command-driven.
- Markdown preview is fixture-driven and does not yet embed the full publisher
  renderer.
- Packaging is dependency-free for local verification; public release should
  re-check current marketplace tooling.

## Planning Artifacts

- `.aiwg/working/issue-planner/vscode-extension/research-best-practices.md`
- `.aiwg/working/issue-planner/vscode-extension/research-current-state.md`
- `.aiwg/working/issue-planner/vscode-extension/research-vendor-docs.md`
- `.aiwg/working/issue-planner/vscode-extension/research-synthesis.md`
- `.aiwg/requirements/UC-vscode-extension-author-feedback.md`
- `.aiwg/architecture/sketch-vscode-extension.md`
- `.aiwg/risks/risks-vscode-extension.md`
- `.aiwg/testing/test-strategy-vscode-extension.md`
- `.aiwg/security/screening-vscode-extension.md`
