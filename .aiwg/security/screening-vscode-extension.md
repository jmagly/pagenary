# Security Screening: Pagenary VS Code Extension

## Threats

- Malicious workspace content rendered in preview.
- Extension command execution over untrusted tenant files.
- Dependency or marketplace tooling drift.

## Requirements

- Treat workspace content as untrusted input.
- Escape rendered preview content and use a strict webview content security policy.
- Do not run arbitrary tenant scripts during validation.
- Pin dependencies through the committed npm lockfile.
- Re-check current Marketplace/Open VSX publishing requirements during implementation.
