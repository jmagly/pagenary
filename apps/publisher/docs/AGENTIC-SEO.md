# Agentic SEO & AI Discoverability

People use "agentic SEO" for two related ideas:

- agents that help maintain search content by auditing, recommending changes,
  and opening reviewable edits;
- sites that are easy for answer engines, crawlers, and LLM tools to read
  without guessing how an app works.

Pagenary addresses the second idea directly, and it gives teams a practical
substrate for the first. It publishes static, machine-readable artifacts that
agents can inspect, while the source stays in Markdown and Git so any automated
SEO maintenance can happen through reviewable pull requests. Pagenary does not
silently rewrite a live site or claim to autonomously perform SEO.

## Agent-Consumable Output

Pagenary makes a documentation site legible to crawlers, answer engines, and
internal agents by emitting real files at build time:

| Capability | What ships | Receipt |
|------------|------------|---------|
| `llms.txt` | A root LLM-friendly site map with links to canonical static pages. | [SEO Strategy](SEO-STRATEGY.md), [README](https://git.integrolabs.net/roctinam/pagenary/src/branch/main/README.md#features) |
| Structured metadata | JSON-LD, Open Graph, canonical URLs, and runtime meta updates. | [SEO Strategy](SEO-STRATEGY.md), [Tenant Configuration](TENANT-CONFIG.md) |
| Crawlable static pages | `/pages/<id>.html` snapshots plus a readable root HTML fallback. | [#111](https://git.integrolabs.net/roctinam/pagenary/issues/111), [#120](https://git.integrolabs.net/roctinam/pagenary/issues/120), [SEO Strategy](SEO-STRATEGY.md) |
| Discoverability profiles | `standard`, `open`, `limited`, and `locked` presets for artifact output. | [#113](https://git.integrolabs.net/roctinam/pagenary/issues/113), [SEO Strategy](SEO-STRATEGY.md) |
| Machine-readable corpus artifacts | `content-index.json`, `documents.jsonl`, per-page JSON, per-page text, and optional `llms-full.txt` for open-profile sites. | [#108](https://git.integrolabs.net/roctinam/pagenary/issues/108), [#114](https://git.integrolabs.net/roctinam/pagenary/issues/114), [SEO Strategy](SEO-STRATEGY.md) |
| AI crawler preference signals | Advisory `Content-Signal` output in `robots.txt` for search, AI input, and AI training preferences. | [#116](https://git.integrolabs.net/roctinam/pagenary/issues/116), [Tenant Controls](TENANT-CONTROLS.md) |
| Human-visible topic and section hubs | Authored section heading pages that are crawlable without becoming hidden doorway pages. | [#118](https://git.integrolabs.net/roctinam/pagenary/issues/118), [#119](https://git.integrolabs.net/roctinam/pagenary/issues/119), [SEO Strategy](SEO-STRATEGY.md) |
| Semantic search and docs graph | A static Fortemi-backed search index, compact page metadata, and an inspectable Docs Map. | [Search & Data](SEARCH-AND-DATA.md), [API Reference](API.md) |

This is the part of agentic SEO that Pagenary ships today: agent-consumable
output. GEO, AEO, AI discoverability, and `llms.txt` all point at the same
practical requirement: publish stable content, metadata, links, and extract
surfaces that machines can read without executing the SPA.

## Agentic-SEO-Native Substrate

Pagenary is also a good substrate for human-approved SEO maintenance loops:

- Content lives in Markdown and tenant config files, so an agent can propose
  specific diffs instead of mutating production state.
- Git history, code review, CI, and release tags provide an audit trail for
  search and AI-discoverability changes.
- The generated corpus artifacts give an agent a current map of the published
  site: pages, titles, summaries, static URLs, extracts, and text.
- Search metadata and the Docs Map expose relationships in the corpus that can
  guide maintenance proposals.

The boundary matters. Pagenary can be used with an agentic workflow, but the
safe version is review-gated: monitor the generated artifacts, recommend a
change, open a pull request, run tests, then publish through the normal release
path. Pagenary does not bypass that review loop.

## Make A Site Agent-Discoverable

Use the `open` discoverability profile for public docs that should be easy to
read, cite, and ingest:

```json
{
  "domain": "docs.example.com",
  "seo": {
    "discoverabilityProfile": "open"
  }
}
```

Then build the site and verify the emitted surfaces:

- `/sitemap.xml` lists the root and static page snapshots.
- `/robots.txt` points at the sitemap and includes configured AI crawler
  preference signals.
- `/llms.txt` links to the docs corpus.
- `/content-index.json` and `/documents.jsonl` exist for open-profile corpus
  ingestion.
- `/pages/<id>.html`, `/pages/<id>.json`, and `/pages/<id>.txt` exist for each
  published page when corpus artifacts are enabled.

Use `limited`, `locked`, `seo.noIndex`, or low-level artifact switches when a
tenant should not advertise those machine-readable surfaces. These settings are
static publishing controls and crawler signals, not authentication or access
control; protect private content at the host.

## Claims Boundary

Pagenary can honestly say:

- it publishes crawler-facing and agent-consumable files;
- it supports `llms.txt`, JSON-LD, Open Graph, sitemaps, robots output, static
  snapshots, and open-profile corpus extracts;
- it is compatible with human-in-the-loop, PR-gated agentic SEO workflows.

Pagenary should not claim:

- that it autonomously performs SEO;
- that it guarantees rankings, answer-engine citations, or AI training
  exclusion;
- that robots or content-signal preferences enforce access control.

For the lower-level controls behind this page, see [SEO Strategy](SEO-STRATEGY.md),
[Tenant Configuration](TENANT-CONFIG.md), and
[Tenant Controls](TENANT-CONTROLS.md).
