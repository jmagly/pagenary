---
title: Pagenary syntax gallery
summary: Buildable, copyable examples of every supported authoring construct.
---

# Pagenary syntax gallery

This tenant is the executable companion to `docs/SUPPORTED-SYNTAX.md` in the publisher package.
Each inventory item names a page and an anchor, and CI checks that both remain present.

- Start with [Markdown](#markdown).
- See [Inline LaTeX](#inline-latex) for math embedded in prose.
- See [Diagrams](#diagrams) for Mermaid and PlantUML.
- See [Media and forms](#media-forms) for richer embeds.
- Open [Complete LaTeX page](#latex-page) for a `.tex` source rendered as the page itself.

The gallery's normal build uses warning fallbacks for optional local tools. It therefore builds on a
machine without PlantUML while preserving the authored source and a diagnostic. Release projects can
switch their own policy to `strict` after installing and qualifying the renderer.
