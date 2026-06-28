import fs from 'node:fs';
import path from 'node:path';

const PLAN_ORDER = ['free', 'pro', 'team'];

export const HOSTING_PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    label: 'Free',
    monthlyPrice: 0,
    siteLimit: 1,
    customDomains: false,
    privateRepos: false,
    whiteLabel: false,
    sso: false
  }),
  pro: Object.freeze({
    id: 'pro',
    label: 'Pro',
    monthlyPrice: 19,
    siteLimit: 5,
    customDomains: true,
    privateRepos: true,
    whiteLabel: false,
    sso: false
  }),
  team: Object.freeze({
    id: 'team',
    label: 'Team',
    monthlyPrice: 49,
    siteLimit: 25,
    customDomains: true,
    privateRepos: true,
    whiteLabel: true,
    sso: true
  })
});

export function normalizeHostingPlan(plan) {
  const id = String(plan || 'free').trim().toLowerCase();
  if (!HOSTING_PLANS[id]) {
    throw new Error(`Unknown hosting plan "${plan}". Expected one of: ${PLAN_ORDER.join(', ')}`);
  }
  return HOSTING_PLANS[id];
}

export function isPlanAtLeast(plan, minimum) {
  const actualIndex = PLAN_ORDER.indexOf(normalizeHostingPlan(plan).id);
  const minimumIndex = PLAN_ORDER.indexOf(normalizeHostingPlan(minimum).id);
  return actualIndex >= minimumIndex;
}

export function getHostingEntitlements(plan) {
  const normalized = normalizeHostingPlan(plan);
  return {
    plan: normalized.id,
    siteLimit: normalized.siteLimit,
    customDomains: normalized.customDomains,
    privateRepos: normalized.privateRepos,
    whiteLabel: normalized.whiteLabel,
    sso: normalized.sso
  };
}

export function buildManagedHostingAccountUsage(tenants, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const accountFilter = options.accountId ? normalizeAccountId(options.accountId) : null;
  const groups = new Map();

  for (const tenant of tenants) {
    const accountId = normalizeAccountId(tenant?.accountId || tenant?.id || 'default');
    if (accountFilter && accountId !== accountFilter) continue;
    if (!groups.has(accountId)) groups.set(accountId, []);
    groups.get(accountId).push(tenant);
  }

  const accounts = Array.from(groups.entries()).map(([accountId, accountTenants]) => {
    const tenantRows = accountTenants.map((tenant) => {
      const validation = validateManagedHostingTenant(tenant, {
        requirePaidActivation: Boolean(options.requirePaidActivation)
      });
      return {
        tenantId: validation.tenant.id,
        plan: validation.tenant.plan,
        paymentStatus: validation.tenant.paymentStatus,
        siteCount: validation.tenant.siteCount,
        errors: validation.errors
      };
    });
    const plans = Array.from(new Set(tenantRows.map((tenant) => tenant.plan)));
    const plan = highestPlan(plans);
    const entitlements = getHostingEntitlements(plan);
    const sitesUsed = tenantRows.reduce((sum, tenant) => sum + tenant.siteCount, 0);
    const paymentStatus = summarizePaymentStatus(tenantRows.map((tenant) => tenant.paymentStatus));
    const errors = [
      ...(plans.length > 1 ? [`account ${accountId} has mixed plans: ${plans.join(', ')}`] : []),
      ...(sitesUsed > entitlements.siteLimit
        ? [`${normalizeHostingPlan(plan).label} allows ${entitlements.siteLimit} hosted site${entitlements.siteLimit === 1 ? '' : 's'}; account uses ${sitesUsed}`]
        : []),
      ...(options.requirePaidActivation ? paymentActivationErrors(plan, paymentStatus) : []),
      ...tenantRows.flatMap((tenant) => tenant.errors.map((error) => `${tenant.tenantId}: ${error}`))
    ];

    return {
      accountId,
      status: errors.length === 0 ? 'ready' : 'blocked',
      plan,
      paymentStatus,
      entitlements,
      sitesUsed,
      sitesRemaining: Math.max(0, entitlements.siteLimit - sitesUsed),
      canAddSite: errors.length === 0 && sitesUsed < entitlements.siteLimit,
      tenantIds: tenantRows.map((tenant) => tenant.tenantId),
      tenants: tenantRows,
      errors: Array.from(new Set(errors))
    };
  });

  return {
    status: accounts.every((account) => account.status === 'ready') ? 'ready' : 'blocked',
    generatedAt,
    totals: {
      accounts: accounts.length,
      ready: accounts.filter((account) => account.status === 'ready').length,
      blocked: accounts.filter((account) => account.status !== 'ready').length,
      sitesUsed: accounts.reduce((sum, account) => sum + account.sitesUsed, 0),
      sitesRemaining: accounts.reduce((sum, account) => sum + account.sitesRemaining, 0)
    },
    accounts
  };
}

export function buildManagedHostingOnboardingIntake(tenants, request, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const proposedTenant = buildProposedTenantFromIntake(request);
  const existingTenants = Array.isArray(tenants) ? tenants : [];
  const validation = validateManagedHostingTenant(proposedTenant, {
    requirePaidActivation: false
  });
  const conflicts = findTenantConflicts(existingTenants, validation.tenant);
  const accountUsage = buildManagedHostingAccountUsage([...existingTenants, proposedTenant], {
    accountId: proposedTenant.accountId,
    requirePaidActivation: false,
    generatedAt
  });
  const account = accountUsage.accounts[0] || null;
  const billingAction = buildManagedHostingBillingAction(proposedTenant, {
    requirePaidActivation: Boolean(options.requirePaidActivation),
    generatedAt
  });
  const repository = buildManagedHostingRepoSetup(proposedTenant, {
    credentialRef: options.credentialRef,
    webhookSecretRef: options.webhookSecretRef,
    webhookTarget: options.webhookTarget
  });
  const domains = buildManagedHostingDomainSetup(proposedTenant, {
    verifiedDomains: options.verifiedDomains,
    wildcardTarget: options.wildcardTarget
  });
  const blockingErrors = Array.from(new Set([
    ...validation.errors,
    ...conflicts,
    ...(account?.errors || [])
  ]));
  const privateSteps = [
    ...(billingAction.privateControlPlane.required ? [billingAction.operatorLabel] : []),
    ...(repository.errors.includes('private repository hosting requires a private control-plane credential reference')
      ? ['Create or attach the private repository credential reference.']
      : []),
    ...(repository.warnings.includes('webhook secret reference is missing; private control plane should create one before enabling push deploys')
      ? ['Create a webhook secret reference and install the push webhook.']
      : []),
    ...domains.customDomains
      .filter((domain) => domain.status === 'pending_dns')
      .map((domain) => `Verify DNS/TLS for ${domain.domain}.`)
  ];
  const status = blockingErrors.length > 0
    ? 'blocked'
    : (privateSteps.length > 0 ? 'action-required' : 'ready');

  return {
    status,
    generatedAt,
    tenant: {
      ...proposedTenant,
      source: sanitizeSource(proposedTenant.source)
    },
    account: account
      ? {
          accountId: account.accountId,
          plan: account.plan,
          sitesUsed: account.sitesUsed,
          sitesRemaining: account.sitesRemaining,
          canAddSite: account.errors.length === 0 && account.sitesUsed <= account.entitlements.siteLimit,
          errors: account.errors
        }
      : null,
    billingAction,
    repository,
    domains,
    checklist: buildConciergeOnboardingChecklist(proposedTenant),
    nextActions: status === 'blocked'
      ? blockingErrors.map((error) => `Resolve before onboarding: ${error}`)
      : privateSteps,
    errors: blockingErrors
  };
}

export function applyManagedHostingSiteEvent(tenants, event, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const normalized = normalizeSiteEvent(event);
  const existingTenants = Array.isArray(tenants) ? tenants : [];
  let updatedTenants = existingTenants.map((tenant) => ({ ...tenant }));
  let tenant = null;
  let account = null;
  const impact = {
    eventType: normalized.type,
    effectiveAt: normalized.effectiveAt,
    previousTenantCount: existingTenants.length,
    nextTenantCount: existingTenants.length,
    warnings: [],
    errors: [],
    nextActions: []
  };

  if (normalized.type === 'site.created') {
    const intake = buildManagedHostingOnboardingIntake(existingTenants, normalized.tenant, {
      ...options,
      generatedAt
    });
    tenant = intake.tenant;
    account = intake.account;
    impact.errors.push(...intake.errors);
    if (options.requirePaidActivation) impact.errors.push(...intake.billingAction.errors);
    impact.nextActions.push(...intake.nextActions);
    if (impact.errors.length === 0) {
      updatedTenants = [...updatedTenants, tenant];
      impact.nextTenantCount = updatedTenants.length;
    }
  }

  if (normalized.type === 'site.removed') {
    const removedTenant = existingTenants.find((entry) => validateManagedHostingTenant(entry).tenant.id === normalized.tenantId);
    if (!removedTenant) {
      impact.errors.push(`tenant ${normalized.tenantId} was not found`);
    } else {
      const validation = validateManagedHostingTenant(removedTenant);
      tenant = {
        ...removedTenant,
        source: sanitizeSource(removedTenant.source)
      };
      updatedTenants = updatedTenants.filter((entry) => validateManagedHostingTenant(entry).tenant.id !== normalized.tenantId);
      impact.nextTenantCount = updatedTenants.length;
      if (validation.tenant.customDomains.length > 0) {
        impact.nextActions.push(`Remove DNS/TLS routing for ${validation.tenant.customDomains.join(', ')}.`);
      }
      impact.nextActions.push(`Remove hosted output for tenant ${validation.tenant.id} from the private deploy target.`);
    }
  }

  if (!account) {
    const accountId = normalizeAccountId(tenant?.accountId || normalized.accountId || normalized.tenantId);
    const usage = buildManagedHostingAccountUsage(updatedTenants, {
      accountId,
      requirePaidActivation: Boolean(options.requirePaidActivation),
      generatedAt
    });
    account = usage.accounts[0] || {
      accountId,
      status: 'ready',
      plan: 'free',
      sitesUsed: 0,
      sitesRemaining: getHostingEntitlements('free').siteLimit,
      canAddSite: true,
      errors: []
    };
  }

  const accountStatus = account?.status || ((account?.errors || []).length > 0 ? 'blocked' : 'ready');
  const status = impact.errors.length > 0
    ? 'blocked'
    : (impact.nextActions.length > 0 ? 'action-required' : accountStatus);

  return {
    ok: status !== 'blocked',
    status,
    generatedAt,
    event: {
      type: normalized.type,
      effectiveAt: normalized.effectiveAt
    },
    tenant,
    account: account
      ? {
          accountId: account.accountId,
          status: accountStatus,
          plan: account.plan,
          paymentStatus: account.paymentStatus || null,
          sitesUsed: account.sitesUsed,
          sitesRemaining: account.sitesRemaining,
          canAddSite: account.canAddSite,
          errors: account.errors
        }
      : null,
    tenants: updatedTenants.map((entry) => ({
      ...entry,
      source: sanitizeSource(entry.source)
    })),
    impact
  };
}

export function validateManagedHostingTenant(tenant, options = {}) {
  const tenantId = String(tenant?.id || '').trim();
  const plan = normalizeHostingPlan(tenant?.plan || 'free');
  const subdomain = normalizeSubdomain(tenant?.subdomain || tenantId);
  const domains = normalizeDomains(tenant?.domains || []);
  const customDomains = domains.filter((domain) => !domain.endsWith('.pagenary.app'));
  const invalidDomains = customDomains.filter((domain) => !isValidHostname(domain));
  const siteCount = normalizeSiteCount(tenant?.siteCount);
  const privateRepo = Boolean(tenant?.privateRepo);
  const paymentStatus = String(tenant?.paymentStatus || 'manual-pending').trim();
  const errors = [];

  if (!tenantId) errors.push('id is required');
  if (!subdomain) errors.push('subdomain is required');
  if (invalidDomains.length > 0) {
    errors.push(...invalidDomains.map((domain) => `invalid custom domain ${domain}`));
  }
  if (siteCount > plan.siteLimit) {
    errors.push(`${plan.label} allows ${plan.siteLimit} hosted site${plan.siteLimit === 1 ? '' : 's'}; requested ${siteCount}`);
  }
  if (customDomains.length > 0 && !plan.customDomains) {
    errors.push('custom domains require Pro or Team');
  }
  if (privateRepo && !plan.privateRepos) {
    errors.push('private repository hosting requires Pro or Team');
  }
  if (tenant?.whiteLabel && !plan.whiteLabel) {
    errors.push('white-label hosting requires Team');
  }
  if (tenant?.sso && !plan.sso) {
    errors.push('SSO requires Team');
  }
  if (options.requirePaidActivation && plan.monthlyPrice > 0 && paymentStatus !== 'active') {
    errors.push(`paid ${plan.label} tenant must have active payment status before activation`);
  }

  return {
    ok: errors.length === 0,
    errors,
    tenant: {
      id: tenantId,
      plan: plan.id,
      subdomain,
      publicDomain: `${subdomain}.pagenary.app`,
      domains,
      customDomains,
      siteCount,
      privateRepo,
      paymentStatus
    },
    entitlements: getHostingEntitlements(plan.id)
  };
}

export function generateManagedHostingCaddyfile(tenants, options = {}) {
  const root = options.root || '/srv/pagenary/sites';
  const wildcardDomain = options.wildcardDomain || '*.pagenary.app';
  const email = options.email || 'ops@pagenary.com';
  const lines = [
    '{',
    `  email ${email}`,
    '}',
    '',
    `${wildcardDomain} {`,
    '  encode gzip zstd',
    `  root * ${root}/{labels.2}`,
    '  try_files {path} {path}/ /index.html',
    '  file_server',
    '  header /index.html Cache-Control "no-cache, must-revalidate"',
    '  header /search-index/* Cache-Control "public, max-age=300, must-revalidate"',
    '  header /pages/* Cache-Control "public, max-age=300, must-revalidate"',
    '  header /*.js Cache-Control "public, max-age=31536000, immutable"',
    '  header /*.css Cache-Control "public, max-age=31536000, immutable"',
    '}'
  ];

  const paidCustomDomains = tenants
    .map((tenant) => validateManagedHostingTenant(tenant))
    .filter((result) => result.ok && result.tenant.customDomains.length > 0 && result.entitlements.customDomains);

  for (const result of paidCustomDomains) {
    lines.push('', `${result.tenant.customDomains.join(', ')} {`);
    lines.push('  encode gzip zstd');
    lines.push(`  root * ${root}/${result.tenant.id}`);
    lines.push('  try_files {path} {path}/ /index.html');
    lines.push('  file_server');
    lines.push('  header /index.html Cache-Control "no-cache, must-revalidate"');
    lines.push('  header /search-index/* Cache-Control "public, max-age=300, must-revalidate"');
    lines.push('  header /pages/* Cache-Control "public, max-age=300, must-revalidate"');
    lines.push('  header /*.js Cache-Control "public, max-age=31536000, immutable"');
    lines.push('  header /*.css Cache-Control "public, max-age=31536000, immutable"');
    lines.push('}');
  }

  return `${lines.join('\n')}\n`;
}

export function buildConciergeOnboardingChecklist(tenant) {
  const result = validateManagedHostingTenant(tenant, { requirePaidActivation: false });
  const plan = normalizeHostingPlan(result.tenant.plan);
  const domainSetup = buildManagedHostingDomainSetup(tenant);
  const paymentStep = plan.monthlyPrice > 0
    ? `Collect payment with the ${plan.label} Stripe Payment Link and mark paymentStatus=active.`
    : 'Create the free tenant record; no Stripe payment is required.';
  const customDomainSteps = domainSetup.customDomains.flatMap((domain) => [
    `Ask the customer to point ${domain.domain} to ${domain.records[0].value}.`,
    `Mark ${domain.domain} verified after the DNS record resolves and TLS is ready.`
  ]);

  return [
    `Confirm tenant id "${result.tenant.id}" and public URL https://${result.tenant.publicDomain}.`,
    paymentStep,
    'Add a deploy key or OAuth connection for the customer repository.',
    'Register the repository webhook so pushes trigger the build worker.',
    `Run the pinned in-repo build: npm run build:tenants --workspace @pagenary/publisher -- ${result.tenant.id}.`,
    `Sync the built dist/${result.tenant.id}/ bundle to the hosting origin or object store.`,
    'Verify index.html, sections/, search-index/, sitemap.xml, and robots.txt on the live URL.',
    ...customDomainSteps,
    'Send the customer the live URL, billing receipt, and custom-domain DNS instructions when applicable.'
  ];
}

export function buildManagedHostingDomainSetup(tenant, options = {}) {
  const validation = validateManagedHostingTenant(tenant);
  const verifiedDomains = new Set(normalizeDomains(
    options.verifiedDomains?.length ? options.verifiedDomains : tenant?.verifiedDomains || []
  ));

  return {
    publicDomain: {
      domain: validation.tenant.publicDomain,
      url: `https://${validation.tenant.publicDomain}`,
      status: 'ready',
      records: [
        {
          type: 'CNAME',
          name: validation.tenant.publicDomain,
          value: options.wildcardTarget || 'pagenary.app'
        }
      ]
    },
    customDomains: validation.tenant.customDomains.map((domain) => ({
      domain,
      url: `https://${domain}`,
      status: validation.entitlements.customDomains
        ? (verifiedDomains.has(domain) ? 'ready' : 'pending_dns')
        : 'not_allowed',
      records: [
        {
          type: 'CNAME',
          name: domain,
          value: validation.tenant.publicDomain,
          note: 'If this is an apex/root domain, use ALIAS/ANAME or CNAME flattening to the same target.'
        }
      ]
    }))
  };
}

export function buildManagedHostingRepoSetup(tenant, options = {}) {
  const validation = validateManagedHostingTenant(tenant);
  const source = tenant?.source || {};
  const connected = source.type === 'git' && Boolean(source.url);
  const privateRepo = Boolean(tenant?.privateRepo);
  const credentialRef = tenant?.repoCredentialRef || options.credentialRef || null;
  const webhookSecretRef = tenant?.webhookSecretRef || options.webhookSecretRef || null;
  const errors = [];
  const warnings = [];

  if (!connected) {
    errors.push('source.type=git with source.url is required before managed hosting can build');
  }
  if (privateRepo && !validation.entitlements.privateRepos) {
    errors.push('private repository hosting requires Pro or Team');
  }
  if (privateRepo && !credentialRef) {
    errors.push('private repository hosting requires a private control-plane credential reference');
  }
  if (!webhookSecretRef) {
    warnings.push('webhook secret reference is missing; private control plane should create one before enabling push deploys');
  }
  if (source.url && /\/\/[^/@:\s]+:[^/@\s]+@/.test(String(source.url))) {
    warnings.push('source URL contains embedded credentials; move credentials into the private control plane');
  }

  return {
    status: errors.length === 0 ? 'ready' : 'blocked',
    tenantId: validation.tenant.id,
    source: sanitizeSource(source),
    privateRepo,
    credentialRef,
    webhookSecretRef,
    buildCommand: `npm run build:tenants --workspace @pagenary/publisher -- ${validation.tenant.id}`,
    webhook: {
      events: ['push'],
      target: options.webhookTarget || 'private-control-plane-managed-hosting-worker',
      branch: source.ref || 'main'
    },
    errors,
    warnings
  };
}

export function applyManagedHostingRepoEvent(tenant, event, options = {}) {
  const normalized = normalizeRepoEvent(event);
  const updatedTenant = {
    ...tenant
  };
  const impact = {
    eventType: normalized.type,
    effectiveAt: normalized.effectiveAt,
    previousStatus: buildManagedHostingRepoSetup(tenant, options).status,
    nextStatus: null,
    warnings: [],
    errors: []
  };

  if (normalized.type === 'repository.connected') {
    updatedTenant.source = normalized.source;
    updatedTenant.privateRepo = normalized.privateRepo;
    if (normalized.credentialRef) updatedTenant.repoCredentialRef = normalized.credentialRef;
  }
  if (normalized.type === 'webhook.installed') {
    if (normalized.webhookSecretRef) updatedTenant.webhookSecretRef = normalized.webhookSecretRef;
    if (normalized.source) updatedTenant.source = normalized.source;
  }
  if (normalized.type === 'repository.failed') {
    impact.errors.push(normalized.reason || 'repository setup failed');
    if (normalized.source) updatedTenant.source = normalized.source;
  }
  if (normalized.type === 'repository.disconnected') {
    delete updatedTenant.source;
    delete updatedTenant.repoCredentialRef;
    delete updatedTenant.webhookSecretRef;
    updatedTenant.privateRepo = false;
    impact.warnings.push('repository connection has been disconnected; builds should be disabled until reconnected');
  }

  const setup = buildManagedHostingRepoSetup(updatedTenant, {
    credentialRef: options.credentialRef,
    webhookSecretRef: options.webhookSecretRef,
    webhookTarget: options.webhookTarget
  });
  impact.nextStatus = setup.status;

  return {
    ok: impact.errors.length === 0 && setup.status === 'ready',
    tenant: {
      ...updatedTenant,
      source: sanitizeSource(updatedTenant.source)
    },
    repository: setup,
    impact,
    privateControlPlane: {
      nextActions: repoEventNextActions(setup, impact)
    },
    validation: {
      errors: [...setup.errors, ...impact.errors]
    }
  };
}

export function buildManagedHostingStatusRecord(tenant, options = {}) {
  const validation = validateManagedHostingTenant(tenant, {
    requirePaidActivation: Boolean(options.requirePaidActivation)
  });
  const distRoot = options.distRoot || 'dist';
  const distDir = path.resolve(options.cwd || process.cwd(), distRoot, validation.tenant.id);
  const artifacts = inspectStaticOutput(distDir);
  const domains = buildManagedHostingDomainSetup(tenant, {
    verifiedDomains: options.verifiedDomains,
    wildcardTarget: options.wildcardTarget
  });
  const repository = buildManagedHostingRepoSetup(tenant, {
    credentialRef: options.credentialRef,
    webhookSecretRef: options.webhookSecretRef,
    webhookTarget: options.webhookTarget
  });
  const errors = [...validation.errors, ...artifacts.missing.map((item) => `missing ${item}`)];
  const publicUrls = [`https://${validation.tenant.publicDomain}`]
    .concat(validation.tenant.customDomains.map((domain) => `https://${domain}`));

  return {
    tenantId: validation.tenant.id,
    status: errors.length === 0 ? 'ready' : 'blocked',
    generatedAt: options.generatedAt || new Date().toISOString(),
    plan: validation.tenant.plan,
    entitlements: validation.entitlements,
    publicUrls,
    domains,
    repository,
    paymentStatus: validation.tenant.paymentStatus,
    source: sanitizeSource(tenant?.source),
    build: {
      commit: options.commit || null,
      logUrl: options.logUrl || null,
      distDir,
      artifacts
    },
    errors
  };
}

export function buildManagedHostingActivationRecord(tenant, options = {}) {
  const status = buildManagedHostingStatusRecord(tenant, {
    ...options,
    requirePaidActivation: true
  });
  const customDomainStatuses = status.domains.customDomains.map((domain) => ({
    domain: domain.domain,
    status: domain.status,
    errors: domain.status === 'ready' ? [] : [`custom domain ${domain.domain} is ${domain.status}`]
  }));
  const checks = [
    {
      id: 'tenant',
      status: status.errors.filter((error) => !error.startsWith('missing ')).length === 0 ? 'ready' : 'blocked',
      errors: status.errors.filter((error) => !error.startsWith('missing '))
    },
    {
      id: 'payment',
      status: paymentActivationStatus(status.plan, status.paymentStatus),
      errors: paymentActivationErrors(status.plan, status.paymentStatus)
    },
    {
      id: 'repository',
      status: status.repository.status,
      errors: status.repository.errors
    },
    {
      id: 'build',
      status: status.build.artifacts.ok ? 'ready' : 'blocked',
      errors: status.build.artifacts.missing.map((item) => `missing ${item}`)
    },
    {
      id: 'public-domain',
      status: status.domains.publicDomain.status,
      errors: status.domains.publicDomain.status === 'ready'
        ? []
        : [`public domain ${status.domains.publicDomain.domain} is ${status.domains.publicDomain.status}`]
    },
    ...customDomainStatuses.map((domain) => ({
      id: `custom-domain:${domain.domain}`,
      status: domain.status === 'ready' ? 'ready' : 'blocked',
      errors: domain.errors
    }))
  ];
  const errors = Array.from(new Set(checks.flatMap((check) => check.errors)));

  return {
    tenantId: status.tenantId,
    status: errors.length === 0 ? 'ready' : 'blocked',
    generatedAt: status.generatedAt,
    launchUrl: status.publicUrls[0],
    publicUrls: status.publicUrls,
    checks,
    errors,
    statusRecord: status
  };
}

export function buildManagedHostingCustomerHandoff(tenant, options = {}) {
  const readiness = buildManagedHostingActivationRecord(tenant, options);
  const status = readiness.statusRecord;
  const customDomains = status.domains.customDomains.map((domain) => ({
    domain: domain.domain,
    url: domain.url,
    status: domain.status,
    records: domain.records
  }));
  const blockedActions = readiness.errors.map((error) => `Resolve before customer handoff: ${error}`);
  const readyActions = [
    `Share the live URL ${readiness.launchUrl}.`,
    'Send the billing receipt from the private Stripe/customer portal.',
    ...customDomains
      .filter((domain) => domain.status !== 'ready')
      .map((domain) => `Ask the customer to finish DNS for ${domain.domain}.`)
  ];

  return {
    tenantId: readiness.tenantId,
    status: readiness.status,
    subject: readiness.status === 'ready'
      ? `Your Pagenary site is live: ${readiness.launchUrl}`
      : `Pagenary hosting setup is not ready: ${readiness.tenantId}`,
    summary: readiness.status === 'ready'
      ? 'The managed-hosting launch gate passed and the site can be shared with the customer.'
      : 'The managed-hosting launch gate is blocked; do not tell the customer the site is live yet.',
    liveUrls: readiness.status === 'ready' ? readiness.publicUrls : [],
    primaryUrl: readiness.status === 'ready' ? readiness.launchUrl : null,
    plan: status.plan,
    paymentStatus: status.paymentStatus,
    repository: {
      source: status.repository.source,
      branch: status.repository.webhook.branch,
      buildCommand: status.repository.buildCommand
    },
    build: {
      commit: status.build.commit,
      logUrl: status.build.logUrl
    },
    domains: {
      publicDomain: status.domains.publicDomain,
      customDomains
    },
    nextActions: readiness.status === 'ready' ? readyActions : blockedActions,
    readiness: {
      status: readiness.status,
      checks: readiness.checks
    }
  };
}

export function buildManagedHostingSupportPacket(tenant, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const accountTenants = getAccountTenants(tenant, options.tenants);
  const sharedOptions = {
    ...options,
    generatedAt
  };
  const readiness = buildManagedHostingActivationRecord(tenant, sharedOptions);
  const handoff = buildManagedHostingCustomerHandoff(tenant, sharedOptions);
  const publishPlan = buildManagedHostingPublishPlan(tenant, sharedOptions);
  const publishResult = buildManagedHostingPublishResult(tenant, sharedOptions);
  const accountUsage = buildManagedHostingAccountUsage(accountTenants, {
    accountId: tenant?.accountId || tenant?.id,
    requirePaidActivation: false,
    generatedAt
  });
  const account = accountUsage.accounts[0] || null;
  const billingAction = buildManagedHostingBillingAction(tenant, {
    requirePaidActivation: Boolean(options.requirePaidActivation),
    generatedAt
  });
  const status = publishResult.status;
  const errors = Array.from(new Set([
    ...readiness.errors,
    ...publishResult.errors,
    ...(account?.errors || []),
    ...billingAction.errors
  ]));
  const statusRecord = readiness.statusRecord;
  const customerNextActions = status === 'ready'
    ? [
        ...handoff.nextActions,
        ...(billingAction.action === 'none' ? [] : [billingAction.customerVisible.message])
      ]
    : [
        ...errors.map((error) => `Resolve before customer update: ${error}`),
        ...(billingAction.action === 'none' ? [] : [billingAction.customerVisible.message])
      ];

  return {
    tenantId: readiness.tenantId,
    status,
    generatedAt,
    plan: statusRecord.plan,
    paymentStatus: statusRecord.paymentStatus,
    account: account
      ? {
          accountId: account.accountId,
          status: account.status,
          sitesUsed: account.sitesUsed,
          sitesRemaining: account.sitesRemaining,
          canAddSite: account.canAddSite,
          errors: account.errors
        }
      : null,
    billingAction,
    customer: {
      subject: status === 'ready'
        ? handoff.subject
        : `Pagenary hosting setup is not ready: ${readiness.tenantId}`,
      summary: status === 'ready'
        ? handoff.summary
        : 'The managed-hosting launch gate or publish verification is blocked; do not tell the customer the site is live yet.',
      primaryUrl: status === 'ready' ? publishResult.publicUrls[0] : null,
      liveUrls: status === 'ready' ? publishResult.publicUrls : [],
      nextActions: customerNextActions
    },
    operator: {
      source: statusRecord.repository.source,
      repositoryStatus: statusRecord.repository.status,
      buildCommand: statusRecord.repository.buildCommand,
      buildLogUrl: statusRecord.build.logUrl,
      commit: statusRecord.build.commit,
      domainStatus: summarizeDomainStatus(statusRecord.domains),
      buildStatus: statusRecord.build.artifacts.ok ? 'ready' : 'blocked',
      publishStatus: publishResult.status,
      rollbackCommand: publishResult.rollbackCommand,
      blockers: errors,
      checklist: buildConciergeOnboardingChecklist(tenant)
    },
    readiness: {
      status: readiness.status,
      checks: readiness.checks
    },
    publish: {
      plan: {
        status: publishPlan.status,
        sourceDir: publishPlan.sourceDir,
        targetDir: publishPlan.targetDir,
        backupDir: publishPlan.backupDir,
        publicUrls: publishPlan.publicUrls,
        commands: publishPlan.commands
      },
      result: {
        status: publishResult.status,
        publicUrls: publishResult.publicUrls,
        errors: publishResult.errors,
        comparisons: publishResult.comparisons
      }
    }
  };
}

export function buildManagedHostingWorkerRunRecord(tenant, event, options = {}) {
  const normalized = normalizeWorkerEvent(event);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const validation = validateManagedHostingTenant(tenant);
  const accountTenants = getAccountTenants(tenant, options.tenants);
  const repository = buildManagedHostingRepoSetup(tenant, {
    credentialRef: options.credentialRef,
    webhookSecretRef: options.webhookSecretRef,
    webhookTarget: options.webhookTarget
  });
  const sharedOptions = {
    ...options,
    generatedAt,
    commit: normalized.commit || options.commit,
    logUrl: normalized.logUrl || options.logUrl
  };
  const supportPacket = normalized.type === 'publish.succeeded'
    ? buildManagedHostingSupportPacket(tenant, {
        ...sharedOptions,
        tenants: accountTenants
      })
    : null;
  const accountUsage = buildManagedHostingAccountUsage(accountTenants, {
    accountId: tenant?.accountId || tenant?.id,
    requirePaidActivation: false,
    generatedAt
  });
  const account = accountUsage.accounts[0] || null;
  const billingAction = buildManagedHostingBillingAction(tenant, {
    requirePaidActivation: Boolean(options.requirePaidActivation),
    generatedAt
  });
  const eventErrors = normalized.errors.map((error) => sanitizeLogText(error));
  const systemErrors = repository.status === 'ready' ? [] : repository.errors;
  const publishErrors = supportPacket?.status === 'ready' ? [] : supportPacket?.operator.blockers || [];
  const errors = Array.from(new Set([
    ...eventErrors,
    ...systemErrors,
    ...publishErrors
  ]));
  const baseStatus = supportPacket
    ? (supportPacket.status === 'ready' ? normalized.status : 'blocked')
    : normalized.status;
  const status = errors.length > 0 && ['queued', 'building', 'built', 'publishing', 'published'].includes(baseStatus)
    ? 'blocked'
    : baseStatus;
  const publicUrls = status === 'published' ? supportPacket.customer.liveUrls : [];

  return {
    tenantId: validation.tenant.id,
    runId: normalized.runId,
    eventType: normalized.type,
    status,
    stage: normalized.stage,
    generatedAt,
    occurredAt: normalized.occurredAt,
    source: sanitizeSource(normalized.source || tenant?.source),
    repository: {
      status: repository.status,
      branch: normalized.ref || repository.webhook.branch,
      buildCommand: repository.buildCommand
    },
    account: account
      ? {
          accountId: account.accountId,
          status: account.status,
          sitesUsed: account.sitesUsed,
          sitesRemaining: account.sitesRemaining,
          canAddSite: account.canAddSite,
          errors: account.errors
        }
      : null,
    billingAction,
    build: {
      commit: normalized.commit,
      ref: normalized.ref,
      logUrl: normalized.logUrl,
      durationMs: normalized.durationMs
    },
    deploy: {
      publicUrls,
      publishVerified: supportPacket ? supportPacket.status === 'ready' : false,
      targetDir: supportPacket?.publish.plan.targetDir || null,
      rollbackCommand: supportPacket?.operator.rollbackCommand || null
    },
    customer: {
      visibleStatus: customerVisibleRunStatus(status),
      liveUrls: publicUrls,
      message: customerVisibleRunMessage(status)
    },
    operator: {
      errors,
      nextActions: workerRunNextActions(status, errors, normalized.logUrl),
      supportPacket: supportPacket
        ? {
            status: supportPacket.status,
            account: supportPacket.account,
            billingAction: supportPacket.billingAction,
            customer: supportPacket.customer,
            readiness: supportPacket.readiness,
            publish: supportPacket.publish.result
          }
        : null
    }
  };
}

export function buildManagedHostingRegistryOverview(tenants, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const tenantRows = tenants.map((tenant) => {
    const readiness = buildManagedHostingActivationRecord(tenant, {
      ...options,
      generatedAt
    });
    const status = readiness.statusRecord;
    const blockingChecks = readiness.checks
      .filter((check) => check.status !== 'ready')
      .map((check) => ({
        id: check.id,
        errors: check.errors
      }));

    return {
      tenantId: readiness.tenantId,
      status: readiness.status,
      plan: status.plan,
      paymentStatus: status.paymentStatus,
      publicUrls: readiness.status === 'ready' ? readiness.publicUrls : [],
      launchUrl: readiness.status === 'ready' ? readiness.launchUrl : null,
      repositoryStatus: status.repository.status,
      domainStatus: summarizeDomainStatus(status.domains),
      buildStatus: status.build.artifacts.ok ? 'ready' : 'blocked',
      blockingChecks,
      errors: readiness.errors
    };
  });
  const totals = {
    tenants: tenantRows.length,
    ready: tenantRows.filter((row) => row.status === 'ready').length,
    blocked: tenantRows.filter((row) => row.status !== 'ready').length,
    paid: tenantRows.filter((row) => normalizeHostingPlan(row.plan).monthlyPrice > 0).length
  };

  return {
    status: totals.blocked === 0 ? 'ready' : 'blocked',
    generatedAt,
    totals,
    tenants: tenantRows
  };
}

export function buildManagedHostingDashboardState(tenants, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const accountId = normalizeAccountId(options.accountId);
  if (!accountId) throw new Error('dashboard state requires an accountId');

  const accountTenants = tenants.filter((tenant) => normalizeAccountId(tenant?.accountId || tenant?.id) === accountId);
  const accountUsage = buildManagedHostingAccountUsage(tenants, {
    accountId,
    requirePaidActivation: Boolean(options.requirePaidActivation),
    generatedAt
  });
  const account = accountUsage.accounts[0] || null;
  const tenantStates = accountTenants.map((tenant) => {
    const supportPacket = buildManagedHostingSupportPacket(tenant, {
      ...options,
      tenants,
      generatedAt
    });
    return {
      tenantId: supportPacket.tenantId,
      status: supportPacket.status,
      plan: supportPacket.plan,
      paymentStatus: supportPacket.paymentStatus,
      repository: {
        status: supportPacket.operator.repositoryStatus,
        source: supportPacket.operator.source,
        buildCommand: supportPacket.operator.buildCommand
      },
      domains: {
        status: supportPacket.operator.domainStatus,
        liveUrls: supportPacket.customer.liveUrls
      },
      billingAction: supportPacket.billingAction,
      customer: supportPacket.customer,
      readiness: {
        status: supportPacket.readiness.status,
        checks: supportPacket.readiness.checks
      },
      publish: {
        status: supportPacket.publish.result.status,
        publicUrls: supportPacket.publish.result.publicUrls,
        errors: supportPacket.publish.result.errors
      },
      operator: {
        blockers: supportPacket.operator.blockers,
        nextActions: supportPacket.operator.blockers.length > 0
          ? [
              ...supportPacket.operator.blockers.map((error) => `Resolve before launch: ${error}`),
              ...(supportPacket.billingAction.action === 'none' ? [] : [supportPacket.billingAction.operatorLabel])
            ]
          : ['Tenant is ready for customer handoff.']
      }
    };
  });
  const errors = [
    ...(account ? account.errors : [`account ${accountId} has no tenants`]),
    ...tenantStates.flatMap((tenant) => tenant.operator.blockers.map((error) => `${tenant.tenantId}: ${error}`))
  ];

  return {
    status: errors.length === 0 ? 'ready' : 'blocked',
    generatedAt,
    account: account
      ? {
          accountId: account.accountId,
          status: account.status,
          plan: account.plan,
          paymentStatus: account.paymentStatus,
          sitesUsed: account.sitesUsed,
          sitesRemaining: account.sitesRemaining,
          canAddSite: account.canAddSite,
          entitlements: account.entitlements,
          errors: account.errors
        }
      : {
          accountId,
          status: 'blocked',
          plan: 'free',
          paymentStatus: 'unknown',
          sitesUsed: 0,
          sitesRemaining: 0,
          canAddSite: false,
          entitlements: getHostingEntitlements('free'),
          errors
        },
    totals: {
      tenants: tenantStates.length,
      ready: tenantStates.filter((tenant) => tenant.status === 'ready').length,
      blocked: tenantStates.filter((tenant) => tenant.status !== 'ready').length,
      billingActions: tenantStates.filter((tenant) => tenant.billingAction.action !== 'none').length
    },
    tenants: tenantStates,
    errors: Array.from(new Set(errors))
  };
}

export function buildManagedHostingPublishPlan(tenant, options = {}) {
  const readiness = buildManagedHostingActivationRecord(tenant, options);
  const status = readiness.statusRecord;
  const deployRoot = options.deployRoot || '/srv/pagenary/sites';
  const sourceDir = path.resolve(options.cwd || process.cwd(), options.distRoot || 'dist', readiness.tenantId);
  const targetDir = `${deployRoot.replace(/\/+$/, '')}/${readiness.tenantId}`;
  const backupDir = `${deployRoot.replace(/\/+$/, '')}/.releases/${readiness.tenantId}/${status.build.commit || 'manual'}`;
  const excludes = [
    '.git/',
    '.DS_Store',
    'node_modules/',
    '*.map'
  ];
  const rsyncArgs = [
    '-av',
    '--delete',
    ...excludes.map((item) => `--exclude=${shellQuote(item)}`),
    `${shellQuote(`${sourceDir}/`)}`,
    `${shellQuote(`${targetDir}/`)}`
  ];

  return {
    tenantId: readiness.tenantId,
    status: readiness.status,
    generatedAt: readiness.generatedAt,
    sourceDir,
    targetDir,
    backupDir,
    publicUrls: readiness.status === 'ready' ? readiness.publicUrls : [],
    readiness: {
      status: readiness.status,
      errors: readiness.errors
    },
    commands: readiness.status === 'ready'
      ? {
          dryRun: `rsync --dry-run ${rsyncArgs.join(' ')}`,
          publish: `rsync ${rsyncArgs.join(' ')}`,
          backup: `mkdir -p ${shellQuote(backupDir)} && rsync -av ${shellQuote(`${targetDir}/`)} ${shellQuote(`${backupDir}/`)}`,
          rollback: `rsync -av --delete ${shellQuote(`${backupDir}/`)} ${shellQuote(`${targetDir}/`)}`
        }
      : null,
    notes: readiness.status === 'ready'
      ? [
          'Run dryRun first from the private worker before publish.',
          'Run backup before publish when the target path already exists.',
          'Execute publish only from private infrastructure with deploy credentials.'
        ]
      : readiness.errors.map((error) => `Resolve before publish: ${error}`)
  };
}

export function buildManagedHostingPublishResult(tenant, options = {}) {
  const plan = buildManagedHostingPublishPlan(tenant, options);
  const sourceArtifacts = inspectStaticOutput(plan.sourceDir);
  const targetArtifacts = inspectStaticOutput(plan.targetDir);
  const comparisons = compareStaticArtifacts(sourceArtifacts, targetArtifacts);
  const errors = [
    ...plan.readiness.errors,
    ...targetArtifacts.missing.map((item) => `target missing ${item}`),
    ...comparisons.filter((item) => !item.ok).map((item) => item.error)
  ];

  return {
    tenantId: plan.tenantId,
    status: plan.status === 'ready' && errors.length === 0 ? 'ready' : 'blocked',
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceDir: plan.sourceDir,
    targetDir: plan.targetDir,
    publicUrls: plan.status === 'ready' && errors.length === 0 ? plan.publicUrls : [],
    readiness: plan.readiness,
    sourceArtifacts,
    targetArtifacts,
    comparisons,
    errors,
    rollbackCommand: plan.commands?.rollback || null
  };
}

export function buildManagedHostingRollbackPlan(tenant, options = {}) {
  const publishPlan = buildManagedHostingPublishPlan(tenant, options);
  const backupArtifacts = inspectStaticOutput(publishPlan.backupDir);
  const targetArtifacts = inspectStaticOutput(publishPlan.targetDir);
  const errors = [
    ...publishPlan.readiness.errors,
    ...backupArtifacts.missing.map((item) => `backup missing ${item}`)
  ];

  return {
    tenantId: publishPlan.tenantId,
    status: publishPlan.status === 'ready' && errors.length === 0 ? 'ready' : 'blocked',
    generatedAt: options.generatedAt || new Date().toISOString(),
    backupDir: publishPlan.backupDir,
    targetDir: publishPlan.targetDir,
    publicUrls: publishPlan.status === 'ready' && errors.length === 0 ? publishPlan.publicUrls : [],
    backupArtifacts,
    targetArtifacts,
    commands: publishPlan.status === 'ready' && errors.length === 0
      ? {
          rollback: publishPlan.commands.rollback,
          verify: `diff -qr ${shellQuote(`${publishPlan.backupDir}/`)} ${shellQuote(`${publishPlan.targetDir}/`)}`
        }
      : null,
    notes: errors.length === 0
      ? [
          'Run rollback only from private infrastructure with deploy credentials.',
          'Run verify after rollback and regenerate publish/deploy artifacts before customer handoff.'
        ]
      : errors.map((error) => `Resolve before rollback: ${error}`),
    errors
  };
}

export function buildManagedHostingDeployManifest(tenant, options = {}) {
  const publishResult = buildManagedHostingPublishResult(tenant, options);
  const immutablePatterns = ['/*.js', '/*.css', '/assets/*'];
  const shortCachePatterns = ['/search-index/*', '/pages/*'];
  const noCachePaths = ['/index.html', '/sitemap.xml', '/robots.txt'];
  const uploadRules = [
    ...noCachePaths.map((pathPattern) => ({
      path: pathPattern,
      cacheControl: 'no-cache, must-revalidate'
    })),
    ...shortCachePatterns.map((pathPattern) => ({
      path: pathPattern,
      cacheControl: 'public, max-age=300, must-revalidate'
    })),
    ...immutablePatterns.map((pathPattern) => ({
      path: pathPattern,
      cacheControl: 'public, max-age=31536000, immutable'
    }))
  ];
  const invalidationPaths = [
    '/index.html',
    '/sitemap.xml',
    '/robots.txt',
    '/search-index/*',
    '/pages/*'
  ];

  return {
    tenantId: publishResult.tenantId,
    status: publishResult.status,
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceDir: publishResult.sourceDir,
    targetDir: publishResult.targetDir,
    publicUrls: publishResult.publicUrls,
    upload: {
      root: publishResult.targetDir,
      requiredArtifacts: publishResult.targetArtifacts.required,
      cacheRules: publishResult.status === 'ready' ? uploadRules : []
    },
    cdn: {
      invalidationPaths: publishResult.status === 'ready' ? invalidationPaths : [],
      notes: publishResult.status === 'ready'
        ? [
            'Invalidate HTML, sitemap, robots, page metadata, and search index paths after sync.',
            'Keep fingerprinted JS/CSS immutable to avoid stale-edit masking while preserving CDN efficiency.'
          ]
        : publishResult.errors.map((error) => `Resolve before CDN invalidation: ${error}`)
    },
    verification: {
      status: publishResult.status,
      comparisons: publishResult.comparisons,
      errors: publishResult.errors
    }
  };
}

export function buildManagedHostingArtifactIndex(tenant, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const sharedOptions = {
    ...options,
    generatedAt
  };
  const statusRecord = buildManagedHostingStatusRecord(tenant, sharedOptions);
  const readiness = buildManagedHostingActivationRecord(tenant, sharedOptions);
  const handoff = buildManagedHostingCustomerHandoff(tenant, sharedOptions);
  const publishPlan = buildManagedHostingPublishPlan(tenant, sharedOptions);
  const publishResult = buildManagedHostingPublishResult(tenant, sharedOptions);
  const rollbackPlan = buildManagedHostingRollbackPlan(tenant, sharedOptions);
  const deployManifest = buildManagedHostingDeployManifest(tenant, sharedOptions);
  const supportPacket = buildManagedHostingSupportPacket(tenant, sharedOptions);
  const artifacts = [
    {
      id: 'status',
      file: 'pagenary-hosting-status.json',
      status: statusRecord.status,
      requiredFor: ['dashboard', 'readiness'],
      summary: 'Build, repository, domain, and artifact status.'
    },
    {
      id: 'readiness',
      file: 'pagenary-hosting-readiness.json',
      status: readiness.status,
      requiredFor: ['publish-plan', 'customer-handoff'],
      summary: 'Launch gate across tenant, payment, repository, build, and domains.'
    },
    {
      id: 'customer-handoff',
      file: 'pagenary-hosting-handoff.json',
      status: handoff.status,
      requiredFor: ['customer-update'],
      summary: 'Customer-safe launch message and live URL handoff.'
    },
    {
      id: 'publish-plan',
      file: 'pagenary-hosting-publish-plan.json',
      status: publishPlan.status,
      requiredFor: ['private-worker-sync'],
      summary: 'Dry-run, backup, publish, and rollback command plan.'
    },
    {
      id: 'publish-result',
      file: 'pagenary-hosting-publish-result.json',
      status: publishResult.status,
      requiredFor: ['deploy-manifest', 'support-packet'],
      summary: 'Post-sync source/target artifact verification.'
    },
    {
      id: 'rollback-plan',
      file: 'pagenary-hosting-rollback-plan.json',
      status: rollbackPlan.status,
      requiredFor: ['recovery'],
      summary: 'Verified backup path and rollback command.'
    },
    {
      id: 'deploy-manifest',
      file: 'pagenary-hosting-deploy-manifest.json',
      status: deployManifest.status,
      requiredFor: ['cdn-handoff'],
      summary: 'Cache-control and CDN invalidation manifest.'
    },
    {
      id: 'support-packet',
      file: 'pagenary-hosting-support-packet.json',
      status: supportPacket.status,
      requiredFor: ['dashboard', 'support'],
      summary: 'Single support/control-panel launch state.'
    }
  ];
  const errors = Array.from(new Set([
    ...statusRecord.errors,
    ...readiness.errors,
    ...publishResult.errors,
    ...deployManifest.verification.errors,
    ...supportPacket.operator.blockers
  ]));

  return {
    tenantId: statusRecord.tenantId,
    status: errors.length === 0 ? 'ready' : 'blocked',
    generatedAt,
    accountId: tenant?.accountId || statusRecord.tenantId,
    plan: statusRecord.plan,
    paymentStatus: statusRecord.paymentStatus,
    publicUrls: supportPacket.status === 'ready' ? supportPacket.customer.liveUrls : [],
    files: artifacts,
    dependencies: [
      { before: 'readiness', after: 'status' },
      { before: 'publish-plan', after: 'readiness' },
      { before: 'publish-result', after: 'publish-plan' },
      { before: 'rollback-plan', after: 'publish-plan' },
      { before: 'deploy-manifest', after: 'publish-result' },
      { before: 'support-packet', after: 'publish-result' },
      { before: 'customer-handoff', after: 'readiness' }
    ],
    errors
  };
}

export function buildManagedHostingBillingAction(tenant, options = {}) {
  const validation = validateManagedHostingTenant(tenant, {
    requirePaidActivation: Boolean(options.requirePaidActivation)
  });
  const plan = normalizeHostingPlan(validation.tenant.plan);
  const paymentStatus = normalizePaymentStatus(validation.tenant.paymentStatus);
  const action = billingActionFor(plan, paymentStatus);
  const errors = paymentActivationErrors(plan.id, paymentStatus);

  return {
    tenantId: validation.tenant.id,
    status: action.status,
    generatedAt: options.generatedAt || new Date().toISOString(),
    plan: plan.id,
    planLabel: plan.label,
    monthlyPrice: plan.monthlyPrice,
    paymentStatus,
    action: action.id,
    customerLabel: action.customerLabel,
    operatorLabel: action.operatorLabel,
    canLaunchPaidFeatures: plan.monthlyPrice === 0 || paymentStatus === 'active',
    customerVisible: {
      severity: action.severity,
      message: action.message,
      cta: action.cta
    },
    privateControlPlane: {
      required: action.privateRequired,
      expectedAction: action.privateAction,
      note: 'Create Payment Link, checkout, customer portal, and webhook records in the private control plane.'
    },
    errors
  };
}

export function applyManagedHostingBillingEvent(tenant, event) {
  const normalized = normalizeBillingEvent(event);
  const before = validateManagedHostingTenant(tenant);
  const nextPlan = normalizeHostingPlan(normalized.plan || tenant?.plan || before.tenant.plan);
  const nextPaymentStatus = normalized.paymentStatus || paymentStatusForEvent(normalized.type, nextPlan);
  const updatedTenant = {
    ...tenant,
    plan: nextPlan.id,
    paymentStatus: nextPaymentStatus
  };

  const impact = {
    eventType: normalized.type,
    effectiveAt: normalized.effectiveAt,
    previousPlan: before.tenant.plan,
    nextPlan: nextPlan.id,
    previousPaymentStatus: before.tenant.paymentStatus,
    nextPaymentStatus,
    revoked: [],
    warnings: []
  };

  if (!nextPlan.customDomains && Array.isArray(updatedTenant.domains) && updatedTenant.domains.length > 0) {
    impact.revoked.push({
      feature: 'customDomains',
      domains: normalizeDomains(updatedTenant.domains)
    });
    updatedTenant.suspendedDomains = normalizeDomains(updatedTenant.domains);
    updatedTenant.domains = [];
    updatedTenant.verifiedDomains = [];
  }
  if (!nextPlan.privateRepos && updatedTenant.privateRepo) {
    impact.revoked.push({ feature: 'privateRepos' });
    updatedTenant.privateRepo = false;
  }
  if (!nextPlan.whiteLabel && updatedTenant.whiteLabel) {
    impact.revoked.push({ feature: 'whiteLabel' });
    updatedTenant.whiteLabel = false;
  }
  if (!nextPlan.sso && updatedTenant.sso) {
    impact.revoked.push({ feature: 'sso' });
    updatedTenant.sso = false;
  }
  if (updatedTenant.siteCount > nextPlan.siteLimit) {
    impact.revoked.push({
      feature: 'siteLimit',
      previousSiteCount: updatedTenant.siteCount,
      nextSiteLimit: nextPlan.siteLimit
    });
    updatedTenant.siteCount = nextPlan.siteLimit;
  }
  if (nextPaymentStatus === 'past-due') {
    impact.warnings.push('paid features remain configured, but the tenant should be shown a billing action before the next renewal gate');
  }
  if (nextPaymentStatus === 'canceled') {
    impact.warnings.push('tenant has been downgraded for cancellation; keep suspendedDomains for operator/customer recovery');
  }

  const after = validateManagedHostingTenant(updatedTenant, {
    requirePaidActivation: nextPlan.monthlyPrice > 0 && nextPaymentStatus !== 'past-due'
  });

  return {
    ok: after.ok,
    tenant: updatedTenant,
    entitlements: getHostingEntitlements(nextPlan.id),
    impact,
    validation: {
      errors: after.errors
    }
  };
}

export function applyManagedHostingDomainEvent(tenant, event, options = {}) {
  const normalized = normalizeDomainEvent(event);
  const before = validateManagedHostingTenant(tenant);
  const updatedTenant = {
    ...tenant,
    domains: normalizeDomains(tenant?.domains || []),
    verifiedDomains: normalizeDomains(tenant?.verifiedDomains || []),
    suspendedDomains: normalizeDomains(tenant?.suspendedDomains || [])
  };
  const impact = {
    eventType: normalized.type,
    domain: normalized.domain,
    effectiveAt: normalized.effectiveAt,
    previousStatus: domainStatusForTenant(before, normalized.domain),
    nextStatus: null,
    warnings: [],
    errors: []
  };

  if (normalized.type === 'custom_domain.requested') {
    if (!before.entitlements.customDomains) {
      impact.errors.push('custom domains require Pro or Team');
    } else if (!updatedTenant.domains.includes(normalized.domain)) {
      updatedTenant.domains.push(normalized.domain);
      updatedTenant.suspendedDomains = updatedTenant.suspendedDomains.filter((domain) => domain !== normalized.domain);
    }
  }
  if (normalized.type === 'custom_domain.verified') {
    if (!before.entitlements.customDomains) {
      impact.errors.push('custom domains require Pro or Team');
    } else {
      if (!updatedTenant.domains.includes(normalized.domain)) updatedTenant.domains.push(normalized.domain);
      if (!updatedTenant.verifiedDomains.includes(normalized.domain)) updatedTenant.verifiedDomains.push(normalized.domain);
      updatedTenant.suspendedDomains = updatedTenant.suspendedDomains.filter((domain) => domain !== normalized.domain);
    }
  }
  if (normalized.type === 'custom_domain.failed') {
    updatedTenant.verifiedDomains = updatedTenant.verifiedDomains.filter((domain) => domain !== normalized.domain);
    impact.warnings.push(normalized.reason || `custom domain ${normalized.domain} failed verification`);
  }
  if (normalized.type === 'custom_domain.removed') {
    updatedTenant.domains = updatedTenant.domains.filter((domain) => domain !== normalized.domain);
    updatedTenant.verifiedDomains = updatedTenant.verifiedDomains.filter((domain) => domain !== normalized.domain);
    updatedTenant.suspendedDomains = updatedTenant.suspendedDomains.filter((domain) => domain !== normalized.domain);
  }

  const setup = buildManagedHostingDomainSetup(updatedTenant, {
    verifiedDomains: updatedTenant.verifiedDomains,
    wildcardTarget: options.wildcardTarget
  });
  const domainRecord = setup.customDomains.find((domain) => domain.domain === normalized.domain) || null;
  impact.nextStatus = domainRecord?.status || (normalized.type === 'custom_domain.removed' ? 'removed' : 'not_configured');
  const validation = validateManagedHostingTenant(updatedTenant);

  return {
    ok: impact.errors.length === 0 && validation.ok,
    tenant: updatedTenant,
    domain: {
      domain: normalized.domain,
      status: impact.nextStatus,
      records: domainRecord?.records || []
    },
    impact,
    setup,
    validation: {
      errors: [...validation.errors, ...impact.errors]
    }
  };
}

function normalizeBillingEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('billing event must be a JSON object');
  }
  const type = String(event.type || '').trim();
  const allowedTypes = new Set([
    'subscription.active',
    'subscription.updated',
    'subscription.past_due',
    'subscription.canceled'
  ]);
  if (!allowedTypes.has(type)) {
    throw new Error(`unknown billing event type "${type}"`);
  }
  const normalized = {
    type,
    plan: event.plan ? normalizeHostingPlan(event.plan).id : null,
    paymentStatus: event.paymentStatus ? normalizePaymentStatus(event.paymentStatus) : null,
    effectiveAt: event.effectiveAt || new Date().toISOString()
  };
  if (type === 'subscription.canceled' && !normalized.plan) normalized.plan = 'free';
  if ((type === 'subscription.active' || type === 'subscription.updated') && !normalized.plan) {
    throw new Error(`${type} requires a plan`);
  }
  return normalized;
}

function normalizeSiteEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('site event must be a JSON object');
  }
  const type = String(event.type || '').trim();
  const allowedTypes = new Set(['site.created', 'site.removed']);
  if (!allowedTypes.has(type)) {
    throw new Error(`unknown site event type "${type}"`);
  }
  const normalized = {
    type,
    tenant: event.tenant || event.request || null,
    tenantId: normalizeSubdomain(event.tenantId || event.id),
    accountId: event.accountId ? normalizeAccountId(event.accountId) : null,
    effectiveAt: event.effectiveAt || new Date().toISOString()
  };
  if (type === 'site.created' && (!normalized.tenant || typeof normalized.tenant !== 'object')) {
    throw new Error('site.created requires a tenant or request object');
  }
  if (type === 'site.removed' && !normalized.tenantId) {
    throw new Error('site.removed requires tenantId or id');
  }
  return normalized;
}

function buildProposedTenantFromIntake(request) {
  if (!request || typeof request !== 'object') {
    throw new Error('onboarding intake request must be a JSON object');
  }
  const tenantId = normalizeSubdomain(request.tenantId || request.id || request.subdomain || request.accountId);
  if (!tenantId) throw new Error('onboarding intake request requires tenantId, id, subdomain, or accountId');
  const accountId = normalizeAccountId(request.accountId || tenantId);
  const plan = normalizeHostingPlan(request.plan || 'free');
  const source = request.source || {};
  return {
    id: tenantId,
    accountId,
    plan: plan.id,
    subdomain: normalizeSubdomain(request.subdomain || tenantId),
    siteCount: normalizeSiteCount(request.siteCount),
    paymentStatus: request.paymentStatus || (plan.monthlyPrice === 0 ? 'free' : 'manual-pending'),
    privateRepo: Boolean(request.privateRepo),
    domains: normalizeDomains(request.domains || []),
    source: sanitizeSource(source),
    repoCredentialRef: request.repoCredentialRef || null,
    webhookSecretRef: request.webhookSecretRef || null
  };
}

function findTenantConflicts(tenants, proposed) {
  const errors = [];
  const proposedPublicDomain = `${proposed.subdomain}.pagenary.app`;
  const proposedDomains = new Set([proposedPublicDomain, ...proposed.customDomains]);
  for (const tenant of tenants) {
    const existing = validateManagedHostingTenant(tenant).tenant;
    if (existing.id === proposed.id) {
      errors.push(`tenant id ${proposed.id} already exists`);
    }
    if (existing.publicDomain === proposedPublicDomain) {
      errors.push(`subdomain ${proposed.subdomain} already maps to an existing tenant`);
    }
    for (const domain of existing.customDomains) {
      if (proposedDomains.has(domain)) errors.push(`custom domain ${domain} already belongs to another tenant`);
    }
  }
  return Array.from(new Set(errors));
}

function normalizeDomainEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('domain event must be a JSON object');
  }
  const type = String(event.type || '').trim();
  const allowedTypes = new Set([
    'custom_domain.requested',
    'custom_domain.verified',
    'custom_domain.failed',
    'custom_domain.removed'
  ]);
  if (!allowedTypes.has(type)) {
    throw new Error(`unknown domain event type "${type}"`);
  }
  const [domain] = normalizeDomains([event.domain]);
  if (!domain) throw new Error(`${type} requires a domain`);
  return {
    type,
    domain,
    reason: event.reason ? sanitizeLogText(event.reason) : null,
    effectiveAt: event.effectiveAt || new Date().toISOString()
  };
}

function normalizeRepoEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('repository event must be a JSON object');
  }
  const type = String(event.type || '').trim();
  const allowedTypes = new Set([
    'repository.connected',
    'webhook.installed',
    'repository.failed',
    'repository.disconnected'
  ]);
  if (!allowedTypes.has(type)) {
    throw new Error(`unknown repository event type "${type}"`);
  }
  const source = event.source && typeof event.source === 'object'
    ? sanitizeSource(event.source)
    : null;
  if ((type === 'repository.connected' || type === 'webhook.installed') && !source?.url && type === 'repository.connected') {
    throw new Error(`${type} requires source.url`);
  }
  return {
    type,
    source,
    privateRepo: Boolean(event.privateRepo),
    credentialRef: event.credentialRef ? String(event.credentialRef) : null,
    webhookSecretRef: event.webhookSecretRef ? String(event.webhookSecretRef) : null,
    reason: event.reason ? sanitizeLogText(event.reason) : null,
    effectiveAt: event.effectiveAt || new Date().toISOString()
  };
}

function normalizeWorkerEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('worker event must be a JSON object');
  }
  const type = String(event.type || '').trim();
  const statusByType = {
    'repo.push': ['queued', 'webhook'],
    'build.queued': ['queued', 'build-queued'],
    'build.started': ['building', 'build'],
    'build.succeeded': ['built', 'build'],
    'build.failed': ['failed', 'build'],
    'publish.started': ['publishing', 'publish'],
    'publish.succeeded': ['published', 'publish'],
    'publish.failed': ['failed', 'publish']
  };
  if (!statusByType[type]) {
    throw new Error(`unknown worker event type "${type}"`);
  }
  const [status, stage] = statusByType[type];
  const errors = Array.isArray(event.errors)
    ? event.errors.map((error) => String(error || '').trim()).filter(Boolean)
    : [];
  if (type === 'build.failed' && errors.length === 0) {
    errors.push('build failed; inspect the worker log URL');
  }
  if (type === 'publish.failed' && errors.length === 0) {
    errors.push('publish failed; inspect the worker log URL');
  }

  return {
    type,
    status,
    stage,
    runId: event.runId ? String(event.runId) : null,
    occurredAt: event.occurredAt || new Date().toISOString(),
    commit: event.commit ? String(event.commit) : null,
    ref: event.ref ? String(event.ref) : null,
    logUrl: event.logUrl ? sanitizeLogText(event.logUrl) : null,
    durationMs: Number.isFinite(event.durationMs) ? event.durationMs : null,
    source: event.source,
    errors
  };
}

function domainStatusForTenant(validation, domain) {
  if (validation.tenant.customDomains.includes(domain)) {
    if (!validation.entitlements.customDomains) return 'not_allowed';
    return 'configured';
  }
  return 'not_configured';
}

function paymentStatusForEvent(type, plan) {
  if (type === 'subscription.canceled') return 'canceled';
  if (type === 'subscription.past_due') return 'past-due';
  if (plan.monthlyPrice === 0) return 'free';
  return 'active';
}

function normalizeSiteCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function isValidHostname(value) {
  if (typeof value !== 'string') return false;
  const hostname = value.trim().toLowerCase();
  if (!hostname || hostname.length > 253) return false;
  if (/\s/.test(hostname)) return false;
  try {
    const normalized = new URL(`https://${hostname}`).hostname;
    if (normalized !== hostname) return false;
  } catch {
    return false;
  }
  return hostname.split('.').every((part) => (
    part.length > 0 &&
    part.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part)
  ));
}

function normalizePaymentStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  const allowed = new Set(['free', 'manual-pending', 'active', 'past-due', 'canceled']);
  if (!allowed.has(value)) {
    throw new Error(`unknown payment status "${status}"`);
  }
  return value;
}

function paymentActivationStatus(plan, paymentStatus) {
  const normalizedPlan = normalizeHostingPlan(plan);
  if (normalizedPlan.monthlyPrice === 0) return paymentStatus === 'canceled' ? 'blocked' : 'ready';
  return paymentStatus === 'active' ? 'ready' : 'blocked';
}

function paymentActivationErrors(plan, paymentStatus) {
  const normalizedPlan = normalizeHostingPlan(plan);
  if (normalizedPlan.monthlyPrice === 0 && paymentStatus !== 'canceled') return [];
  if (normalizedPlan.monthlyPrice > 0 && paymentStatus === 'active') return [];
  return [`${normalizedPlan.label} activation requires active payment status; current status is ${paymentStatus}`];
}

function billingActionFor(plan, paymentStatus) {
  if (plan.monthlyPrice === 0 && paymentStatus !== 'canceled') {
    return {
      id: 'none',
      status: 'ready',
      severity: 'none',
      customerLabel: 'No payment required',
      operatorLabel: 'Free plan active',
      message: 'No payment is required for this Free tenant.',
      cta: null,
      privateRequired: false,
      privateAction: null
    };
  }
  if (paymentStatus === 'active') {
    return {
      id: 'none',
      status: 'ready',
      severity: 'none',
      customerLabel: `${plan.label} active`,
      operatorLabel: 'Paid subscription active',
      message: `${plan.label} billing is active.`,
      cta: null,
      privateRequired: false,
      privateAction: null
    };
  }
  if (paymentStatus === 'manual-pending') {
    return {
      id: 'collect-payment',
      status: 'action-required',
      severity: 'warning',
      customerLabel: 'Payment required',
      operatorLabel: 'Send concierge payment link',
      message: `${plan.label} requires active payment before launch.`,
      cta: 'Open payment link',
      privateRequired: true,
      privateAction: 'create-or-send-payment-link'
    };
  }
  if (paymentStatus === 'past-due') {
    return {
      id: 'update-payment',
      status: 'action-required',
      severity: 'warning',
      customerLabel: 'Payment needs attention',
      operatorLabel: 'Send billing portal or recovery link',
      message: `${plan.label} payment is past due. Keep configured features visible but request a billing update.`,
      cta: 'Update payment',
      privateRequired: true,
      privateAction: 'create-or-send-billing-portal-link'
    };
  }
  if (paymentStatus === 'canceled') {
    return {
      id: 'reactivate',
      status: 'blocked',
      severity: 'error',
      customerLabel: 'Plan canceled',
      operatorLabel: 'Reactivate subscription before launch',
      message: `${plan.label} is canceled. Paid features must remain blocked until reactivation.`,
      cta: 'Reactivate plan',
      privateRequired: true,
      privateAction: 'create-reactivation-checkout'
    };
  }
  return {
    id: 'contact-support',
    status: 'blocked',
    severity: 'error',
    customerLabel: 'Billing needs review',
    operatorLabel: 'Review billing state',
    message: 'Billing status needs operator review before launch.',
    cta: 'Contact support',
    privateRequired: true,
    privateAction: 'review-billing-state'
  };
}

function highestPlan(plans) {
  return plans
    .map((plan) => normalizeHostingPlan(plan).id)
    .sort((a, b) => PLAN_ORDER.indexOf(b) - PLAN_ORDER.indexOf(a))[0] || 'free';
}

function summarizePaymentStatus(statuses) {
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('manual-pending')) return 'manual-pending';
  if (statuses.includes('past-due')) return 'past-due';
  if (statuses.includes('canceled')) return 'canceled';
  return 'free';
}

function customerVisibleRunStatus(status) {
  if (status === 'published') return 'live';
  if (status === 'failed' || status === 'blocked') return 'action-required';
  if (status === 'built' || status === 'publishing') return 'deploying';
  return 'building';
}

function customerVisibleRunMessage(status) {
  if (status === 'published') return 'The latest build is live.';
  if (status === 'failed') return 'The latest hosting run failed; support is reviewing the log.';
  if (status === 'blocked') return 'The latest hosting run is blocked before customer launch.';
  if (status === 'publishing') return 'The latest build is being published.';
  if (status === 'built') return 'The latest build finished and is waiting for publish verification.';
  return 'The latest build is running.';
}

function workerRunNextActions(status, errors, logUrl) {
  if (status === 'published') return ['Share the verified live URLs with the customer.'];
  if (errors.length > 0) {
    return [
      ...errors.map((error) => `Resolve worker blocker: ${error}`),
      ...(logUrl ? [`Review worker log: ${logUrl}`] : [])
    ];
  }
  if (status === 'built') return ['Run readiness and publish verification before customer handoff.'];
  if (status === 'publishing') return ['Wait for publish verification before exposing live URLs.'];
  return ['Wait for the worker to finish and emit the next event.'];
}

function repoEventNextActions(setup, impact) {
  if (impact.eventType === 'repository.disconnected') {
    return ['Reconnect the repository before enabling builds.'];
  }
  if (impact.errors.length > 0) {
    return impact.errors.map((error) => `Resolve repository setup error: ${error}`);
  }
  const actions = [];
  if (setup.errors.includes('source.type=git with source.url is required before managed hosting can build')) {
    actions.push('Connect a git repository source.');
  }
  if (setup.errors.includes('private repository hosting requires a private control-plane credential reference')) {
    actions.push('Create or attach the private repository credential reference.');
  }
  if (setup.warnings.includes('webhook secret reference is missing; private control plane should create one before enabling push deploys')) {
    actions.push('Create a webhook secret reference and install the push webhook.');
  }
  if (setup.status === 'ready' && actions.length === 0) {
    actions.push('Repository connection is ready for push-triggered builds.');
  }
  return actions;
}

function summarizeDomainStatus(domains) {
  const customStatuses = domains.customDomains.map((domain) => domain.status);
  if (domains.publicDomain.status !== 'ready') return 'blocked';
  if (customStatuses.length === 0) return 'ready';
  if (customStatuses.every((status) => status === 'ready')) return 'ready';
  if (customStatuses.some((status) => status === 'not_allowed')) return 'blocked';
  return 'pending_dns';
}

function sanitizeLogText(value) {
  return String(value || '')
    .replace(/\/\/([^/@:\s]+):([^/@\s]+)@/, '//***:***@')
    .replace(/([?&](token|access_token|password|key|signature|secret)=)[^&\s]+/gi, '$1***')
    .replace(/(\b(token|access_token|password|key|signature|secret)=)[^&\s]+/gi, '$1***');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function compareStaticArtifacts(sourceArtifacts, targetArtifacts) {
  const fileComparisons = Object.keys(sourceArtifacts.files).map((name) => {
    const source = sourceArtifacts.files[name];
    const target = targetArtifacts.files[name];
    const ok = source.exists && target.exists && source.bytes === target.bytes;
    return {
      path: name,
      type: 'file',
      ok,
      sourceBytes: source.bytes,
      targetBytes: target.bytes,
      error: ok ? null : `target ${name} does not match source`
    };
  });
  const directoryComparisons = Object.keys(sourceArtifacts.directories).map((name) => {
    const source = sourceArtifacts.directories[name];
    const target = targetArtifacts.directories[name];
    const ok = source.exists && target.exists && source.entries === target.entries;
    return {
      path: `${name}/`,
      type: 'directory',
      ok,
      sourceEntries: source.entries,
      targetEntries: target.entries,
      error: ok ? null : `target ${name}/ does not match source`
    };
  });

  return [...fileComparisons, ...directoryComparisons];
}

function inspectStaticOutput(distDir) {
  const requiredFiles = ['index.html', 'sitemap.xml', 'robots.txt'];
  const requiredDirs = ['sections', 'search-index'];
  const files = Object.fromEntries(
    requiredFiles.map((rel) => [rel, readFileArtifact(path.join(distDir, rel))])
  );
  const dirs = Object.fromEntries(
    requiredDirs.map((rel) => [rel, readDirectoryArtifact(path.join(distDir, rel))])
  );
  const missing = [
    ...Object.entries(files).filter(([, value]) => !value.exists).map(([key]) => key),
    ...Object.entries(dirs).filter(([, value]) => !value.exists).map(([key]) => `${key}/`)
  ];

  return {
    ok: missing.length === 0,
    missing,
    files,
    directories: dirs
  };
}

function readFileArtifact(absPath) {
  try {
    const stat = fs.statSync(absPath);
    return {
      exists: stat.isFile(),
      bytes: stat.isFile() ? stat.size : 0,
      modifiedAt: stat.mtime.toISOString()
    };
  } catch {
    return { exists: false, bytes: 0, modifiedAt: null };
  }
}

function readDirectoryArtifact(absPath) {
  try {
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    return {
      exists: true,
      entries: entries.length,
      files: entries.filter((entry) => entry.isFile()).length,
      directories: entries.filter((entry) => entry.isDirectory()).length
    };
  } catch {
    return { exists: false, entries: 0, files: 0, directories: 0 };
  }
}

function getAccountTenants(tenant, tenants) {
  if (!Array.isArray(tenants) || tenants.length === 0) return [tenant];
  const accountId = normalizeAccountId(tenant?.accountId || tenant?.id);
  const scoped = tenants.filter((entry) => normalizeAccountId(entry?.accountId || entry?.id) === accountId);
  return scoped.length > 0 ? scoped : [tenant];
}

function sanitizeSource(source) {
  if (!source || typeof source !== 'object') return null;
  const sanitized = {
    type: source.type || null,
    ref: source.ref || null,
    path: source.path || null
  };
  if (source.url) {
    sanitized.url = String(source.url)
      .replace(/\/\/([^/@:\s]+):([^/@\s]+)@/, '//***:***@')
      .replace(/([?&](token|access_token|password|key)=)[^&]+/gi, '$1***');
  }
  return sanitized;
}

function normalizeSubdomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normalizeAccountId(value) {
  return normalizeSubdomain(value || 'default') || 'default';
}

function normalizeDomains(domains) {
  return Array.from(new Set(
    domains
      .map((domain) => String(domain || '').trim().toLowerCase())
      .filter(Boolean)
      .map((domain) => domain.replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
  ));
}
