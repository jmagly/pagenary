# Tenant Security and Privacy Controls

Pagenary publishes static sites. Static controls can reduce accidental exposure,
shape crawler behavior, and improve privacy defaults, but they are not DRM and
they are not authorization. If a browser can render a page, the reader's device
can capture it.

Use this guide to choose the right control for the risk.

## Control Types

| Control type | Examples | What it can do | What it cannot do |
|---|---|---|---|
| Advisory crawler controls | `robots.txt`, noindex metadata, sitemap settings | Ask cooperative crawlers not to index or follow paths | Stop direct access, hostile crawlers, screenshots, or source fetches |
| Browser/runtime controls | export UI scopes, hosted embed privacy gates, referrer policy, CSP | Reduce unnecessary data sharing and narrow browser behavior | Prove content secrecy in a public static bundle |
| Hosting-layer controls | authentication, authorization, signed URLs, private object storage, server-side watermarking | Enforce access before bytes are served | Work from Pagenary config alone on a public static host |

## Recommended Profiles

### Public Docs

Use the defaults:

```json
{
  "seo": {
    "generateSitemap": true,
    "generateRobotsTxt": true,
    "generateStaticPages": true
  }
}
```

This emits crawlable static snapshots, sitemap entries, canonical URLs, and a
robots file that advertises public page paths while hiding internal generated
paths such as `/sections/` and `/lib/`.

### Internal But Static Docs

For docs that are public at the hosting layer but should avoid casual indexing:

```json
{
  "seo": {
    "noIndex": true,
    "generateSitemap": false
  }
}
```

This emits `noindex, nofollow` metadata on static snapshots and a restrictive
`robots.txt` with `Disallow: /`. This is only an advisory signal. Anyone with the
URL can still fetch the content.

### Private Or Auth-Gated Docs

Use hosting-layer access control. Typical controls include:

- SSO or HTTP basic auth at the static host or reverse proxy.
- Private bucket/object storage with signed URLs.
- VPN or network allowlists.
- Server-side personalized watermarking for exports when attribution matters.
- Response headers such as `Content-Security-Policy`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Content-Type-Options`, and strict cache policy.

Pagenary can generate the static files, but the host must enforce access.

## Robots and Search Visibility

`seo.noIndex: true` is the simple privacy-oriented setting. It avoids advertising
a sitemap from `robots.txt` and adds noindex metadata to generated static pages.

Use `seo.robots` when you need explicit directives:

```json
{
  "seo": {
    "robots": {
      "allow": ["/public/"],
      "disallow": ["/", "/drafts/"],
      "sitemap": false
    }
  }
}
```

Robots directives are crawler hints. They do not hide files, remove content from
already indexed search results, or prevent direct access.

## Export and Watermarking

Use `export.enabled` and `export.scopes` to control Pagenary's own Export button.
This does not disable the browser or operating system print/save features.

Use `export.watermark` for an optional visible watermark in generated print/PDF
output. Treat watermarking as an intent signal, not protection.

Do not rely on right-click blocking, copy suppression, selection blocking,
devtools deterrents, or print-hiding CSS. These measures are easy to bypass and
harm legitimate reader and accessibility workflows.

## Embeds and Referrers

Hosted form and media embeds should remain opt-in. Pagenary's embed path already
uses lazy loading, sandbox attributes, and a strict-origin referrer default where
applicable. Tenants with a CSP must explicitly allow each external provider they
choose to embed.

## Large Language Model Indexing

`llms.txt` is a discovery aid, not an access-control mechanism. Do not publish
references there for content you do not want broadly discoverable. For private
docs, enforce access at the host and avoid generating public discovery artifacts.
