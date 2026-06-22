# Deployment Guide

Pagenary produces static files that can be served by any web server, CDN, or object storage.

## Quick Deploy

```bash
# Build a tenant to a specific directory
node scripts/build-tenants.js my-tenant --target /var/www/docs

# The output is ready to serve - no server setup required
```

## Build Options

### Custom Output Directory

```bash
# Override target for all tenants
node scripts/build-tenants.js --target /var/www/html

# Build specific tenant to custom location
node scripts/build-tenants.js my-docs --target /opt/docs/my-docs
```

### Build from Git Repository

Configure a git source in your registry:

```json
{
  "tenants": [
    {
      "id": "my-docs",
      "source": {
        "type": "git",
        "url": "https://github.com/org/my-docs.git",
        "ref": "main",
        "path": "docs/"
      },
      "target": {
        "type": "local",
        "path": "/var/www/my-docs"
      }
    }
  ]
}
```

Then build:
```bash
node scripts/build-tenants.js my-docs
```

### External Registry

Use a registry file from any location:

```bash
node scripts/build-tenants.js --registry /etc/pagenary/tenants.json
```

Or via environment variable:
```bash
TENANT_REGISTRY=/etc/pagenary/tenants.json node scripts/build-tenants.js
```

### Git Authentication

For private repositories:

```bash
# SSH key
GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy_key" node scripts/build-tenants.js

# HTTPS token
GIT_CREDENTIALS="username:token" node scripts/build-tenants.js

# Disable interactive prompts (recommended for CI)
GIT_TERMINAL_PROMPT=0 node scripts/build-tenants.js
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Build Docs
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Build documentation
        run: node scripts/build-tenants.js my-docs --target ./output

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: docs
          path: output/
```

### GitLab CI

```yaml
build-docs:
  image: node:20
  script:
    - npm ci
    - node scripts/build-tenants.js my-docs --target ./public
  artifacts:
    paths:
      - public/
```

### Incremental Builds

For faster CI builds with git-based sources:

```bash
# Only rebuild changed content
node scripts/build-tenants.js my-docs --incremental --keep-cache

# Show what changed without building
node scripts/build-tenants.js my-docs --diff-only
```

## Hosting Patterns

### Static File Servers

The build output is self-contained. Serve with any static server:

```bash
# Python
python -m http.server 8080 -d /var/www/my-docs

# Node.js (npx)
npx serve /var/www/my-docs

# Caddy
caddy file-server --root /var/www/my-docs --listen :8080
```

### Nginx

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/my-docs;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Caddy

```caddyfile
docs.example.com {
    root * /var/www/my-docs
    file_server
    try_files {path} /index.html

    @static path *.js *.css *.png *.jpg *.ico
    header @static Cache-Control "public, max-age=31536000, immutable"
}
```

### S3 + CloudFront

1. Create S3 bucket with static website hosting
2. Upload build output:
   ```bash
   aws s3 sync /var/www/my-docs s3://my-docs-bucket/
   ```
3. Create CloudFront distribution pointing to S3
4. Set default root object to `index.html`
5. Configure error pages to return `index.html` for 404s (for hash routing)

### Netlify / Vercel

1. Point to your repository
2. Build command: `node scripts/build-tenants.js my-docs --target ./dist`
3. Publish directory: `dist/`

## Multi-Tenant Deployment

### Single Server, Multiple Tenants

Build all tenants to subdirectories:

```bash
node scripts/build-tenants.js --target /var/www/docs
# Creates /var/www/docs/tenant-a/, /var/www/docs/tenant-b/, etc.
```

Nginx config:
```nginx
server {
    listen 80;
    root /var/www/docs;

    location ~ ^/([^/]+)/ {
        try_files $uri $uri/ /$1/index.html;
    }
}
```

### Domain-Based Routing

Each tenant gets its own domain:

```caddyfile
tenant-a.example.com {
    root * /var/www/docs/tenant-a
    file_server
    try_files {path} /index.html
}

tenant-b.example.com {
    root * /var/www/docs/tenant-b
    file_server
    try_files {path} /index.html
}
```

## Cache Strategy

Pagenary emits **stable filenames** (`styles.css`, `sections/<id>.js`,
`assets/*`) — they are *not* content-addressed. The shell `index.html` is only
the entry point; the visible pages are loaded later from JavaScript section
modules such as `sections/overview.js`. If a CDN keeps one of those stable URLs
fresh for a long time, readers can get a fresh shell that still imports an old
virtual page module.

Do **not** serve stable Pagenary JS/CSS/assets as long-lived `immutable` files.
Pick one of these deployment profiles:

### Profile A: no CDN purge, short revalidation

This is the safest CDN-neutral default. It works with Cloudflare, Fastly,
CloudFront, nginx caches, and most static hosts that honor HTTP caching headers.

| Asset | Recommended policy |
|-------|-------------|
| `index.html` | `Cache-Control: no-cache, must-revalidate` |
| `app.js`, `manifest.js`, `styles.css`, `sections/*.js`, `docs-map-data.js` | `Cache-Control: public, max-age=300, must-revalidate` |
| `search-index/*.json` | `Cache-Control: public, max-age=300, must-revalidate` |
| `pages/*.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, collection feeds | `Cache-Control: public, max-age=300, must-revalidate` |
| tenant `assets/*` | `Cache-Control: public, max-age=300, must-revalidate` unless you version asset URLs yourself |

Add `ETag` headers when your server supports them. ETags make revalidation cheap:
after `max-age` expires, the CDN can ask the origin whether a file changed and
receive `304 Not Modified` instead of downloading the full file again. ETags do
not force a CDN to check origin while the object is still fresh, so they must be
paired with `no-cache` or a short `max-age`.

Avoid `stale-while-revalidate` for Pagenary's stable JS/CSS/page assets unless
you are comfortable serving old virtual pages while the CDN refreshes in the
background.

### Profile B: purge on deploy

If you need longer edge TTLs without changing filenames, purge the CDN cache
after each successful deploy. This keeps runtime URLs stable but requires
provider-specific credentials and operational wiring.

For docs.pagenary.com, `.gitea/workflows/docsite-deploy.yml` can purge
Cloudflare when `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` are configured.
Other CDNs have equivalent invalidation APIs.

### Profile C: content-addressed URLs

The high-performance no-purge model is content-addressed filenames, for example
`sections/overview.a1b2c3d4.js` and `styles.98f6e2.css`. With that output shape,
changed content gets a new URL and unchanged content can use:

```http
Cache-Control: public, max-age=31536000, immutable
```

Keep `index.html` and any small URL-manifest files on `no-cache` or a short TTL
so clients discover the new hashed URLs. Pagenary does not currently emit
content-addressed runtime filenames by default.

## Monitoring

### Health Check

Create a simple health endpoint by checking for `index.html`:

```bash
curl -f https://docs.example.com/ || exit 1
```

### Build Verification

After deployment, verify the build:

```bash
# Check response
curl -I https://docs.example.com/

# Verify content
curl -s https://docs.example.com/ | grep -q "manifest.js"
```
