const POLICY_ORDER = {
  off: 0,
  warn: 1,
  strict: 2
};

const DEFAULT_SEVERITY = 'error';

export function createRenderDiagnostic(input = {}) {
  const severity = input.severity || DEFAULT_SEVERITY;
  return {
    code: String(input.code || 'RTC_DIAGNOSTIC'),
    severity,
    message: String(input.message || input.code || 'Renderer diagnostic'),
    renderer: input.renderer || null,
    profile: input.profile || null,
    cacheStatus: input.cacheStatus || null,
    durationMs: Number.isFinite(input.durationMs) ? input.durationMs : null,
    location: input.location ? cloneLocation(input.location) : null,
    details: input.details && typeof input.details === 'object' ? { ...input.details } : {}
  };
}

export function resolveFailurePolicy({ platformPolicy = 'warn', pagePolicy = null } = {}) {
  const platform = normalizePolicy(platformPolicy);
  const page = pagePolicy == null ? platform : normalizePolicy(pagePolicy);
  return POLICY_ORDER[page] > POLICY_ORDER[platform] ? page : platform;
}

export function escapeFallbackSource(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeDiagnostic(diagnostic, options = {}) {
  const workspaceRoot = options.workspaceRoot ? normalizePath(options.workspaceRoot) : null;
  const clean = createRenderDiagnostic(diagnostic);
  clean.message = sanitizeText(clean.message, workspaceRoot);
  clean.location = sanitizeLocation(clean.location, workspaceRoot);
  clean.details = sanitizeDetails(clean.details, workspaceRoot);
  return clean;
}

export function fallbackHtmlForSource(source) {
  return `<pre class="rich-content-fallback"><code>${escapeFallbackSource(source)}</code></pre>`;
}

function normalizePolicy(value) {
  const policy = String(value || '').toLowerCase();
  if (!Object.hasOwn(POLICY_ORDER, policy)) {
    throw new Error(`Unsupported rich-content failure policy: ${value}`);
  }
  return policy;
}

function cloneLocation(location) {
  return {
    file: location.file || null,
    start: location.start ? { ...location.start } : null,
    end: location.end ? { ...location.end } : null
  };
}

function sanitizeLocation(location, workspaceRoot) {
  if (!location) return null;
  const clean = cloneLocation(location);
  if (clean.file) clean.file = sanitizePath(clean.file, workspaceRoot);
  return clean;
}

function sanitizeDetails(details, workspaceRoot) {
  const out = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (typeof value === 'string') out[key] = sanitizeText(value, workspaceRoot);
    else if (Array.isArray(value)) out[key] = value.map((item) => (
      typeof item === 'string' ? sanitizeText(item, workspaceRoot) : item
    ));
    else out[key] = value;
  }
  return out;
}

function sanitizeText(value, workspaceRoot) {
  return String(value == null ? '' : value)
    .replace(/\b([A-Z_]*(?:TOKEN|SECRET|PASSWORD|KEY)[A-Z_]*=)[^\s"'<>]+/gi, '$1[redacted]')
    .replace(/(?:[A-Za-z]:)?\/[^\s"'<>]+/g, (match) => sanitizePath(match, workspaceRoot));
}

function sanitizePath(value, workspaceRoot) {
  const normalized = normalizePath(value);
  if (workspaceRoot && (normalized === workspaceRoot || normalized.startsWith(`${workspaceRoot}/`))) {
    const relative = normalized.slice(workspaceRoot.length).replace(/^\/+/, '');
    return relative || '.';
  }
  if (normalized.startsWith('/')) return '[path]';
  return value;
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+$/g, '');
}
