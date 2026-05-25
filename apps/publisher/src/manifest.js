import { getSectionMetadata } from './sections/section-templates.js';

function sectionEntry(input) {
  const sectionId = typeof input === 'string' ? input : input.id;
  const overrides = typeof input === 'string' ? {} : { title: input.title, summary: input.summary };
  const meta = getSectionMetadata(sectionId, overrides);
  return {
    id: sectionId,
    title: meta.title,
    summary: meta.summary,
    module: `./sections/${sectionId}.js`
  };
}

function groupEntry({ id, title, summary, sections }) {
  return {
    id,
    title,
    summary,
    subsections: sections.map(sectionEntry)
  };
}

export const MANIFEST = [
  sectionEntry({ id: 'welcome-overview', title: 'Welcome', summary: 'Landing hub for introducing each tenant experience.' }),
  groupEntry({
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Orientation guides that prepare new teams to launch quickly.',
    sections: [
      { id: 'getting-started-introduction', title: 'Introduction' },
      { id: 'getting-started-architecture-basics', title: 'Platform Fundamentals' },
      { id: 'getting-started-performance-overview', title: 'Why Precision Matters' }
    ]
  }),
  groupEntry({
    id: 'core-technology',
    title: 'Core Systems',
    summary: 'Reference templates describing foundational infrastructure and consensus patterns.',
    sections: [
      { id: 'core-technology-overview', title: 'Overview' },
      'core-technology-system-foundation',
      'core-technology-compliance-frameworks',
      'core-technology-synchronization-strategy',
      'core-technology-hardware-integration',
      'core-technology-data-definitions',
      'core-technology-coordination-model',
      'core-technology-service-interfaces',
      'core-technology-integrity-controls',
      'core-technology-network-topology',
      'core-technology-operator-requirements'
    ]
  }),
  groupEntry({
    id: 'technical',
    title: 'Technical Papers',
    summary: 'Deep dives and formal descriptions ready for adaptation.',
    sections: [
      'technical-architecture',
      'technical-whitepaper'
    ]
  }),
  groupEntry({
    id: 'developers',
    title: 'Developers',
    summary: 'SDKs, APIs, and engineering workflows captured as reusable templates.',
    sections: [
      { id: 'developers-overview', title: 'Developer Hub' },
      'developers-sdks',
      'developers-sdk-javascript',
      'developers-sdk-python',
      'developers-sdk-rust',
      'developers-sdk-go',
      'developers-api-reference',
      'developers-api-operations',
      'developers-api-websocket',
      'developers-api-credentials',
      'developers-solution-examples',
      'developers-automation-blueprints',
      'developers-automation-modules',
      'developers-automation-patterns',
      'developers-scheduling-patterns',
      'developers-testing-framework',
      'developers-deployment-playbook'
    ]
  }),
  groupEntry({
    id: 'tutorials',
    title: 'Tutorials',
    summary: 'Hands-on walkthroughs that demonstrate end-to-end tenant scenarios.',
    sections: [
      'tutorials-overview',
      'tutorial-build-first-integration',
      'tutorial-deploy-automation',
      'tutorial-event-driven-experience',
      'tutorial-systems-integration',
      'tutorial-automation-bot',
      'tutorial-operations-onboarding'
    ]
  }),
  groupEntry({
    id: 'use-cases',
    title: 'Use Cases',
    summary: 'Story-driven templates that connect personas, workflows, and measurable impact.',
    sections: [
      'use-cases-overview',
      'use-case-digital-auctions',
      'use-case-financial-automation',
      'use-case-interactive-media',
      'use-case-realtime-execution',
      'use-case-connected-devices',
      'use-case-research-analytics',
      'use-case-supply-operations'
    ]
  }),
  groupEntry({
    id: 'products',
    title: 'Products',
    summary: 'Packaging and positioning templates for offerings built on the platform.',
    sections: [
      'products-solution-library',
      'products-flagship-solution'
    ]
  }),
  groupEntry({
    id: 'governance',
    title: 'Governance',
    summary: 'Policy and decision-making templates that scale across tenants.',
    sections: [
      'governance-overview',
      'governance-structure',
      'governance-dao-overview',
      'governance-proposal-process',
      'governance-proposals',
      'governance-token-distribution',
      'governance-treasury',
      'governance-community-initiatives',
      'governance-multi-token'
    ]
  }),
  groupEntry({
    id: 'resources',
    title: 'Resources',
    summary: 'Reference libraries, glossaries, and asset collections ready for reuse.',
    sections: [
      'resources-faq',
      'resources-glossary',
      'resources-brand-assets',
      'resources-research-papers'
    ]
  }),
  groupEntry({
    id: 'security',
    title: 'Security',
    summary: 'Risk management templates spanning posture, controls, and incident response.',
    sections: [
      'security-overview',
      'security-best-practices',
      'security-incident-response',
      'security-bug-bounty',
      'security-audits'
    ]
  }),
  groupEntry({
    id: 'operations',
    title: 'Operations',
    summary: 'Runbooks and checklists for service operators and tenant teams.',
    sections: [
      'operations-overview',
      'operations-getting-started',
      'operations-setup-guide',
      'operations-environment-prep',
      'operations-infrastructure',
      'operations-sync-setup',
      'operations-power-infrastructure',
      'operations-monitoring',
      'operations-performance',
      'operations-incentives',
      'operations-incentives-guide',
      'operations-incentives-strategies'
    ]
  }),
  groupEntry({
    id: 'archive',
    title: 'Archive',
    summary: 'Historical timelines and context for major initiatives.',
    sections: [
      'archive-timeline-overview',
      'archive-milestone-records',
      'archive-initiative-alpha',
      'archive-future-roadmap'
    ]
  })
];

export const DEFAULT_SECTION = 'welcome-overview';

const SECTION_INDEX = new Map();

function registerEntry(entry, parentId = null) {
  if (parentId) entry.parentId = parentId;
  SECTION_INDEX.set(entry.id, entry);
  if (Array.isArray(entry.subsections)) {
    entry.subsections.forEach((subsection) => registerEntry(subsection, entry.id));
  }
}

MANIFEST.forEach((entry) => registerEntry(entry));

export function findSection(id) {
  return SECTION_INDEX.get(id) || null;
}

// Build flat list of navigable sections for prev/next navigation
function buildFlatNav() {
  const flat = [];
  MANIFEST.forEach((entry) => {
    if (entry.subsections && entry.subsections.length) {
      entry.subsections.forEach((sub) => flat.push(sub));
    } else {
      flat.push(entry);
    }
  });
  return flat;
}

const FLAT_NAV = buildFlatNav();

/**
 * Get previous and next sections for bottom navigation
 * @param {string} currentId - Current section ID
 * @returns {{ prev: object|null, next: object|null }}
 */
export function getAdjacentSections(currentId) {
  const index = FLAT_NAV.findIndex((s) => s.id === currentId);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? FLAT_NAV[index - 1] : null,
    next: index < FLAT_NAV.length - 1 ? FLAT_NAV[index + 1] : null
  };
}

// Site configuration (can be overridden by tenant manifest)
export const SITE_CONFIG = {
  bottomNav: 'mobile' // 'always' | 'mobile' | 'never'
};
