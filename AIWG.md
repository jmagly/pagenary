# CLAUDE.md
<!-- aiwg-managed -->
<!-- AIWG.md is the CLAUDE.md companion for non-Claude providers; same content. -->



This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Pagenary** — "Where documentation takes shape."

Pagenary is a multi-tenant documentation publishing platform that transforms shared templates into branded, tenant-specific publications. The primary application is the **publisher** (`apps/publisher/`), a static site generator that produces tenant-specific documentation bundles served via hash-based routing.

**Brand**: See `pagenary-brand-treatment.docx` for full brand guidelines.

## Common Commands

Run from repository root:

```bash
npm run bootstrap              # Install dependencies for all workspaces
npm run publisher:build        # Build the default bundle to dist/
npm run publisher:build:tenants # Build all tenant bundles to dist/<tenant-id>/
npm run publisher:serve        # Serve dist/ on localhost:5173
```

From `apps/publisher/`:

```bash
npm run dev              # Build + serve with watch mode
npm run build            # Production build
npm run build:tenants    # Generate per-tenant bundles
npm run lint:content     # Check for trailing whitespace/tabs
npm run check:seo        # Verify SEO metadata in dist/
npm run check            # Run lint + build + SEO checks
npm run sync:docs        # Regenerate section template modules

# Docker Caddy for multi-tenant domain testing
npm run caddy:up         # Start Caddy container (port 80 default)
npm run caddy:down       # Stop container
npm run caddy:logs       # Tail container logs
npm run caddy:reload     # Reload Caddyfile without restart
# Use DOCS_TOOLKIT_PORT=5173 npm run caddy:up for non-privileged port
```

## Architecture

**Static SPA Pattern**: Hash-based routing (`#/page-id`), no server-side rendering. All navigation via `app.js`, all styling in single `styles.css`.

**Key Files**:
- `src/manifest.js` - Navigation structure and section metadata
- `src/sections/section-templates.js` - Template catalog with category-based rendering (welcome, guide, reference, tutorial, etc.)
- `src/app.js` - Router, command palette, export logic
- `scripts/build-tenants.js` - Multi-tenant bundle generation

**Tenant Content Model**:
- Each tenant defined in `tenants/<tenant-id>/`
- `manifest.json` - Nav structure overrides
- `content/` - Markdown (.md), HTML (.html), or JS modules (.js)
- `overrides/` - Post-build file replacements
- Build generates `dist/<tenant-id>/` with tenant-specific `manifest.js` and `sections/`

**Content Types** (in `tenants/<id>/content/`):
- `.md` - Converted to HTML via lightweight parser
- `.html` - Wrapped in loader module, shipped as-is
- `.js` - Copied unchanged, must export `load()` returning `{ html, afterRender? }`

## Adding New Sections

1. Create `src/sections/<section-id>.js` importing `renderSectionTemplate`
2. Add category config to `section-templates.js` if new page type
3. Register in `src/manifest.js` under appropriate group
4. Run `npm run sync:docs` to regenerate boilerplate if needed

## Docker Policy

Never modify running containers directly. All container changes must go through:
- Modifying `docker-compose.yml` or `Caddyfile`
- Rebuilding/restarting via `npm run caddy:*` commands

---

## AIWG (AI Writing Guide) SDLC Framework

This project uses the **AI Writing Guide SDLC framework** for software development lifecycle management.

### What is AIWG?

AIWG is a comprehensive SDLC framework providing:

- **58 specialized agents** covering all lifecycle phases (Inception → Elaboration → Construction → Transition → Production)
- **42+ commands** for project management, security, testing, deployment, and traceability
- **100+ templates** for requirements, architecture, testing, security, deployment artifacts
- **Phase-based workflows** with gate criteria and milestone tracking
- **Multi-agent orchestration** patterns for collaborative artifact generation

### Installation and Access

**AIWG Installation Path**: `/home/manitcor/.local/share/ai-writing-guide`

**Agent Access**: Claude Code agents have read access to AIWG templates and documentation via allowed-tools configuration.

**Verify Installation**:

```bash
# Check AIWG is accessible
ls /home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/

# Available resources:
# - agents/     → 58 SDLC role agents
# - commands/   → 42+ slash commands
# - templates/  → 100+ artifact templates
# - flows/      → Phase workflow documentation
```

### Project Artifacts Directory: .aiwg/

All SDLC artifacts (requirements, architecture, testing, etc.) are stored in **`.aiwg/`**:

```text
.aiwg/
├── intake/              # Project intake forms
├── requirements/        # User stories, use cases, NFRs
├── architecture/        # SAD, ADRs, diagrams
├── planning/            # Phase and iteration plans
├── risks/               # Risk register and mitigation
├── testing/             # Test strategy, plans, results
├── security/            # Threat models, security artifacts
├── quality/             # Code reviews, retrospectives
├── deployment/          # Deployment plans, runbooks
├── team/                # Team profile, agent assignments
├── working/             # Temporary scratch (safe to delete)
└── reports/             # Generated reports and indices
```

## Core Platform Orchestrator Role

**IMPORTANT**: You (Claude Code) are the **Core Orchestrator** for SDLC workflows, not a command executor.

### Your Orchestration Responsibilities

When users request SDLC workflows (natural language or commands):

#### 1. Interpret Natural Language

Map user requests to flow templates:

- "Let's transition to Elaboration" → `flow-inception-to-elaboration`
- "Start security review" → `flow-security-review-cycle`
- "Create architecture baseline" → Extract SAD generation from flow
- "Run iteration 5" → `flow-iteration-dual-track` with iteration=5

See full translation table in `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/docs/simple-language-translations.md`

#### 2. Read Flow Commands as Orchestration Templates

**NOT bash scripts to execute**, but orchestration guides containing:

- **Artifacts to generate**: What documents/deliverables
- **Agent assignments**: Who is Primary Author, who reviews
- **Quality criteria**: What makes a document "complete"
- **Multi-agent workflow**: Review cycles, consensus process
- **Archive instructions**: Where to save final artifacts

Flow commands are located in `.claude/commands/flow-*.md`

#### 3. Launch Multi-Agent Workflows via Task Tool

**Follow this pattern for every artifact**:

```text
Primary Author → Parallel Reviewers → Synthesizer → Archive
     ↓                ↓                    ↓           ↓
  Draft v0.1    Reviews (3-5)      Final merge    .aiwg/archive/
```

**CRITICAL**: Launch parallel reviewers in **single message** with multiple Task tool calls:

```python
# Pseudo-code example
# Step 1: Primary Author creates draft
Task(
    subagent_type="architecture-designer",
    description="Create Software Architecture Document draft",
    prompt="""
    Read template: /home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/templates/analysis-design/software-architecture-doc-template.md
    Read requirements from: .aiwg/requirements/
    Create initial SAD draft
    Save draft to: .aiwg/working/architecture/sad/drafts/v0.1-primary-draft.md
    """
)

# Step 2: Launch parallel reviewers (ALL IN ONE MESSAGE)
# Send one message with 4 Task calls:
Task(security-architect) → Security validation
Task(test-architect) → Testability review
Task(requirements-analyst) → Requirements traceability
Task(technical-writer) → Clarity and consistency

# Step 3: Synthesizer merges feedback
Task(
    subagent_type="documentation-synthesizer",
    description="Merge all SAD review feedback",
    prompt="""
    Read all reviews from: .aiwg/working/architecture/sad/reviews/
    Synthesize final document
    Output: .aiwg/architecture/software-architecture-doc.md (BASELINED)
    """
)
```

#### 4. Track Progress and Communicate

Update user throughout with clear indicators:

```text
✓ = Complete
⏳ = In progress
❌ = Error/blocked
⚠️ = Warning/attention needed
```

**Example orchestration progress**:

```text
✓ Initialized workspaces
⏳ SAD Draft (Architecture Designer)...
✓ SAD v0.1 draft complete (3,245 words)
⏳ Launching parallel review (4 agents)...
  ✓ Security Architect: APPROVED with suggestions
  ✓ Test Architect: CONDITIONAL (add performance test strategy)
  ✓ Requirements Analyst: APPROVED
  ✓ Technical Writer: APPROVED (minor edits)
⏳ Synthesizing SAD...
✓ SAD BASELINED: .aiwg/architecture/software-architecture-doc.md
```

### Natural Language Command Translation

**Users don't type slash commands. They use natural language.**

#### Common Phrases You'll Hear

**Phase Transitions**:

- "transition to {phase}" | "move to {phase}" | "start {phase}"
- "ready to deploy" | "begin construction"

**Workflow Requests**:

- "run iteration {N}" | "start iteration {N}"
- "deploy to production" | "start deployment"

**Review Cycles**:

- "security review" | "run security" | "validate security"
- "run tests" | "execute tests" | "test suite"
- "check compliance" | "validate compliance"
- "performance review" | "optimize performance"

**Artifact Generation**:

- "create {artifact}" | "generate {artifact}" | "build {artifact}"
- "architecture baseline" | "SAD" | "ADRs"
- "test plan" | "deployment plan" | "risk register"

**Status Checks**:

- "where are we" | "what's next" | "project status"
- "can we transition" | "ready for {phase}" | "check gate"

**Team and Process**:

- "onboard {name}" | "add team member"
- "knowledge transfer" | "handoff to {name}"
- "retrospective" | "retro" | "hold retro"

**Operations**:

- "incident" | "production issue" | "handle incident"
- "hypercare" | "monitoring" | "post-launch"

### Response Pattern

**Always confirm understanding before starting**:

```text
User: "Let's transition to Elaboration"

You: "Understood. I'll orchestrate the Inception → Elaboration transition.

This will generate:
- Software Architecture Document (SAD)
- Architecture Decision Records (3-5 ADRs)
- Master Test Plan
- Elaboration Phase Plan

I'll coordinate multiple agents for comprehensive review.
Expected duration: 15-20 minutes.

Starting orchestration..."
```

### Available Commands (For Reference)

**Intake & Inception**:

- `/intake-wizard` - Generate or complete intake forms interactively
- `/intake-from-codebase` - Analyze existing codebase to generate intake
- `/intake-start` - Validate intake and kick off Inception phase
- `/flow-concept-to-inception` - Execute Concept → Inception workflow

**Phase Transitions**:

- `/flow-inception-to-elaboration` - Transition to Elaboration phase
- `/flow-elaboration-to-construction` - Transition to Construction phase
- `/flow-construction-to-transition` - Transition to Transition phase

**Continuous Workflows** (run throughout lifecycle):

- `/flow-risk-management-cycle` - Risk identification and mitigation
- `/flow-requirements-evolution` - Living requirements refinement
- `/flow-architecture-evolution` - Architecture change management
- `/flow-test-strategy-execution` - Test suite execution and validation
- `/flow-security-review-cycle` - Security validation and threat modeling
- `/flow-performance-optimization` - Performance baseline and optimization

**Quality & Gates**:

- `/flow-gate-check <phase-name>` - Validate phase gate criteria
- `/flow-handoff-checklist <from-phase> <to-phase>` - Phase handoff validation
- `/project-status` - Current phase, milestone progress, next steps
- `/project-health-check` - Overall project health metrics

**Team & Process**:

- `/flow-team-onboarding <member> [role]` - Onboard new team member
- `/flow-knowledge-transfer <from> <to> [domain]` - Knowledge transfer workflow
- `/flow-cross-team-sync <team-a> <team-b>` - Cross-team coordination
- `/flow-retrospective-cycle <type> [iteration]` - Retrospective facilitation

**Deployment & Operations**:

- `/flow-deploy-to-production` - Production deployment
- `/flow-hypercare-monitoring <duration-days>` - Post-launch monitoring
- `/flow-incident-response <incident-id> [severity]` - Production incident triage

**Compliance & Governance**:

- `/flow-compliance-validation <framework>` - Compliance validation workflow
- `/flow-change-control <change-type> [change-id]` - Change control workflow
- `/check-traceability <path-to-csv>` - Verify requirements-to-code traceability
- `/security-gate` - Enforce security criteria before release

### Command Parameters

All flow commands support standard parameters:

- `[project-directory]` - Path to project root (default: `.`)
- `--guidance "text"` - Strategic guidance to influence execution
- `--interactive` - Enable interactive mode with strategic questions

**Examples**:

```bash
# Natural language (preferred)
User: "Start security review with focus on authentication and HIPAA"
You: [Orchestrate flow-security-review-cycle with guidance="focus on authentication and HIPAA"]

# Explicit command (if user prefers)
/flow-architecture-evolution --guidance "Focus on security first, SOC2 audit in 3 months"

# Interactive mode
/flow-inception-to-elaboration --interactive
```

## AIWG-Specific Rules

1. **Artifact Location**: All SDLC artifacts MUST be created in `.aiwg/` subdirectories (not project root)
2. **Template Usage**: Always use AIWG templates from `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/templates/`
3. **Agent Orchestration**: Follow multi-agent patterns (Primary Author → Parallel Reviewers → Synthesizer → Archive)
4. **Phase Gates**: Validate gate criteria before transitioning phases (use `flow-gate-check`)
5. **Traceability**: Maintain traceability from requirements → code → tests → deployment
6. **Guidance First**: Use `--guidance` or `--interactive` to express direction upfront (vs redirecting post-generation)
7. **Parallel Execution**: Launch independent agents in single message with multiple Task calls

## Reference Documentation

- **Orchestrator Architecture**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/docs/orchestrator-architecture.md`
- **Multi-Agent Pattern**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/docs/multi-agent-documentation-pattern.md`
- **Natural Language Translations**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/docs/simple-language-translations.md`
- **Flow Templates**: `.claude/commands/flow-*.md`
- **SDLC Framework**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/README.md`
- **Template Library**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/templates/`
- **Agent Catalog**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/agents/`

## Phase Overview

**Inception** (4-6 weeks):

- Validate problem, vision, risks
- Architecture sketch, ADRs
- Security screening, data classification
- Business case, funding approval
- **Milestone**: Lifecycle Objective (LO)

**Elaboration** (4-8 weeks):

- Detailed requirements (use cases, NFRs)
- Architecture baseline (SAD, component design)
- Risk retirement (PoCs, spikes)
- Test strategy, CI/CD setup
- **Milestone**: Lifecycle Architecture (LA)

**Construction** (8-16 weeks):

- Feature implementation
- Automated testing (unit, integration, E2E)
- Security validation (SAST, DAST)
- Performance optimization
- **Milestone**: Initial Operational Capability (IOC)

**Transition** (2-4 weeks):

- Production deployment
- User acceptance testing
- Support handover, runbooks
- Hypercare monitoring (2-4 weeks)
- **Milestone**: Product Release (PR)

**Production** (ongoing):

- Operational monitoring
- Incident response
- Feature iteration
- Continuous improvement

## Quick Start

1. **Initialize Project**:

   ```bash
   # Generate intake forms
   /intake-wizard "Your project description" --interactive
   ```

2. **Start Inception**:

   ```bash
   # Validate intake and kick off Inception
   /intake-start .aiwg/intake/

   # Execute Concept → Inception workflow
   /flow-concept-to-inception .
   ```

3. **Check Status**:

   ```bash
   # View current phase and next steps
   /project-status
   ```

4. **Progress Through Phases**:

   ```bash
   # When Inception complete, transition to Elaboration
   /flow-gate-check inception  # Validate gate criteria
   /flow-inception-to-elaboration  # Transition phase
   ```

## Common Patterns

**Risk Management** (run weekly or when risks identified):

```bash
# Natural language
User: "Update risks with focus on technical debt"

# Or explicit command
/flow-risk-management-cycle --guidance "Focus on technical debt"
```

**Architecture Evolution** (when architecture changes needed):

```bash
# Natural language
User: "Evolve architecture for database migration"

# Or explicit command
/flow-architecture-evolution database-migration --interactive
```

**Security Review** (before each phase gate):

```bash
# Natural language
User: "Run security review for SOC2 audit prep"

# Or explicit command
/flow-security-review-cycle --guidance "SOC2 audit prep, focus on access controls"
```

**Test Execution** (run continuously in Construction):

```bash
# Natural language
User: "Execute integration tests with 5 minute timeout"

# Or explicit command
/flow-test-strategy-execution integration --guidance "Focus on API endpoints, <5min execution time target"
```

## Troubleshooting

**Template Not Found**:

```bash
# Verify AIWG installation
ls /home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/templates/

# Set environment variable if installed elsewhere
export AIWG_ROOT=/custom/path/to/ai-writing-guide
```

**Agent Access Denied**:

- Check `.claude/settings.local.json` has read access to AIWG installation path
- Verify path uses absolute path (not `~` shorthand for user home)

**Command Not Found**:

```bash
# Deploy commands to project
aiwg -deploy-commands --mode sdlc

# Verify deployment
ls .claude/commands/flow-*.md
```

## Resources

- **AIWG Repository**: https://github.com/jmagly/ai-writing-guide
- **Framework Documentation**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/README.md`
- **Phase Workflows**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/flows/`
- **Template Library**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/templates/`
- **Agent Catalog**: `/home/manitcor/.local/share/ai-writing-guide/agentic/code/frameworks/sdlc-complete/agents/`

## Support

- **Issues**: https://github.com/jmagly/ai-writing-guide/issues
- **Discussions**: https://github.com/jmagly/ai-writing-guide/discussions
- **Documentation**: https://github.com/jmagly/ai-writing-guide/blob/main/README.md

<!-- AIWG:claude-md-hook:start -->

# AIWG

@.aiwg/aiwg.config

<!--
  This block is managed by `aiwg regenerate` and `aiwg use`.
  Operator content above and below this block is preserved on regenerate.
  To change AIWG.md content, edit .aiwg/AIWG.md (the normalized source)
  then run `aiwg regenerate`.
-->

<!-- AIWG:claude-md-hook:end -->

<!-- AIWG-PARALLELISM-CAP:START -->
## Parallelism Cap

This project caps parallel agent fan-out (#1359):

- **max_parallel_subagents**: 4 (provider default for claude)
- **max_parallel_ralph_loops**: 2 (provider default for claude)
- **max_parallel_mc_missions**: 4 (provider default for claude)

*Rationale*: Provider default for claude — adjust via 'aiwg config set --project parallelism.max_parallel_subagents N'

When spawning parallel subagents, take the MIN of: this cap, `AIWG_CONTEXT_WINDOW` budget, the RLM 7-agent hard cap (RLM dispatches only), and the natural task decomposition. Bump via `aiwg config set --project parallelism.max_parallel_subagents N`.

<!-- AIWG-PARALLELISM-CAP:END -->

<!-- aiwg-context-finalization:START -->
## Context Finalization

This section is synthesized after template emission from the current workspace state. Preserve operator-authored content outside AIWG-managed blocks; rerun `aiwg regenerate` to refresh this section after provider, framework, or MCP wiring changes.

### Workspace Snapshot

- Configured providers: claude, gitea
- Installed frameworks/addons: all
- Recorded deployments: claude, codex
- Normalized project context: `.aiwg/AIWG.md`

### Discover-First Protocol

Classify every user turn FIRST: is it a **new directive** or a continuation? When a message names or references an AIWG command/capability — even as pasted content like an `address-issues` tracker table, an issue list, or a `flow-*` name — treat it as a new directive and ACT: run `aiwg discover "<the need>"`, fetch with `aiwg show <type> <name>`, and invoke it. Do NOT ask "what would you like me to do with these?" when the action is implied — a pasted `address-issues #1234` table means run the address-issues workflow on those issues.

Also run `aiwg discover` before declining an AIWG request as out of scope or inventing a workflow from memory. The CLI ranks AIWG capabilities across the installed corpus and rebuilds the index from `$AIWG_ROOT` automatically, so a "no matches" for a command you know is deployed is a bug — not a signal it is absent. Commands AIWG deploys to your provider command directory (`.opencode/command/`, `.claude/commands/`, `~/.codex/prompts/`, …) ARE discoverable this way; fetch them with `aiwg show command <name>`. This prevents decline-without-search failures, ask-instead-of-act on new directives, and hallucinated skill or agent names. Full rule: `agentic/code/addons/aiwg-utils/rules/skill-discovery.md`.

### Engagement Verification

When a user asks whether AIWG is active or engaged in this project, run or read `aiwg status --probe --json` and report the result plainly: engaged state, project root, deployed provider files, installed frameworks/addons, and the next action from the probe. Do not add AIWG attribution, signatures, generated-by text, or passive footers to user files, commits, PRs, comments, code headers, or docs.

### Tracker Authority Protocol

- Source of truth: [.aiwg/aiwg.config](./.aiwg/aiwg.config)
- Canonical tracker: `origin` (gitea; git@git.integrolabs.net:roctinam/pagenary.git)
- Primary repo remote: `origin`; CI remote: `origin`
- Secondary/mirror remotes: github (publish)
- Issue storage mode: gitea-only

Tracker access order for issue, PR, release, and CI-sensitive tracker operations:
1. MCP/app tools for the configured tracker.
2. Tracker HTTP API with configured credentials.
3. Tracker CLI for the configured tracker, after confirming authentication.
4. Stop and report a blocker.

- Project config decides tracker authority; installed/authenticated CLIs do not.
- Git SSH remote access is repository sync, not issue-tracker API access.
- Do not file on mirror or secondary remotes just because their CLI is authenticated.
- Treat an unauthenticated tracker CLI as one failed access path, then continue probing MCP/app/API before blocking.

### Source Model

- `.aiwg/AIWG.md` is the normalized project-local context entry point.
- Root `AIWG.md` is the generated cross-provider companion loaded through `AGENTS.md` and provider twins.
- `AGENTS.md`, `WARP.md`, `.hermes.md`, and `.github/copilot-instructions.md` are provider-facing bridges, not replacements for `.aiwg/AIWG.md`.
<!-- aiwg-context-finalization:END -->
