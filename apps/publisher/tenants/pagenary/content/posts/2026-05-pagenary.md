---
title: "Pagenary - May 2026"
template: post
date: 2026-05-28
author: Pagenary Team
summary: "Pagenary made its first public package line: a static docs publisher with npm releases, a dogfooded docs site, SEO snapshots, collection feeds, CI, and documentation foundations."
hero: /assets/images/pagenary-2026-05-hero.png
heroAlt: "An abstract database and build pipeline transforming into clean static documentation pages."
tags: [report, origin, publishing]
---

# Pagenary - May 2026

May was Pagenary's first public release window. In four fast days, the project
went from a new multi-tenant publisher to an installable npm package with a
dogfooded docs site, SEO-friendly static snapshots, collection feeds, and a
repeatable release process.

This was the foundation release: the month when Pagenary became something other
projects could install, configure, and ship.

*Hero image: AI-generated with ChatGPT from a brand-specified prompt; no text or
logos are AI-rendered.*

## Release highlights

Pagenary launched as a practical answer to a common problem: teams had Markdown
and project notes in git, but turning that into polished docs sites still meant
hand-built templates, one-off deployment scripts, and repeated glue. The first
release line made the product shape clear: one publisher, many tenants, static
output, Git-aware builds, and docs that can live with the code.

By the end of May, Pagenary had moved through the `2026.5.x` release line,
published its own docs at `docs.pagenary.com`, added crawler-safe static pages,
generated collection manifests and feeds, and tightened the build path enough
for external repos to use it.

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

**Dogfooded docs site.** The repo added automated publishing for the Pagenary
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
important than that: it made Pagenary real. The project became a named package
with a public docs site, tested tenant builds, SEO output, collection feeds, and
a repeatable release process.

That foundation let the June work move fast. Search, blogs, page effects,
accessibility reports, and mixed docs/blog layouts all depended on the May
decision to keep Pagenary simple at its core: read repo content, build static
files, and make the output easy to host.

## What's next

June would push beyond the foundation. Pagenary would gain Fortemi-powered
search, docs-map, richer theming, blog publishing, accessibility artifacts,
page effects, and the first version of the monthly update flow this post now
belongs to.

<!-- Backfilled from git history, May 25-28 2026. Public release-announcement voice; internal repository naming history intentionally omitted. -->
