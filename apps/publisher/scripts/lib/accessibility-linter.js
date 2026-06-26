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
  const markdownParts = [];
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  let fenceLang = '';
  let fenceLines = [];

  for (const line of lines) {
    const fence = /^\s*```([A-Za-z0-9_-]*)/.exec(line);
    if (fence) {
      if (inFence) {
        if (fenceLang === 'html') {
          htmlBlocks.push(fenceLines.join('\n'));
        }
        inFence = false;
        fenceLang = '';
        fenceLines = [];
      } else {
        inFence = true;
        fenceLang = (fence[1] || '').trim().toLowerCase();
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
  }

  return {
    markdown: markdownParts.join('\n'),
    html: htmlBlocks.join('\n')
  };
}

function lineForOffset(text, offset) {
  return String(text || '').slice(0, offset).split(/\r?\n/).length;
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
    if (alt) continue;
    addFinding(findings, context, {
      rule: 'image-alt',
      severity: 'error',
      line: lineForOffset(markdown, match.index || 0),
      message: 'Image is missing alt text.',
      remediation: 'Add concise alt text, or use authored HTML with alt="" only for a truly decorative image.'
    });
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
  for (const pattern of riskyPatterns) {
    for (const match of text.matchAll(pattern.regex)) {
      addFinding(findings, context, {
        rule: 'risky-raw-html',
        severity: 'warning',
        line: offsetLine + lineForOffset(text, match.index || 0),
        message: `Raw HTML uses ${pattern.label}.`,
        remediation: 'Prefer semantic markup and external scripts; avoid focus-order overrides and inline JavaScript.'
      });
    }
  }
}

export function lintContentAccessibility(raw, context = {}) {
  const findings = [];
  const { body } = parseFrontmatter(raw);
  const { markdown, html } = htmlBlocksAndMarkdown(body);

  lintHeadings(markdown, context, findings);
  lintMarkdownImages(markdown, context, findings);
  lintMarkdownLinks(markdown, context, findings);
  lintMarkdownTables(markdown, context, findings);
  lintRawHtml(markdown, { ...context, htmlIds: new Map() }, findings);
  if (html) lintRawHtml(html, { ...context, htmlIds: new Map() }, findings);

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
