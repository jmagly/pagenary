import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Optional peer dependencies per interactive docs-map tier (#135). The tiers
// are lazy-loaded upstream, but Vite still needs the packages resolvable to
// bundle the opted-in tier's async chunks.
const DOCS_MAP_TIER_PEERS = {
  '2d': ['sigma', 'graphology', 'graphology-layout-forceatlas2'],
  '3d': ['react-force-graph-3d', 'three']
};

function docsMapViewFromConfig(config) {
  const renderer = String(config?.docsMap?.renderer || '').trim().toLowerCase();
  if (renderer === 'fortemi-react-2d') return '2d';
  if (renderer === 'fortemi-react-3d') return '3d';
  return 'graph';
}

function assertDocsMapTierPeers(view, tenantId, sourceDir) {
  const peers = DOCS_MAP_TIER_PEERS[view];
  if (!peers) return;
  const probe = createRequire(path.join(sourceDir, '_peer-probe.js'));
  const missing = peers.filter((pkg) => {
    try {
      probe.resolve(`${pkg}/package.json`);
      return false;
    } catch {
      try {
        // Packages whose exports map hides package.json still resolve by name.
        probe.resolve(pkg);
        return false;
      } catch {
        return true;
      }
    }
  });
  if (missing.length) {
    throw new Error(
      `docsMap.renderer "fortemi-react-${view}" for tenant "${tenantId}" needs optional peer ` +
      `dependencies that are not installed: ${missing.join(', ')}. ` +
      `Install them (npm install ${peers.join(' ')}) or switch docsMap.renderer ` +
      `back to "fortemi-react" / "svg".`
    );
  }
}

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
          // Only a root-level index.*.js is the entry — code-split chunks can
          // also be named index (e.g. docs-map/index.jsx) but land under
          // assets/, and injecting a chunk as the entry script mounts nothing.
          isEntry: /^index\.[\w-]+\.js$/.test(file) || file === 'index.js'
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
    config = {},
    runtime = {}
  } = options;
  if (!tenantId) throw new Error('tenantId is required');
  if (!sourceDir) throw new Error('sourceDir is required');
  if (!distDir) throw new Error('distDir is required');
  if (!runtime.entry) throw new Error('runtime.entry is required');

  const entry = path.resolve(sourceDir, runtime.entry);
  assertInside(sourceDir, entry, 'runtime.react.entry');
  await fs.access(entry);

  // Interactive docs-map tier selection (#135): only the opted-in tier is
  // bundled; the other stays external so its bytes never ship. Peer deps for
  // the selected tier must be installed — fail with an actionable message.
  const docsMapView = docsMapViewFromConfig(config);
  assertDocsMapTierPeers(docsMapView, tenantId, sourceDir);

  const outDir = path.join(distDir, 'assets', 'react');
  await viteBuild({
    root: sourceDir,
    base: normalizeBase(basePath),
    logLevel: 'warn',
    plugins: [react()],
    configFile: false,
    publicDir: false,
    resolve: {
      // PGlite stays out of the tenant bundle without an alias/stub since
      // fortemi-react 2026.7.4 (#261): @fortemi/core lazy-loads
      // @electric-sql/pglite and the docs-map imports GraphView from the
      // PGlite-free @fortemi/react/graph subpath. The build-time WASM/data
      // absence check in CI guards this staying true.
      dedupe: ['react', 'react-dom']
    },
    build: {
      emptyOutDir: false,
      manifest: true,
      outDir,
      assetsDir: 'assets',
      rollupOptions: {
        input: entry,
        // @fortemi/core lazy-loads @electric-sql/pglite behind a dynamic
        // import that the Tier-1 docs-map path never executes, but Vite still
        // emits it (and its ~16MB WASM/data) as async chunks because
        // @fortemi/graph's barrel statically imports core's GraphController.
        // Externalize the optional engine so no PGlite bytes ship; a Tier-2
        // (full-database) tenant build must NOT externalize this.
        // Unselected interactive docs-map tiers (#135) are externalized the
        // same way: their runtime dynamic import fails fast in the browser and
        // the control falls back to the default GraphView tier.
        external: (id) =>
          id === '@electric-sql/pglite' ||
          id.startsWith('@electric-sql/pglite/') ||
          (docsMapView !== '2d' && id === '@fortemi/react/graph-2d') ||
          (docsMapView !== '3d' && id === '@fortemi/react/graph-3d'),
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
