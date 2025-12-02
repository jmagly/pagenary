# ADR-002: Zero-Dependency Philosophy

**Status**: Accepted
**Date**: 2025-12-01
**Decision Makers**: Architecture Team

## Context

Pagenary faces a critical decision regarding its approach to external dependencies. Several factors motivate this architectural decision:

- **Supply Chain Risk**: The JavaScript ecosystem has experienced numerous high-profile supply chain attacks (e.g., event-stream, ua-parser-js, colors.js). Each dependency introduces potential security vulnerabilities beyond our control.

- **Dependency Churn**: JavaScript frameworks and libraries undergo frequent breaking changes, major version upgrades, and occasional abandonment. Projects built on heavy dependency trees often spend significant effort on maintenance rather than feature development.

- **Build Complexity**: Modern JavaScript toolchains (Webpack, Babel, TypeScript compilers, bundlers) can become complex and brittle. Configuration drift, version conflicts, and obscure build errors consume developer time.

- **Long-term Maintainability**: Pagenary prioritizes longevity. Code written in vanilla JavaScript remains valid and functional indefinitely, whereas framework-dependent code may become obsolete.

- **Operational Simplicity**: Fewer dependencies mean simpler deployments, faster CI/CD pipelines, smaller attack surfaces, and reduced operational overhead.

- **Cost Efficiency**: Build infrastructure, storage for `node_modules`, and developer time spent debugging dependency issues all have costs that compound over time.

## Decision

Pagenary adopts a **zero-dependency philosophy** for runtime code, with minimal tooling for build processes:

1. **Use Vanilla JavaScript (ES Modules)**: All frontend and shared code is written in plain JavaScript using modern ES module syntax. No frameworks, no transpilers, no polyfills for supported browser targets.

2. **No Runtime Dependencies**: The published bundle contains zero external runtime dependencies. All functionality is implemented in-house or inlined as needed.

3. **Minimal Build Dependencies**: Limit build-time dependencies to essential tools only. Currently, only `terser` is used for minification. This keeps `package.json` lean and the build process fast.

4. **Write Utility Functions**: Instead of importing lodash, moment, axios, or similar utilities, implement the specific functions needed. This results in smaller, more tailored code.

5. **Leverage Browser APIs**: Modern browsers provide robust APIs for fetch, DOM manipulation, routing (History API), storage, and more. Use these directly rather than abstracting through libraries.

6. **Copy, Don't Import**: When external code is genuinely needed (e.g., a well-tested algorithm), copy and adapt the specific implementation rather than importing the entire package.

## Consequences

### Positive

- **Zero Supply Chain Vulnerabilities**: With no runtime dependencies, the SBOM (Software Bill of Materials) is minimal. Security audits are straightforward, and there are no upstream vulnerabilities to patch.

- **Fast Build Times**: Without heavy bundlers, transpilers, or dependency resolution, builds complete in seconds rather than minutes.

- **Long-term Maintainability**: Vanilla JavaScript code written today will work identically in 10 years. No framework migrations, no deprecation warnings, no breaking changes from upstream.

- **Smaller Bundle Sizes**: Only the code actually needed is shipped. No framework overhead, no dead code from large utility libraries.

- **Universal Compatibility**: ES modules work natively in all modern browsers and Node.js. No polyfills or compatibility layers required for supported environments.

- **No Ecosystem Lock-in**: The codebase can be moved, forked, or adapted without concern for framework licensing, ecosystem changes, or vendor decisions.

- **Transparent Code**: Every line of code is visible and auditable. No "magic" from frameworks obscures behavior or introduces unexpected side effects.

- **Faster Onboarding for Fundamentals**: Developers work directly with web standards, reinforcing core skills rather than framework-specific patterns.

### Negative

- **More Code to Write**: Functionality that frameworks provide (routing, state management, component lifecycle) must be implemented manually. This increases initial development time.

- **Pattern Implementation**: Common patterns (reactive state, virtual DOM diffing, dependency injection) may need to be implemented from scratch if required.

- **Team JavaScript Proficiency Required**: Developers must have strong vanilla JavaScript skills. Framework abstractions won't hide complexity or enforce patterns.

- **Longer Feature Development for Complex UI**: Features like drag-and-drop, complex forms, or data grids may take longer without specialized libraries.

- **Reinventing Wheels**: Some utilities will be rewritten that exist in mature libraries. These implementations may be less battle-tested initially.

### Risks

- **Complex Features May Require Reconsideration**: Certain features may eventually justify adding dependencies:
  - **Authentication**: OAuth/OIDC flows can be complex
  - **Real-time Updates**: WebSocket management and reconnection logic
  - **Rich Text Editing**: Full WYSIWYG editors are non-trivial
  - **Visualization**: Complex charting may benefit from established libraries

  *Mitigation*: Evaluate on a case-by-case basis. If a dependency is added, prefer small, focused libraries over frameworks. Document the decision in a new ADR.

- **Initial Productivity Impact**: Team members accustomed to frameworks may initially be slower.

  *Mitigation*: Develop internal utility modules, establish patterns, and document common solutions.

- **Perceived as Unconventional**: The approach may seem unusual to developers from framework-heavy backgrounds.

  *Mitigation*: Document the rationale thoroughly. Demonstrate the benefits through fast builds, simple debugging, and long-term stability.

## Alternatives Considered

### 1. React/Vue/Angular SPA

**Description**: Use a modern component framework to build the frontend as a Single Page Application.

**Pros**:
- Large ecosystem of components and tools
- Familiar to many developers
- Established patterns for state management and routing

**Cons**:
- Heavy bundle size (React alone is ~40KB gzipped)
- Framework version upgrades can be disruptive
- Build tooling complexity (Babel, Webpack/Vite, etc.)
- Supply chain exposure through dependencies

**Decision**: Rejected. The complexity overhead and supply chain risk outweigh the convenience benefits for this project.

### 2. Next.js/Nuxt/Astro Meta-framework

**Description**: Use a meta-framework that provides SSR/SSG capabilities with a modern development experience.

**Pros**:
- Excellent developer experience
- Built-in routing and optimization
- Good performance through static generation

**Cons**:
- Still introduces significant dependencies
- Framework-specific patterns and limitations
- Upgrade path tied to framework decisions
- Opinionated structure may not fit all use cases

**Decision**: Rejected. While these frameworks offer convenience, they still introduce the dependency problems we seek to avoid.

### 3. Vanilla JS with Full Build Tooling (Webpack/Vite)

**Description**: Use vanilla JavaScript but employ modern build tools for bundling, tree-shaking, and optimization.

**Pros**:
- Modern development experience (HMR, etc.)
- Powerful optimization capabilities
- Familiar tooling for most developers

**Cons**:
- Build tool configuration complexity
- Plugin ecosystem dependencies
- Configuration drift over time
- Build tool itself becomes a dependency to maintain

**Decision**: Rejected. The build tool complexity contradicts our simplicity goals.

### 4. Vanilla JS with Minimal Dependencies (Current Choice)

**Description**: Pure ES modules with only essential build tools (terser for minification).

**Pros**:
- Maximum simplicity
- Near-zero supply chain risk
- Fast, predictable builds
- Long-term maintainability

**Cons**:
- More manual implementation required
- Less "out of the box" functionality

**Decision**: **Accepted**. This approach best aligns with the project's priorities of simplicity, security, and long-term maintainability.

## Implementation Guidelines

1. **Before Adding Any Dependency**: Create an ADR documenting the need, alternatives considered, and justification.

2. **Utility Functions**: Place reusable utilities in `/src/utils/` with clear documentation and tests.

3. **Browser API Usage**: Prefer native APIs. Document any browser compatibility constraints.

4. **Code Review Standard**: Review PRs for unnecessary dependency additions or patterns that could be simplified.

5. **Annual Review**: Revisit this decision annually to ensure it still serves project goals.

## References

- [NPM Security Advisories](https://www.npmjs.com/advisories)
- [Event-Stream Incident Post-mortem](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident)
- [Vanilla JS Movement](http://vanilla-js.com/)
- [You Might Not Need jQuery](http://youmightnotneedjquery.com/)
- [Modern JavaScript: ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
