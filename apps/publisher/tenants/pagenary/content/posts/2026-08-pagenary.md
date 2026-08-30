---
title: "Pagenary - August 2026"
template: post
author: Pagenary Team
date: "2026-08-28"
project: "pagenary"
type: report
tags: [report, "2026-08", "pagenary", "publishing"]
summary: "Pagenary's August work made docs sites easier to use as publishing systems: small-site publishing, portable site data, opt-in Fortemi exports, app adapters, and a public style catalog."
hero: /assets/images/pagenary-2026-08-hero.png
heroAlt: "Sunlit glacier-blue glass forms rising from water, representing clear publishing layers and reusable site data."
status: published
---

# Pagenary - August 2026

Pagenary turns Markdown, HTML, and JavaScript files into fast docs sites. You keep the source in git. Pagenary builds the site, search, menus, SEO files, and static pages you can host almost anywhere.

August moved Pagenary past "docs renderer" and deeper into "publishing system." The core package added a clearer path for small public sites. It added site data that other tools can read. It added opt-in Fortemi data tiers for richer search and graph work. It also gained tenant-local app adapters, so a site can carry richer pages while the normal docs stay simple. Around it, Pagenary Styles opened a public catalog for reusable looks.

## TL;DR

August was a practical month for Pagenary. The main change is that a Pagenary site can now publish more than pages for people to read. It can also emit route files, search data, text and JSON, and opt-in Fortemi Knowledge Shards. That helps your docs become a source of truth, not just a website. The public style catalog also gives teams a safer way to choose and test a look before copying it into a tenant. The normal static-site path stays simple: build files, host files, and avoid running a server.

## By the numbers

| What's public | Value |
|---|---|
| Main package | `@pagenary/publisher` |
| Related packages | `@pagenary/blog-client`, `@pagenary/embed` |
| August package versions | `2026.7.25`, `2026.8.0`, `2026.8.1`, `2026.8.2` |
| Public source | `github.com/jmagly/pagenary` |
| Product site | `pagenary.com` |
| Docs | `docs.pagenary.com` |
| Style catalog | `catalog.pagenary.com` |

## Highlights

**Small sites that publish real route data.** Pagenary can now treat a public site as a structured tenant, not as a one-off page bundle. You define the content shape once. Then the build emits the site, route records, search data, and plain text and JSON. Say you are publishing a portfolio or product site. You can keep the visual app in control while search engines, readers, and other tools get stable page data.

**Portable Knowledge Shards.** Pagenary can emit an opt-in Fortemi Knowledge Shard from a tenant. In plain terms, that is a packaged copy of the site's knowledge layer. You can check it, move it, and import it into richer Fortemi tools later. This helps when your docs need to feed search, graph views, or a larger knowledge flow without scraping the live site.

**Opt-in runtime tiers for richer data.** The August line added Fortemi record and PGlite projection paths. These are opt-in tiers, not a new requirement for every site. A simple docs site can stay static and light. A more advanced site can use richer browser-side data when it needs it.

**Tenant-local app adapters.** A tenant can now carry its own single-page app adapter. That gives teams a bridge between plain docs and custom interactive pages. You might keep most pages as Markdown, then use a tenant-local app route for a dashboard, demo, or product-specific view.

**A public style catalog.** Pagenary Styles gives teams a place to inspect reusable visual systems before adopting them. The catalog shows what each style works with, where it came from, previews, and exact package bytes. That matters because a style changes more than color. It can affect menus, code blocks, contrast, and how a site feels to read.

## Features shipped

### Small-site publishing

The new small-site path is for public sites that still need a real publish shape. It defines a content contract, loads tenant content modules, and emits route files.

That means a public site can keep its polished front end while Pagenary does the build work behind it. A route can have the page users see, plus data for search, site maps, text output, and tools. This is useful for product pages, founder sites, service pages, and public docs hubs where the same facts need to show up in more than one form.

### Data export and Knowledge Shards

Pagenary's Search & Data docs now describe the site as a knowledge layer. The build can produce ranked search data, page facts, graph-friendly data, and an opt-in Knowledge Shard.

A Knowledge Shard is a portable archive of the site's indexed content. The public docs describe it as a Fortemi `1.2.0/core-v1` export with a manifest, a checksum, and a source-trail receipt. You would use it when the docs need to move into a richer search or memory system later. The default site does not need a database or server for this. The export is made during the build.

### Fortemi record and PGlite tiers

The August release line added opt-in Fortemi record and PGlite paths. PGlite is PostgreSQL built to run in the browser. For a normal reader, the point is simple: richer local data tools can be available without turning the basic Pagenary site into a hosted app.

This also keeps the architecture honest. The static docs path is still the lowest tier. It is read-only and light. The richer data tiers are there when a tenant needs more.

### Tenant-local app adapters

Tenant-local app adapters let a tenant own its richer app surface. That keeps custom code near the tenant that needs it. Other Pagenary sites do not have to carry the same app behavior.

Use this when one docs tenant needs a custom interactive view and another does not. The shared publisher stays the same. The tenant adds its local adapter and keeps the rest of the site in the normal content model.

### Style catalog

Pagenary Styles opened a public catalog for reusable docs styles. A style record can show its version, license, Pagenary fit, final file hashes, source trail, and previews.

This makes styling safer. Instead of copying a theme because it looks good in a screenshot, you can inspect the package, check whether it fits your publisher version, and review the live test page first. The catalog also separates base styles from presets. A base can define a fuller shell. A preset can make a smaller brand or color-token change on top of a base.

## Fixes

The most visible fix in the Pagenary line lazy-loads shard converter parts. That keeps the normal publisher path cleaner: if you are not exporting a shard, you should not pay the cost up front.

The style catalog also fixed readable code contrast in Mint Grid. It keeps highlighted code and JavaScript-off code states readable. It also scans both default and dark preview themes for contrast regressions.

## Performance & reliability

Pagenary's August reliability work focused on build output and release behavior. The small-site path emits stable route files, so a build can be checked by tools as well as by a browser. The Knowledge Shard path checks that the same source makes the same bytes and can round-trip through the source index. The style catalog added safer retry behavior for fixed releases, so a retry after a health failure does not create a mismatched catalog state.

## Breaking changes & migrations

None this month.

## Releases

Public package versions were published for `@pagenary/publisher`, `@pagenary/blog-client`, and `@pagenary/embed`.

- **2026.7.25** (Aug 1) - August-published carry-over release with the July report, Fortemi static index adoption, graph runtime alignment, themed graph renderers, and Fortemi record-tier posture docs.
- **2026.8.0** (Aug 2) - small-site content and route files, Knowledge Shard export, opt-in Fortemi record and PGlite tiers, image viewport access coverage, and steadier docsite release deploys.
- **2026.8.1** (Aug 2) - tenant-local app adapters.
- **2026.8.2** (Aug 2) - lazy-loaded shard converter dependencies.

Pagenary Styles also published public GitHub releases:

- **v0.1.0** (Aug 15) - initial preserved and Open Kit style catalog release.
- **v0.1.1** (Aug 21) - Mint Grid contrast fix and safer fixed-release deploy retries.

## Dependencies & security

No public security advisory is called out in the release notes reviewed for this report.

The useful dependency story is about keeping opt-in parts opt-in. The shard converter now loads lazily. The Fortemi record and PGlite paths are opt-in tiers. The public docs also draw a line between the normal static tenant and richer data work, which helps site owners choose the right level of complexity.

## Docs & DX

The public docs now give clearer paths for richer authoring and safer site data. The Search & Data guide explains Fortemi-backed search, the content graph, same-bytes static output, and opt-in Knowledge Shard export. The Rich Technical Content guide covers inline LaTeX, complete LaTeX pages, Mermaid, PlantUML, local tool needs, and security limits.

The Styles docs add the missing workflow around choosing, checking, installing, testing, and rolling back a versioned style. That is important DX work. Styling a docs site is not just taste; it affects contrast, menus, keyboard use, and the reader's trust.

## Tests & CI

The release-backed work added checks around image viewport access, repeatable tenant setup, Knowledge Shard output, record/PGlite runtime paths, and route files. The style catalog release notes also call out catalog integrity, test-page, browser, and WCAG checks.

## Cross-project impact

Pagenary remains the publishing layer for the portfolio. The August work makes that layer more useful to other products because it can publish pages and reusable data from the same source.

Fortemi benefits because Pagenary can export static site knowledge into Fortemi shapes. Product and docs sites benefit because small-site support lets a polished site keep structured route data. The style catalog helps any Pagenary tenant adopt a visual system with more proof than a screenshot.

## Known issues & open threads

None this month.

## What's next

The next useful step is to keep tightening the line between simple static publishing and richer opt-in data tiers. Most users should still be able to start with Markdown, run the publisher, and host static files. Teams that need more can then add Knowledge Shards, tenant-local app routes, and style packages when the need is real.

## Appendix

- **Published packages:** `@pagenary/publisher`, `@pagenary/blog-client`, `@pagenary/embed`.
- **Public source:** `https://github.com/jmagly/pagenary`.
- **Public docs:** `https://docs.pagenary.com`.
- **Product site:** `https://pagenary.com`.
- **Style catalog:** `https://catalog.pagenary.com`.
- **Style source:** `https://github.com/jmagly/pagenary-styles`.
- **Window:** August 2026, using evidence observed through August 28, 2026.
