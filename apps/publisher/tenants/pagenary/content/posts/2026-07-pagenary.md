---
title: "Pagenary - July 2026 Report"
date: "2026-07-31"
project: "pagenary"
type: report
tags: [report, "2026-07", "pagenary", "publishing"]
summary: "Pagenary pushed deeper into product-grade publishing in July: interactive docs maps, React support, responsive media, SEO profiles, share controls, and sturdier Markdown."
status: published
---

# Pagenary - July 2026

Pagenary turns Markdown into fast docs and blog sites. You write content in plain files, and Pagenary builds the site around it. It also powers portfolio docs and monthly updates across the stack.

July moved Pagenary toward a richer product surface. The docs map became interactive. React support got a hybrid base. Image and media blocks became more responsive. SEO profiles and author controls made sites easier to publish well. Several fixes made Markdown, links, base paths, package contents, and dense menus more reliable.

## TL;DR

Pagenary had an active July. It improved how readers explore docs. It improved how builders add React-backed views. It also improved how sites behave when hosted from different paths. It added better asset data, share controls, responsive media blocks, and SEO profiles. It also fixed flat blog posts, portable base paths, dense docs-map layout, encoded Markdown tags, and strict doc links.

## By the numbers

| What's public | Value |
|---|---|
| Package | `@pagenary/publisher` |
| July release line | `2026.7.x` |
| Key capabilities | interactive docs maps, React runtime, responsive media, SEO profiles, share controls |
| Sites | `pagenary.com` and `docs.pagenary.com` |

## Highlights

**Interactive docs maps.** The docs map is no longer just a static idea. It can support richer tiers, palettes, dragging, and build-time snapshots. That helps readers understand a large doc set by shape, not only by menu order.

**Hybrid React support.** Pagenary added a React adapter baseline and adopted Fortemi React graph-view support through a lighter graph path. This gives builders a bridge between static content and richer client-side views.

**Generated-asset details.** Delivery assets can now be shown in a detail pane. That helps site owners see what a build made and check that the right files are part of the publish.

**Responsive media blocks.** Image and media blocks gained better behavior on different screen sizes. A docs site can now carry richer visuals without assuming every reader has the same screen.

**SEO and author controls.** SEO profiles and author controls make it easier to publish pages that are findable, attributable, and consistent across a site.

## Features shipped

### Docs-map exploration

The docs-map work added tiers, palette controls, drag behavior, and graph snapshots at build time. The same inputs should produce the same graph shape. That makes tests and review easier.

For a reader, the result is a more useful map. For a site owner, the map is easier to trust because it is made during the build.

### React runtime

Pagenary added a React runtime base, including adapter work and a schema. This lets a Pagenary site stay mostly static while using richer React sections where they make sense.

The Fortemi React graph path matters here. Search, graphs, and knowledge views can appear inside a published site without turning the whole site into a custom app.

### Publishing controls

Share controls, generated-asset details, SEO profiles, and author controls all make Pagenary more useful for production sites. They help a site owner answer practical questions. What got built? How should a page be shared? Who owns the page? How should search engines read it?

### Content blocks and page structure

Responsive media blocks and authored section-heading pages give writers more control over page shape. A team can build richer docs while still writing in the same content system.

## Fixes

Pagenary fixed several edges that readers would notice. Markdown image, link, and span tags now survive encoded attributes better. Flat blog posts render. Root fallback behavior works in custom shells. Portable base paths are supported, so a site can live under a sub-path without broken links. Dense docs maps scale better. The table-of-contents rail keeps its packaged CSS and has a capped scroll area.

## Performance & reliability

Reliability improved around build output, base paths, strict links, and dense graph layouts. These are publishing reliability issues. The site should build. Links should work. Menus should stay usable when content gets large.

## Breaking changes & migrations

None called out for normal users. Site owners who use custom shells or unusual base paths should retest those paths with the July line.

## Releases

The July `2026.7.x` line for `@pagenary/publisher` carried the work described here: docs maps, React support, responsive media, asset details, SEO controls, sharing controls, and publishing fixes.

## Dependencies & security

The notable dependency story is the Fortemi React path used for graph views. Pagenary continued to use portfolio parts in its own publish surface. No public advisory is called out in this report.

## Docs & developer experience

Docs improved around publisher behavior, React use, SEO profiles, and generated delivery assets. Better asset details are useful for developers because they make a build easier to inspect.

## Tests & CI

Build-time graph snapshots, package checks, strict links, and layout fixes all support a steadier CI path. The goal is simple: catch broken publish output before a user sees it.

## Cross-project impact

Pagenary is the publishing layer for the portfolio. AIWG docs, Fortemi docs, monthly reports, and company-site updates all benefit when Pagenary handles richer pages, better graphs, safer links, and more reliable builds. Fortemi React also benefits because Pagenary gives its graph and local knowledge work a publish surface.

## Known issues & open threads

Docs-map, React-backed content, generated-asset details, SEO controls, and portable hosting behavior are still active areas. Site owners using custom shells, strict links, or unusual base paths should retest their publish path with the July line.

## What's next

Continue polishing docs maps, React-backed content, generated-asset details, SEO controls, and portable hosting behavior. The main direction is to keep Pagenary simple for writers while making the published site richer and easier to trust.

## Appendix

- **Published package:** `@pagenary/publisher`.
- **Release line:** July `2026.7.x`.
- **Sites:** `pagenary.com` and `docs.pagenary.com`.
- **Window:** July 2026, using the July evidence snapshot prepared through July 30.
