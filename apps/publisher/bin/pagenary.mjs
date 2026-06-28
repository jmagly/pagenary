#!/usr/bin/env node
/**
 * pagenary — CLI entry point for @pagenary/publisher.
 *
 * Thin entry that hands control to the dispatcher in scripts/lib/cli.js. The
 * dispatcher resolves internal scripts relative to the installed package (never
 * the caller's CWD), so the right generator code runs regardless of where
 * `pagenary` is invoked — installed, via npx, or from source.
 */

import { run } from '../scripts/lib/cli.js';

run(process.argv.slice(2))
  .then((code) => process.exit(typeof code === 'number' ? code : 0))
  .catch((err) => {
    process.stderr.write(`pagenary: ${err?.message || err}\n`);
    process.exit(1);
  });
