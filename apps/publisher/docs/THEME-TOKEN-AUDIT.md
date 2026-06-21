# Theme Token Audit

This note records the current source of truth for Pagenary theme tokens and the
intentional exceptions that remain outside the token model.

## Sources Of Truth

Themeable UI colors start in `apps/publisher/src/styles.css` under `:root`.
The canonical runtime variables are:

| Token | Purpose |
|-------|---------|
| `--surface` | Page, panel, and modal surfaces |
| `--surface-rgb` | RGB channels for translucent surface overlays |
| `--ink` | Primary text, strong borders, active marks |
| `--ink-rgb` | RGB channels for translucent ink tints |
| `--muted` | Secondary labels and descriptions |
| `--accent` | Active progress, graph accents, selected affordances |
| `--grid-line` | Dividers, low-emphasis borders |
| `--highlight-bg` | Search highlight fill |
| `--highlight-border` | Search highlight edge |
| `--font-body` | Prose and general UI font stack |
| `--font-mono` | Code and compact technical UI font stack |

Tenant builds resolve config in `apps/publisher/scripts/build-tenants.js`.
`THEME_PRESETS` defines the built-in `light`, `dark`, and `matrix` palettes.
`resolveTheme()` merges presets, custom `theme` objects, and legacy keys such as
`accentColor`, `surfaceColor`, `inkColor`, `mutedColor`, and `gridLineColor`.
`renderThemedCss()` writes both base tokens and channel tokens, so generated
tenant stylesheets have the same variable contract as the source stylesheet.

`apps/publisher/tenants.schema.json` and `apps/publisher/docs/TENANT-CONFIG.md`
must stay aligned with that build behavior. The schema is intentionally
permissive for custom theme object properties so new build-time override keys can
ship without invalidating existing tenant configs.

## Component Coverage

Interactive chrome should use tokens directly:

- overlays and popups use `--surface`, `--surface-rgb`, `--ink`, `--ink-rgb`,
  and `--grid-line`;
- command palette, export popups, Docs Map popups, Fortemi metadata popovers,
  Mermaid controls, mobile sidebar, and nav hover states should not rely on raw
  `white`, `#000`, or `rgba(0, 0, 0, …)` values;
- docs content, generated architecture widgets, layer stacks, and bottom nav
  should use `--ink-rgb` for low-emphasis fills and `--grid-line` for borders.

The runtime theme picker emits full `theme-<name>.css` files using the same
renderer as the baked default stylesheet. A dark or custom theme should not need
component-specific JavaScript to keep overlays, popups, and toolbars readable.

## Intentional Exceptions

Some raw colors remain by design:

- `:root` token defaults are literal colors because they define the token base.
- `--grid-line`, `--highlight-bg`, and `--highlight-border` may be literal
  `rgba(...)` values because they are tokens.
- Mermaid error states use fixed red values until a dedicated status-token set
  exists.
- Prism syntax highlighting token colors stay literal for language readability;
  they are a syntax palette, not app chrome.
- Neutral black alpha shadows may remain when they model depth rather than
  foreground tint. Component fills, controls, borders, and overlays should prefer
  tokens.

## Regression Expectations

Theme-related tests should prove both source and generated output:

- source CSS defines every variable it uses, including channel variables;
- theme builds regenerate `--surface-rgb` and `--ink-rgb`;
- dark/custom theme picker output carries the same token contract as
  `styles.css`;
- modal/overlay surfaces use theme variables rather than hard-coded legacy
  white/black styling.
