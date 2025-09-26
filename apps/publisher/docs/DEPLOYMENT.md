# Deployment Guide

Docs Toolkit ships as static files. Any platform that can serve HTML, CSS, and JavaScript works—object storage, CDN, static site hosts, or a minimal container.

## Build Artifacts
1. `npm run build`
2. Assets land in `dist/`
3. Upload the folder contents as-is

The router uses hash fragments, so every request can safely return `index.html` without server-side routing rules.

## Hosting Patterns
- **S3 + CloudFront / GCS + Cloud CDN** – upload `dist/`, configure default root object, enable compression.
- **Static Hosts (Netlify, Vercel, Render)** – drop the folder or point to the build command `npm run build` with `dist/` as output.
- **Containerized** – wrap `dist/` with Caddy, Nginx, or http-server for air-gapped environments.

## Cache Strategy
- Fingerprint uploads or version folders per release
- Cache `*.js`/`*.css` aggressively; set `index.html` to short TTL so nav updates propagate quickly
- Use immutable cache headers for asset files when hosting from object storage or CDN

## Exporting Releases
- Tag builds with a release identifier
- Store the `dist/` folder alongside release notes for audit history
- Mirror the same artifacts to preview/staging buckets to test navigation updates before production rollout

## Local Multi-Tenant Validation
- Produce tenant-specific bundles by pointing the build output at nested folders, e.g. `BUILD_OUTPUT=dist/tenant-alpha npm run build`.
- Repeat the build after swapping in each tenant's content so every folder under `dist/` represents a self-contained deployment.
- Generate all configured tenants at once with `npm run build:tenants`; every folder inside `tenants/` becomes `dist/<tenant-id>/`.
- Run `npm run serve` and visit `http://localhost:5173/<tenant-id>/` to review a tenant without DNS configuration; the static server automatically resolves directory requests to `index.html`.
- Use alternative ports by setting `PORT=5000 npm run serve` when the default is unavailable.
- For domain-based validation, map hosts (e.g. `127.0.0.1 tenant-alpha.local tenant-beta.local`) and run `npm run caddy:up` to serve `dist/tenant-alpha` and `dist/tenant-beta` on their respective domains via Docker Caddy. Override the host port with `DOCS_TOOLKIT_PORT=5173 npm run caddy:up` when you can’t bind to 80 (browse via `http://tenant-alpha.local:5173`). The container exposes HTTP/1.1/2 only (HTTP/3 disabled to suppress UDP buffer warnings). Stop the container with `npm run caddy:down` or reload the config in place using `npm run caddy:reload` after rebuilding.
