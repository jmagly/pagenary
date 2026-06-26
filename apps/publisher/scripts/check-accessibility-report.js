#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  buildAccessibilityReport,
  isAccessibilityReportEnabled,
  renderAccessibilityReportMarkdown
} from './lib/accessibility-report.js';

const config = {
  accessibility: {
    report: {
      enabled: true
    }
  }
};

assert.equal(isAccessibilityReportEnabled(config), true);
assert.equal(isAccessibilityReportEnabled({}), false);

const report = buildAccessibilityReport({
  tenantId: 'fixture',
  config,
  findings: [
    {
      rule: 'image-alt',
      severity: 'error',
      responsibility: 'authored-content',
      route: 'intro',
      file: 'content/intro.md',
      line: 7,
      message: 'Image is missing alt text.',
      remediation: 'Add concise alt text.'
    },
    {
      rule: 'language-metadata',
      severity: 'warning',
      responsibility: 'tenant-theme',
      route: 'site',
      file: 'config.json',
      message: 'Tenant configuration does not declare a default page language.',
      remediation: 'Set config.language.'
    }
  ]
});

assert.equal(report.version, 1);
assert.equal(report.status, 'error');
assert.equal(report.summary.error, 1);
assert.equal(report.summary.warning, 1);
assert.equal(report.summary.manualReview, 3);
assert.equal(report.byResponsibility['authored-content'].length, 1);
assert.equal(report.byResponsibility['tenant-theme'].length, 1);
assert.equal(report.byResponsibility['manual-review-required'].length, 3);

const markdown = renderAccessibilityReportMarkdown(report);
assert.equal(markdown.includes('# Accessibility Report: fixture'), true);
assert.equal(markdown.includes('| Severity | Responsibility | Rule | Location | Remediation |'), true);
assert.equal(markdown.includes('manual-review-required'), true);

console.log('Accessibility report checks passed.');
