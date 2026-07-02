# Deployment Guide

Pagenary produces static files that can be served by any web server, CDN, or object storage.

All builds run through the **`pagenary`** CLI — the one supported interface. It
works the same way whether Pagenary is installed (`pagenary …`), run via npx
(`npx pagenary …` / `npx @pagenary/publisher …`), or invoked from source
(`npm run build` delegates to it). Run `pagenary --help` to see every command.

## Quick Deploy

```bash
# Build a tenant to a specific directory
pagenary build my-tenant --target /var/www/docs

# The output is ready to serve - no server setup required
```

## Build Options

### Custom Output Directory

```bash
# Override target for all tenants
pagenary build --all --target /var/www/html

# Build specific tenant to custom location
pagenary build my-docs --target /opt/docs/my-docs
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
pagenary build my-docs
```

### External Registry

Use a registry file from any location:

```bash
pagenary build --all --registry /etc/pagenary/tenants.json
```

Or via environment variable:
```bash
TENANT_REGISTRY=/etc/pagenary/tenants.json pagenary build --all
```

### Git Authentication

For private repositories:

```bash
# SSH key
GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy_key" pagenary build --all

# HTTPS token
GIT_CREDENTIALS="username:token" pagenary build --all

# Disable interactive prompts (recommended for CI)
GIT_TERMINAL_PROMPT=0 pagenary build --all
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
        run: npx pagenary build my-docs --target ./output

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
    - npx pagenary build my-docs --target ./public
  artifacts:
    paths:
      - public/
```

### Incremental Builds

For faster CI builds with git-based sources:

```bash
# Only rebuild changed content
pagenary build my-docs --incremental --keep-cache

# Show what changed without building
pagenary build my-docs --diff-only
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
2. Build command: `npx pagenary build my-docs --target ./dist`
3. Publish directory: `dist/`

## Multi-Tenant Deployment

### Single Server, Multiple Tenants

Build all tenants to subdirectories:

```bash
pagenary build --all --target /var/www/docs
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

By default, Pagenary resolves runtime assets from the directory that served
`index.html`, so a base-less build can move between `/`, `/docs/`, and other
subpath mounts. If a tenant must be hard-pinned to one subpath, configure
`basePath` so the generated `<base href>` points at the public mount:

```json
{
  "tenants": [
    {
      "id": "fortemi-react-docs",
      "basePath": "/react/",
      "source": { "type": "local", "path": "./tenants/fortemi-react-docs" },
      "target": { "type": "local", "path": "./dist/fortemi-react-docs" }
    }
  ]
}
```

When the same tenant is deployed to more than one mount, keep committed config
portable and set the base at launch time:

```bash
pagenary build fortemi-docs --base /server
PAGENARY_BASE=/docs pagenary build fortemi-docs
PAGENARY_BASE=auto pagenary build fortemi-docs
```

For local preview of a deploy-oriented build, serve it at the matching mount:

```bash
pagenary serve --mount /server
```

## Cache Strategy

Pagenary emits content-addressed runtime URLs by default. The shell `index.html`
is only the entry point; the visible pages are loaded later from JavaScript
section modules such as `sections/overview.<hash>.js`. When a page, stylesheet,
docs-map artifact, search-index part, or copied tenant asset changes, its hashed
URL changes too. Unchanged files keep the same URL and remain cache-efficient.

The build keeps stable compatibility files such as `app.js`, `manifest.js`, and
`sections/<id>.js` on disk, but generated runtime references use the hashed
files. Keep the HTML entrypoint fresh so clients discover new hashed URLs.

### Default profile: content-addressed runtime URLs

This is the recommended CDN-neutral profile. It works with Cloudflare, Fastly,
CloudFront, nginx caches, and most static hosts that honor HTTP caching headers.

| Asset | Recommended policy |
|-------|-------------|
| `index.html` | `Cache-Control: no-cache, must-revalidate` |
| content-hashed JS/CSS/assets/search parts | `Cache-Control: public, max-age=31536000, immutable` |
| stable compatibility files (`app.js`, `manifest.js`, `sections/<id>.js`) | `Cache-Control: public, max-age=300, must-revalidate` or bypass if no direct clients use them |
| lightweight discovery manifests (`search-index/manifest.json`, `search-index/metadata.json`) | `Cache-Control: public, max-age=300, must-revalidate` |
| `pages/*.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, collection feeds | `Cache-Control: public, max-age=300, must-revalidate` |

Add `ETag` headers when your server supports them. ETags make revalidation cheap:
after `max-age` expires, the CDN can ask the origin whether a file changed and
receive `304 Not Modified` instead of downloading the full file again. ETags do
not force a CDN to check origin while the object is still fresh, so they must be
paired with `no-cache` or a short `max-age`.

Avoid `stale-while-revalidate` for `index.html`, stable compatibility files, and
lightweight URL manifests unless you are comfortable serving an old URL map while
the CDN refreshes in the background.

### Legacy profile: stable filenames

Set `cacheStrategy: "stable"` only when legacy hosting or tooling requires
unversioned runtime filenames. In stable mode, do **not** serve Pagenary
JS/CSS/assets as long-lived `immutable` files:

| Asset | Recommended policy |
|-------|-------------|
| `index.html` | `Cache-Control: no-cache, must-revalidate` |
| `app.js`, `manifest.js`, `styles.css`, `sections/*.js`, `docs-map-data.js`, `assets/*` | `Cache-Control: public, max-age=300, must-revalidate` |
| `search-index/*.json` | `Cache-Control: public, max-age=300, must-revalidate` |

### Purge on deploy

If you need long edge TTLs with stable runtime filenames, purge the CDN cache
after each successful deploy. This keeps runtime URLs stable but requires
provider-specific credentials and operational wiring.

For docs.pagenary.com, `.gitea/workflows/docsite-deploy.yml` can purge
Cloudflare when `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` are configured.
Other CDNs have equivalent invalidation APIs.

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
