---
title: "Pagenary - July 2026 so far"
template: post
date: 2026-07-06
author: Pagenary Team
summary: "July tightened the public docs experience: author controls, portable launches, materialized blog posts, SEO discoverability profiles, authored section pages, responsive media, sharing controls, and a documented cross-site updates feed contract."
tags: [report, publishing, docs]
---

# Pagenary - July 2026 so far

July started with a different kind of work than June. June proved Pagenary could
be more than a docs shell. July has been about making that broader platform feel
solid: easier to launch, easier to author, better for crawlers, clearer for
external consumers, and cleaner as a public package.

This is an in-progress month report, backfilled from the repository history
through July 6, 2026.

## TL;DR

Pagenary's July work sharpened the path from "I have content" to "I have a
real published site." The docs theme was aligned with the marketing site.
Portable base-path launches got fixed. Blog posts in flat and manifest-driven
content structures now render correctly. SEO gained named discoverability
profiles, authored section heading pages, better static fallback links, and
bot-friendliness research. Authors got controls and VS Code extension work.
Readers got responsive images and configurable sharing. External sites got a
stable blog consumption and embed contract.

## What shipped

**Author controls and editor direction.** July opened with authoring work:
controls for the people writing Pagenary sites, plus VS Code extension support.
That fits the larger direction from June's planning: Pagenary should be useful
inside an editor before a full publish, not only after a build.

**Blog rendering fixes.** After the June blog launch, July hardened the real
content paths. Flat content blog posts render. Manifested collection posts
materialize. The docs clarified mixed blog customization and table-of-contents
behavior. These are the fixes that make the blog layout feel dependable when a
tenant is not shaped exactly like the demo.

**Portable launches.** Pagenary fixed portable base-path launches so a generated
site behaves when opened from different roots and deployment paths. This matters
for local previews, project-page hosting, subpath deployments, and generated
bundles that move between environments.

**Docs site polish.** The Pagenary docs theme was matched to the marketing site,
the quickstart was streamlined, the favicon was aligned, and sharing defaults
were cleaned up. The public docs became more consistent with the product story:
static, polished, low-friction docs that still feel branded.

**SEO discoverability profiles.** Pagenary added named SEO profiles so tenants
can choose how open or locked down their generated artifacts should be. Static
fallbacks, crawler-facing pages, corpus extracts, and related discovery files
now have a clearer policy surface.

**Authored section heading pages.** Sections can now have their own authored
heading pages instead of being only containers for child pages. That makes large
docsets feel more intentional: a section can introduce a topic, link its child
pages, and still participate in SEO snapshots and navigation.

**Better static fallbacks.** Root fallback embedding now works in custom shells,
and static fallback doc links are rewritten correctly. That is the difference
between "we generated no-JS HTML" and "the no-JS path is actually navigable."

**Responsive media blocks.** Pagenary added responsive image media blocks so
authors can ship better visual pages without custom markup. Images can adapt to
screen shape and size while staying in the Markdown-driven authoring flow.

**Configurable sharing.** The share control became configurable. Tenants can
choose which services to show and keep the share UI aligned with their audience
instead of accepting a one-size-fits-all menu.

**Cross-site update feeds and embeds.** Pagenary documented and wired a stable
blog consumption path for external sites: collection `index.json`, optional
`feed.xml`, `@pagenary/blog-client`, and the `<pagenary-blog>` embed. That gives
bespoke SPAs such as `magly.net` and `integrolabs.io` a clean way to link to or
embed monthly updates published once in Pagenary.

**Release and package hygiene.** July also improved npm package discoverability,
release wiring for the new packages, and tracker/release documentation. The
canonical Gitea tracker policy is now documented so project issues do not drift
to the GitHub mirror by accident.

## Releases

- **2026.7.0** - rail table-of-contents scroll-area fix and the start of the
  July release line.
- **2026.7.1-2026.7.3** - author controls, VS Code extension work, portable
  base-path launch fixes, and materialized collection posts.
- **2026.7.4-2026.7.12** - docs theme alignment, quickstart polish, root
  fallback fixes, SEO discoverability profiles, and authored section heading
  pages.
- **2026.7.13** - responsive image media blocks, npm discoverability work, and
  configurable sharing.
- **2026.7.14-2026.7.16** - cross-site blog contract and embeds, release-flow
  wiring for new packages, favicon/share cleanup, and tracker access docs.

## Why it matters

The July theme is trust. A docs generator earns trust when the normal paths work
without ceremony: posts render, links survive static fallbacks, feeds can be
consumed by another site, the output launches from the path where it is served,
and the docs explain the policy choices clearly.

That is what this month has been doing. It has been turning June's large feature
surface into a system that feels ready for more tenants and more publishing
workflows.

## What's next

The rest of July should finish the monthly update pipeline, keep tightening the
external feed/embed story, and continue the authoring loop. The editor work,
discoverability profiles, section landing pages, and cross-site update contract
now give Pagenary a strong base for publishing once and reusing the result
across docs sites, marketing sites, and bespoke SPAs.

<!-- Backfilled from reachable git history, July 1-6 2026. This is intentionally labeled "so far" because July is still in progress. -->
