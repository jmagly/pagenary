# Docs Toolkit Architecture

A minimalist documentation shell built around static assets and client-side rendering. The goal is to keep deployments inexpensive while giving resellers a deliberate, repeatable structure for tenant documentation.

## Principles
- **No build-time frameworks** – vanilla HTML, CSS, and ES modules keep the footprint tiny and portable.
- **Deterministic navigation** – a manifest file defines ordering and grouping so every tenant sees a predictable outline.
- **Template parity** – each page type uses the shared renderer in `section-templates.js`, ensuring consistent markup and semantics.
- **Static-first operation** – all routing happens through hash fragments (`#/page-id`), so any static host can serve the bundle.

## Stack Overview
- Routing: hash-based navigation managed by `app.js`
- State: per-session state only (expanded nav groups, command palette query cache)
- Rendering: sections import `renderSectionTemplate` and return HTML strings
- Styling: a single `styles.css` file governs typography, layout, and responsive behavior

## Layout Shell
- **Top Bar** – menu toggle, brand mark, command palette toggle, export action
- **Sidebar** – manifest-driven navigation with expand/collapse groups and accessibility focus management
- **Canvas** – main content area receiving rendered section HTML and handling export/highlight interactions
- **Footer** – brand-neutral copy with programmable year marker

## Extensibility Notes
- Additional page types can be added by extending the configuration in `section-templates.js`.
- Navigation groupings live in `manifest.js`; new sections only need to supply an ID and template metadata.
- Because everything ships as static assets, integration with CDNs, S3, or containerized gateways requires zero bespoke logic.
