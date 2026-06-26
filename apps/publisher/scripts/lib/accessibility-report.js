import fs from 'fs/promises';
import path from 'path';
import {
  formatAccessibilityFinding,
  summarizeAccessibilityFindings
} from './accessibility-linter.js';

const RESPONSIBILITIES = [
  'pagenary-generated',
  'tenant-theme',
  'authored-content',
  'manual-review-required'
];

const MANUAL_REVIEW_ITEMS = [
  {
    rule: 'alt-text-quality',
    severity: 'manual-review',
    responsibility: 'manual-review-required',
    route: 'site',
    file: null,
    message: 'Review meaningful images for accurate, contextual alt text.',
    remediation: 'Confirm alt text communicates the same purpose as the image in context.'
  },
  {
    rule: 'captions-transcripts',
    severity: 'manual-review',
    responsibility: 'manual-review-required',
    route: 'site',
    file: null,
    message: 'Review audio, video, and embeds for accurate captions or transcripts.',
    remediation: 'Provide captions for spoken video and transcripts for audio/video where media is present.'
  },
  {
    rule: 'custom-html-behavior',
    severity: 'manual-review',
    responsibility: 'manual-review-required',
    route: 'site',
    file: null,
    message: 'Review custom HTML and third-party embeds for keyboard and assistive-technology behavior.',
    remediation: 'Manually test custom controls, embeds, focus order, and interactive states.'
  }
];

function isTruthy(value) {
  return value === true || value === 'true' || value === '1';
}

export function isAccessibilityReportEnabled(config = {}) {
  const value = config.accessibility?.report?.enabled ??
    config.accessibility?.reporting ??
    config.accessibilityReport ??
    false;
  return isTruthy(value);
}

function includeManualReview(config = {}) {
  const value = config.accessibility?.report?.manualReview ??
    config.accessibility?.manualReview ??
    true;
  return value !== false && value !== 'false';
}

function normalizeFinding(finding) {
  return {
    rule: finding.rule,
    severity: finding.severity || 'warning',
    responsibility: finding.responsibility || 'authored-content',
    route: finding.route || null,
    file: finding.file || null,
    line: finding.line || null,
    message: finding.message,
    remediation: finding.remediation
  };
}

export function buildAccessibilityReport({ tenantId, config = {}, findings = [] }) {
  const normalized = findings.map(normalizeFinding);
  const manualReview = includeManualReview(config) ? MANUAL_REVIEW_ITEMS.map(normalizeFinding) : [];
  const allFindings = [...normalized, ...manualReview];
  const severitySummary = summarizeAccessibilityFindings(allFindings);
  const errors = severitySummary.error || 0;
  const warnings = severitySummary.warning || 0;
  const manualReviewCount = severitySummary['manual-review'] || 0;

  const byResponsibility = Object.fromEntries(RESPONSIBILITIES.map((key) => [key, []]));
  for (const finding of allFindings) {
    const key = RESPONSIBILITIES.includes(finding.responsibility)
      ? finding.responsibility
      : 'authored-content';
    byResponsibility[key].push(finding);
  }

  return {
    version: 1,
    tenantId,
    status: errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'passed',
    summary: {
      passed: errors === 0 ? 1 : 0,
      warning: warnings,
      error: errors,
      manualReview: manualReviewCount
    },
    byResponsibility,
    findings: allFindings
  };
}

function markdownTableRows(findings) {
  if (!findings.length) return '| - | - | - | - | - |\n';
  return findings.map((finding) => {
    const location = `${finding.file || '-'}${finding.line ? `:${finding.line}` : ''}`;
    return `| ${finding.severity} | ${finding.responsibility} | ${finding.rule} | ${location} | ${finding.remediation} |`;
  }).join('\n') + '\n';
}

export function renderAccessibilityReportMarkdown(report) {
  const lines = [
    `# Accessibility Report: ${report.tenantId}`,
    '',
    `Status: ${report.status}`,
    '',
    '## Summary',
    '',
    `- Passed checks: ${report.summary.passed}`,
    `- Warnings: ${report.summary.warning}`,
    `- Errors: ${report.summary.error}`,
    `- Manual-review items: ${report.summary.manualReview}`,
    '',
    '## Findings',
    '',
    '| Severity | Responsibility | Rule | Location | Remediation |',
    '| --- | --- | --- | --- | --- |',
    markdownTableRows(report.findings),
    ''
  ];

  for (const responsibility of RESPONSIBILITIES) {
    lines.push(`## ${responsibility}`, '');
    const items = report.byResponsibility[responsibility] || [];
    if (!items.length) {
      lines.push('No findings.', '');
      continue;
    }
    for (const finding of items) {
      lines.push(`- ${formatAccessibilityFinding(finding)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function writeAccessibilityReportArtifacts({ distDir, tenantId, config = {}, findings = [] }) {
  if (!isAccessibilityReportEnabled(config)) {
    return null;
  }

  const report = buildAccessibilityReport({ tenantId, config, findings });
  await fs.mkdir(distDir, { recursive: true });
  await fs.writeFile(
    path.join(distDir, 'accessibility-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await fs.writeFile(
    path.join(distDir, 'accessibility-report.md'),
    renderAccessibilityReportMarkdown(report),
    'utf8'
  );
  return report;
}
