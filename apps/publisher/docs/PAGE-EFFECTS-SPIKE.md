# Page Effects R&D Spike

This note resolves the page-effects catalog spike tracked in #57. It evaluates
additional content-site effects against the #51 invariants and recommends the
next set of production primitives. The spike does not add runtime APIs or
production CSS contracts; prototype markup lives in the `page-effects` example
tenant and is intentionally throwaway.

## Evaluation Criteria

Every candidate was checked against these constraints:

- Opt-in with a `.pe-*` class or `data-pe-*` hook.
- Accessible semantics and keyboard operation where interactive.
- Reduced-motion support with a static final state.
- Progressive enhancement: content remains complete when JavaScript is off.
- Theme-token aware styles using existing color and spacing tokens.
- Layout-agnostic behavior inside the `.canvas` scroll container.
- Runtime lifecycle compatibility through `registerEffect` / `initPageEffects`
  when JavaScript is needed.
- No heavy animation dependencies.

## Candidate Matrix

| Candidate | Decision | Rationale |
| --- | --- | --- |
| Staggered/sequenced reveal | Accept | Small extension of `data-reveal`; can use CSS custom properties and the existing observer. |
| Generalized parallax | Accept | The hero parallax logic can be promoted to `[data-pe-parallax]` with per-element speed limits. |
| Scroll-spy | Accept | High docs value; can observe headings and update existing TOC state without changing document content. |
| Scrollytelling | Accept | Strong landing-page pattern; higher effort but can be built from sticky layout plus step observers. |
| Per-section / circular progress | Defer | Useful, but overlaps reading-progress metadata and risks visual noise in dense docs. |
| SVG line-draw / count-up | Defer | Attractive for marketing pages, but numeric animation needs careful reduced-motion and semantic fallback. |
| Animated gradient / mesh / subtle noise | Accept | CSS-only and theme-token aware when treated as decorative background. |
| Scroll-snap sections | Accept | CSS-first, no runtime dependency; must remain opt-in and avoid trapping keyboard users. |
| Hero typewriter / scramble text | Reject | Conveys content through animation and adds accessibility risk for limited product value. |
| Tabs / accordion disclosure | Accept | High utility; native `<details>` gives a strong no-JS baseline, tabs can enhance later. |
| Before/after image comparison | Accept | Valuable for visual case studies; needs labelled controls and a static side-by-side fallback. |
| Figure lightbox / zoomable images | Accept | Common docs/blog need; can start with anchor/dialog semantics and no autoplaying motion. |
| Logo/marquee ticker | Defer | Often decorative and easy to overuse; acceptable only if pause/focus and reduced-motion rules are strict. |
| Card hover lift / spotlight glow | Defer | Low content value and pointer-biased; can remain recipe-level CSS rather than a toolkit primitive. |

## Throwaway Prototypes

The example page at `examples/page-effects/content/effects-spike.md` prototypes
three candidates without adding production primitives:

- Native disclosure stack for accordion-style content.
- CSS scroll-snap feature panels.
- CSS-only figure zoom/lightbox pattern using `<details>`.

These examples deliberately use `pe-spike-*` class names so they do not become a
supported API. They use real HTML semantics, token-aware colors, and a
`prefers-reduced-motion` block. With JavaScript disabled, all content remains in
the document and the interactive controls still use browser-native behavior.

## Recommended Implementation Order

1. **Disclosure primitives**: accordion first, then optional tabs enhancement.
   This is the highest utility and lowest runtime risk.
2. **Scroll-spy**: highlight the active heading in the existing navigation/TOC
   while preserving keyboard and hash-link behavior.
3. **Staggered reveal**: extend `data-reveal` with child sequencing via
   attributes such as `data-reveal-stagger`.
4. **Generalized parallax**: promote parallax beyond heroes with clamped speed
   and reduced-motion fallback.
5. **Figure lightbox / zoom**: start from accessible links or native dialog,
   then layer optional enhancement.
6. **Scroll-snap sections**: CSS-first layout primitive for portfolio/landing
   tenants, with clear opt-in boundaries.
7. **Scrollytelling**: implement after scroll-spy and sticky primitives prove
   stable, because it combines both behaviors.
8. **Decorative gradient/noise backgrounds**: ship as static CSS recipes first;
   add motion only behind reduced-motion gates.
9. **Before/after comparison**: implement once the media layer is settled so
   images, labels, and captions share the same accessibility model.

## Follow-Up Checklist

- [ ] Add an accordion/disclosure issue with native `<details>` baseline and
      optional grouped behavior.
- [ ] Add a scroll-spy issue scoped to docs/blog heading navigation.
- [ ] Add a staggered reveal issue extending the existing reveal observer.
- [ ] Add a generalized parallax issue that reuses the hero parallax clamps.
- [ ] Add a figure zoom/lightbox issue aligned with the media rendering work.
- [ ] Add a scroll-snap sections issue for landing/portfolio layouts.
- [ ] Add a scrollytelling issue after scroll-spy and sticky behavior are
      validated together.
- [ ] Keep decorative backgrounds and hover effects as recipes unless customer
      demand justifies production primitives.
