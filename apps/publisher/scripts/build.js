#!/usr/bin/env node
/* Minimal build: copy src -> dist with optional terser minification */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const srcDir = path.join(root, 'src');
const outputDirEnv = process.env.BUILD_OUTPUT || process.env.DIST_DIR;
const distDir = outputDirEnv ? path.resolve(root, outputDirEnv) : path.join(root, 'dist');

const argv = process.argv.slice(2);
const DEV = argv.includes('--dev') || process.env.NODE_ENV === 'development';
const FORCE_MINIFY = argv.includes('--force-minify') || /^(1|true)$/i.test(process.env.FORCE_MINIFY || '');
let buildConfig = {};
const cfgPath = path.join(root, 'build.config.json');
if (fs.existsSync(cfgPath)) {
  try { buildConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {}; }
  catch (err) { console.warn('Could not read build.config.json:', err.message); }
}
const minifyDefault = buildConfig.minify !== false;
const MINIFY = FORCE_MINIFY ? true : (DEV ? false : minifyDefault);
const baseReserved = Array.isArray(buildConfig.mangleReserved) ? buildConfig.mangleReserved : [];
const sectionReserved = Array.isArray(buildConfig.sectionsMangleReserved) ? buildConfig.sectionsMangleReserved : ['load'];
let terser = null;
let attemptedTerser = false;

async function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map((entry) => entry.isDirectory()
    ? rimraf(path.join(dir, entry.name))
    : fsp.unlink(path.join(dir, entry.name))));
  await fsp.rmdir(dir).catch(() => {});
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyEntry(from, to) {
  const stat = await fsp.lstat(from);
  if (stat.isDirectory()) {
    await ensureDir(to);
    const entries = await fsp.readdir(from);
    for (const name of entries) {
      await copyEntry(path.join(from, name), path.join(to, name));
    }
    return;
  }

  let content = await fsp.readFile(from, 'utf8');
  if (path.basename(from) === 'index.html') {
    content = content.replace('</head>', `  <meta name="x-build" content="${new Date().toISOString()}" />\n  </head>`);
  }

  if (MINIFY && from.endsWith('.js')) {
    if (!attemptedTerser) {
      attemptedTerser = true;
      try { terser = require('terser'); }
      catch { console.warn('Terser not installed; skipping minification.'); }
    }
    if (terser) {
      try {
        const isSection = from.includes(`${path.sep}sections${path.sep}`);
        const reserved = Array.from(new Set([...(isSection ? sectionReserved : baseReserved)]));
        const result = await terser.minify(content, {
          module: true,
          compress: { passes: 2 },
          mangle: { toplevel: true, reserved }
        });
        if (result.code) content = result.code;
      } catch (err) {
        console.warn('Minification error in', path.relative(root, from), '-', err.message);
      }
    }
  }

  await ensureDir(path.dirname(to));
  await fsp.writeFile(to, content, 'utf8');
}

async function main() {
  if (!fs.existsSync(srcDir)) {
    console.error('src directory missing.');
    process.exit(1);
  }
  await rimraf(distDir);
  await ensureDir(distDir);
  await copyEntry(srcDir, distDir);
  console.log(`Built docs-toolkit -> ${path.relative(root, distDir)}/ ${MINIFY ? '(minified)' : '(dev copy)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
