#!/usr/bin/env node
import { copyFile } from 'node:fs/promises';

// prepack runs in the source workspace, before scripts importing this contract.
// The generated copy is shipped under scripts/ but never replaces the canonical
// workspace module used by development builds and source-bound tests.
await copyFile(
  new URL('../../authoring-contract/index.cjs', import.meta.url),
  new URL('./lib/authoring-contract.cjs', import.meta.url)
);
