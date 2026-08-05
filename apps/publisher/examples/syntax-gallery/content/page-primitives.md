---
title: Page primitives
summary: Frontmatter, raw HTML, heroes, banners, and page-level controls.
template: guide
hero:
  eyebrow: Authoring
  title: Declarative page primitives
  subtitle: A hero, banner, and CTA without custom templates.
  image: assets/syntax-diagram.svg
  fullBleed: true
  overlay: true
  align: center
banner:
  title: Continue through the gallery
  text: Every feature has a copyable source file.
  cta:
    - { label: "Open diagrams", href: "#diagrams", style: primary }
---

# Page primitives

The frontmatter above exercises scalar values, nested maps, a list of maps, `template`, `summary`, a
declarative `hero`, and a CTA `banner`.

## Raw HTML fence

```html
<aside role="note"><strong>Trusted-author feature:</strong> raw HTML is emitted as authored.</aside>
```

HTML comments in prose are removed before publication. <!-- This sentence stays out of output. -->
