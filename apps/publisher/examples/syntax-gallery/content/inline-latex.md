---
title: Inline LaTeX
summary: KaTeX math in inline and display contexts, with bounded page-scoped macros.
inlineLatex:
  dollarDelimiters: true
---

# Inline LaTeX

## Inline delimiters

Euler's identity is \(e^{i\pi}+1=0\), a vector is \(\vec{x}\in\RR^n\), and this page opts into
single-dollar syntax: $a^2+b^2=c^2$.

## Display delimiters

\[
  \int_0^1 x^2\,dx = \frac{1}{3}
\]

$$
\begin{aligned}
f(x) &= x^2 + 2x + 1 \\
     &= (x+1)^2
\end{aligned}
$$

## Protected contexts

The following remains literal: `\(not math\)`. Link destinations are also protected by the inline-LaTeX
pass; percent-encode special characters in URLs as usual.

```tex
\(also not rendered inside a fence\)
```
