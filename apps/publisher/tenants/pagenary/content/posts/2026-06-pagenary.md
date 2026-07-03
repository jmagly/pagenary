---
title: "Pagenary — June 2026"
template: post
date: 2026-06-28
author: Pagenary Team
summary: "A flagship month: Pagenary learned to publish blogs, mixed docs and blog layouts in one site, gained a full page-effects suite, shipped meaning-based search, drew an automatic page map, hardened git-source publishing, and promoted the CLI."
hero: /assets/images/pagenary-2026-06-hero.png
heroAlt: "A glowing Markdown document transforming into several fast, clean web pages fanning out to the right, with a search lens."
tags: [report, publishing, release]
---

# Pagenary — June 2026

*Pagenary turns your Markdown docs into a fast, good-looking website. You write plain text; it builds a finished site made of plain files — no server or database to run, so it's cheap and quick to host. One setup can publish many separate, branded sites from a shared set of templates. Pagenary is also the tool that publishes these monthly updates, and it powers the docs sites across the portfolio.*

*Hero image: AI-generated with ChatGPT from a brand-specified prompt; no text or logos are AI-rendered.*

## TL;DR

June was a flagship month for Pagenary. The platform grew from "docs site builder" into something broader. It learned to publish **blogs**, not just docs, then learned to mix docs and blog sections in one site. It gained a whole **set of scroll and motion effects** you can add to any page. Think a contents strip that follows you, scroll-driven stories, and zoomable images. It shipped **search that finds pages by meaning**, built on a copy of the Fortemi engine. It can now draw a **map** of how your pages connect, on its own. The CLI became the main public surface, the template system gained stronger schema checks, hosted-form embeds landed, and private git-source publishing got security and credential hardening. All of this came in a steady run of releases through the month.

## By the numbers

| What's public | Value |
|---|---|
| What it is | A tool that turns Markdown into a fast, hostable docs or blog site |
| Package | `@pagenary/publisher` on npm |
| New this month | Blog publishing · mixed docs/blog sites · a scroll/motion effects suite · meaning-based search · an auto page-map · form embeds · stronger CLI |
| Search | Powered by a built-in copy of the Fortemi engine |
| Sites it runs | pagenary.com · docs.pagenary.com (and the portfolio's docs sites) |
| Source | github.com/jmagly/pagenary |

## Highlights

**1. Publish a blog, not just docs.**
What it is: Pagenary now has a blog layout family — blog post pages, an index of posts, and next/previous links between them. By the end of the month, one site could mix a docs area and a blog area, each with its own shell.
How you'd use it: write posts in Markdown and Pagenary builds a real blog, with readers able to move from one post to the next. Keep product docs and updates in the same deploy when that fits your site.
Why it helps: one tool now covers both your documentation and your updates or articles. These monthly reports publish through exactly this feature.

**2. A set of scroll and motion effects.**
What it is: effects you can add to any page. A "what's on this page" strip that tracks where you are. Scroll-driven stories, where a visual stays put while text steps through it. Sections that snap into place. Click-to-zoom images. Items that fade in as they appear. Fold-out sections. A reading-progress bar.
How you'd use it: turn on the effects you want in a page's settings — no code.
Why it helps: your pages can be lively and easy to follow. And they respect a reader's "less motion, please" setting on their own.

**3. Search that finds pages by meaning.**
What it is: built-in search that matches what a reader means, not just the exact words they typed. It runs on a copy of the Fortemi search engine bundled right into the site.
How you'd use it: readers type a question and find the right page even if it uses different words than they did.
Why it helps: people find answers faster, and the search needs no separate server — it's part of the static site.

**4. A map of your pages, drawn for you.**
What it is: a "docs-map" that reads your pages and draws a picture of how they link. It arranges itself so linked pages sit near each other.
How you'd use it: turn it on, and readers get a map to explore your site by topic, not just a list.
Why it helps: big doc sets become easier to get around and grasp at a glance.

**5. Managed hosting, if you don't want to run it yourself.**
What it is: managed-hosting research and concierge tooling moved forward, while the public package stayed focused on the self-hosted static publisher.
How you'd use it: self-hosting remains the public path; private hosted operations are being kept behind the right boundary.
Why it helps: the package stays simple for users who just want static files, while hosted-service work can continue without leaking service-only fields into the public schema.

## Features shipped

**Blog publishing (Phase 1).** Pagenary gained a blog layout family: post pages, an index of posts with fully clickable cards, and next/previous links plus back-to-index. There are themed blog examples to start from, and a "living scroll" reading style for posts. This is phase one of blog support. It's how these monthly updates get published.

**Mixed docs and blog sites.** The first blog pass made whole sites use the blog shell. The next pass made layout a per-route decision. A section, group, or collection can now choose the docs shell or the blog shell, and the runtime switches as the reader moves around. The Pagenary docs site uses this directly: the normal docs stay as reference pages, while the Blog navigation item opens a card-grid index of monthly posts.

**The page-effects suite.** This was the month's biggest build. A new per-page effects engine lets you turn on rich behavior on any page. It's built to be gentle: it loads only when the page is ready, and it respects a reader's "less motion, please" setting. The effects include a **contents strip** that highlights the section you're in. **Scroll-driven stories**, where a visual stays put while text steps through it. **Snap** sections that click into place. A **depth effect** you can add to any element. **Click-to-enlarge** images. **Staggered reveal**, so items fade in one by one. **Fold-out** sections. A **reading-progress** bar. And rich **hero and banner** blocks. Later in the month the contents strip got a second version: a side rail on wide screens, foldable on narrow ones. The effects also reached all page types, not just blogs.

**Search, powered by Fortemi.** Pagenary published meaning-based search. It runs on a copy of the Fortemi search engine, bundled right into the build. A build-time check now tests the search-index file before a site ships, so a broken one can't slip through. Through the month Pagenary kept that bundled engine current. It tracked new Fortemi releases and recorded which version it carries, so it's easy to trace.

**Looks, menus, and the page-map.** A **theme and color picker** lets readers switch the look, and it remembers their choice. A theme-recipes gallery and example pages give you starting points. The menus gained position and alignment options, a foldable sidebar, and a slide-over drawer for small screens. And **docs-map** arrived: a picture of how your pages link, built from their content. Its layout settles so linked pages sit near each other.

**CLI, schemas, and authoring controls.** The public command became `pagenary`, with docs updated around `pagenary build` instead of lower-level script calls. The template registry and frontmatter schema checks give authors earlier feedback when a page asks for a layout or field Pagenary does not understand. Hosted-form embeds also landed, starting with Tally: a site can expose a feedback or contact form without hand-pasting provider scripts into every page, and JavaScript-off readers still get a working link.

**Hosting, deploy, and serving anywhere.** Sites now serve correctly from either a domain root or a sub-path, because links resolve against the site's own base. Deploys got more reliable too. File names are now tied to their contents, with a clear cache plan and an automatic cache clear. So readers see new content right after a deploy. Managed-hosting work happened too, but late-month cleanup moved service-only pieces out of the public package and schema so self-hosted users get a clean static-publisher surface.

**Markdown and publishing robustness.** Plain web addresses you type now turn into clickable links on their own. Soft-wrapped lines now join into one paragraph, as intended. Page titles now feed the browser tab and search engines properly. The page frame no longer clips on small or rotated screens. Printing and exporting keep the contents list intact. New publishing examples and a getting-started guide make first setup easier.

**Private git-source hardening.** The git-source build path was tightened for hosted and private-repo use. Git commands now use argument arrays instead of shell strings, blocking shell metacharacter injection through tenant source fields. The advertised `GIT_CREDENTIALS` path gained coverage so HTTPS private repos have a tested credential route. These changes matter most for hosted build workers and teams pulling content from private repos.

**Accessibility.** Late in the month Pagenary added an accessibility push. It can produce accessibility reports and narration files, has a strict content mode, and ships a guide for writing pages everyone can use. New automatic checks scan for color-contrast and keyboard-focus problems.

## Fixes

Most fixes hardened the new features as they landed. The contents strip stopped overlapping text and now scrolls reliably. The "quick find" search box stays above page banners. Next/previous links became steady and predictable. The menu drawer is now solid, not see-through. And a gap between a heading and its content was removed. On the publishing side: pages serve correctly from a sub-path, content-addressed file rewrites are scoped per directory, the page frame no longer clips on rotation or short screens, and printing keeps its contents list. Markdown-rendered HTML comments are stripped, and post tags render as tidy pills. One release was kept tightly scoped, so an unrelated change didn't ride along. A cleanup also split the published docs from the project's own working notes.

## Performance & reliability

Reliability work centered on getting fresh content to readers and keeping search trustworthy. Deploys now tie file names to their contents, with a clear cache plan and an automatic cache clear. So a new publish shows up right away, instead of being held back by an old cached copy. The build-time search-index check means a site won't ship with broken search. No general speed-tuning shipped this month.

## Breaking changes & migrations

None that affect normal use. Everything this month is additive — blogs, mixed-layout sites, the effects suite, search, the page-map, form embeds, and deploy hardening all sit alongside the existing docs builder. New behavior is opt-in per page, collection, or site. The one exception: next/previous article links became a general feature, on by default, near the end of the month.

## Releases

Pagenary shipped small, steady releases all month, each public on npm as `@pagenary/publisher`. The notable cuts:

- **2026.6.0–2026.6.2** (Jun 13–15) — the June line opens; meaning-based, Fortemi-powered search is published.
- **2026.6.3** (Jun 15) — sites serve correctly from a domain root or a sub-path.
- **2026.6.4** (Jun 15) — proper page titles for browser tabs and search engines.
- **2026.6.5–2026.6.6** (Jun 15) — repositioned around low-cost, self-hosted docs; publishing-workflow examples and an on-ramp guide.
- **2026.6.7–2026.6.8** (Jun 15) — ship the examples; runtime title branding and tighter sidebar.
- **2026.6.9** (Jun 16) — theming-recipes gallery, runtime theme/color picker, automatic links, and the first docs-map.
- **2026.6.10–2026.6.12** (Jun 17–18) — keep the bundled Fortemi search engine current and record its exact version; dev-tooling refresh.
- **2026.6.13** (Jun 21) — content-addressed file names and a cache-refresh strategy; managed-hosting tooling; the docs-map's self-arranging layout.
- **2026.6.14** (Jun 27) — the page-effects suite, plus reading metadata and the accessibility artifacts.
- **2026.6.15** (Jun 27) — collapsible navigation and the second-version on-this-page contents strip; live in-docs demos of the effects.
- **2026.6.16** (Jun 27) — next/previous article navigation on by default; automatic edge-cache purge on deploy.
- **2026.6.17** (Jun 28) — code-copy controls, more on-this-page placement polish, and the latest page-effects refinements.
- **2026.6.18** (Jun 29) — the `pagenary` CLI becomes the main public surface; mixed docs/blog layouts, template schemas, form embeds, a consolidated docs+blog showcase, and the June blog report land in the docs site.

Small patch releases continued through the end of the month.

## Dependencies & security

The main dependency story is the bundled Fortemi search engine. Pagenary carries a copy of `@fortemi/core` and kept it current through the month. It declares the version it tracks and documents how the copy is made, plus a dependency check, so it's clear which version ships. The release pipeline also checks what goes into the npm package, with an allowlist for the example files it now ships. Security work centered on the hosted/private git-source build path: shell-string git execution was replaced with guarded argument-vector execution, and HTTPS credential handling was covered by tests.

## Docs & developer experience

Docs were a major theme in their own right. Pagenary's own docs (at docs.pagenary.com) gained live, in-page demos of the new effects and themes. There's a Page Effects guide with a recipe gallery, theme recipes, and step-by-step publishing walkthroughs. A getting-started on-ramp eases first-time setup. The pitch was refreshed to lead with low-cost, self-hosted docs for individual developers. CLI examples were canonicalized around `pagenary build`. An accessibility guide was added. And the project split its public docs from its working notes, so readers see only the finished docs.

## Tests & CI

New checks backed the month's features. A real-browser smoke test covers base-URL, title, and search. The build-time search-index gate catches a broken index. Accessibility scans check color contrast and keyboard focus. Git-source tests cover shell-safety and `GIT_CREDENTIALS`. The release pipeline gained the package-contents check above, plus an automatic cache-clear step on deploy.

## Cross-project impact

- Pagenary is the **publishing base for the whole portfolio**. It builds these monthly update sites and the docs sites across the stack — the Fortemi docs, for example. When it gains blogs and effects, every portfolio site can use them.
- Its **search runs on a vendored copy of the Fortemi engine** — the portfolio publishing on its own parts. Pagenary tracked new Fortemi releases through the month to stay current.
- The founder and company sites (**magly.net** and **integrolabs.io**) publish through Pagenary and the `@fortemi/` packages, so this month's work flows straight into them.
- Pagenary **publishes its own docs** (docs.pagenary.com) — it dogfoods itself, including the new blog and effects.

## Known issues & open threads

- **Blog support is Phase 1.** More blog capability is planned beyond this first set of layouts and navigation.
- The **effects suite is new and broad.** As more sites adopt it on large pages, expect ongoing polish to scrolling and layout.
- **Accessibility work is early.** The report artifacts, strict mode, and contrast/focus checks are a foundation to build on.
- **React integration is being shaped as an optional consumer layer.** The current direction is not to rebuild Pagenary in React. It is to let React apps consume Pagenary's static output, metadata, Fortemi search index, and graph data through a small client or React package.
- **Editor tooling is on the backlog.** A VS Code-compatible extension is planned for Pagenary Markdown preview and config validation, so authors can catch content and schema issues before a full build.
- **Hosted-service boundaries are still being refined.** Public package fields are being kept focused on self-hosted static publishing while private hosted-worker work continues separately.

## What's next

Take the blog family beyond Phase 1, keep polishing mixed docs/blog sites and the on-this-page contents strip, continue the accessibility work, prove the React/static-artifact integration path, build the editor-extension workflow, and keep the bundled Fortemi search engine current. Pagenary increasingly publishes itself and the rest of the portfolio — including this report.

## Appendix

- **What it is:** a tool that turns Markdown into a fast, hostable docs or blog site; one setup can publish many branded sites.
- **Package:** `@pagenary/publisher` on npm.
- **Released this month:** the 2026.6.x line, published steadily to npm through June, reaching `2026.6.18` by June 29.
- **Search:** powered by a bundled copy of the Fortemi engine (`@fortemi/core`).
- **Source · sites:** github.com/jmagly/pagenary · pagenary.com · docs.pagenary.com · window: all of June 2026.
- **Related:** Fortemi (search engine) · the portfolio docs sites and monthly updates that publish through Pagenary.

<!-- Comprehensive report per report-spec.md, written for users at ~6th-grade reading level. Public/dev voice. No AI attribution. Flagship active month. Verified against current repo history and artifacts through 2026.6.18 on June 29, 2026. Themes: blog layout family (Phase 1), mixed docs/blog sites, page-effects suite, Fortemi-backed search (vendored @fortemi/core), docs-map, theming/nav, form embeds, CLI promotion, hosted/private git-source hardening, managed-hosting boundary cleanup, markdown/publishing robustness, accessibility, React integration planning, and editor-tooling backlog. Internal #N citations and volatile totals/latest-version pins omitted. Cross-link: Pagenary search runs on a vendored Fortemi engine; the portfolio's docs sites + magly.net/integrolabs.io publish through Pagenary. -->
