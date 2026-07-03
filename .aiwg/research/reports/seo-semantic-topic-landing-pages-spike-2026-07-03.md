# Semantic Topic Landing Pages Research Spike

Generated: 2026-07-03
Issue: #118
Mode: planning spike; no implementation.

## Recommendation

Pagenary should not start with generated topic-vector landing pages. The viable
first product step is optional, tenant-authored section heading pages.

Section heading pages are legitimate because they are ordinary human-facing pages:
they have their own URL, title, H1, intro copy, metadata, structured data, and
links to child pages. They should be useful to a reader who lands there from
search, sitemap, `llms.txt`, `content-index.json`, or in-site navigation.

Generated semantic/topic landing pages may be considered later, but only with
strict eligibility and review gates. They must not become hidden crawler-only
pages, thin duplicates, keyword variants, or doorway pages.

## Source Guidance Reviewed

- Google Search Central spam policies: pages must not deceive users or manipulate
  Search systems; cloaking includes search-only keywords or different search/user
  content.
  https://developers.google.com/search/docs/essentials/spam-policies
- Google helpful content guidance: content should be created primarily for
  people, provide original value, and avoid search-engine-first production.
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google canonical guidance: internal links should point to canonical URLs;
  `robots.txt` and `noindex` are not canonicalization tools; canonical signals
  should be clear in HTML source where possible.
  https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google noindex guidance: `noindex` only works when crawlers can access the
  page and see the rule; blocking in `robots.txt` can prevent that.
  https://developers.google.com/search/docs/crawling-indexing/block-indexing
- Google structured data policies: structured data must represent visible page
  content, must not describe hidden or misleading content, and must follow Search
  policies.
  https://developers.google.com/search/docs/appearance/structured-data/sd-policies

## Product Direction

### Phase 1: Optional Section Heading Pages

Add support for manifest group entries to become real pages when the tenant opts
in with authored content. A section heading page should:

- use the existing section/group id as the stable route unless explicitly
  overridden by the tenant;
- render human-visible content, not just metadata;
- summarize why the child pages belong together;
- link to the most important child pages with useful anchor text;
- self-canonicalize when it has distinct authored content;
- appear in `sitemap.xml`, `llms.txt`, `content-index.json`, and
  `documents.jsonl` only when the active discoverability profile allows those
  artifacts;
- emit structured data only for visible content on that page;
- honor `limited`, `locked`, `seo.noIndex`, `robots.blockAll`, and related
  privacy controls.

Suggested configuration shape:

```json
{
  "sections": [
    {
      "id": "guides",
      "title": "Guides",
      "summary": "Practical guides for deploying and operating the product.",
      "file": "guides/index.md",
      "sections": [
        { "id": "guides/install", "title": "Install", "file": "guides/install.md" },
        { "id": "guides/deploy", "title": "Deploy", "file": "guides/deploy.md" }
      ]
    }
  ]
}
```

The key distinction is that the group has real source content. If there is no
authored content, Pagenary may keep current redirect-to-first-child behavior.

### Phase 2: Generated Semantic Topic Pages

Defer generated topic pages until after section heading pages ship. A later
implementation should require:

- at least three distinct source pages or one curated collection plus multiple
  child pages;
- source diversity across sections or collections unless the tenant explicitly
  pins a topic;
- a confidence threshold from tags/headings/search facets/concept graph data;
- a generated draft preview and tenant approval before publication;
- internal discovery path from source pages or an index page;
- visible source links and clear explanation of why sources are grouped;
- anti-doorway checks before sitemap or corpus index inclusion.

## Canonical, Sitemap, Robots, And Index Rules

- Authored section heading pages with distinct content should self-canonicalize.
- Pages that substantially duplicate one child page should not be published as
  standalone indexable pages; link to the child instead.
- Generated topic pages, if later supported, should self-canonicalize only when
  they summarize multiple sources and have distinct visible value.
- Sitemaps should include only canonical, indexable landing pages.
- `llms.txt`, `content-index.json`, and `documents.jsonl` should distinguish
  `kind: "section-heading"` or `kind: "topic"` from ordinary source pages.
- `limited`, `locked`, `seo.noIndex`, and `robots.blockAll` must suppress or
  mark these pages consistently with existing profile behavior.

## Structured Data Rules

- Use `WebPage` or `CollectionPage` only when the visible content supports it.
- Include `BreadcrumbList` when the page participates in visible navigation.
- Do not emit structured data for hidden topic claims or source relationships
  that are not visible on the page.
- Do not mark generated summaries as reviews, articles, FAQs, or how-tos unless
  the visible page actually meets that feature's content requirements.

## Anti-Doorway And Anti-Keyword-Stuffing Checks

Reject or keep noindex when any of these are true:

- the page is hidden from humans or reachable only through crawler artifacts;
- the page duplicates one source page with only URI/title/H1 changes;
- the page title, H1, slug, metadata, or body repeats target terms unnaturally;
- the page lacks an internal discovery path;
- crawler-visible content materially differs from human-visible content;
- structured data describes content not visible on the page;
- the page bypasses restrictive profile or tenant privacy settings;
- the page has fewer than the configured minimum source pages and no tenant
  authored content.

## Documentation Language

Suggested docs language:

> Prefer real section heading pages when a section has a meaningful theme and
> multiple child pages. A heading page should help a human understand the topic,
> explain why the child pages belong together, and link to the most important
> child pages. Use natural terminology from the section. Do not keyword-stuff
> the title, H1, slug, metadata, or body text.
>
> Generated semantic topic pages are a later, stricter feature. They must be
> human-usable public pages, not hidden SEO copies or crawler-only surfaces.

## Follow-Up Implementation Issue

File a construction issue for optional authored section heading pages. Do not
file generated topic-vector page implementation until the authored heading-page
path has shipped and produced real usage feedback.
