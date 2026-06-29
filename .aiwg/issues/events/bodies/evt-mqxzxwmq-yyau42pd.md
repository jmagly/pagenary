# Severity
P2 (medium)

# Problem
Pagenary authors and integrators need editor feedback before running a full publisher build. There is no VS Code-compatible extension that previews Pagenary Markdown as it will render through the publisher and validates nearby Pagenary configuration artifacts such as tenant configs, manifests, metadata, and related schema-backed files.

# User value
- Authors can preview Markdown content in-editor with Pagenary-specific rendering expectations.
- Developers can catch invalid `config.json`, `manifest.json`, tenant registry, metadata, and search/graph contract issues before CI.
- Integrators using VS Code-compatible editors get a smoother content-development workflow without needing to run the full site for every edit.

# Scope
- Develop and package a VS Code-compatible extension.
- Provide Markdown preview support aligned with Pagenary publisher behavior where practical.
- Add validation/linting utilities for Pagenary configuration and content-side artifacts, including:
  - tenant `config.json`
  - tenant `manifest.json`
  - root or workspace tenant registries
  - page/frontmatter metadata
  - generated/consumed manifest and metadata contract files where useful
- Surface diagnostics in the editor Problems panel.
- Provide commands for manual validation of the active file and workspace.
- Document installation, local development, packaging, and distribution flow.

# Acceptance criteria
- Extension can be built and packaged locally.
- Extension activates in VS Code-compatible editors for Pagenary workspaces or relevant file types.
- Markdown preview path renders representative Pagenary Markdown content, including frontmatter handling, internal links, code fences, and common publisher extensions.
- JSON/config validation reports actionable diagnostics with file/line references.
- Validation reuses existing Pagenary schemas or publisher logic where feasible instead of duplicating rules by hand.
- README documents development setup, test commands, packaging, and distribution/publishing steps.
- Tests or smoke checks cover activation, validation, and at least one preview fixture.

# Implementation notes
- Prefer reusing `apps/publisher/tenants.schema.json` and existing lint/build helper logic where possible.
- Keep extension logic separated from publisher runtime code so the publisher does not depend on VS Code APIs.
- Investigate whether the extension should live under a new workspace such as `apps/vscode-extension/` or `packages/vscode-extension/`.
- Include distribution research for Open VSX as well as the Microsoft VS Code Marketplace if licensing/account constraints allow.

