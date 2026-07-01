# Test Strategy: Pagenary VS Code Extension

## Unit Tests

- Schema-backed diagnostics for valid and invalid tenant registry/config fixtures.
- Frontmatter and Markdown fixture handling for preview input.
- Link and manifest/metadata contract validation helpers as they are added.

## Extension Smoke Tests

- Extension activates in a fixture Pagenary workspace.
- Manual validation command reports diagnostics for an invalid active file.
- Preview command opens or renders a representative Markdown fixture.
- Packaging command produces a `.vsix` artifact.

## Regression Fixtures

- Valid tenant registry.
- Invalid tenant registry with line/range diagnostics.
- Markdown with frontmatter, internal links, code fences, and publisher extension examples.
