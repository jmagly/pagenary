# Rich Content Assistive-Technology UAT Record

**Date:** 2026-08-05
**Platform:** Linux, Orca 46.1, Google Chrome with forced renderer
accessibility, AT-SPI 2, Xvfb, D-Bus accessibility bus
**Artifact:** built `syntax-gallery` tenant
**Result:** PASS

This is a real assistive-technology session, separate from Playwright's CDP
accessibility-tree assertion. Orca was running and registered on the AT-SPI bus;
Chrome was launched with its platform accessibility implementation forced on.
The checked-in `scripts/smoke-rich-content-atspi.py` client activated Pagenary's
route buttons through their AT-SPI action interface, then inspected the same
platform tree consumed by Orca.

## Results

| Scenario | Expected | Observed |
|---|---|---|
| Navigate to Inline LaTeX | Route control is exposed and actionable | AT-SPI action changed the document to `Inline LaTeX · Pagenary Syntax Gallery` |
| Math semantics | Representative expressions are platform math objects | 5 `math` roles exposed |
| Math reading structure | Page and subsection headings remain available | `INLINE LATEX`, `INLINE DELIMITERS`, `DISPLAY DELIMITERS`, `PROTECTED CONTEXTS` |
| Navigate to diagrams | Route control is exposed and actionable | AT-SPI action changed the document to `Diagrams · Pagenary Syntax Gallery` |
| Diagram alternatives | Five representative diagrams have meaningful names | Flowchart, sequence, class, state, and entity-relationship image names exposed |
| Reading order | Caption/source order remains stable | Independently asserted in Chromium, Firefox, and WebKit browser matrix |

Captured assertions:

```text
{'mode': 'math', 'documents': [('document web', 'Inline LaTeX · Pagenary Syntax Gallery')], 'mathNodes': 5, 'headings': ['INLINE LATEX', 'INLINE DELIMITERS', 'DISPLAY DELIMITERS', 'PROTECTED CONTEXTS']}
{'mode': 'diagrams', 'documents': [('document web', 'Diagrams · Pagenary Syntax Gallery')], 'namedImages': [('image', 'Flowchart: publishing path'), ('image', 'Sequence: local build'), ('image', 'Class diagram: page renderer'), ('image', 'State diagram: publication lifecycle'), ('image', 'Entity relationship: pages and assets')]}
```

Orca's application inventory in the same session showed both `/usr/bin/orca`
and the Chrome process. The session used no remote content or renderer service.
The expected headless-session portal/GVFS warnings did not affect the AT-SPI
registry or assertions.

## Reproduction

1. Build and serve `apps/publisher/dist/syntax-gallery`.
2. Start an X display and D-Bus session with `NO_AT_BRIDGE=0`.
3. Start Orca 46.1 with a debug file.
4. Start Chrome with `--force-renderer-accessibility` and the local gallery URL.
5. Run:

```sh
/usr/bin/python3 apps/publisher/scripts/smoke-rich-content-atspi.py math
/usr/bin/python3 apps/publisher/scripts/smoke-rich-content-atspi.py diagrams
orca --list-apps
```

The Python gate fails if the document, route action, five MathML platform math
objects, or five named diagram images are absent.
