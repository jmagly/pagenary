# Use Cases: Pagenary VS Code Extension

## UC-1: Author Previews Pagenary Markdown

An author opens a Pagenary Markdown file and previews how core Markdown, frontmatter handling, internal links, code fences, and common Pagenary extensions will render before running a full publisher build.

Acceptance:
- Preview command is available for Markdown files in a Pagenary workspace.
- Representative fixture renders without throwing.
- Unsupported publisher behavior is documented or surfaced clearly.

## UC-2: Integrator Validates Tenant Configuration

An integrator edits tenant registry/config files and receives actionable diagnostics in the Problems panel before CI.

Acceptance:
- Diagnostics identify invalid JSON/schema violations with file and range where possible.
- Validation reuses `apps/publisher/tenants.schema.json` or extracted publisher validation logic.
- Manual validation command can validate the active file.

## UC-3: Maintainer Packages The Extension

A maintainer builds and packages the extension locally for review or distribution.

Acceptance:
- Package scripts produce a local `.vsix`.
- Documentation explains local development, test, package, and publishing preparation.
