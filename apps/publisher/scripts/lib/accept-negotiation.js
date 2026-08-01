/**
 * Parse an HTTP Accept header into normalized media ranges.
 * Quoted commas are retained inside parameter values.
 */
export function parseAcceptHeader(header) {
  const source = String(header || '').trim();
  if (!source) return [];
  const parts = [];
  let current = '';
  let quoted = false;
  let escaped = false;
  for (const char of source) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\' && quoted) {
      current += char;
      escaped = true;
    } else if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (char === ',' && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);

  return parts.map((part, order) => {
    const segments = part.split(';').map((value) => value.trim()).filter(Boolean);
    const mediaType = String(segments.shift() || '').toLowerCase();
    if (!/^[^\s/]+\/[^\s/]+$/.test(mediaType)) return null;
    let quality = 1;
    const parameters = {};
    for (const segment of segments) {
      const index = segment.indexOf('=');
      const name = (index === -1 ? segment : segment.slice(0, index)).trim().toLowerCase();
      const value = (index === -1 ? '' : segment.slice(index + 1)).trim().replace(/^"|"$/g, '');
      if (name === 'q') {
        const parsed = Number(value);
        quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
      } else if (name) {
        parameters[name] = value;
      }
    }
    return { mediaType, quality, parameters, order };
  }).filter(Boolean);
}

function qualityFor(ranges, type) {
  const [wantedType, wantedSubtype] = type.split('/');
  let winner = null;
  for (const range of ranges) {
    const [rangeType, rangeSubtype] = range.mediaType.split('/');
    if (rangeType !== '*' && rangeType !== wantedType) continue;
    if (rangeSubtype !== '*' && rangeSubtype !== wantedSubtype) continue;
    const specificity = (rangeType === '*' ? 0 : 1) + (rangeSubtype === '*' ? 0 : 1);
    if (!winner || specificity > winner.specificity ||
      (specificity === winner.specificity && range.order < winner.order)) {
      winner = { quality: range.quality, specificity, order: range.order };
    }
  }
  return winner?.quality || 0;
}

/**
 * Return true only when Markdown is explicitly acceptable and more preferred
 * than HTML. HTML intentionally wins ties and wildcard-only requests.
 */
export function prefersMarkdown(header) {
  const ranges = parseAcceptHeader(header);
  if (!ranges.length) return false;
  const markdown = qualityFor(ranges, 'text/markdown');
  const html = qualityFor(ranges, 'text/html');
  return markdown > 0 && markdown > html;
}
