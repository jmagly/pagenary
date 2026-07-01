# Risk Register: Pagenary VS Code Extension

| Risk | Impact | Mitigation |
|---|---|---|
| Preview diverges from publisher output | Authors lose trust | Use fixtures and explicitly track unsupported gaps |
| Validation duplicates publisher rules | Drift and false diagnostics | Reuse schemas/helpers; extract shared helpers only when needed |
| Webview handles untrusted content unsafely | Extension security issue | Escape rendered content and enforce CSP |
| Marketplace packaging differs between VS Code and Open VSX | Release friction | Document local `.vsix`, Microsoft Marketplace, and Open VSX separately |
| Full workspace validation is slow | Poor editor UX | Run incremental diagnostics on active files; make workspace scan command-driven |
