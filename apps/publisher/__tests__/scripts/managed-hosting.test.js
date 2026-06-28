import {
  applyManagedHostingDomainEvent,
  applyManagedHostingBillingEvent,
  applyManagedHostingRepoEvent,
  applyManagedHostingSiteEvent,
  buildManagedHostingAccountUsage,
  buildManagedHostingArtifactIndex,
  buildManagedHostingBillingAction,
  buildManagedHostingOnboardingIntake,
  buildManagedHostingActivationRecord,
  buildManagedHostingCustomerHandoff,
  buildManagedHostingDeployManifest,
  buildManagedHostingDomainSetup,
  buildManagedHostingDashboardState,
  buildManagedHostingPublishPlan,
  buildManagedHostingPublishResult,
  buildManagedHostingRepoSetup,
  buildManagedHostingRegistryOverview,
  buildManagedHostingRollbackPlan,
  buildManagedHostingStatusRecord,
  buildManagedHostingSupportPacket,
  buildManagedHostingWorkerRunRecord,
  buildConciergeOnboardingChecklist,
  generateManagedHostingCaddyfile,
  getHostingEntitlements,
  isPlanAtLeast,
  validateManagedHostingTenant
} from '../../scripts/lib/managed-hosting.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('managed hosting helpers', () => {
  test('defines the first hosting plan gates', () => {
    expect(getHostingEntitlements('free')).toEqual({
      plan: 'free',
      siteLimit: 1,
      customDomains: false,
      privateRepos: false,
      whiteLabel: false,
      sso: false
    });
    expect(getHostingEntitlements('pro').customDomains).toBe(true);
    expect(getHostingEntitlements('team').sso).toBe(true);
    expect(isPlanAtLeast('team', 'pro')).toBe(true);
    expect(isPlanAtLeast('free', 'pro')).toBe(false);
  });

  test('rejects paid features on the free plan', () => {
    const result = validateManagedHostingTenant({
      id: 'demo',
      plan: 'free',
      privateRepo: true,
      domains: ['docs.example.com']
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('custom domains require Pro or Team');
    expect(result.errors).toContain('private repository hosting requires Pro or Team');
  });

  test('requires active payment before activating paid tenants when requested', () => {
    const result = validateManagedHostingTenant({
      id: 'acme',
      plan: 'pro',
      domains: ['docs.acme.com'],
      paymentStatus: 'manual-pending'
    }, { requirePaidActivation: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('paid Pro tenant must have active payment status before activation');
  });

  test('allows pro custom domains with active concierge payment', () => {
    const result = validateManagedHostingTenant({
      id: 'acme',
      plan: 'pro',
      subdomain: 'Acme Docs',
      privateRepo: true,
      domains: ['https://docs.acme.com/path'],
      paymentStatus: 'active'
    }, { requirePaidActivation: true });

    expect(result.ok).toBe(true);
    expect(result.tenant.subdomain).toBe('acme-docs');
    expect(result.tenant.publicDomain).toBe('acme-docs.pagenary.app');
    expect(result.tenant.customDomains).toEqual(['docs.acme.com']);
  });

  test('accepts numeric string siteCount values from intake payloads', () => {
    const result = validateManagedHostingTenant({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      siteCount: '2'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.siteCount).toBe(2);
  });

  test('rejects invalid custom domains before publishing', () => {
    const result = validateManagedHostingTenant({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'https://git.example.com/acme/docs.git',
        ref: 'main'
      },
      domains: ['docs acme.com', 'https://good.acme.com/path']
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('invalid custom domain docs acme.com');
    expect(result.errors).not.toContain('custom domains require Pro or Team');
  });

  test('builds account usage for control-panel site limits', () => {
    const usage = buildManagedHostingAccountUsage([
      {
        id: 'acme-docs',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        siteCount: 1
      },
      {
        id: 'acme-api',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        siteCount: 2
      },
      {
        id: 'demo',
        accountId: 'demo',
        plan: 'free',
        paymentStatus: 'free',
        siteCount: 1
      }
    ], {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(usage.status).toBe('ready');
    expect(usage.totals).toMatchObject({
      accounts: 2,
      ready: 2,
      blocked: 0,
      sitesUsed: 4
    });
    expect(usage.accounts.find((account) => account.accountId === 'acme')).toMatchObject({
      plan: 'pro',
      sitesUsed: 3,
      sitesRemaining: 2,
      canAddSite: true,
      tenantIds: ['acme-docs', 'acme-api']
    });
    expect(usage.accounts.find((account) => account.accountId === 'demo')).toMatchObject({
      plan: 'free',
      sitesUsed: 1,
      sitesRemaining: 0,
      canAddSite: false
    });
  });

  test('blocks account usage when a plan site limit is exceeded', () => {
    const usage = buildManagedHostingAccountUsage([
      { id: 'one', accountId: 'acme', plan: 'pro', paymentStatus: 'active', siteCount: 3 },
      { id: 'two', accountId: 'acme', plan: 'pro', paymentStatus: 'active', siteCount: 3 }
    ], {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });
    const account = usage.accounts[0];

    expect(usage.status).toBe('blocked');
    expect(account.status).toBe('blocked');
    expect(account.sitesUsed).toBe(6);
    expect(account.sitesRemaining).toBe(0);
    expect(account.canAddSite).toBe(false);
    expect(account.errors).toContain('Pro allows 5 hosted sites; account uses 6');
  });

  test('builds account dashboard state for the minimal control panel', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-dashboard-state-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const state = buildManagedHostingDashboardState([
      {
        id: 'acme',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        domains: ['docs.acme.com'],
        verifiedDomains: ['docs.acme.com'],
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      },
      {
        id: 'demo',
        accountId: 'demo',
        plan: 'free',
        paymentStatus: 'free'
      }
    ], {
      accountId: 'acme',
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z',
      requirePaidActivation: true
    });

    expect(state.status).toBe('ready');
    expect(state.account).toMatchObject({
      accountId: 'acme',
      plan: 'pro',
      sitesUsed: 1,
      canAddSite: true
    });
    expect(state.totals).toMatchObject({
      tenants: 1,
      ready: 1,
      blocked: 0,
      billingActions: 0
    });
    expect(state.tenants[0]).toMatchObject({
      tenantId: 'acme',
      status: 'ready',
      paymentStatus: 'active'
    });
    expect(state.tenants[0].billingAction.action).toBe('none');
    expect(state.tenants[0].customer.liveUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
  });

  test('blocks account dashboard state when paid activation is pending', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-dashboard-state-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const state = buildManagedHostingDashboardState([
      {
        id: 'acme',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'manual-pending',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      }
    ], {
      accountId: 'acme',
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z',
      requirePaidActivation: true
    });

    expect(state.status).toBe('blocked');
    expect(state.account.status).toBe('blocked');
    expect(state.totals.billingActions).toBe(1);
    expect(state.tenants[0].billingAction.action).toBe('collect-payment');
    expect(state.tenants[0].customer.liveUrls).toEqual([]);
    expect(state.errors).toContain('Pro activation requires active payment status; current status is manual-pending');
  });

  test('applies site created events within account plan limits', () => {
    const result = applyManagedHostingSiteEvent([
      {
        id: 'docs',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        },
        webhookSecretRef: 'secret:WEBHOOK_SECRET/docs'
      }
    ], {
      type: 'site.created',
      tenant: {
        tenantId: 'api',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/api.git',
          ref: 'main'
        },
        webhookSecretRef: 'secret:WEBHOOK_SECRET/api'
      },
      effectiveAt: '2026-06-22T00:00:00.000Z'
    }, {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.status).toBe('ready');
    expect(result.ok).toBe(true);
    expect(result.tenants.map((tenant) => tenant.id)).toEqual(['docs', 'api']);
    expect(result.account).toMatchObject({
      accountId: 'acme',
      sitesUsed: 2,
      canAddSite: true
    });
    expect(result.impact.nextTenantCount).toBe(2);
  });

  test('blocks site created events that exceed plan limits or billing gates', () => {
    const overLimit = applyManagedHostingSiteEvent([
      {
        id: 'docs',
        accountId: 'demo',
        plan: 'free',
        paymentStatus: 'free',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/demo/docs.git',
          ref: 'main'
        }
      }
    ], {
      type: 'site.created',
      tenant: {
        tenantId: 'api',
        accountId: 'demo',
        plan: 'free',
        paymentStatus: 'free',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/demo/api.git',
          ref: 'main'
        }
      }
    }, {
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    const unpaid = applyManagedHostingSiteEvent([], {
      type: 'site.created',
      tenant: {
        tenantId: 'pro-docs',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'manual-pending',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      }
    }, {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(overLimit.status).toBe('blocked');
    expect(overLimit.tenants).toHaveLength(1);
    expect(overLimit.impact.errors).toContain('Free allows 1 hosted site; account uses 2');
    expect(unpaid.status).toBe('blocked');
    expect(unpaid.tenants).toHaveLength(0);
    expect(unpaid.impact.errors).toContain('Pro activation requires active payment status; current status is manual-pending');
  });

  test('applies site removed events and returns account cleanup actions', () => {
    const result = applyManagedHostingSiteEvent([
      {
        id: 'docs',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        domains: ['docs.acme.com']
      },
      {
        id: 'api',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active'
      }
    ], {
      type: 'site.removed',
      tenantId: 'docs',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    }, {
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.status).toBe('action-required');
    expect(result.tenants.map((tenant) => tenant.id)).toEqual(['api']);
    expect(result.account).toMatchObject({
      accountId: 'acme',
      sitesUsed: 1,
      canAddSite: true
    });
    expect(result.impact.nextActions).toContain('Remove DNS/TLS routing for docs.acme.com.');
    expect(result.impact.nextActions).toContain('Remove hosted output for tenant docs from the private deploy target.');
  });

  test('builds onboarding intake for a new paid private-repo tenant', () => {
    const intake = buildManagedHostingOnboardingIntake([
      {
        id: 'acme',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      }
    ], {
      tenantId: 'beta',
      accountId: 'beta',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      privateRepo: true,
      domains: ['docs.beta.example.com'],
      source: {
        type: 'git',
        url: 'https://user:secret@git.example.com/beta/docs.git?token=abc123',
        ref: 'main',
        path: 'docs'
      }
    }, {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(intake.status).toBe('action-required');
    expect(intake.tenant.id).toBe('beta');
    expect(intake.account.canAddSite).toBe(true);
    expect(intake.billingAction.action).toBe('collect-payment');
    expect(intake.repository.errors).toContain('private repository hosting requires a private control-plane credential reference');
    expect(intake.domains.customDomains[0].status).toBe('pending_dns');
    expect(intake.nextActions).toEqual(expect.arrayContaining([
      'Send concierge payment link',
      'Create or attach the private repository credential reference.',
      'Create a webhook secret reference and install the push webhook.',
      'Verify DNS/TLS for docs.beta.example.com.'
    ]));
    expect(JSON.stringify(intake)).not.toContain('user:secret');
    expect(JSON.stringify(intake)).not.toContain('abc123');
  });

  test('blocks onboarding intake for duplicate tenant and domain conflicts', () => {
    const intake = buildManagedHostingOnboardingIntake([
      {
        id: 'acme',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        domains: ['docs.acme.com'],
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      }
    ], {
      tenantId: 'acme',
      accountId: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/other.git',
        ref: 'main'
      }
    }, {
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(intake.status).toBe('blocked');
    expect(intake.errors).toEqual(expect.arrayContaining([
      'tenant id acme already exists',
      'subdomain acme already maps to an existing tenant',
      'custom domain docs.acme.com already belongs to another tenant'
    ]));
    expect(intake.nextActions).toEqual(expect.arrayContaining([
      'Resolve before onboarding: tenant id acme already exists'
    ]));
  });

  test('generates wildcard and paid custom-domain Caddy routing', () => {
    const caddyfile = generateManagedHostingCaddyfile([
      { id: 'demo', plan: 'free', subdomain: 'demo' },
      { id: 'acme', plan: 'pro', domains: ['docs.acme.com'], paymentStatus: 'active' }
    ], {
      root: '/srv/pagenary/sites',
      wildcardDomain: '*.pagenary.app',
      email: 'ops@example.com'
    });

    expect(caddyfile).toContain('*.pagenary.app {');
    expect(caddyfile).toContain('root * /srv/pagenary/sites/{labels.2}');
    expect(caddyfile).toContain('docs.acme.com {');
    expect(caddyfile).toContain('root * /srv/pagenary/sites/acme');
    expect(caddyfile).not.toContain('demo.pagenary.app {');
    expect(caddyfile).toContain('Cache-Control "no-cache, must-revalidate"');
    expect(caddyfile).toContain('Cache-Control "public, max-age=31536000, immutable"');
  });

  test('builds a concierge checklist around the pinned in-repo build', () => {
    const checklist = buildConciergeOnboardingChecklist({
      id: 'acme',
      plan: 'pro',
      domains: ['docs.acme.com'],
      paymentStatus: 'manual-pending'
    });

    expect(checklist.join('\n')).toContain('Stripe Payment Link');
    expect(checklist.join('\n')).toContain('npm run build:tenants --workspace @pagenary/publisher -- acme');
    expect(checklist.join('\n')).toContain('dist/acme/');
    expect(checklist.join('\n')).toContain('Ask the customer to point docs.acme.com to acme.pagenary.app.');
  });

  test('builds customer-facing custom domain setup', () => {
    const setup = buildManagedHostingDomainSetup({
      id: 'acme',
      plan: 'pro',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com']
    });

    expect(setup.publicDomain.url).toBe('https://acme.pagenary.app');
    expect(setup.customDomains).toEqual([
      {
        domain: 'docs.acme.com',
        url: 'https://docs.acme.com',
        status: 'ready',
        records: [
          {
            type: 'CNAME',
            name: 'docs.acme.com',
            value: 'acme.pagenary.app',
            note: 'If this is an apex/root domain, use ALIAS/ANAME or CNAME flattening to the same target.'
          }
        ]
      }
    ]);
  });

  test('marks custom domains pending until DNS is verified', () => {
    const setup = buildManagedHostingDomainSetup({
      id: 'acme',
      plan: 'pro',
      domains: ['docs.acme.com']
    });

    expect(setup.customDomains[0].status).toBe('pending_dns');
  });

  test('applies verified domain events without provider internals', () => {
    const result = applyManagedHostingDomainEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com']
    }, {
      type: 'custom_domain.verified',
      domain: 'https://docs.acme.com/path',
      providerZoneId: 'zone-secret',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.verifiedDomains).toEqual(['docs.acme.com']);
    expect(result.domain.status).toBe('ready');
    expect(result.impact.previousStatus).toBe('configured');
    expect(result.impact.nextStatus).toBe('ready');
    expect(JSON.stringify(result)).not.toContain('zone-secret');
  });

  test('applies failed domain events with sanitized reasons', () => {
    const result = applyManagedHostingDomainEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com']
    }, {
      type: 'custom_domain.failed',
      domain: 'docs.acme.com',
      reason: 'provider check failed token=domain-secret',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.verifiedDomains).toEqual([]);
    expect(result.domain.status).toBe('pending_dns');
    expect(result.impact.warnings).toContain('provider check failed token=***');
    expect(JSON.stringify(result)).not.toContain('domain-secret');
  });

  test('blocks custom domain events for free tenants', () => {
    const result = applyManagedHostingDomainEvent({
      id: 'demo',
      plan: 'free',
      paymentStatus: 'free'
    }, {
      type: 'custom_domain.requested',
      domain: 'docs.example.com',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(false);
    expect(result.tenant.domains).toEqual([]);
    expect(result.domain.status).toBe('not_configured');
    expect(result.impact.errors).toContain('custom domains require Pro or Team');
  });

  test('applies active billing events without leaking provider internals', () => {
    const result = applyManagedHostingBillingEvent({
      id: 'acme',
      plan: 'free',
      paymentStatus: 'free'
    }, {
      type: 'subscription.active',
      plan: 'pro',
      paymentStatus: 'active',
      stripeCustomerId: 'cus_secret',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.plan).toBe('pro');
    expect(result.tenant.paymentStatus).toBe('active');
    expect(JSON.stringify(result)).not.toContain('cus_secret');
  });

  test('builds a ready billing action for active paid tenants', () => {
    const action = buildManagedHostingBillingAction({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      stripeCustomerId: 'cus_secret'
    }, {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(action.status).toBe('ready');
    expect(action.action).toBe('none');
    expect(action.canLaunchPaidFeatures).toBe(true);
    expect(action.privateControlPlane.required).toBe(false);
    expect(JSON.stringify(action)).not.toContain('cus_secret');
  });

  test('builds a concierge payment action for manual-pending paid tenants', () => {
    const action = buildManagedHostingBillingAction({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending'
    }, {
      requirePaidActivation: true,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(action.status).toBe('action-required');
    expect(action.action).toBe('collect-payment');
    expect(action.customerVisible.cta).toBe('Open payment link');
    expect(action.privateControlPlane.expectedAction).toBe('create-or-send-payment-link');
    expect(action.canLaunchPaidFeatures).toBe(false);
    expect(action.errors).toContain('Pro activation requires active payment status; current status is manual-pending');
  });

  test('builds recovery actions for past-due and canceled tenants', () => {
    const pastDue = buildManagedHostingBillingAction({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'past-due'
    });
    const canceled = buildManagedHostingBillingAction({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'canceled'
    });

    expect(pastDue.status).toBe('action-required');
    expect(pastDue.action).toBe('update-payment');
    expect(pastDue.privateControlPlane.expectedAction).toBe('create-or-send-billing-portal-link');
    expect(canceled.status).toBe('blocked');
    expect(canceled.action).toBe('reactivate');
    expect(canceled.privateControlPlane.expectedAction).toBe('create-reactivation-checkout');
  });

  test('downgrades canceled tenants and preserves suspended domains for recovery', () => {
    const result = applyManagedHostingBillingEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      privateRepo: true,
      whiteLabel: true,
      sso: true,
      siteCount: 3
    }, {
      type: 'subscription.canceled',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.plan).toBe('free');
    expect(result.tenant.paymentStatus).toBe('canceled');
    expect(result.tenant.domains).toEqual([]);
    expect(result.tenant.verifiedDomains).toEqual([]);
    expect(result.tenant.suspendedDomains).toEqual(['docs.acme.com']);
    expect(result.tenant.privateRepo).toBe(false);
    expect(result.tenant.siteCount).toBe(1);
    expect(result.impact.revoked.map((item) => item.feature)).toEqual(expect.arrayContaining([
      'customDomains',
      'privateRepos',
      'whiteLabel',
      'sso',
      'siteLimit'
    ]));
  });

  test('reports past-due billing events without disabling paid features immediately', () => {
    const result = applyManagedHostingBillingEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com']
    }, {
      type: 'subscription.past_due',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.plan).toBe('pro');
    expect(result.tenant.paymentStatus).toBe('past-due');
    expect(result.tenant.domains).toEqual(['docs.acme.com']);
    expect(result.impact.warnings.join('\n')).toContain('billing action');
  });

  test('builds dashboard-safe repository setup for private repos', () => {
    const setup = buildManagedHostingRepoSetup({
      id: 'acme',
      plan: 'pro',
      privateRepo: true,
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'https://user:secret@git.example.com/acme/docs.git?token=abc123',
        ref: 'main',
        path: 'docs'
      }
    });

    expect(setup.status).toBe('ready');
    expect(setup.buildCommand).toBe('npm run build:tenants --workspace @pagenary/publisher -- acme');
    expect(setup.webhook.events).toEqual(['push']);
    expect(setup.credentialRef).toBe('secret:CUSTOMER_DEPLOY_KEY/acme');
    expect(setup.source.url).not.toContain('secret');
    expect(setup.source.url).not.toContain('abc123');
    expect(setup.warnings.join('\n')).toContain('embedded credentials');
  });

  test('blocks private repo setup without a private credential reference', () => {
    const setup = buildManagedHostingRepoSetup({
      id: 'acme',
      plan: 'pro',
      privateRepo: true,
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    });

    expect(setup.status).toBe('blocked');
    expect(setup.errors).toContain('private repository hosting requires a private control-plane credential reference');
  });

  test('applies repository connection events without leaking provider values', () => {
    const result = applyManagedHostingRepoEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true
    }, {
      type: 'repository.connected',
      privateRepo: true,
      credentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      source: {
        type: 'git',
        url: 'https://user:private-token@git.example.com/acme/docs.git?token=source-secret',
        ref: 'main'
      },
      providerInstallationId: 'provider-secret',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.repoCredentialRef).toBe('secret:CUSTOMER_DEPLOY_KEY/acme');
    expect(result.repository.status).toBe('ready');
    expect(result.repository.warnings).toContain('webhook secret reference is missing; private control plane should create one before enabling push deploys');
    expect(result.privateControlPlane.nextActions).toContain('Create a webhook secret reference and install the push webhook.');
    expect(JSON.stringify(result)).not.toContain('private-token');
    expect(JSON.stringify(result)).not.toContain('source-secret');
    expect(JSON.stringify(result)).not.toContain('provider-secret');
  });

  test('applies webhook installed events to ready repository state', () => {
    const result = applyManagedHostingRepoEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      type: 'webhook.installed',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.tenant.webhookSecretRef).toBe('secret:WEBHOOK_SECRET/acme');
    expect(result.repository.status).toBe('ready');
    expect(result.privateControlPlane.nextActions).toEqual(['Repository connection is ready for push-triggered builds.']);
  });

  test('applies failed and disconnected repository events safely', () => {
    const failed = applyManagedHostingRepoEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      type: 'repository.failed',
      reason: 'webhook setup failed token=repo-secret',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });
    const disconnected = applyManagedHostingRepoEvent({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      },
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme'
    }, {
      type: 'repository.disconnected',
      effectiveAt: '2026-06-22T00:00:00.000Z'
    });

    expect(failed.ok).toBe(false);
    expect(failed.impact.errors).toContain('webhook setup failed token=***');
    expect(JSON.stringify(failed)).not.toContain('repo-secret');
    expect(disconnected.ok).toBe(false);
    expect(disconnected.tenant.source).toBeNull();
    expect(disconnected.privateControlPlane.nextActions).toEqual(['Reconnect the repository before enabling builds.']);
  });

  test('builds a dashboard-safe ready status record from static output', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-'));
    const site = path.join(cwd, 'dist', 'acme');
    await fs.mkdir(path.join(site, 'sections'), { recursive: true });
    await fs.mkdir(path.join(site, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(site, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(site, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(site, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(site, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(site, 'search-index', 'manifest.json'), '{}');

    const record = buildManagedHostingStatusRecord({
      id: 'acme',
      plan: 'pro',
      domains: ['docs.acme.com'],
      paymentStatus: 'active',
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'https://user:secret@git.example.com/acme/docs.git?token=abc123',
        ref: 'main',
        path: 'docs'
      }
    }, {
      cwd,
      commit: 'abc123',
      generatedAt: '2026-06-22T00:00:00.000Z',
      logUrl: 'https://git.example.com/run/1',
      requirePaidActivation: true
    });

    expect(record.status).toBe('ready');
    expect(record.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(record.domains.customDomains[0].status).toBe('ready');
    expect(record.repository.status).toBe('ready');
    expect(record.build.artifacts.ok).toBe(true);
    expect(record.build.artifacts.directories.sections.files).toBe(1);
    expect(record.source.url).not.toContain('secret');
    expect(record.source.url).not.toContain('abc123');
  });

  test('blocks status records when build artifacts are missing', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-missing-'));
    const record = buildManagedHostingStatusRecord({
      id: 'demo',
      plan: 'free',
      paymentStatus: 'free'
    }, {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('blocked');
    expect(record.errors).toEqual(expect.arrayContaining([
      'missing index.html',
      'missing sections/',
      'missing search-index/'
    ]));
  });

  test('builds a ready activation record for a paid tenant', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-ready-'));
    const site = path.join(cwd, 'dist', 'acme');
    await fs.mkdir(path.join(site, 'sections'), { recursive: true });
    await fs.mkdir(path.join(site, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(site, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(site, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(site, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(site, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(site, 'search-index', 'manifest.json'), '{}');

    const record = buildManagedHostingActivationRecord({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('ready');
    expect(record.launchUrl).toBe('https://acme.pagenary.app');
    expect(record.errors).toEqual([]);
    expect(record.checks.map((check) => [check.id, check.status])).toEqual(expect.arrayContaining([
      ['payment', 'ready'],
      ['repository', 'ready'],
      ['build', 'ready'],
      ['custom-domain:docs.acme.com', 'ready']
    ]));
  });

  test('blocks activation when launch gates are incomplete', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-blocked-'));
    const record = buildManagedHostingActivationRecord({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      privateRepo: true,
      domains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('blocked');
    expect(record.errors).toEqual(expect.arrayContaining([
      'paid Pro tenant must have active payment status before activation',
      'Pro activation requires active payment status; current status is manual-pending',
      'private repository hosting requires a private control-plane credential reference',
      'missing index.html',
      'custom domain docs.acme.com is pending_dns'
    ]));
    expect(record.checks.find((check) => check.id === 'payment').status).toBe('blocked');
    expect(record.checks.find((check) => check.id === 'repository').status).toBe('blocked');
  });

  test('builds a customer handoff after readiness passes', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-handoff-'));
    const site = path.join(cwd, 'dist', 'acme');
    await fs.mkdir(path.join(site, 'sections'), { recursive: true });
    await fs.mkdir(path.join(site, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(site, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(site, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(site, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(site, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(site, 'search-index', 'manifest.json'), '{}');

    const handoff = buildManagedHostingCustomerHandoff({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'https://user:secret@git.example.com/acme/docs.git?token=private-token-value',
        ref: 'main'
      }
    }, {
      cwd,
      commit: 'abc123',
      generatedAt: '2026-06-22T00:00:00.000Z',
      logUrl: 'https://git.example.com/run/1'
    });

    expect(handoff.status).toBe('ready');
    expect(handoff.subject).toContain('https://acme.pagenary.app');
    expect(handoff.liveUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(handoff.nextActions.join('\n')).toContain('Send the billing receipt');
    expect(handoff.build.logUrl).toBe('https://git.example.com/run/1');
    expect(JSON.stringify(handoff)).not.toContain('secret');
    expect(JSON.stringify(handoff)).not.toContain('private-token-value');
    expect(handoff.build.commit).toBe('abc123');
  });

  test('blocks customer handoff when readiness fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-handoff-blocked-'));
    const handoff = buildManagedHostingCustomerHandoff({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      domains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(handoff.status).toBe('blocked');
    expect(handoff.primaryUrl).toBeNull();
    expect(handoff.liveUrls).toEqual([]);
    expect(handoff.summary).toContain('do not tell the customer');
    expect(handoff.nextActions).toEqual(expect.arrayContaining([
      'Resolve before customer handoff: paid Pro tenant must have active payment status before activation',
      'Resolve before customer handoff: missing index.html'
    ]));
  });

  test('builds a registry overview for the control panel site list', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-overview-'));
    const site = path.join(cwd, 'dist', 'acme');
    await fs.mkdir(path.join(site, 'sections'), { recursive: true });
    await fs.mkdir(path.join(site, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(site, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(site, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(site, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(site, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(site, 'search-index', 'manifest.json'), '{}');

    const overview = buildManagedHostingRegistryOverview([
      {
        id: 'demo',
        plan: 'free',
        paymentStatus: 'free',
        source: {
          type: 'git',
          url: 'https://git.example.com/customer/demo-docs.git',
          ref: 'main'
        }
      },
      {
        id: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        privateRepo: true,
        domains: ['docs.acme.com'],
        verifiedDomains: ['docs.acme.com'],
        repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
        webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
        source: {
          type: 'git',
          url: 'ssh://git@git.example.com/acme/docs.git',
          ref: 'main'
        }
      }
    ], {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(overview.status).toBe('blocked');
    expect(overview.totals).toEqual({
      tenants: 2,
      ready: 1,
      blocked: 1,
      paid: 1
    });
    expect(overview.tenants.find((tenant) => tenant.tenantId === 'acme')).toMatchObject({
      status: 'ready',
      launchUrl: 'https://acme.pagenary.app',
      domainStatus: 'ready',
      buildStatus: 'ready'
    });
    expect(overview.tenants.find((tenant) => tenant.tenantId === 'demo')).toMatchObject({
      status: 'blocked',
      launchUrl: null,
      publicUrls: [],
      buildStatus: 'blocked'
    });
    expect(overview.tenants.find((tenant) => tenant.tenantId === 'demo').blockingChecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'build' })
    ]));
  });

  test('builds a publish plan after readiness passes', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-publish-'));
    const site = path.join(cwd, 'dist', 'acme');
    await fs.mkdir(path.join(site, 'sections'), { recursive: true });
    await fs.mkdir(path.join(site, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(site, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(site, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(site, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(site, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(site, 'search-index', 'manifest.json'), '{}');

    const plan = buildManagedHostingPublishPlan({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      commit: 'abc123',
      deployRoot: '/srv/pagenary/sites',
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(plan.status).toBe('ready');
    expect(plan.sourceDir).toBe(path.join(cwd, 'dist', 'acme'));
    expect(plan.targetDir).toBe('/srv/pagenary/sites/acme');
    expect(plan.backupDir).toBe('/srv/pagenary/sites/.releases/acme/abc123');
    expect(plan.commands.dryRun).toContain('rsync --dry-run');
    expect(plan.commands.publish).toContain('--delete');
    expect(plan.commands.publish).toContain("--exclude='node_modules/'");
    expect(plan.commands.backup).toContain('/srv/pagenary/sites/.releases/acme/abc123');
    expect(plan.commands.rollback).toContain('/srv/pagenary/sites/acme/');
    expect(plan.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
  });

  test('blocks publish plans when readiness fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-publish-blocked-'));
    const plan = buildManagedHostingPublishPlan({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      domains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(plan.status).toBe('blocked');
    expect(plan.commands).toBeNull();
    expect(plan.publicUrls).toEqual([]);
    expect(plan.notes).toEqual(expect.arrayContaining([
      'Resolve before publish: paid Pro tenant must have active payment status before activation',
      'Resolve before publish: missing index.html'
    ]));
  });

  test('verifies published output after sync', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-publish-result-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    for (const root of [source, target]) {
      await fs.mkdir(path.join(root, 'sections'), { recursive: true });
      await fs.mkdir(path.join(root, 'search-index'), { recursive: true });
      await fs.writeFile(path.join(root, 'index.html'), '<!doctype html>');
      await fs.writeFile(path.join(root, 'sitemap.xml'), '<urlset></urlset>');
      await fs.writeFile(path.join(root, 'robots.txt'), 'User-agent: *');
      await fs.writeFile(path.join(root, 'sections', 'intro.js'), 'export default {};');
      await fs.writeFile(path.join(root, 'search-index', 'manifest.json'), '{}');
    }

    const result = buildManagedHostingPublishResult({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      commit: 'abc123',
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.status).toBe('ready');
    expect(result.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(result.comparisons.every((comparison) => comparison.ok)).toBe(true);
    expect(result.rollbackCommand).toContain('.releases/acme/abc123');
  });

  test('blocks published output verification when target artifacts differ', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-publish-result-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await fs.mkdir(path.join(source, 'sections'), { recursive: true });
    await fs.mkdir(path.join(source, 'search-index'), { recursive: true });
    await fs.mkdir(path.join(target, 'sections'), { recursive: true });
    await fs.mkdir(path.join(target, 'search-index'), { recursive: true });
    await fs.writeFile(path.join(source, 'index.html'), '<!doctype html>');
    await fs.writeFile(path.join(source, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(source, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(source, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(source, 'search-index', 'manifest.json'), '{}');
    await fs.writeFile(path.join(target, 'index.html'), '<!doctype html>changed');
    await fs.writeFile(path.join(target, 'sitemap.xml'), '<urlset></urlset>');
    await fs.writeFile(path.join(target, 'robots.txt'), 'User-agent: *');
    await fs.writeFile(path.join(target, 'sections', 'intro.js'), 'export default {};');
    await fs.writeFile(path.join(target, 'search-index', 'manifest.json'), '{}');

    const result = buildManagedHostingPublishResult({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(result.status).toBe('blocked');
    expect(result.publicUrls).toEqual([]);
    expect(result.errors).toContain('target index.html does not match source');
    expect(result.comparisons.find((comparison) => comparison.path === 'index.html').ok).toBe(false);
  });

  test('builds a rollback plan when release backup artifacts exist', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-rollback-plan-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    const backup = path.join(cwd, 'sites', '.releases', 'acme', 'abc123');
    await writeStaticOutput(source);
    await writeStaticOutput(target);
    await writeStaticOutput(backup);

    const rollback = buildManagedHostingRollbackPlan({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      commit: 'abc123',
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(rollback.status).toBe('ready');
    expect(rollback.commands.rollback).toContain('.releases/acme/abc123');
    expect(rollback.commands.verify).toContain('diff -qr');
    expect(rollback.publicUrls).toEqual(['https://acme.pagenary.app']);
  });

  test('blocks rollback plans when release backups are missing', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-rollback-plan-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const rollback = buildManagedHostingRollbackPlan({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      commit: 'abc123',
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(rollback.status).toBe('blocked');
    expect(rollback.commands).toBeNull();
    expect(rollback.errors).toEqual(expect.arrayContaining([
      'backup missing index.html',
      'backup missing sitemap.xml',
      'backup missing robots.txt'
    ]));
  });

  test('builds a deploy manifest with cache and CDN invalidation rules', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-deploy-manifest-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const manifest = buildManagedHostingDeployManifest({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(manifest.status).toBe('ready');
    expect(manifest.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(manifest.upload.cacheRules).toContainEqual({
      path: '/index.html',
      cacheControl: 'no-cache, must-revalidate'
    });
    expect(manifest.upload.cacheRules).toContainEqual({
      path: '/*.js',
      cacheControl: 'public, max-age=31536000, immutable'
    });
    expect(manifest.cdn.invalidationPaths).toEqual([
      '/index.html',
      '/sitemap.xml',
      '/robots.txt',
      '/search-index/*',
      '/pages/*'
    ]);
  });

  test('blocks deploy manifests until publish verification passes', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-deploy-manifest-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target, { indexHtml: '<!doctype html>changed' });

    const manifest = buildManagedHostingDeployManifest({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(manifest.status).toBe('blocked');
    expect(manifest.upload.cacheRules).toEqual([]);
    expect(manifest.cdn.invalidationPaths).toEqual([]);
    expect(manifest.cdn.notes).toContain('Resolve before CDN invalidation: target index.html does not match source');
  });

  test('builds an artifact index for managed-hosting outputs', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-artifact-index-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const index = buildManagedHostingArtifactIndex({
      id: 'acme',
      accountId: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(index.status).toBe('ready');
    expect(index.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(index.files.map((file) => file.file)).toEqual([
      'pagenary-hosting-status.json',
      'pagenary-hosting-readiness.json',
      'pagenary-hosting-handoff.json',
      'pagenary-hosting-publish-plan.json',
      'pagenary-hosting-publish-result.json',
      'pagenary-hosting-rollback-plan.json',
      'pagenary-hosting-deploy-manifest.json',
      'pagenary-hosting-support-packet.json'
    ]);
    expect(index.files.find((file) => file.id === 'rollback-plan').status).toBe('blocked');
    expect(index.dependencies).toContainEqual({
      before: 'deploy-manifest',
      after: 'publish-result'
    });
  });

  test('blocks artifact indexes when publish verification fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-artifact-index-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target, { indexHtml: '<!doctype html>changed' });

    const index = buildManagedHostingArtifactIndex({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(index.status).toBe('blocked');
    expect(index.publicUrls).toEqual([]);
    expect(index.files.find((file) => file.id === 'publish-result').status).toBe('blocked');
    expect(index.files.find((file) => file.id === 'deploy-manifest').status).toBe('blocked');
    expect(index.errors).toContain('target index.html does not match source');
  });

  test('builds a support packet after publish verification passes', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-support-packet-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const packet = buildManagedHostingSupportPacket({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'https://user:private-token@git.example.com/acme/docs.git?token=token-secret',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      commit: 'abc123',
      logUrl: 'https://git.example.com/run/1',
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(packet.status).toBe('ready');
    expect(packet.account).toMatchObject({
      accountId: 'acme',
      sitesUsed: 1,
      canAddSite: true
    });
    expect(packet.billingAction).toMatchObject({
      status: 'ready',
      action: 'none',
      canLaunchPaidFeatures: true
    });
    expect(packet.customer.primaryUrl).toBe('https://acme.pagenary.app');
    expect(packet.customer.liveUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(packet.operator.publishStatus).toBe('ready');
    expect(packet.operator.rollbackCommand).toContain('.releases/acme/abc123');
    expect(packet.publish.result.comparisons.every((comparison) => comparison.ok)).toBe(true);
    expect(JSON.stringify(packet)).not.toContain('private-token');
    expect(JSON.stringify(packet)).not.toContain('token-secret');
    expect(packet.operator.commit).toBe('abc123');
  });

  test('blocks support packet live URLs when publish verification fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-support-packet-blocked-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target, { indexHtml: '<!doctype html>changed' });

    const packet = buildManagedHostingSupportPacket({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(packet.status).toBe('blocked');
    expect(packet.customer.primaryUrl).toBeNull();
    expect(packet.customer.liveUrls).toEqual([]);
    expect(packet.customer.summary).toContain('do not tell the customer');
    expect(packet.operator.blockers).toContain('target index.html does not match source');
    expect(packet.publish.result.publicUrls).toEqual([]);
  });

  test('includes billing action blockers in support packets', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-support-packet-billing-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const packet = buildManagedHostingSupportPacket({
      id: 'acme',
      accountId: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(packet.status).toBe('blocked');
    expect(packet.customer.liveUrls).toEqual([]);
    expect(packet.billingAction.action).toBe('collect-payment');
    expect(packet.billingAction.privateControlPlane.expectedAction).toBe('create-or-send-payment-link');
    expect(packet.customer.nextActions.join('\n')).toContain('Pro requires active payment before launch.');
    expect(packet.operator.blockers).toContain('Pro activation requires active payment status; current status is manual-pending');
  });

  test('builds account-scoped support packets and worker records', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-account-rollup-'));
    const source = path.join(cwd, 'dist', 'acme-docs');
    const target = path.join(cwd, 'sites', 'acme-docs');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const tenants = [
      {
        id: 'acme-docs',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        siteCount: 3,
        source: {
          type: 'git',
          url: 'https://git.example.com/acme/docs.git',
          ref: 'main'
        }
      },
      {
        id: 'acme-blog',
        accountId: 'acme',
        plan: 'pro',
        paymentStatus: 'active',
        siteCount: 3,
        source: {
          type: 'git',
          url: 'https://git.example.com/acme/blog.git',
          ref: 'main'
        }
      },
      {
        id: 'demo-site',
        accountId: 'demo',
        plan: 'pro',
        paymentStatus: 'active',
        siteCount: 2,
        source: {
          type: 'git',
          url: 'https://git.example.com/demo/docs.git',
          ref: 'main'
        }
      }
    ];

    const packet = buildManagedHostingSupportPacket(tenants[0], {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      tenants,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });
    expect(packet.account).toMatchObject({
      accountId: 'acme',
      sitesUsed: 6,
      canAddSite: false
    });
    expect(packet.account.errors).toContain('Pro allows 5 hosted sites; account uses 6');

    const record = buildManagedHostingWorkerRunRecord(tenants[0], {
      type: 'publish.succeeded',
      runId: 'run-4',
      commit: 'abc123',
      ref: 'main',
      logUrl: 'https://git.example.com/run/4',
      occurredAt: '2026-06-22T00:00:00.000Z'
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      tenants,
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.account.sitesUsed).toBe(6);
    expect(record.account.canAddSite).toBe(false);
    expect(record.account.errors).toContain('Pro allows 5 hosted sites; account uses 6');
    expect(record.operator.supportPacket.account.errors).toContain('Pro allows 5 hosted sites; account uses 6');
  });

  test('builds a worker run record for verified publish events', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-worker-event-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const record = buildManagedHostingWorkerRunRecord({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      domains: ['docs.acme.com'],
      verifiedDomains: ['docs.acme.com'],
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      type: 'publish.succeeded',
      runId: 'run-1',
      commit: 'abc123',
      ref: 'main',
      logUrl: 'https://git.example.com/run/1',
      occurredAt: '2026-06-22T00:00:00.000Z'
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('published');
    expect(record.customer.visibleStatus).toBe('live');
    expect(record.deploy.publicUrls).toEqual(['https://acme.pagenary.app', 'https://docs.acme.com']);
    expect(record.deploy.publishVerified).toBe(true);
    expect(record.account).toMatchObject({
      accountId: 'acme',
      canAddSite: true
    });
    expect(record.billingAction).toMatchObject({
      status: 'ready',
      action: 'none',
      canLaunchPaidFeatures: true
    });
    expect(record.operator.supportPacket.status).toBe('ready');
    expect(record.operator.supportPacket.account).toMatchObject({
      accountId: 'acme',
      canAddSite: true
    });
    expect(record.operator.supportPacket.billingAction.action).toBe('none');
  });

  test('blocks published worker records when paid activation is pending', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenary-hosting-worker-event-billing-'));
    const source = path.join(cwd, 'dist', 'acme');
    const target = path.join(cwd, 'sites', 'acme');
    await writeStaticOutput(source);
    await writeStaticOutput(target);

    const record = buildManagedHostingWorkerRunRecord({
      id: 'acme',
      accountId: 'acme',
      plan: 'pro',
      paymentStatus: 'manual-pending',
      source: {
        type: 'git',
        url: 'ssh://git@git.example.com/acme/docs.git',
        ref: 'main'
      }
    }, {
      type: 'publish.succeeded',
      runId: 'run-3',
      commit: 'abc123',
      ref: 'main',
      logUrl: 'https://git.example.com/run/3',
      occurredAt: '2026-06-22T00:00:00.000Z'
    }, {
      cwd,
      deployRoot: path.join(cwd, 'sites'),
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('blocked');
    expect(record.deploy.publicUrls).toEqual([]);
    expect(record.deploy.publishVerified).toBe(false);
    expect(record.billingAction.action).toBe('collect-payment');
    expect(record.operator.errors).toContain('Pro activation requires active payment status; current status is manual-pending');
    expect(record.operator.supportPacket.billingAction.privateControlPlane.expectedAction).toBe('create-or-send-payment-link');
    expect(record.operator.supportPacket.customer.liveUrls).toEqual([]);
  });

  test('builds a sanitized failed worker run record with log details', () => {
    const record = buildManagedHostingWorkerRunRecord({
      id: 'acme',
      plan: 'pro',
      paymentStatus: 'active',
      privateRepo: true,
      repoCredentialRef: 'secret:CUSTOMER_DEPLOY_KEY/acme',
      webhookSecretRef: 'secret:WEBHOOK_SECRET/acme',
      source: {
        type: 'git',
        url: 'https://user:private-token@git.example.com/acme/docs.git?token=source-secret',
        ref: 'main'
      }
    }, {
      type: 'build.failed',
      runId: 'run-2',
      commit: 'def456',
      ref: 'main',
      logUrl: 'https://git.example.com/run/2?token=log-secret',
      errors: ['build command exited 1; token=error-secret'],
      source: {
        type: 'git',
        url: 'https://user:event-token@git.example.com/acme/docs.git?access_token=event-secret',
        ref: 'main'
      }
    }, {
      generatedAt: '2026-06-22T00:00:00.000Z'
    });

    expect(record.status).toBe('failed');
    expect(record.customer.visibleStatus).toBe('action-required');
    expect(record.customer.liveUrls).toEqual([]);
    expect(record.build.logUrl).toBe('https://git.example.com/run/2?token=***');
    expect(record.operator.errors).toContain('build command exited 1; token=***');
    expect(record.operator.nextActions.join('\n')).toContain('Review worker log');
    expect(JSON.stringify(record)).not.toContain('private-token');
    expect(JSON.stringify(record)).not.toContain('source-secret');
    expect(JSON.stringify(record)).not.toContain('event-token');
    expect(JSON.stringify(record)).not.toContain('event-secret');
    expect(JSON.stringify(record)).not.toContain('log-secret');
    expect(JSON.stringify(record)).not.toContain('error-secret');
  });
});

async function writeStaticOutput(root, options = {}) {
  await fs.mkdir(path.join(root, 'sections'), { recursive: true });
  await fs.mkdir(path.join(root, 'search-index'), { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), options.indexHtml || '<!doctype html>');
  await fs.writeFile(path.join(root, 'sitemap.xml'), '<urlset></urlset>');
  await fs.writeFile(path.join(root, 'robots.txt'), 'User-agent: *');
  await fs.writeFile(path.join(root, 'sections', 'intro.js'), 'export default {};');
  await fs.writeFile(path.join(root, 'search-index', 'manifest.json'), '{}');
}
