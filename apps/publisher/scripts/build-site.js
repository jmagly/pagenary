#!/usr/bin/env node
/**
 * Flatten the compiled `pagenary` tenant bundle into a top-level `site/`
 * directory so it ships inside the published @pagenary/publisher tarball
 * (see issue #7). This runs from the `prepack` lifecycle hook, after
 * `build:tenants pagenary` has produced `dist/pagenary/`.
 *
 * `prepack` fires for `npm pack` and `npm publish` but NOT for a consumer's
 * `npm install` (that would be `prepare`), so installing the package never
 * triggers a site build.
 *
 * Output shape: site/index.html (+ assets) at the top level — not
 * site/pagenary/ — matching the tarball-audit expectation.
 */

import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'dist', 'pagenary');
const destDir = path.join(root, 'site');

async function pathExists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively copy a directory. Follows symlinks (the pagenary tenant uses
 * repo-relative symlinks for source content, but dist/ is already a fully
 * materialized build, so this copy sees regular files).
 * Returns { files, bytes }.
 */
async function copyDir(from, to) {
  await fsp.mkdir(to, { recursive: true });
  const entries = await fsp.readdir(from, { withFileTypes: true });
  let files = 0;
  let bytes = 0;
  for (const entry of entries) {
    const fromPath = path.join(from, entry.name);
    const toPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      const sub = await copyDir(fromPath, toPath);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      await fsp.copyFile(fromPath, toPath);
      const stat = await fsp.stat(toPath);
      files += 1;
      bytes += stat.size;
    }
  }
  return { files, bytes };
}

async function main() {
  if (!(await pathExists(srcDir))) {
    console.error(
      `build-site: ${path.relative(root, srcDir)} not found. ` +
        `Run "npm run build:tenants pagenary" first (prepack does this automatically).`
    );
    process.exit(1);
  }

  // Deterministic: start from a clean site/.
  await fsp.rm(destDir, { recursive: true, force: true });

  const { files, bytes } = await copyDir(srcDir, destDir);
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  console.log(`build-site: copied ${files} files (${mb} MB) -> ${path.relative(root, destDir)}/`);

  if (!(await pathExists(path.join(destDir, 'index.html')))) {
    console.error('build-site: site/index.html missing after copy — build output looks incomplete.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`build-site: ${err.message}`);
  process.exit(1);
});
