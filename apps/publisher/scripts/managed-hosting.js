#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
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
  HOSTING_PLANS,
  validateManagedHostingTenant
} from './lib/managed-hosting.js';

function printHelp() {
  console.log([
    'pagenary managed-hosting — concierge hosting helpers',
    '',
    'Usage:',
    '  node scripts/managed-hosting.js plans',
    '  node scripts/managed-hosting.js validate <registry.json>',
    '  node scripts/managed-hosting.js account-usage <registry.json> [--account-id id] [--strict]',
    '  node scripts/managed-hosting.js dashboard-state <registry.json> --account-id id [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js overview <registry.json> [--dist-root dist] [--strict]',
    '  node scripts/managed-hosting.js caddy <registry.json>',
    '  node scripts/managed-hosting.js billing-action <registry.json> <tenant-id>',
    '  node scripts/managed-hosting.js billing-event <registry.json> <tenant-id> <event.json>',
    '  node scripts/managed-hosting.js domain-event <registry.json> <tenant-id> <event.json>',
    '  node scripts/managed-hosting.js site-event <registry.json> <event.json>',
    '  node scripts/managed-hosting.js onboarding-intake <registry.json> <request.json>',
    '  node scripts/managed-hosting.js repo-event <registry.json> <tenant-id> <event.json>',
    '  node scripts/managed-hosting.js domains <registry.json> <tenant-id> [--verified-domain domain]',
    '  node scripts/managed-hosting.js repo <registry.json> <tenant-id> [--credential-ref name] [--webhook-secret-ref name]',
    '  node scripts/managed-hosting.js readiness <registry.json> <tenant-id> [--dist-root dist] [--verified-domain domain]',
    '  node scripts/managed-hosting.js publish-plan <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js publish-check <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js rollback-plan <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path] [--commit sha]',
    '  node scripts/managed-hosting.js deploy-manifest <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js artifact-index <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js support-packet <registry.json> <tenant-id> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js worker-event <registry.json> <tenant-id> <event.json> [--dist-root dist] [--deploy-root path]',
    '  node scripts/managed-hosting.js status <registry.json> <tenant-id> [--dist-root dist] [--commit sha] [--log-url url]',
    '  node scripts/managed-hosting.js handoff <registry.json> <tenant-id> [--dist-root dist] [--verified-domain domain]',
    '  node scripts/managed-hosting.js checklist <registry.json> <tenant-id>',
    '',
    'The registry is a small public hosting contract used by concierge onboarding.',
    'Commerce automation, Stripe secrets, OAuth credentials, and customer data stay outside this repo.'
  ].join('\n'));
}

function readRegistry(file) {
  if (!file) throw new Error('registry path is required');
  const abs = path.resolve(process.cwd(), file);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function main() {
  const [, , command, registryPath, tenantId, ...rest] = process.argv;

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'plans') {
    console.log(JSON.stringify(Object.fromEntries(
      Object.keys(HOSTING_PLANS).map((plan) => [plan, getHostingEntitlements(plan)])
    ), null, 2));
    return;
  }

  const registry = readRegistry(registryPath);
  const tenants = registry.tenants || [];

  if (command === 'validate') {
    const results = tenants.map((tenant) => validateManagedHostingTenant(tenant, {
      requirePaidActivation: Boolean(registry.requirePaidActivation)
    }));
    for (const result of results) {
      if (result.ok) {
        console.log(`ok ${result.tenant.id} ${result.tenant.plan} https://${result.tenant.publicDomain}`);
      } else {
        console.error(`error ${result.tenant.id || '(missing id)'}: ${result.errors.join('; ')}`);
      }
    }
    if (results.some((result) => !result.ok)) process.exit(1);
    return;
  }

  if (command === 'account-usage') {
    const options = parseAccountUsageOptions([tenantId, ...rest].filter(Boolean));
    const record = buildManagedHostingAccountUsage(tenants, {
      accountId: options.accountId,
      requirePaidActivation: Boolean(registry.requirePaidActivation)
    });
    console.log(JSON.stringify(record, null, 2));
    if (options.strict && record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'dashboard-state') {
    const options = parseDashboardOptions([tenantId, ...rest].filter(Boolean));
    const record = buildManagedHostingDashboardState(tenants, {
      ...options,
      requirePaidActivation: Boolean(registry.requirePaidActivation)
    });
    console.log(JSON.stringify(record, null, 2));
    if (options.strict && record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'overview') {
    const options = parseOverviewOptions([tenantId, ...rest].filter(Boolean));
    const record = buildManagedHostingRegistryOverview(tenants, options);
    console.log(JSON.stringify(record, null, 2));
    if (options.strict && record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'caddy') {
    console.log(generateManagedHostingCaddyfile(tenants, registry.caddy || {}));
    return;
  }

  if (command === 'checklist') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    for (const item of buildConciergeOnboardingChecklist(tenant)) {
      console.log(`- ${item}`);
    }
    return;
  }

  if (command === 'domains') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseSharedOptions(rest);
    console.log(JSON.stringify(buildManagedHostingDomainSetup(tenant, options), null, 2));
    return;
  }

  if (command === 'billing-event') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const eventPath = rest[0];
    if (!eventPath) throw new Error('billing event path is required');
    const event = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), eventPath), 'utf8'));
    console.log(JSON.stringify(applyManagedHostingBillingEvent(tenant, event), null, 2));
    return;
  }

  if (command === 'onboarding-intake') {
    const requestPath = tenantId;
    if (!requestPath) throw new Error('onboarding intake request path is required');
    const request = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), requestPath), 'utf8'));
    const record = buildManagedHostingOnboardingIntake(tenants, request, {
      requirePaidActivation: Boolean(registry.requirePaidActivation),
      ...(registry.caddy || {})
    });
    console.log(JSON.stringify(record, null, 2));
    if (record.status === 'blocked') process.exit(1);
    return;
  }

  if (command === 'billing-action') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const record = buildManagedHostingBillingAction(tenant, {
      requirePaidActivation: Boolean(registry.requirePaidActivation)
    });
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'domain-event') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const eventPath = rest[0];
    if (!eventPath) throw new Error('domain event path is required');
    const event = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), eventPath), 'utf8'));
    console.log(JSON.stringify(applyManagedHostingDomainEvent(tenant, event, registry.caddy || {}), null, 2));
    return;
  }

  if (command === 'site-event') {
    const eventPath = tenantId;
    if (!eventPath) throw new Error('site event path is required');
    const event = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), eventPath), 'utf8'));
    const options = parseStatusOptions(rest);
    const record = applyManagedHostingSiteEvent(tenants, event, {
      ...options,
      requirePaidActivation: Boolean(registry.requirePaidActivation),
      ...(registry.caddy || {})
    });
    console.log(JSON.stringify({
      ...record,
      updatedRegistry: {
        ...registry,
        tenants: record.tenants
      }
    }, null, 2));
    if (record.status === 'blocked') process.exit(1);
    return;
  }

  if (command === 'repo-event') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const eventPath = rest[0];
    if (!eventPath) throw new Error('repository event path is required');
    const event = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), eventPath), 'utf8'));
    console.log(JSON.stringify(applyManagedHostingRepoEvent(tenant, event), null, 2));
    return;
  }

  if (command === 'repo') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseRepoOptions(rest);
    console.log(JSON.stringify(buildManagedHostingRepoSetup(tenant, options), null, 2));
    return;
  }

  if (command === 'status') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingStatusRecord(tenant, {
      ...options,
      requirePaidActivation: Boolean(registry.requirePaidActivation)
    });
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'readiness') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingActivationRecord(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'publish-plan') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingPublishPlan(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'publish-check') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingPublishResult(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'rollback-plan') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingRollbackPlan(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'deploy-manifest') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingDeployManifest(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'artifact-index') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingArtifactIndex(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'support-packet') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingSupportPacket(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  if (command === 'worker-event') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const eventPath = rest[0];
    if (!eventPath) throw new Error('worker event path is required');
    const event = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), eventPath), 'utf8'));
    const options = parseStatusOptions(rest.slice(1));
    const record = buildManagedHostingWorkerRunRecord(tenant, event, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status === 'blocked' || record.status === 'failed') process.exit(1);
    return;
  }

  if (command === 'handoff') {
    const tenant = tenants.find((entry) => entry.id === tenantId);
    if (!tenant) throw new Error(`tenant "${tenantId}" was not found`);
    const options = parseStatusOptions(rest);
    const record = buildManagedHostingCustomerHandoff(tenant, options);
    console.log(JSON.stringify(record, null, 2));
    if (record.status !== 'ready') process.exit(1);
    return;
  }

  throw new Error(`unknown command "${command}"`);
}

function parseStatusOptions(args) {
  const options = parseSharedOptions(args, false);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dist-root') options.distRoot = args[++i];
    else if (arg === '--commit') options.commit = args[++i];
    else if (arg === '--log-url') options.logUrl = args[++i];
    else if (arg === '--deploy-root') options.deployRoot = args[++i];
    else if (arg === '--credential-ref') options.credentialRef = args[++i];
    else if (arg === '--webhook-secret-ref') options.webhookSecretRef = args[++i];
    else if (arg === '--webhook-target') options.webhookTarget = args[++i];
    else if (arg === '--verified-domain' || arg === '--wildcard-target') i += 1;
    else throw new Error(`unknown status option "${arg}"`);
  }
  return options;
}

function parseRepoOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--credential-ref') options.credentialRef = args[++i];
    else if (arg === '--webhook-secret-ref') options.webhookSecretRef = args[++i];
    else if (arg === '--webhook-target') options.webhookTarget = args[++i];
    else throw new Error(`unknown repo option "${arg}"`);
  }
  return options;
}

function parseOverviewOptions(args) {
  const options = parseStatusOptions(args.filter((arg) => arg !== '--strict'));
  options.strict = args.includes('--strict');
  return options;
}

function parseAccountUsageOptions(args) {
  const options = { strict: args.includes('--strict') };
  const filtered = args.filter((arg) => arg !== '--strict');
  for (let i = 0; i < filtered.length; i += 1) {
    const arg = filtered[i];
    if (arg === '--account-id') options.accountId = filtered[++i];
    else throw new Error(`unknown account-usage option "${arg}"`);
  }
  return options;
}

function parseDashboardOptions(args) {
  const statusArgs = [];
  const options = { strict: args.includes('--strict') };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--account-id') options.accountId = args[++i];
    else if (arg !== '--strict') statusArgs.push(arg);
  }
  Object.assign(options, parseStatusOptions(statusArgs));
  if (!options.accountId) throw new Error('dashboard-state requires --account-id');
  return options;
}

function parseSharedOptions(args, rejectUnknown = true) {
  const options = { verifiedDomains: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--verified-domain') options.verifiedDomains.push(args[++i]);
    else if (arg === '--wildcard-target') options.wildcardTarget = args[++i];
    else if (rejectUnknown) throw new Error(`unknown option "${arg}"`);
  }
  return options;
}

try {
  main();
} catch (error) {
  console.error(`managed-hosting: ${error.message}`);
  process.exit(1);
}
