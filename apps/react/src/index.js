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

const TIER_ONE_DB_MARKERS = [
  '@electric-sql/pglite',
  '@fortemi/core',
  'pglite.wasm',
  'pglite.data',
  'pglite-worker'
];

export async function assertTierOneGraphOnly(outDir, emittedAssets) {
  const forbiddenFiles = emittedAssets
    .map((asset) => asset.file)
    .filter((file) => /(?:pglite|\.wasm(?:$|\?))/i.test(file));
  const forbiddenImports = [];
  for (const asset of emittedAssets) {
    if (!asset.file.endsWith('.js')) continue;
    const relative = asset.file.replace(/^assets\/react\//, '');
    const source = await fs.readFile(path.join(outDir, relative), 'utf8');
    for (const marker of TIER_ONE_DB_MARKERS) {
      if (source.includes(marker)) forbiddenImports.push(`${asset.file}: ${marker}`);
    }
  }
  if (forbiddenFiles.length || forbiddenImports.length) {
    throw new Error(
      'Tier-1 React graph bundle contains database artifacts/imports:\n' +
      [...forbiddenFiles, ...forbiddenImports].map((item) => `- ${item}`).join('\n')
    );
  }
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
      // PGlite stays out of the tenant bundle because the docs-map imports
      // GraphView from @fortemi/react/graph and the @fortemi/graph root is
      // graph-only as of 2026.7.11. Database orchestration is isolated behind
      // @fortemi/graph/controller. The artifact audit below guards this seam.
      dedupe: ['react', 'react-dom']
    },
    build: {
      emptyOutDir: false,
      manifest: true,
      outDir,
      assetsDir: 'assets',
      rollupOptions: {
        input: entry,
        // Unselected interactive docs-map tiers (#135) remain external so
        // their optional peer trees are not emitted. PGlite is deliberately
        // not externalized: if it re-enters this Tier-1 graph, the artifact
        // audit must fail rather than leaving a masked unresolved import.
        external: (id) =>
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
  await assertTierOneGraphOnly(outDir, emittedAssets);
  const manifestFile = emittedAssets.find((asset) => asset.file.endsWith('.vite/manifest.json'));
  return {
    adapter: '@pagenary/react',
    packageRoot,
    emittedAssets,
    manifestFile: manifestFile?.file || null
  };
}
