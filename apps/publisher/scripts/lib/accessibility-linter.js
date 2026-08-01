import path from 'path';
import { parseFrontmatter } from './frontmatter.js';

const AMBIGUOUS_LINK_TEXT = new Set([
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
  'link',
  'this link',
  'details'
]);

function normalizeSlash(value) {
  return String(value || '').split(path.sep).join('/');
}

function stripInlineMarkdown(value) {
  return String(value || '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlBlocksAndMarkdown(body) {
  const htmlBlocks = [];
  const mediaBlocks = [];
  const markdownParts = [];
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let fenceLang = '';
  let fenceMarker = '';
  let fenceLines = [];

  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})([^`]*)$/.exec(line);
    if (fence) {
      const marker = fence[1];
      const isClosingFence = inFence &&
        marker[0] === fenceMarker[0] && marker.length >= fenceMarker.length &&
        !fence[2].trim();
      if (isClosingFence) {
        if (fenceLang === 'html') {
          htmlBlocks.push(fenceLines.join('\n'));
        } else if (fenceLang === 'media') {
          mediaBlocks.push({ text: fenceLines.join('\n'), line: markdownParts.length + 1 });
        }
        inFence = false;
        fenceLang = '';
        fenceMarker = '';
        fenceLines = [];
      } else if (!inFence) {
        inFence = true;
        fenceMarker = marker;
        fenceLang = (fence[2] || '').trim().split(/\s+/, 1)[0].toLowerCase();
      } else {
        // A shorter or differently styled marker inside a fence is example
        // content, not a delimiter (CommonMark fenced-code semantics).
        fenceLines.push(line);
      }
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
    } else {
      markdownParts.push(line);
    }
  }

  if (inFence && fenceLang === 'html') {
    htmlBlocks.push(fenceLines.join('\n'));
  } else if (inFence && fenceLang === 'media') {
    mediaBlocks.push({ text: fenceLines.join('\n'), line: markdownParts.length + 1 });
  }

  return {
    markdown: markdownParts.join('\n'),
    html: htmlBlocks.join('\n'),
    mediaBlocks
  };
}

function parseMediaBlock(raw) {
  const data = {};
  const text = String(raw || '').trim();
  if (!text) return data;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return { _invalid: true };
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    data[key] = value;
  }
  return data;
}

function lineForOffset(text, offset) {
  return String(text || '').slice(0, offset).split(/\r?\n/).length;
}

function maskInlineCode(markdown) {
  return String(markdown || '').replace(/(`+)([^`\n]*?)\1/g, (match) => ' '.repeat(match.length));
}

function hasAttribute(tag, name) {
  return new RegExp(`\\s${name}(?:\\s*=|\\s|>)`, 'i').test(tag);
}

function attributeValue(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? '';
}

function addFinding(findings, context, partial) {
  findings.push({
    file: normalizeSlash(context.file || ''),
    route: context.route || context.id || null,
    rule: partial.rule,
    severity: partial.severity || 'warning',
    message: partial.message,
    remediation: partial.remediation,
    line: partial.line || null,
    responsibility: partial.responsibility || 'authored-content'
  });
}

function lintHeadings(markdown, context, findings) {
  let previousLevel = 0;

  for (const match of markdown.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)) {
    const level = match[1].length;
    const line = lineForOffset(markdown, match.index || 0);

    if (previousLevel > 0 && level > previousLevel + 1) {
      addFinding(findings, context, {
        rule: 'heading-order',
        severity: 'error',
        line,
        message: `Heading jumps from h${previousLevel} to h${level}.`,
        remediation: 'Use the next heading level in sequence so assistive navigation preserves document structure.'
      });
    }
    previousLevel = level;
  }
}

function lintMarkdownImages(markdown, context, findings) {
  for (const match of markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    const alt = match[1].trim();
    const line = lineForOffset(markdown, match.index || 0);
    if (!alt) {
      addFinding(findings, context, {
        rule: 'image-alt', severity: 'error', line,
        message: 'Image is missing alt text.',
        remediation: 'Add concise alt text, or use authored HTML with alt="" only for a truly decorative image.'
      });
    }
    const suffix = markdown.slice((match.index || 0) + match[0].length);
    if (suffix.startsWith('{zoom}')) {
      const cleanSrc = match[2].split(/[?#]/, 1)[0].toLowerCase();
      if (!/\.(?:svg|png|jpe?g)$/.test(cleanSrc)) {
        addFinding(findings, context, {
          rule: 'image-viewport-format', severity: 'error', line,
          message: 'Interactive Markdown image supports SVG, PNG, JPEG, and JPG sources only.',
          remediation: 'Use a supported image format or remove {zoom}.'
        });
      }
    }
  }
}

function lintMarkdownLinks(markdown, context, findings) {
  for (const match of markdown.matchAll(/(?<!!)\[([^\]]*)\]\(([^)]+)\)/g)) {
    const text = stripInlineMarkdown(match[1]).toLowerCase();
    const line = lineForOffset(markdown, match.index || 0);
    if (!text) {
      addFinding(findings, context, {
        rule: 'link-text',
        severity: 'error',
        line,
        message: 'Link has empty text.',
        remediation: 'Use descriptive link text that identifies the destination.'
      });
    } else if (AMBIGUOUS_LINK_TEXT.has(text)) {
      addFinding(findings, context, {
        rule: 'link-text',
        severity: 'warning',
        line,
        message: `Link text "${text}" is ambiguous out of context.`,
        remediation: 'Use destination-specific link text, such as the page or resource name.'
      });
    }
  }
}

function lintMarkdownTables(markdown, context, findings) {
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i += 1) {
    const row = lines[i].trim();
    const next = lines[i + 1].trim();
    if (!row.startsWith('|') || !/^\|?[\s\-:|]+\|?$/.test(next)) continue;
    const headers = row.replace(/^\||\|$/g, '').split('|').map((cell) => stripInlineMarkdown(cell));
    if (headers.some((cell) => !cell)) {
      addFinding(findings, context, {
        rule: 'table-headers',
        severity: 'error',
        line: i + 1,
        message: 'Markdown table has an empty header cell.',
        remediation: 'Name every table header, or rewrite layout-only content without a table.'
      });
    }
  }
}

function lintRawHtml(html, context, findings, offsetLine = 0) {
  const text = String(html || '');

  for (const match of text.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const ariaHidden = attributeValue(tag, 'aria-hidden') === 'true';
    const role = attributeValue(tag, 'role');
    if (hasAttribute(tag, 'alt') || ariaHidden || role === 'presentation' || role === 'none') continue;
    addFinding(findings, context, {
      rule: 'image-alt',
      severity: 'error',
      line: offsetLine + lineForOffset(text, match.index || 0),
      message: 'Raw HTML image is missing an alt attribute.',
      remediation: 'Add alt text, or set alt="" for decorative images.'
    });
  }

  for (const match of text.matchAll(/<iframe\b[^>]*>/gi)) {
    if (hasAttribute(match[0], 'title')) continue;
    addFinding(findings, context, {
      rule: 'iframe-title',
      severity: 'error',
      line: offsetLine + lineForOffset(text, match.index || 0),
      message: 'Iframe is missing a title.',
      remediation: 'Add a concise title that describes the embedded content.'
    });
  }

  for (const match of text.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    if (/<th\b/i.test(match[0])) continue;
    addFinding(findings, context, {
      rule: 'table-headers',
      severity: 'error',
      line: offsetLine + lineForOffset(text, match.index || 0),
      message: 'HTML table does not contain header cells.',
      remediation: 'Use <th> cells for data tables, or avoid <table> for layout.'
    });
  }

  for (const match of text.matchAll(/\sid\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const id = match[2] ?? match[3] ?? match[4];
    if (!id) continue;
    context.htmlIds ||= new Map();
    const count = (context.htmlIds.get(id) || 0) + 1;
    context.htmlIds.set(id, count);
    if (count > 1) {
      addFinding(findings, context, {
        rule: 'duplicate-id',
        severity: 'error',
        line: offsetLine + lineForOffset(text, match.index || 0),
        message: `Duplicate raw HTML id "${id}".`,
        remediation: 'Use unique id values within each document.'
      });
    }
  }

  const riskyPatterns = [
    { regex: /\son[a-z]+\s*=/gi, label: 'inline event handler' },
    { regex: /javascript\s*:/gi, label: 'javascript: URL' },
    { regex: /\stabindex\s*=\s*["']?[1-9]\d*/gi, label: 'positive tabindex' }
  ];
  for (const tagMatch of text.matchAll(/<[^>]+>/g)) {
    for (const pattern of riskyPatterns) {
      if (pattern.regex.global) pattern.regex.lastIndex = 0;
      if (pattern.regex.test(tagMatch[0])) {
        addFinding(findings, context, {
          rule: 'risky-raw-html',
          severity: 'warning',
          line: offsetLine + lineForOffset(text, tagMatch.index || 0),
          message: `Raw HTML uses ${pattern.label}.`,
          remediation: 'Prefer semantic markup and external scripts; avoid focus-order overrides and inline JavaScript.'
        });
      }
    }
  }
}

function lintMediaBlocks(mediaBlocks, context, findings) {
  for (const block of mediaBlocks) {
    const def = parseMediaBlock(block.text);
    const line = block.line || null;
    const type = String(def.type || def.kind || '').toLowerCase();
    const isVideo = type === 'video' || type === 'embed' || type === 'youtube' || type === 'vimeo' || type === 'peertube';
    const isAudio = type === 'audio' || type === 'podcast' || type === 'narration';
    const isHosted = type === 'embed' || type === 'youtube' || type === 'vimeo' || type === 'peertube' || Boolean(def.provider);
    const isImage = type === 'image' || type === 'picture' || type === 'img';
    const viewportRequested = def.zoom === true || def.zoom === 'true' || def.viewport === true || def.viewport === 'true' || def.panZoom === true || def.panZoom === 'true';

    if (def._invalid) {
      addFinding(findings, context, {
        rule: 'media-metadata',
        severity: 'error',
        line,
        message: 'Media block metadata is invalid.',
        remediation: 'Use key/value lines or valid JSON inside the media fence.'
      });
      continue;
    }

    if (!isImage && !def.title && !def.label) {
      addFinding(findings, context, {
        rule: 'media-title',
        severity: 'error',
        line,
        message: 'Media block is missing a title or label.',
        remediation: 'Add a title that gives the generated player or embed an accessible name.'
      });
    }

    if (isImage) {
      const hasAlt = Object.prototype.hasOwnProperty.call(def, 'alt');
      const alt = hasAlt ? String(def.alt ?? '') : '';
      const sources = [
        def.src || def.url || def.default || def.defaultSrc,
        def.portrait || def.portraitSrc || def.mobile || def.mobileSrc,
        def.landscape || def.landscapeSrc || def.desktop || def.desktopSrc
      ].filter(Boolean).map((src) => String(src).split(/[?#]/, 1)[0].toLowerCase());
      if (!hasAlt) {
        addFinding(findings, context, {
          rule: 'image-alt', severity: 'error', line,
          message: 'Image media is missing explicit alt text.',
          remediation: 'Add concise alt text, or declare alt: "" for a truly decorative static image.'
        });
      }
      if (alt === '' && (def.description || viewportRequested)) {
        addFinding(findings, context, {
          rule: 'image-decoration-conflict', severity: 'error', line,
          message: 'A decorative image cannot have a description or interactive viewport.',
          remediation: 'Add meaningful alt text for informative content, or remove description/zoom from the decorative image.'
        });
      }
      if (viewportRequested && (!sources.length || sources.some((src) => !/\.(?:svg|png|jpe?g)$/.test(src)))) {
        addFinding(findings, context, {
          rule: 'image-viewport-format', severity: 'error', line,
          message: 'Interactive image viewport supports SVG, PNG, JPEG, and JPG sources only.',
          remediation: 'Use a supported source format or remove zoom: true.'
        });
      }
      if (viewportRequested && (def.link || def.href)) {
        addFinding(findings, context, {
          rule: 'image-viewport-link', severity: 'error', line,
          message: 'Interactive image viewport cannot also be configured as a link.',
          remediation: 'Remove the image link or use a separate descriptive link beside the viewport.'
        });
      }
    }

    if (def.autoplay === true || def.autoplay === 'true') {
      addFinding(findings, context, {
        rule: 'media-autoplay',
        severity: 'error',
        line,
        message: 'Content media requests autoplay.',
        remediation: 'Do not autoplay article or documentation media; let readers start playback.'
      });
    }

    if ((isAudio || type === 'narration') && !def.transcript) {
      addFinding(findings, context, {
        rule: 'media-transcript',
        severity: 'warning',
        line,
        message: 'Audio media does not declare a transcript.',
        remediation: 'Add a transcript link or sidecar path.'
      });
    }

    if (isVideo && !def.captions && !isHosted) {
      addFinding(findings, context, {
        rule: 'media-captions',
        severity: 'warning',
        line,
        message: 'Video media does not declare captions.',
        remediation: 'Add captions metadata when the video includes speech.'
      });
    }

    if (isVideo && !def.audioDescription && !def.description) {
      addFinding(findings, context, {
        rule: 'media-audio-description-review',
        severity: 'manual-review',
        line,
        message: 'Video or hosted media needs human review for audio-description needs.',
        remediation: 'Confirm important visual information is spoken or provide audio description/written description.'
      });
    }

    if (isHosted && !def.provider && !['youtube', 'vimeo', 'peertube'].includes(type)) {
      addFinding(findings, context, {
        rule: 'media-provider',
        severity: 'error',
        line,
        message: 'Hosted media block is missing an explicit provider.',
        remediation: 'Declare an allowlisted provider such as youtube, vimeo, or peertube.'
      });
    }
  }
}

export function lintContentAccessibility(raw, context = {}) {
  const findings = [];
  const { body } = parseFrontmatter(raw);
  const { markdown, html, mediaBlocks } = htmlBlocksAndMarkdown(body);

  lintHeadings(markdown, context, findings);
  lintMarkdownImages(markdown, context, findings);
  lintMarkdownLinks(markdown, context, findings);
  lintMarkdownTables(markdown, context, findings);
  lintRawHtml(maskInlineCode(markdown), { ...context, htmlIds: new Map() }, findings);
  if (html) lintRawHtml(html, { ...context, htmlIds: new Map() }, findings);
  lintMediaBlocks(mediaBlocks, context, findings);

  return findings;
}

export function isStrictAccessibilityEnabled(config = {}) {
  const value = config.accessibility?.strict ?? config.accessibilityStrict ?? false;
  return value === true || value === 'true';
}

export function summarizeAccessibilityFindings(findings = []) {
  const summary = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) {
    const key = finding.severity || 'warning';
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

export function formatAccessibilityFinding(finding) {
  const location = [
    finding.file || null,
    finding.line ? `:${finding.line}` : '',
    finding.route ? ` (${finding.route})` : ''
  ].filter(Boolean).join('');
  return `${finding.severity.toUpperCase()} ${finding.rule}: ${location} - ${finding.message} Remediation: ${finding.remediation}`;
}
