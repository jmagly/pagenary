# Testing audit evidence

The audit completed with 181 passed gates, zero failed and zero unknown. [Final report](normalization-summary-final-11.md).

The complete protocol, source inventories, 81 file reviews, guarded change plans, initial failures, raw runner output and 25 negative-control/restoration receipts are preserved byte-for-byte in [audit-evidence-2026-09-09.tar.gz](audit-evidence-2026-09-09.tar.gz).

SHA-256: `c449b2caeca60b6d50d728c8cca2567f538f62fcefc6fc54ad099987bda6c948`

For a fresh clone, inspect the archive and restore its `.aiwg/testing/` evidence paths from the repository root:

```sh
tar -tzf .aiwg/testing/audit-evidence-2026-09-09.tar.gz
tar -xzf .aiwg/testing/audit-evidence-2026-09-09.tar.gz
```

The original receipts bind the pre-release audited source snapshot and original worktree path. The subsequent release-browser workflow adjustment and release metadata do not rewrite those historical bindings. Rebind the protocol before a new collection on another checkout, as described in [TESTING.md](../../TESTING.md).
