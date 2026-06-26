# Accessibility Planning

Pagenary should make accessible publishing the default path, while being clear
about the boundary between platform-generated output and user-authored content.
This planning note resolves the ADA/accessibility spike in #50 and sets the
standard, product scope, testing strategy, workflow design, and remediation
backlog for follow-up implementation.

## Standards Decision

Pagenary's product target is **WCAG 2.2 Level AA** for:

- Generated tenant/output sites.
- Product-authored templates, themes, navigation, search, exports, reports, and
  controls.
- Any Pagenary-managed hosting/control-panel UI.

Rationale:

- WCAG 2.2 is additive over WCAG 2.1 and 2.0, so targeting 2.2 AA gives the
  product a stronger forward-looking baseline while remaining compatible with
  policies that cite earlier WCAG 2.x levels.
- The U.S. DOJ Title II web/mobile rule for state and local governments uses
  **WCAG 2.1 Level AA** as the technical standard. That makes WCAG 2.1 AA the
  public-sector legal reference floor, not the ceiling for Pagenary's product
  design.
- The Access Board's Revised Section 508 standards apply accessibility
  requirements to federal ICT and incorporate WCAG 2.0 by reference. Pagenary's
  2.2 AA product target is stricter than that baseline for web output.

Primary references:

- W3C WCAG 2.2: <https://www.w3.org/TR/WCAG22/>
- W3C partial conformance / third-party content: <https://www.w3.org/TR/WCAG22/#cc4>
- W3C ATAG 2.0: <https://www.w3.org/TR/ATAG20/>
- DOJ ADA web guidance: <https://www.ada.gov/resources/web-guidance/>
- DOJ Title II web/mobile rule fact sheet: <https://www.ada.gov/resources/2024-03-08-web-rule/>
- U.S. Access Board Revised 508 Standards: <https://www.access-board.gov/ict/>
- W3C evaluation overview: <https://www.w3.org/WAI/test-evaluate/>
- W3C selecting evaluation tools: <https://www.w3.org/WAI/test-evaluate/tools/selecting/>
- W3C WCAG-EM methodology: <https://www.w3.org/TR/WCAG-EM/>
- W3C ACT overview: <https://www.w3.org/WAI/standards-guidelines/act/>

This is a product planning target, not legal advice or a compliance warranty.

## Responsibility Model

Pagenary owns what it generates and controls:

- Semantic shell structure: landmarks, headings, navigation regions, document
  titles, search UI, command palette, modals, dialogs, and generated metadata.
- Keyboard and focus behavior for generated navigation, search, docs map,
  page-effects runtime, exports, media players, and hosting/control-panel flows.
- Theme defaults, token contrast checks, focus indicators, motion defaults, and
  reduced-motion fallbacks.
- Build-time linting for high-confidence content issues.
- Accessibility reports, warnings, strict-mode failures, and remediation
  guidance.
- Accessible authoring surfaces and documentation.

Site owners remain responsible for content Pagenary cannot fully judge:

- Whether alt text is meaningful, not merely present.
- Captions, transcripts, and audio descriptions for uploaded media.
- Link text quality and heading organization in authored content.
- Third-party embeds, custom HTML/JS, uploaded PDFs/documents, and externally
  hosted widgets.
- Custom brand colors, images with text, complex tables, and domain-specific
  terminology.

Pagenary should not claim blanket compliance for all user content. Reports
should separate **platform checks passed**, **content warnings**, and **manual
review required**.

## Output-Site Checklist

Generated structure:

- One meaningful page title per route and static snapshot.
- One primary `<main>` region and predictable landmark order.
- Navigation has labels, current-page state, keyboard access, and visible focus.
- Skip-link support is available for keyboard users.
- Hash routes, deep links, and static snapshots expose the same content.
- Generated headings do not skip levels without reason.

Content rendering:

- Markdown headings, lists, tables, blockquotes, code blocks, and links preserve
  semantic HTML.
- Images preserve alt text; missing alt text emits a warning or strict-mode
  failure based on confidence.
- Decorative generated images use empty alt or `aria-hidden` as appropriate.
- Tables require headers or produce warnings.
- Links warn on empty, repeated ambiguous, or raw URL-only text.
- Mermaid/diagram output has an accessible label or adjacent text fallback.

Navigation and search:

- Sidebar, bottom nav, post nav, command palette, search results, and docs map
  are keyboard operable.
- Dialogs trap focus only while open and return focus on close.
- Search result count/status changes are announced without excessive chatter.
- Active search/result states do not rely on color alone.

Visual design:

- Default themes meet WCAG AA text contrast.
- Focus indicators are visible against all shipped themes.
- Custom tenant colors are checked for contrast risk.
- Zoom and reflow remain usable at narrow widths and high magnification.
- Icons and badges do not convey required information without text.

Motion and interaction:

- Motion is opt-in and gated by `prefers-reduced-motion`.
- Content is never hidden solely until JavaScript runs.
- Page effects, progress indicators, and sticky/parallax behavior degrade to
  static readable content.
- Pointer-only effects are non-essential and do not block keyboard users.

Metadata and exports:

- Static snapshots include accessible document titles and metadata.
- Print/export output preserves headings, reading order, links, and alt text
  where the target format supports it.
- Export controls are labelled and keyboard reachable.

## Control-Panel And Hosting Flows

The managed hosting/control-panel UI should help users publish accessible sites
without requiring them to know every WCAG criterion.

Authoring:

- Inline warnings for missing alt text, heading jumps, ambiguous links, and
  risky custom HTML.
- A visible "Accessibility" panel on preview/build results.
- Clear severity levels: error, warning, manual review, passed.
- Short remediation text with links to relevant docs.

Preview:

- Toggleable checks for keyboard path, reduced-motion preview, color contrast,
  missing labels, and snapshot parity.
- Strict accessibility mode preview so teams can see what would fail CI.

Build and deployment:

- Default mode warns on content issues and blocks only high-confidence platform
  regressions.
- Strict mode fails builds for high-confidence WCAG AA issues, missing required
  metadata, missing image alt text, inaccessible generated controls, and contrast
  failures in chosen theme tokens.
- Generated report artifact should be saved next to build output, for example
  `accessibility-report.json` and `accessibility-report.html`.

Dashboard:

- Site list shows latest accessibility status.
- Each site has a report history with changed issue counts.
- Reports distinguish "Pagenary-generated", "tenant theme", "authored content",
  and "manual review required".

Low-fidelity report layout:

```text
Accessibility
Status: Needs review
Target: WCAG 2.2 AA

Summary
Passed: 42    Warnings: 6    Errors: 1    Manual review: 5

Errors
[Generated control] Search dialog close button has no accessible name.
Action: fix generated template. Build blocked in strict mode.

Warnings
[Authored content] image in /install has missing alt text.
Action: add alt text or mark decorative.

Manual review
[Media] embedded video in /overview needs captions/transcript confirmation.
Action: verify media provider captions.
```

## Testing Strategy

Automated checks are necessary but insufficient. W3C evaluation guidance is
explicit that tools assist evaluation; they cannot prove accessibility alone.

Automated gates:

- Static content lint: headings, image alt presence, empty links, table headers,
  duplicate IDs, language metadata, iframe titles, and raw HTML risk patterns.
- Template assertions: landmarks, button/link labels, focusable controls, dialog
  attributes, nav current state, and reduced-motion CSS coverage.
- Browser scans on built output with axe-core or equivalent.
- Contrast checks against shipped theme tokens and tenant color overrides.
- Snapshot parity checks so generated static pages expose the same headings,
  landmarks, and metadata as the SPA route.

Manual checks:

- Keyboard-only route through nav, search, command palette, docs map, post nav,
  export controls, and any managed-hosting forms.
- Screen-reader smoke checks with at least one common desktop reader/browser
  pair before release.
- Reduced-motion checks for page effects and blog living scroll.
- Zoom/reflow checks around 200% zoom and narrow mobile widths.
- Representative content sampling using WCAG-EM style page selection:
  home/default page, docs page, blog page, search, generated graph/map page,
  media-rich page, export/print view, and any custom tenant showcase.

Regression expectations:

- Every new generated control gets a unit or DOM test for name/role/state when
  practical.
- Every page-effect or media primitive must document JS-off and reduced-motion
  behavior before release.
- Strict-mode build failures must include file/route, rule, severity, and
  remediation text.

## Accessibility Reports

Tenants can opt into generated report artifacts:

```json
{
  "accessibility": {
    "report": {
      "enabled": true
    }
  }
}
```

When enabled, tenant builds emit:

- `accessibility-report.json` for dashboards, CI summaries, and hosting status.
- `accessibility-report.md` for human review in build artifacts.

The JSON report includes:

- `status`: `passed`, `warning`, or `error`.
- `summary.passed`, `summary.warning`, `summary.error`, and
  `summary.manualReview`.
- `byResponsibility`: grouped findings for `pagenary-generated`,
  `tenant-theme`, `authored-content`, and `manual-review-required`.
- `findings`: normalized route/file/rule/severity/remediation records.

Manual-review items are included by default because automated checks cannot
prove alt text quality, caption accuracy, third-party embed behavior, or custom
HTML keyboard behavior. Set `accessibility.report.manualReview: false` only when
a separate review workflow records that state.

## Remediation Backlog

Priority 1:

- Content accessibility linter: implemented for heading order, missing image
  alt text, empty or ambiguous links, table headers, iframe titles, duplicate
  IDs, language metadata, and risky raw HTML. Findings include file, route,
  rule, severity, and remediation text.
- Add a browser-based accessibility smoke test for the generated docs tenant and
  example tenants.
- Add theme-token contrast validation for defaults and tenant overrides.
- Generated accessibility report artifact: implemented as JSON and Markdown
  output with severity and split-responsibility grouping.

The theme/focus regression gate lives in `scripts/check-accessibility.js`; the
content-linter self-test lives in `scripts/check-accessibility-linter.js`; the
report artifact self-test lives in `scripts/check-accessibility-report.js`. All
three run through `npm run check`.

Priority 2:

- Strict accessibility mode: implemented via `accessibility.strict: true`, which
  turns high-confidence authored-content findings into build failures.
- Add dashboard/report UX for hosted sites.
- Add reduced-motion and keyboard regression tests for page effects, docs map,
  command palette, search, post navigation, and export controls.
- Add authoring docs for alt text, headings, links, tables, embeds, media, and
  custom HTML.

Priority 3:

- Add media caption/transcript guidance and checks as part of the media renderer
  work.
- Add accessibility metadata to generated reports and exports.
- Add optional manual-review checklist export for site owners.

Author-facing guidance now lives in [Accessible Authoring](ACCESSIBLE-AUTHORING.md).

## Follow-Up Issue Split

Use these issue-ready slices:

1. **Accessibility content linter and strict mode**
   - Build-time content checks, severity mapping, config surface, and strict
     mode failure behavior.
2. **Accessibility report artifact and dashboard summary**
   - JSON/HTML report output, categories, remediation text, and hosted-site
     dashboard status.
3. **Theme contrast and focus regression coverage**
   - Token contrast checks, tenant override warnings, focus-visible assertions,
     and shipped-theme test matrix.
4. **Browser accessibility smoke tests**
   - axe-core or equivalent scans over built docs/example tenants plus keyboard
     path smoke coverage.
5. **Authoring guidance for accessible content**
   - Docs and preview guidance for alt text, headings, links, tables, diagrams,
     embeds, media, and custom HTML.
6. **Media accessibility checks**
   - Caption/transcript/manual-review handling for #59 and #60 media/narration
     work.

## Product Commitment

Recommended public language:

> Pagenary targets WCAG 2.2 AA for generated templates, navigation, themes, and
> product-authored UI. For user-authored content, Pagenary provides checks,
> warnings, reports, and strict-mode build gates where issues can be detected
> reliably. Some content and third-party media still require human review.

Avoid stronger blanket claims unless the site owner has completed a full
content audit.

See [Accessible Authoring](ACCESSIBLE-AUTHORING.md) for practical author-facing
guidance.
