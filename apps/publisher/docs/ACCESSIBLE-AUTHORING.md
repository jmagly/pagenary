# Accessible Authoring

Pagenary gives authors accessible defaults, but accessible sites still depend on
the content you write. Use this guide when creating Markdown, HTML blocks,
diagrams, media, embeds, and tenant configuration.

## Quick Checklist

- Use one clear `#` heading for the page title, then nest headings in order.
- Give every meaningful image useful alt text.
- Mark decorative images as decorative instead of describing them.
- Write links that make sense out of context.
- Use real tables only for tabular data, with headers.
- Provide captions, transcripts, or review notes for audio and video.
- Label embedded content such as iframes, maps, forms, and videos.
- Avoid putting important text only inside images.
- Keep custom colors high contrast.
- Test the page with keyboard navigation and reduced motion enabled.

## Headings

Headings are the page outline. Screen-reader users and search tools rely on
them to skim and navigate.

Good:

```markdown
# Installation

## Requirements

## Install the CLI

### Verify the install
```

Avoid skipping levels or using headings only for visual size:

```markdown
# Installation

#### Verify the install
```

Pagenary can detect some heading jumps. It cannot always tell whether a heading
is useful or whether the page outline matches the author's intent.

## Images And Alt Text

Alt text should describe the information the image contributes in context.

Good:

```markdown
![Build status panel showing a failed deploy with a missing alt-text warning](assets/build-warning.png)
```

Too vague:

```markdown
![Screenshot](assets/build-warning.png)
```

Decorative image:

```text
<img src="assets/flourish.svg" alt="" role="presentation">
```

Pagenary can warn when alt text is missing. It cannot prove that present alt
text is meaningful, complete, or appropriate for the surrounding text.

## Links

Write link text that tells readers where the link goes.

Good:

```markdown
Read the [deployment guide](#deployment).
```

Avoid:

```markdown
[Click here](#deployment)
https://example.com/releases/2026/06/notes
```

Repeated links with the same text should point to the same destination. If they
do not, make the text more specific.

## Tables

Use tables for structured data, not for layout. Include a header row and keep
cells short enough to reflow on smaller screens.

Good:

```markdown
| Setting | Purpose |
| --- | --- |
| `basePath` | Mount the tenant under a subpath. |
| `strictLinks` | Fail the build on broken internal links. |
```

If a table needs long paragraphs, lists, or nested controls, a heading-and-list
section is usually easier to read and navigate.

## Diagrams

Diagrams need an accessible text equivalent. For Mermaid or generated graph
views, provide a nearby summary that explains the important relationships.

```markdown
The diagram shows the build flow: content is loaded, Markdown is rendered,
search data is generated, static snapshots are written, and deploy artifacts are
published.
```

Pagenary can check for adjacent text or labels in some cases. It cannot know
whether the prose explains every important visual relationship.

## Media

Audio and video need an accessible alternative:

- Captions for spoken video.
- Transcripts for audio and video.
- Audio description or a written description when important visual information is not spoken.
- Keyboard-accessible controls.
- No autoplaying audio.

For generated narration, keep the article text available. Narration should be an
optional enhancement, not the only way to consume the content.

## Embeds And Third-Party Content

Embeds are a shared responsibility. Pagenary can require labels and report that
an embed needs review, but the provider controls much of the embedded UI.

Use descriptive titles:

```text
<iframe
  title="Quarterly roadmap presentation"
  src="https://example.com/embed/roadmap">
</iframe>
```

Avoid unlabeled embeds:

```text
<iframe src="https://example.com/embed/roadmap"></iframe>
```

If the embed contains video, audio, forms, maps, or interactive charts, add a
short text summary before or after the embed.

## Custom HTML

Prefer native HTML elements before adding custom JavaScript.

- Use `<button>` for actions.
- Use `<a>` for navigation.
- Use `<details>` and `<summary>` for simple disclosure.
- Use form labels tied to inputs.
- Keep focus visible.
- Do not trap focus unless implementing a real modal dialog.

Risky patterns that require manual review:

- `onclick` handlers on non-interactive elements.
- Empty buttons or icon-only controls without accessible names.
- `tabindex` values greater than `0`.
- Hidden content that is not exposed to assistive technology.
- Custom widgets without keyboard behavior.

## Color And Motion

Custom tenant colors should preserve readable contrast. Do not rely on color
alone to communicate status; pair color with text, icons, or labels.

Motion should be optional. If a page uses animation, parallax, scrolling
effects, or video backgrounds, make sure the content remains readable when
`prefers-reduced-motion` is enabled and when JavaScript is disabled.

## Warnings, Strict Mode, And Manual Review

Pagenary accessibility checks should be read as guidance, not a complete audit.
Tenant builds now run an authored-content accessibility linter. By default it
reports findings in advisory mode; set `accessibility.strict: true` in tenant
config to fail builds on high-confidence errors.

Advisory warnings are for issues that are likely problems but may need context:

- Ambiguous link text such as `learn more`.
- Duplicate raw HTML IDs.
- Risky raw HTML patterns such as inline event handlers or positive `tabindex`.
- Missing tenant language metadata.

Strict-mode failures are for high-confidence issues:

- Missing alt text on a meaningful image.
- Empty links.
- Broken heading order.
- Data tables without headers.
- Unlabelled iframes.
- Duplicate raw HTML IDs.

Manual review is still required for:

- Alt text quality.
- Captions and transcripts.
- Custom HTML behavior.
- Third-party embed accessibility.
- Uploaded PDFs and office documents.
- Domain-specific content clarity.

## Before Publishing

For important pages, run this quick manual pass:

- Tab through the page and confirm focus is visible and logical.
- Use browser zoom or a narrow viewport and confirm content reflows.
- Enable reduced motion and confirm animated content remains readable.
- Read only headings and link text; confirm the page still makes sense.
- Confirm every image, diagram, media item, and embed has a useful text path.
