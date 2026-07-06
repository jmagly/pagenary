---
title: "Pagenary - May 2026"
template: post
date: 2026-05-28
author: Pagenary Team
summary: "The dbbuilder-era project became Pagenary: a public static docs publisher with its first npm releases, docs site, SEO snapshots, collection feeds, CI, and documentation foundations."
hero: /assets/images/pagenary-2026-05-hero.png
heroAlt: "An abstract database and build pipeline transforming into clean static documentation pages."
tags: [report, origin, publishing]
---

# Pagenary - May 2026

May is where the dbbuilder-era project became Pagenary. The Gitea repository was
once named `dbbuilder`; this first public stretch is where the work took its
Pagenary shape: a multi-tenant documentation publisher that turns plain repo
content into fast static sites.

It was a short month, but it set the foundation. Pagenary became an installable
npm package, got its first docs site, learned to publish tenant builds from CI,
and started treating SEO and cross-site feeds as core parts of the product
rather than add-ons.

*Hero image: AI-generated with ChatGPT from a brand-specified prompt; no text or
logos are AI-rendered.*

## TL;DR

Pagenary started as a practical answer to a common problem: teams had Markdown
and project notes in git, but turning that into polished docs sites still meant
hand-built templates, one-off deployment scripts, and a lot of repeated glue.
The first Pagenary line made the shape clear. One publisher. Many tenants. Static
output. Git-aware builds. Docs that can live with the code and deploy anywhere.

By the end of May, the package had moved through the `2026.5.x` release line,
published docs at `docs.pagenary.com`, added SEO-safe snapshots, generated
collection manifests and feeds, and tightened the build path enough for external
repos to use it.

## What shipped

**The Pagenary publisher.** The opening commit introduced the multi-tenant
documentation publishing platform. The core idea was already present: content,
configuration, and a shared renderer combine into complete static bundles.
That model is still the center of Pagenary.

**A real npm package.** The docs and README quickly moved toward the package as
the normal entry point. Instead of asking users to clone the source repo, the
early docs started leading with `@pagenary/publisher` and the install workflow.
That mattered because it changed Pagenary from a local build script into a tool
other projects could adopt.

**First public docs site.** The repo added automated publishing for the Pagenary
tenant to `docs.pagenary.com`. The docs site was not just a marketing page; it
was the first dogfood loop. Pagenary began publishing its own documentation with
Pagenary.

**Consumer-repo build fixes.** The first bug-fix release hardened the build for
real users: working from the consumer repo's current directory, enforcing strict
link behavior, and getting SEO right for external tenants. Those are quiet
features, but they decide whether a tool works outside its own repo.

**SEO snapshots and social metadata.** Pagenary added absolute URLs, canonical
static snapshots, and Open Graph images. That gave hash-routed docs a crawler
and sharing story: readers get the interactive app, while crawlers and link
previews get stable generated pages.

**Collection manifests and feeds.** The first feed work landed in May. Pagenary
could emit collection data and RSS-style feeds from Markdown content. That early
surface later became important for monthly updates and for external SPAs that
want to link to or embed Pagenary-published posts.

**Renderer and navigation polish.** The month closed with practical fixes:
frontmatter stopped leaking into rendered Markdown, Firefox navigation alignment
was corrected, the build-library pipeline was documented, and the release
process was written down from verified commands.

## Releases

- **2026.5.0** - the first Pagenary package line.
- **2026.5.1** - consumer-repo build fixes, strict-links gating, external-tenant
  SEO, and docs updates.
- **2026.5.2** - absolute SEO URLs, self-canonical static snapshots, and
  `og:image` support.
- **2026.5.3** - collection manifests and feeds, plus a packaging fix for
  Terser.
- **2026.5.4** - renderer, navigation, and documentation fixes.

## Why it mattered

May did not have the big feature spread that June would bring. It was more
important than that: it made Pagenary real. The project went from an internal
publishing idea, with dbbuilder-era roots, into a named package with a public
docs site and a repeatable release process.

That foundation let the June work move fast. Search, blogs, page effects,
accessibility reports, and mixed docs/blog layouts all depended on the May
decision to keep Pagenary simple at its core: read repo content, build static
files, and make the output easy to host.

## What's next

June would push beyond the foundation. Pagenary would gain Fortemi-powered
search, docs-map, richer theming, blog publishing, accessibility artifacts,
page effects, and the first version of the monthly update flow this post now
belongs to.

<!-- Backfilled from git history, May 25-28 2026. The canonical Gitea repo was previously named dbbuilder; the dbbuilder remote now resolves to the same root commit and refs as Pagenary. -->
