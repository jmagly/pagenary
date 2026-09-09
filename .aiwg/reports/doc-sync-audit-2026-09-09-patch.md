# Release 2026.9.1 documentation sync

Gate: **passed — no documentation changes required**.

Code-to-docs dry run completed before this report. Root and publisher README freshness were explicitly reviewed against the packaging patch, together with the relevant installation walkthrough, rich-content introduction, and release instructions. The prior 2026.9.0 report is preserved.

The shared resolver prefers the canonical workspace authoring contract; package preparation copies that contract into the shipped scripts before prepack builds the reference site. Detached installations load the bundled contract. This restores the existing documented npm installation and tenant-build workflow (“no clone required”). CLI commands, authored syntax, optional external converter requirements, search behavior, public APIs, and CDN/CORS boundaries do not change. No new user setup step is necessary.

The new CLI qualification test statically reviewed here performs an actual pack/extract cycle and detached tenant build, verifies the bundled module and reference site, and checks canonical precedence over a stale bundle. This reviewer did not execute that test; execution evidence belongs to the parent release gate. Public npm availability is not asserted.

Zero documentation findings require repair for this patch. The standalone browser smoke's optional dependency behavior still matches its implementation; the README separately requires browser setup for the repository test suite. No Markdown, version, CHANGELOG, source, or configuration files were edited, and no commit or push was performed.

Dry-run scope, limitations, and SHA-256 bindings are recorded in `.aiwg/working/doc-sync/release-2026.9.1-dry-run.json`. This is a bounded patch drift review, not certification of all historical documentation or external links.
