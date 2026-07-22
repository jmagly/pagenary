# @pagenary/react

Optional React/Vite adapter for Pagenary hybrid tenant routes.

`@pagenary/publisher` does not depend on this package. Tenants opt in with
`runtime.mode: "hybrid"` or `runtime.mode: "react-spa"` and install the adapter
beside the publisher. The adapter builds a tenant-local React entry with Vite
into `dist/<tenant>/assets/react/` without emptying the Pagenary tenant output.

Node requirements follow Vite: Node `20.19+` or `22.12+`. The publisher package
keeps its Node `>=16` static runtime floor.

## Fortemi Docs Map

Hybrid tenants can enhance the generated Docs Map fallback with the Fortemi
React graph control:

```jsx
import { mountFortemiDocsMap } from '@pagenary/react/docs-map';

mountFortemiDocsMap();
```

Set `docsMap.renderer` to `fortemi-react` in the tenant config. The publisher
still emits the static SVG Docs Map first; the React helper mounts into
`#docsMapRoot` when the bundle is present and loads `docs-map-data.js`.

The docs map inherits the tenant's `--surface`, `--ink`, `--muted`, and
`--accent` design tokens. The adapter maps them to Fortemi's GraphView CSS
variables and concrete Sigma/3D themes, preserves community/greyscale/custom
node palettes, and responds to `class`, `style`, or `data-theme` changes on the
page root. Theme switchers that replace styles without changing those
attributes can dispatch `pagenary:themechange` on `window` to request a refresh.
