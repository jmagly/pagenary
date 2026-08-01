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

### Standard Public Docs

Use the default profile:

```json
{
  "seo": {
    "discoverabilityProfile": "standard"
  }
}
```

This emits crawlable static snapshots, sitemap entries, canonical URLs, and a
robots file that advertises public page paths while hiding internal generated
paths such as `/sections/` and `/lib/`.

### Open Docs And Automation-Friendly Extraction

Use `open` when the site should be easy for search, LLM tooling, and automation
to ingest without browser execution:

```json
{
  "seo": {
    "discoverabilityProfile": "open"
  }
}
```

This emits the standard public artifacts plus `content-index.json`,
`documents.jsonl`, per-page JSON/text extracts, extract links in `llms.txt`, and
permissive advisory `Content-Signal` values in `robots.txt`.

### Limited Public Docs

For docs that are public at the hosting layer but should avoid casual indexing:

```json
{
  "seo": {
    "discoverabilityProfile": "limited"
  }
}
```

This emits `noindex, nofollow` metadata on static snapshots, suppresses sitemap,
`llms.txt`, and corpus artifacts, and writes restrictive `robots.txt` output.
This is only an advisory signal. Anyone with the URL can still fetch the content.

### Advisory Locked Static Bundle

Use `locked` only as a static-site crawler preference profile:

```json
{
  "seo": {
    "discoverabilityProfile": "locked"
  }
}
```

This disables sitemap, `/pages/*.html` snapshots, `llms.txt`, corpus artifacts,
and root HTML fallback by default, while writing `Disallow: /` and noindex
signals where generated. It is not a privacy boundary; use hosting-layer access
control for private docs.

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

`seo.aiCrawlers` can add advisory content-signal preferences to `robots.txt`:

```json
{
  "seo": {
    "aiCrawlers": {
      "search": true,
      "aiInput": false,
      "aiTrain": false
    }
  }
}
```

These signals are non-universal preferences for cooperating crawlers. They do not
guarantee AI training exclusion or generated-answer exclusion.

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
The `limited` and `locked` profiles suppress `llms.txt` and machine-readable
corpus artifacts by default.

## Negotiated Markdown Representations

`markdownDelivery.enabled` publishes a complete alternate representation of
each eligible route. Treat `/markdown/*.md` and negotiated `text/markdown`
responses as public copies of the page, not as a private agent channel.

Pagenary applies these safety floors:

- `limited`, `locked`, and `seo.noIndex: true` disable generation and remove
  stale Markdown artifacts on the next build.
- Frontmatter is removed before authored Markdown is embedded in a compiled
  section module, so build-only metadata is not delivered.
- Route lookup comes from the generated `markdown-routes.json`; servers must not
  translate arbitrary request paths into filesystem paths.
- Scripts, styles, application chrome, and generated controls are excluded from
  converted HTML representations.

These are publication safeguards, not authorization. A client that knows a
direct artifact URL can retrieve it on a public static host. Enforce tenant
authentication before both HTML and Markdown responses, apply the same rate
limits to both, and include `Accept` in the CDN cache key whenever negotiation is
enabled. Do not identify agents from User-Agent strings or log complete Accept
headers, query values, credentials, or prompt content.
