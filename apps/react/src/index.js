import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function assertInside(parent, child, label) {
  const rel = path.relative(parent, child);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${label} must stay inside the tenant source directory`);
  }
}

function normalizeBase(basePath) {
  const raw = String(basePath || './');
  if (!raw || raw === '/') return './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

async function listEmittedAssets(outDir) {
  const emitted = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const file = path.relative(outDir, abs).split(path.sep).join('/');
        emitted.push({
          file: `assets/react/${file}`,
          isEntry: /(?:^|\/)index\.[\w-]+\.js$/.test(file) || file === 'index.js'
        });
      }
    }
  }
  await walk(outDir);
  return emitted.sort((a, b) => a.file.localeCompare(b.file));
}

export async function buildReactTenant(options = {}) {
  const {
    tenantId,
    sourceDir,
    distDir,
    basePath = '',
    runtime = {}
  } = options;
  if (!tenantId) throw new Error('tenantId is required');
  if (!sourceDir) throw new Error('sourceDir is required');
  if (!distDir) throw new Error('distDir is required');
  if (!runtime.entry) throw new Error('runtime.entry is required');

  const entry = path.resolve(sourceDir, runtime.entry);
  assertInside(sourceDir, entry, 'runtime.react.entry');
  await fs.access(entry);

  const outDir = path.join(distDir, 'assets', 'react');
  await viteBuild({
    root: sourceDir,
    base: normalizeBase(basePath),
    logLevel: 'warn',
    plugins: [react()],
    configFile: false,
    publicDir: false,
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        // Keep @electric-sql/pglite (~16MB WASM/data) out of the tenant bundle:
        // @fortemi/graph's barrel statically imports @fortemi/core for a
        // GraphController the docs-map never uses. Stub it until fortemi-react
        // #261 makes PGlite optional. See src/fortemi-core-stub.js.
        '@fortemi/core': fileURLToPath(new URL('./fortemi-core-stub.js', import.meta.url))
      }
    },
    build: {
      emptyOutDir: false,
      manifest: true,
      outDir,
      assetsDir: 'assets',
      rollupOptions: {
        input: entry,
        output: {
          entryFileNames: 'index.[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]'
        }
      }
    }
  });

  const emittedAssets = await listEmittedAssets(outDir);
  const manifestFile = emittedAssets.find((asset) => asset.file.endsWith('.vite/manifest.json'));
  return {
    adapter: '@pagenary/react',
    packageRoot,
    emittedAssets,
    manifestFile: manifestFile?.file || null
  };
}
