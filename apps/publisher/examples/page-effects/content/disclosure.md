---
title: Disclosure (accordion)
summary: Production accordion built on native <details> — works with zero JS, keyboard-operable, single-open optional.
hero:
  eyebrow: Primitive
  title: Disclosure
  subtitle: An accordion that's just native <details> — accessible and complete with JavaScript off.
  align: start
---

# Disclosure (accordion)

`.pe-accordion` styles native `<details>/<summary>`, so each panel opens, closes,
and takes keyboard focus with **zero JavaScript**. Add `data-pe-single` to make it
single-open — opening one panel closes its siblings — which is a pure enhancement:
with JS off, every panel still works independently and no content is ever hidden
behind the script.

```html
<div class="pe-accordion" data-pe-single>
  <details open>
    <summary>What is a page effect?</summary>
    <p>An opt-in, accessible enhancement — heroes, reveal-on-scroll, living scroll,
       disclosure — that degrades to plain content when JavaScript or motion is off.</p>
  </details>
  <details>
    <summary>Does it work without JavaScript?</summary>
    <p>Yes. The accordion is native <code>&lt;details&gt;</code>. The only thing JS
       adds is the single-open grouping, and that's optional.</p>
  </details>
  <details>
    <summary>Is it keyboard accessible?</summary>
    <p>Native disclosure is operable with Enter/Space and shows a visible focus
       ring. The open/closed state uses a +/− marker, not color alone.</p>
  </details>
</div>
```

Drop `data-pe-single` to let multiple panels stay open at once. Style is theme-token
aware, so it inherits each tenant's palette automatically.
