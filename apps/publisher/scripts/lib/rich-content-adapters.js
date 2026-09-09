import {
  createRenderDiagnostic,
  fallbackHtmlForSource,
  resolveFailurePolicy,
  sanitizeDiagnostic
} from './rich-content-diagnostics.js';
import { buildRendererCacheIdentity } from './rich-content-cache.js';

export function defineRendererAdapter(definition = {}) {
  if (!definition.id || typeof definition.id !== 'string') {
    throw new Error('Renderer adapter requires a string id');
  }
  const adapter = {
    id: definition.id,
    version: definition.version || '0.0.0',
    profiles: Array.isArray(definition.profiles) ? [...definition.profiles] : [],
    validate: typeof definition.validate === 'function' ? definition.validate : () => [],
    async render() {
      if (typeof definition.render !== 'function') {
        throw new Error(`Renderer adapter ${definition.id} does not implement render`);
      }
      return definition.render.apply(adapter, arguments);
    },
    diagnose: typeof definition.diagnose === 'function'
      ? definition.diagnose
      : (error) => [createRenderDiagnostic({
        code: 'RTC_RENDER_FAILED',
        severity: 'error',
        renderer: definition.id,
        message: error && error.message ? error.message : String(error)
      })],
    dependencies: typeof definition.dependencies === 'function' ? definition.dependencies : () => [],
    cacheIdentity: typeof definition.cacheIdentity === 'function'
      ? definition.cacheIdentity
      : (node) => ({ source: node.source || node.body || '' })
  };
  return Object.freeze(adapter);
}

export function createRendererRegistry() {
  const adapters = new Map();
  return {
    register(adapter) {
      const normalized = defineRendererAdapter(adapter);
      if (adapters.has(normalized.id)) {
        throw new Error(`Renderer adapter already registered: ${normalized.id}`);
      }
      adapters.set(normalized.id, normalized);
      return normalized;
    },
    get(id) {
      return adapters.get(id) || null;
    },
    require(id) {
      const adapter = adapters.get(id);
      if (!adapter) throw new Error(`Renderer adapter not registered: ${id}`);
      return adapter;
    },
    available() {
      return [...adapters.values()]
        .map((adapter) => ({
          id: adapter.id,
          version: adapter.version,
          profiles: [...adapter.profiles]
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
  };
}

export function normalizeRenderResult(result = {}, context = {}) {
  const adapter = context.adapter || {};
  const node = context.node || {};
  return {
    html: String(result.html || ''),
    assets: Array.isArray(result.assets) ? result.assets : [],
    semanticText: String(result.semanticText || result.text || ''),
    searchText: String(result.searchText || result.semanticText || result.text || ''),
    source: result.source != null ? String(result.source) : String(node.source || ''),
    dependencies: Array.isArray(result.dependencies) ? result.dependencies : [],
    diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : [],
    rendererMetadata: {
      renderer: result.rendererMetadata?.renderer || adapter.id || node.renderer || null,
      version: result.rendererMetadata?.version || adapter.version || null,
      profile: result.rendererMetadata?.profile || context.profile || null,
      cacheIdentity: result.rendererMetadata?.cacheIdentity || null,
      cacheStatus: result.rendererMetadata?.cacheStatus || null,
      durationMs: Number.isFinite(result.rendererMetadata?.durationMs) ? result.rendererMetadata.durationMs : null,
      ...(result.rendererMetadata || {})
    }
  };
}

export async function renderRichContentNodes(nodes, options = {}) {
  const registry = options.registry || createRendererRegistry();
  const failurePolicy = resolveFailurePolicy({
    platformPolicy: options.failurePolicy || options.platformPolicy || 'warn',
    pagePolicy: options.pagePolicy || null
  });
  const results = [];

  for (const node of nodes || []) {
    if (!node.renderer) continue;
    const adapter = registry.get(node.renderer);
    if (!adapter) {
      results.push(enforceFailurePolicy(missingAdapterResult(node, options, failurePolicy), failurePolicy));
      continue;
    }
    results.push(await renderWithAdapter(adapter, node, { ...options, failurePolicy }));
  }
  return results;
}

async function renderWithAdapter(adapter, node, context) {
  const started = Date.now();
  const rendererContext = { ...context, adapter };
  try {
    const validationDiagnostics = normalizeDiagnostics(adapter.validate(node, rendererContext), adapter, node, context);
    if (validationDiagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
      return enforceFailurePolicy(resultForDiagnostics(node, adapter, validationDiagnostics, context, started), context.failurePolicy);
    }
    const cacheIdentity = context.cache
      ? buildRendererCacheIdentity({
          tenantId: context.tenantId,
          pageId: context.pageId || context.sourceRelativePath,
          nodeId: node.id || `${node.location?.line || 0}:${node.location?.column || 0}`,
          renderer: adapter,
          profile: context.profile,
          source: node.source || node.body || '',
          config: adapter.cacheIdentity(node, rendererContext),
          theme: context.theme,
          fonts: context.fonts,
          outputFormat: context.outputFormat,
          securityProfile: context.securityProfile,
          dependencies: adapter.dependencies(node, rendererContext)
        })
      : null;
    if (cacheIdentity) {
      const cached = await context.cache.read(cacheIdentity).catch(() => ({ status: 'miss', reason: 'cache-read-failed' }));
      if (cached.status === 'hit') {
        const hit = normalizeRenderResult(cached.payload, { adapter, node, profile: context.profile });
        hit.rendererMetadata.cacheIdentity = cacheIdentity.materialHash;
        hit.rendererMetadata.cacheStatus = 'hit';
        hit.rendererMetadata.durationMs = Date.now() - started;
        return enforceFailurePolicy(hit, context.failurePolicy);
      }
    }
    const result = await adapter.render(node, rendererContext);
    const normalized = normalizeRenderResult(result, {
      adapter,
      node,
      profile: context.profile
    });
    normalized.diagnostics = [
      ...validationDiagnostics,
      ...normalizeDiagnostics(normalized.diagnostics, adapter, node, context)
    ];
    enforceFailurePolicy(normalized, context.failurePolicy);
    normalized.rendererMetadata.durationMs = Date.now() - started;
    if (cacheIdentity) {
      normalized.rendererMetadata.cacheIdentity = cacheIdentity.materialHash;
      normalized.rendererMetadata.cacheStatus = 'miss';
      try {
        await context.cache.write(cacheIdentity, normalized);
      } catch {
        normalized.rendererMetadata.cacheStatus = 'bypass';
      }
    }
    return normalized;
  } catch (error) {
    const diagnostics = normalizeDiagnostics(error?.diagnostics || adapter.diagnose(error, node, rendererContext), adapter, node, context);
    const fallback = resultForDiagnostics(node, adapter, diagnostics, context, started);
    if (context.failurePolicy === 'strict') {
      const strictError = new Error(fallback.diagnostics[0]?.message || `Renderer failed: ${adapter.id}`);
      strictError.code = fallback.diagnostics[0]?.code || 'RTC_RENDER_FAILED';
      strictError.diagnostics = fallback.diagnostics;
      throw strictError;
    }
    return fallback;
  }
}

function enforceFailurePolicy(result, policy) {
  const failure = result.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
  if (policy === 'strict' && failure) {
    const error = new Error(failure.message || 'Renderer validation failed');
    error.code = failure.code;
    error.diagnostics = result.diagnostics;
    throw error;
  }
  return result;
}

function resultForDiagnostics(node, adapter, diagnostics, context, started) {
  const severity = context.failurePolicy === 'warn' ? 'warning' : 'error';
  const normalizedDiagnostics = diagnostics.map((diagnostic) => ({
    ...diagnostic,
    severity: context.failurePolicy === 'warn' && diagnostic.severity === 'error' ? severity : diagnostic.severity
  }));
  return normalizeRenderResult({
    html: context.failurePolicy === 'off' ? '' : fallbackHtmlForSource(node.body || node.source || ''),
    semanticText: node.body || node.source || '',
    source: node.source || '',
    diagnostics: normalizedDiagnostics,
    rendererMetadata: {
      renderer: adapter.id,
      version: adapter.version,
      profile: context.profile || null,
      durationMs: Date.now() - started
    }
  }, { adapter, node, profile: context.profile });
}

function missingAdapterResult(node, context, failurePolicy) {
  const adapter = { id: node.renderer, version: null };
  const diagnostic = createRenderDiagnostic({
    code: 'RTC_RENDERER_UNAVAILABLE',
    severity: failurePolicy === 'warn' ? 'warning' : 'error',
    renderer: node.renderer,
    profile: context.profile || null,
    message: `No renderer adapter is registered for ${node.renderer}`,
    location: node.location || null
  });
  return normalizeRenderResult({
    html: failurePolicy === 'off' ? '' : fallbackHtmlForSource(node.body || node.source || ''),
    semanticText: node.body || node.source || '',
    source: node.source || '',
    diagnostics: [sanitizeDiagnostic(diagnostic, context)],
    rendererMetadata: {
      renderer: node.renderer,
      version: null,
      profile: context.profile || null
    }
  }, { adapter, node, profile: context.profile });
}

function normalizeDiagnostics(diagnostics, adapter, node, context) {
  return (Array.isArray(diagnostics) ? diagnostics : [])
    .map((diagnostic) => sanitizeDiagnostic({
      ...createRenderDiagnostic(diagnostic),
      renderer: diagnostic.renderer || adapter.id,
      profile: diagnostic.profile || context.profile || null,
      location: diagnostic.location || node.location || null
    }, context));
}
