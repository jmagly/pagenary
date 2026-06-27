# Managed Hosting MVP

Pagenary managed hosting starts concierge-first: take the first subscription,
connect the customer's docs repository, build the static bundle, and serve it
from the shared hosting origin. The public repository owns the static publisher,
the tenant contract, cache rules, and routing examples. Payment secrets, OAuth
apps, customer records, and any self-serve control-plane code should live in the
private hosting/control-plane repository.

## Product Slice

Plans are intentionally small for the first recurring product:

| Plan | Price | Included | Gate |
| --- | ---: | --- | --- |
| Free | $0/mo | 1 public site on `name.pagenary.app` | No custom domain or private repo |
| Pro | $19/mo | Up to 5 sites, custom domains, private repos | Stripe Payment Link or checkout active |
| Team | $49+/mo | Up to 25 sites, white-label, SSO-ready flag | Stripe subscription active |

The implementation source of truth is
[`scripts/lib/managed-hosting.js`](../scripts/lib/managed-hosting.js). It
exports plan entitlements, tenant validation, Caddy generation, and the
concierge onboarding checklist used below.

## Concierge Onboarding

1. Create or update a hosting registry entry like
   [`examples/managed-hosting.tenants.json`](../examples/managed-hosting.tenants.json).
2. For Pro/Team, collect payment with the Stripe Payment Link and mark
   `paymentStatus` as `active` in the private control-plane data.
3. Add a customer deploy key or OAuth connection for the docs repository.
4. Register the repository webhook so pushes trigger the build worker.
5. Build with the pinned in-repo command:
   `npm run build:tenants --workspace @pagenary/publisher -- <tenant-id>`.
6. Sync `apps/publisher/dist/<tenant-id>/` to the origin/object-store path.
7. Verify `index.html`, `sections/`, `search-index/`, `sitemap.xml`, and
   `robots.txt` at the live URL.

Generate the checklist for a tenant:

```bash
node apps/publisher/scripts/managed-hosting.js checklist \
  apps/publisher/examples/managed-hosting.tenants.json acme
```

## Build And Deploy Worker

The example worker
[`examples/managed-hosting-gitea.yml`](../examples/managed-hosting-gitea.yml)
shows the public contract for issue #46:

- validate the hosting registry before a deploy
- build one tenant with `scripts/build-tenants.js`
- fail if the output lacks `index.html`, `sections/`, or `search-index/`
- write `pagenary-hosting-status.json` for the future control panel
- write `pagenary-hosting-readiness.json` and stop before sync unless launch
  readiness is `ready`
- write `pagenary-hosting-publish-plan.json` with the dry-run, backup, publish,
  and rollback commands for the private worker
- sync only the static output to the hosting origin
- write `pagenary-hosting-publish-result.json` after sync to verify the target
  path has matching required artifacts

Keep the real worker in the private hosting/control-plane repo because it owns
customer secrets, deploy keys, billing state, and webhook registration.

Inspect the public repository connection contract:

```bash
node apps/publisher/scripts/managed-hosting.js repo \
  apps/publisher/examples/managed-hosting.tenants.json acme
```

The repo output is safe for a dashboard: it includes sanitized source metadata,
the expected build command, push webhook expectations, and references to private
credential/webhook-secret records. It never includes deploy keys, OAuth tokens,
or webhook secret values.

Translate private repository setup into public tenant state:

```bash
node apps/publisher/scripts/managed-hosting.js repo-event \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  apps/publisher/examples/managed-hosting-repo-connected.json
```

Accepted repository event types are `repository.connected`,
`webhook.installed`, `repository.failed`, and `repository.disconnected`. The
result previews updated tenant source/credential references, repository status,
warnings, and private next actions. It does not include provider installation
payloads, deploy key material, OAuth tokens, webhook secret values, or raw
webhook payloads.

Generate the same status record locally after a build:

```bash
node apps/publisher/scripts/managed-hosting.js status \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --commit "$(git rev-parse HEAD)" \
  --log-url "https://git.example.com/org/repo/actions/runs/123" \
  --verified-domain docs.acme.com
```

The record is intentionally safe to expose to a thin dashboard: it contains the
tenant id, plan, public URLs, sanitized source metadata, repository readiness,
build log URL, commit, and artifact checks. It does not contain deploy keys,
OAuth tokens, Stripe customer ids, or payment secrets.

Run the go-live readiness gate before enabling a tenant:

```bash
node apps/publisher/scripts/managed-hosting.js readiness \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com
```

The readiness output aggregates the tenant validation, active paid subscription
requirement, repository connection, build artifacts, public subdomain, and
custom-domain DNS state into a single `ready` or `blocked` decision. This is the
public contract the first private control panel can consume before showing an
operator or customer that hosting is live. The example worker writes this to
`pagenary-hosting-readiness.json` immediately before sync; a blocked readiness
command exits non-zero so incomplete tenants do not get published as live.

Generate a customer-safe concierge handoff after readiness passes:

```bash
node apps/publisher/scripts/managed-hosting.js handoff \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com
```

The handoff record includes the customer-facing subject, live URLs, plan/payment
state, public DNS instructions, build log link, and next actions. It is derived
from the same readiness gate and uses sanitized repository metadata, so it is
safe to feed into a launch email or first dashboard page. If readiness is
blocked, the command exits non-zero and returns operator actions instead of live
URLs.

Generate an operator/control-panel overview for all tenants:

```bash
node apps/publisher/scripts/managed-hosting.js overview \
  apps/publisher/examples/managed-hosting.tenants.json
```

The overview record summarizes total tenants, ready tenants, blocked tenants,
paid tenants, and one dashboard-safe row per tenant. Each row includes plan,
payment state, repository status, build status, domain status, live URLs only
when ready, and blocking checks. Add `--strict` when automation should fail if
any tenant is blocked.

Preview a new tenant before the private control panel provisions anything:

```bash
node apps/publisher/scripts/managed-hosting.js onboarding-intake \
  apps/publisher/examples/managed-hosting.tenants.json \
  apps/publisher/examples/managed-hosting-onboarding-pro.json
```

The onboarding intake record validates the requested tenant id, account id,
plan, repo source, custom domains, and account site capacity. It returns the
proposed tenant preview, billing action, repository requirements, DNS setup,
checklist, and next private-control-plane actions. It does not create customer
records, Stripe sessions, deploy keys, webhooks, DNS records, or TLS state.

Apply a private control-panel site lifecycle event to the public registry
contract:

```bash
node apps/publisher/scripts/managed-hosting.js site-event \
  apps/publisher/examples/managed-hosting.tenants.json \
  apps/publisher/examples/managed-hosting-site-created.json
```

Accepted event types are `site.created` and `site.removed`. The result returns
an `updatedRegistry` preview, account capacity after the change, and any
operator cleanup or provisioning actions. `site.created` reuses the onboarding
intake checks, so it blocks duplicate tenants, domain conflicts, site-limit
overages, and unpaid paid-plan activation before adding a tenant to the
registry. `site.removed` removes the tenant and emits cleanup actions for the
private deploy target and DNS/TLS routing.

Check account/site usage before the control panel adds another hosted site:

```bash
node apps/publisher/scripts/managed-hosting.js account-usage \
  apps/publisher/examples/managed-hosting.tenants.json \
  --account-id acme \
  --strict
```

The account usage record groups tenants by `accountId`, applies the active
Free/Pro/Team site limit, reports sites used/remaining, and returns
`canAddSite=false` when the plan is full or blocked. It is safe for the private
control panel to call before creating another tenant record; customer identity,
Stripe subscriptions, and billing portal state still live outside this public
registry.

Generate the account-level dashboard state for the minimal control panel:

```bash
node apps/publisher/scripts/managed-hosting.js dashboard-state \
  apps/publisher/examples/managed-hosting.tenants.json \
  --account-id acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The dashboard state combines account capacity, tenant readiness, repository
status, domain status, billing action, customer visibility, publish
verification, and operator next actions for a single account. It is still a
sanitized public contract: Stripe sessions, OAuth tokens, deploy keys, webhook
secrets, and customer identity records stay in the private control plane. Add
`--strict` when the dashboard or worker should fail on any blocked tenant.

Generate a publish plan after readiness passes:

```bash
node apps/publisher/scripts/managed-hosting.js publish-plan \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The publish plan contains the tenant source directory, target directory,
release backup path, dry-run command, backup command, publish command, rollback
command, and public URLs. It is intended for the private worker to execute with
deploy credentials after readiness passes. If readiness is blocked, the command
exits non-zero and emits operator actions instead of publish commands.

Generate a rollback plan when a release backup exists:

```bash
node apps/publisher/scripts/managed-hosting.js rollback-plan \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --commit abc123 \
  --deploy-root /srv/pagenary/sites
```

The rollback plan verifies the expected `.releases/<tenant>/<commit>/` backup
contains the required static artifacts before emitting rollback and verify
commands. Missing backups block the rollback plan but do not block a normal
launch; rollback is a recovery artifact for the private worker/dashboard to
offer only when a backup is actually present.

Verify the publish result after sync:

```bash
node apps/publisher/scripts/managed-hosting.js publish-check \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The publish check compares required source and target artifacts, including
`index.html`, `sitemap.xml`, `robots.txt`, `sections/`, and `search-index/`.
It emits public URLs only when readiness is ready and the target path matches
the built output. Otherwise it exits non-zero with explicit target mismatch or
missing-artifact errors and a rollback command when available.

Emit a deployment/CDN manifest after publish verification:

```bash
node apps/publisher/scripts/managed-hosting.js deploy-manifest \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The deploy manifest is the machine-readable handoff for the private
object-store/CDN worker. It reuses publish verification, then emits required
artifacts, cache-control rules, public URLs, and CDN invalidation paths. HTML,
robots, sitemap, search index, and generated page metadata are invalidated after
sync; fingerprinted JS/CSS remain immutable. When verification is blocked, the
manifest exits non-zero and withholds cache rules and invalidation paths.

Write a public artifact index for dashboard ingestion:

```bash
node apps/publisher/scripts/managed-hosting.js artifact-index \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The artifact index lists the expected managed-hosting JSON files for a tenant,
their current statuses, and the dependency order between status, readiness,
publish, deploy, support, and customer-handoff records. It is useful when a
worker writes several public artifacts and the control panel wants one small
index to decide which records are ready to load. Live URLs appear only when the
support packet is ready.

Generate a single support/control-panel packet after sync:

```bash
node apps/publisher/scripts/managed-hosting.js support-packet \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

The support packet combines account usage, billing action, customer handoff,
operator checklist, readiness checks, publish plan, and publish result into one
sanitized record. It exposes live URLs only when publish verification is ready,
so the private dashboard and concierge support flow can share a single "safe to
tell the customer" gate. Repository credentials, webhook secrets, Stripe ids,
and raw payment payloads remain outside this artifact.

Emit a dashboard-safe worker run event from the private build/deploy worker:

```bash
node apps/publisher/scripts/managed-hosting.js worker-event \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  apps/publisher/examples/managed-hosting-worker-publish.json \
  --verified-domain docs.acme.com \
  --deploy-root /srv/pagenary/sites
```

Accepted event types are `repo.push`, `build.queued`, `build.started`,
`build.succeeded`, `build.failed`, `publish.started`, `publish.succeeded`, and
`publish.failed`. The worker record includes run id, stage, dashboard status,
sanitized source metadata, account usage, billing action, commit/ref, log URL,
operator errors, and customer visibility. `publish.succeeded` still runs the
publish verification gate before exposing live URLs, and the embedded support
packet includes the same account and billing state for private-dashboard launch
decisions. Failed events exit non-zero and preserve the log URL and sanitized
error messages for the dashboard.

## Domains And Cache Headers

Generate Caddy routing for the public subdomain plus paid custom domains:

```bash
node apps/publisher/scripts/managed-hosting.js caddy \
  apps/publisher/examples/managed-hosting.tenants.json
```

The generated Caddyfile routes `*.pagenary.app` by subdomain and emits separate
blocks for paid custom domains. Cache policy matches the publisher's
content-addressed output:

- `index.html`: `no-cache, must-revalidate`
- hashed JS/CSS assets: `public, max-age=31536000, immutable`
- search/page discovery files: short revalidation

Free tenants can use `name.pagenary.app`. Custom domains require Pro or Team.

Generate customer-facing DNS setup instructions:

```bash
node apps/publisher/scripts/managed-hosting.js domains \
  apps/publisher/examples/managed-hosting.tenants.json acme
```

Custom domains are reported as `pending_dns` until the private control plane or
operator passes `--verified-domain <domain>` (or persists `verifiedDomains` in
the private tenant record). The public contract only describes the expected DNS
record: point the custom host at the tenant's `name.pagenary.app` hostname. DNS
lookups, challenge tokens, registrar APIs, and TLS state stay in the private
hosting environment.

Translate a private DNS/TLS verification result into public tenant state:

```bash
node apps/publisher/scripts/managed-hosting.js domain-event \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  apps/publisher/examples/managed-hosting-domain-verified.json
```

Accepted domain event types are `custom_domain.requested`,
`custom_domain.verified`, `custom_domain.failed`, and
`custom_domain.removed`. The result updates `domains`/`verifiedDomains` in the
returned tenant preview, emits the customer-facing DNS setup status, and keeps
provider zone ids, registrar credentials, challenge tokens, and TLS API details
out of the public contract. A failed event removes the domain from
`verifiedDomains` and returns an operator warning; a verified event marks the
domain `ready` only when the tenant's plan allows custom domains.

## Billing Event Contract

Generate the dashboard-safe billing action for a tenant:

```bash
node apps/publisher/scripts/managed-hosting.js billing-action \
  apps/publisher/examples/managed-hosting.tenants.json acme
```

The billing action record maps public plan/payment state to a customer-visible
state and an operator/private-control-plane action: `none`, `collect-payment`,
`update-payment`, `reactivate`, or `contact-support`. It can drive the first
dashboard's payment banner or concierge checklist without exposing Stripe
customer ids, subscription ids, checkout sessions, webhook payloads, payment
link URLs, or customer portal URLs.

The private Stripe layer should translate webhook payloads into a small,
sanitized event before touching the public tenant contract. The event never
contains Stripe customer ids, subscription ids, signatures, or raw webhook
payloads.

```json
{
  "type": "subscription.active",
  "plan": "pro",
  "paymentStatus": "active",
  "effectiveAt": "2026-06-22T00:00:00.000Z"
}
```

Preview how an event changes a tenant:

```bash
node apps/publisher/scripts/managed-hosting.js billing-event \
  apps/publisher/examples/managed-hosting.tenants.json acme \
  apps/publisher/examples/managed-hosting-billing-cancel.json
```

Cancellation downgrades the tenant to Free, disables paid-only flags, removes
active custom domains, and preserves them under `suspendedDomains` so an operator
can restore them after payment recovery. Past-due events leave paid features
configured but report a warning for the private dashboard to show a billing
action.

## Control Panel Boundary

The first self-serve control panel can be thin:

- sign up or log in through the shared Integro Cloud auth layer
- create a site record with `id`, `subdomain`, `plan`, and repo source
- preview onboarding intake before private provisioning starts
- show the tenant overview list with ready/blocked counts and blockers
- check account/site usage before enabling the "add site" flow
- show repo connection readiness and webhook setup status
- apply sanitized repository connection/webhook events from the private control
  plane
- show latest build status/log link from `pagenary-hosting-status.json`
- show the aggregate managed-hosting readiness gate before launch
- show the publish plan before the private worker syncs static output
- show the publish result after sync and surface rollback when verification
  fails
- show the support packet as the single concierge/customer-support status view
- show worker run status/log events for build and publish progress
- generate a customer-safe launch handoff after readiness passes
- link to Stripe billing/customer portal
- show billing action state before launch or recovery
- apply sanitized billing events from the private Stripe handler
- enforce the public entitlements from `managed-hosting.js`

That application should call these helpers or share the same contract, but the
control panel itself does not need to live in this AGPL publisher package.
