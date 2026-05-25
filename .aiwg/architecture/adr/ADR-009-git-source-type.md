# ADR-009: Git Source Type for Tenant Content

**Status**: Accepted
**Date**: 2025-12-02
**Updated**: 2025-12-02 (Added incremental build support)
**Decision Makers**: Architecture Team
**Extends**: ADR-008

## Context

ADR-008 established an extensible source type model for tenant content, initially supporting only `local` paths. Real-world usage patterns show that most tenant content is stored in git repositories:

1. **Documentation-as-Code**: Teams manage documentation alongside code in version control
2. **Separate Repos**: Documentation may live in its own repository, separate from application code
3. **Monorepos**: Multiple tenant configurations in a single repository with different paths
4. **CI/CD Integration**: Build pipelines trigger on git pushes, need to fetch content at build time

### Use Cases Driving This Decision

- **UC-006 (Update Content)**: "Content author pushes commit to git repository" - requires git integration
- **UC-009 (Build Bundles)**: Build from arbitrary git repositories for CI/CD pipelines
- **External Teams**: Tenant administrators manage their own git repos; platform fetches at build time

### Current Limitation

ADR-008 source types only support `local`, requiring content to be pre-fetched before build:

```json
{
  "source": {
    "type": "local",
    "path": "/pre-fetched/tenant-docs"
  }
}
```

This works but requires external scripting to clone repos before running build-tenants.js.

## Decision

### 1. Add `git` Source Type

Extend the source type enumeration to include `git`:

```json
{
  "id": "tenant-alpha",
  "source": {
    "type": "git",
    "url": "https://github.com/org/tenant-alpha-docs.git",
    "ref": "main",
    "path": "docs/"
  }
}
```

### 2. Source Configuration Schema

#### Git Source Properties

| Property | Required | Description | Default |
|----------|----------|-------------|---------|
| `type` | Yes | Must be `"git"` | - |
| `url` | Yes | Git repository URL (HTTPS, SSH, or file://) | - |
| `ref` | No | Branch, tag, or commit SHA | `"main"` |
| `path` | No | Subdirectory within repo containing tenant content | `"."` (repo root) |
| `sparse` | No | Use sparse checkout (only fetch `path` subdirectory) | `false` |
| `depth` | No | Shallow clone depth (1 = latest commit only) | `1` |

#### Authentication

| Method | URL Format | Credential Source |
|--------|------------|-------------------|
| HTTPS public | `https://github.com/org/repo.git` | None required |
| HTTPS private | `https://github.com/org/repo.git` | `GIT_CREDENTIALS` env var or git credential helper |
| SSH | `git@github.com:org/repo.git` | SSH key in ssh-agent or `~/.ssh/` |
| GitHub App | `https://x-access-token:TOKEN@github.com/org/repo.git` | Token in URL or env var |

**Environment Variables:**
- `GIT_SSH_COMMAND`: Custom SSH command (e.g., specify key file)
- `GIT_CREDENTIALS`: HTTPS credentials in `username:token` format
- `GIT_TERMINAL_PROMPT=0`: Disable interactive prompts (CI/CD safety)

### 3. Clone Strategy

#### Shallow Clone (Default)

For build-time fetching, use shallow clone with depth=1:

```bash
git clone --depth 1 --branch main https://github.com/org/repo.git /tmp/tenant-xyz
```

Benefits:
- Fast: Only fetches latest commit
- Small: Minimal disk usage
- Sufficient: Build only needs current content state

#### Sparse Checkout (Optional)

When `path` is specified and `sparse: true`, only fetch the subdirectory:

```bash
git clone --filter=blob:none --sparse https://github.com/org/repo.git /tmp/tenant-xyz
cd /tmp/tenant-xyz
git sparse-checkout set docs/
```

Benefits:
- Efficient for monorepos with large content
- Only downloads files in specified path

### 4. Cache Strategy

#### Build-Time Cache

Cloned repositories are cached in a temporary directory during build:

```
.cache/
└── git/
    ├── tenant-alpha-abc123/    # Hash of repo URL + ref
    ├── tenant-beta-def456/
    └── ...
```

**Cache Behavior:**
- Cache key: SHA256 hash of `url + ref + path`
- Cache validity: Check if ref is a tag/SHA (immutable) vs branch (mutable)
- For branches: Always fetch to update (`git fetch && git checkout`)
- For tags/SHAs: Reuse cached clone if exists
- Max cache age: Configurable, default 24 hours for branches
- Cache location: `--cache-dir` CLI flag or `GIT_CACHE_DIR` env var

#### Cleanup

- Clear cache on build completion (default)
- `--keep-cache` flag to preserve for debugging
- `--clean-cache` flag to force fresh clone

### 5. Error Handling

| Scenario | Behavior |
|----------|----------|
| Clone fails (network) | Retry 3 times with exponential backoff |
| Clone fails (auth) | Fail with clear auth error message |
| Ref not found | Fail with "branch/tag not found" error |
| Path not found | Fail with "subdirectory not found" error |
| Timeout | 5-minute timeout per clone operation |

### 6. CLI Integration

#### New Flags

```bash
# Cache management
node scripts/build-tenants.js --cache-dir /tmp/git-cache
node scripts/build-tenants.js --keep-cache
node scripts/build-tenants.js --clean-cache

# Git-specific
node scripts/build-tenants.js --git-depth 10  # Override depth for all git sources
node scripts/build-tenants.js --no-sparse     # Disable sparse checkout
```

#### Environment Variables

```bash
# Authentication
GIT_CREDENTIALS="username:token"
GIT_SSH_COMMAND="ssh -i ~/.ssh/deploy_key"

# Cache
GIT_CACHE_DIR="/tmp/git-cache"

# Behavior
GIT_CLONE_DEPTH=1
GIT_TERMINAL_PROMPT=0  # Critical for CI/CD
```

### 7. Incremental Builds

#### Change Detection

When updating a cached git repository, the build system tracks changes between the old and new HEAD commits:

```javascript
// Change result structure
{
  sourcePath: '/path/to/content',
  changes: {
    type: 'full' | 'incremental' | 'none',
    oldCommit: 'abc123...',
    newCommit: 'def456...',
    files: {
      added: ['content/new-page.md'],
      modified: ['content/updated-page.md'],
      deleted: ['content/removed-page.md']
    }
  }
}
```

**Change Types:**
- `none`: No changes since last build (immutable ref or no commits)
- `incremental`: Changes detected, file list available for targeted rebuild
- `full`: Fresh clone or cache miss, full rebuild required

#### CLI Options

```bash
# Enable incremental builds (only rebuild changed content)
node scripts/build-tenants.js --incremental --keep-cache

# Show changes without building (useful for CI validation)
node scripts/build-tenants.js --diff-only

# Short form
node scripts/build-tenants.js -i
```

#### Incremental Build Behavior

When `--incremental` is enabled:

1. **Cache Required**: Automatically preserves git cache between builds
2. **Change Detection**: Computes `git diff --name-status` between old and new HEAD
3. **Targeted Processing**: Only regenerates changed content files:
   - Added files: Generate new section modules
   - Modified files: Regenerate section modules
   - Deleted files: Remove section modules
4. **Manifest Regeneration**: Only if `manifest.json` was modified
5. **Skip Unchanged**: If no changes detected, skip tenant entirely

```
Build output with --incremental:

Building tenant-alpha
  source: .cache/git/git-abc123/docs
  target: /var/www/tenant-alpha
  mode: incremental (3 files to process)
  ↳ updated: getting-started (markdown)
  ↳ updated: api-reference (markdown)
  ↳ removed: deprecated-feature
Tenant tenant-alpha ready
```

#### Diff-Only Mode

`--diff-only` shows what would be rebuilt without performing the build:

```
Checking 3 tenant(s) for changes...

  tenant-alpha: abc1234 → def5678
    added (1):
      + content/new-feature.md
    modified (2):
      ~ content/getting-started.md
      ~ content/api-reference.md

  tenant-beta: no changes (def5678)

  tenant-gamma: local source (no change tracking)

Change detection complete.
```

#### Performance Benefits

| Scenario | Full Build | Incremental |
|----------|-----------|-------------|
| Fresh clone | 15-30s | 15-30s (same) |
| No changes | 10-15s | <1s (skip) |
| 1 file changed | 10-15s | 1-2s |
| 10 files changed | 10-15s | 3-5s |

Incremental builds are most beneficial for:
- Large documentation sites (100+ pages)
- Frequent small updates (typo fixes, content edits)
- CI/CD pipelines where build time matters
- Multi-tenant deployments with independent update cycles

### 8. Security Considerations

#### Repository Validation

- Validate URL format before cloning
- Reject file:// URLs unless explicitly allowed (`--allow-local-git`)
- Sanitize ref names (prevent command injection)
- Run git commands with minimal permissions

#### Credential Handling

- Never log credentials
- Clear credential environment after clone
- Prefer SSH keys over HTTPS tokens for persistent auth
- Support GitHub App installation tokens (short-lived)

#### Isolation

- Clone to isolated temp directory per tenant
- Remove cloned directory after build (unless `--keep-cache`)
- Do not execute any scripts from cloned repos (content only)

## Architecture

```
Build Pipeline with Git Sources:

  tenants.json                  build-tenants.js                     Outputs
  ┌──────────────────┐         ┌────────────────────────┐
  │ tenant-alpha     │         │                        │
  │   type: git      │────┐    │ 1. Parse registry      │
  │   url: github... │    │    │                        │
  │   ref: main      │    │    │ 2. For each tenant:    │
  ├──────────────────┤    │    │    a. Resolve source   │
  │ tenant-beta      │    │    │    b. If git: clone    │───► .cache/git/
  │   type: local    │    │    │    c. Build bundle     │
  │   path: ./tenants│    │    │    d. Write target     │───► dist/
  └──────────────────┘    │    │                        │        or
                          │    │ 3. Cleanup cache       │      /deploy/
                          └───►│                        │
                               └────────────────────────┘

  Git Clone Flow:

  ┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌────────────┐
  │ Check cache │────►│ Cache valid? │────►│ Use cached    │────►│ Build from │
  └─────────────┘     └──────────────┘     │ directory     │     │ cache dir  │
                             │ No          └───────────────┘     └────────────┘
                             ▼
                      ┌──────────────┐     ┌───────────────┐
                      │ Clone repo   │────►│ Extract path  │────►(Build)
                      │ (shallow)    │     │ if specified  │
                      └──────────────┘     └───────────────┘
```

## Example Configurations

### Simple Public Repository

```json
{
  "id": "tenant-alpha",
  "source": {
    "type": "git",
    "url": "https://github.com/acme/docs.git"
  }
}
```

### Private Repository with Branch

```json
{
  "id": "tenant-beta",
  "source": {
    "type": "git",
    "url": "git@github.com:acme/private-docs.git",
    "ref": "release/v2"
  }
}
```

### Monorepo with Subdirectory

```json
{
  "id": "tenant-gamma",
  "source": {
    "type": "git",
    "url": "https://github.com/acme/monorepo.git",
    "ref": "main",
    "path": "packages/docs/tenant-gamma",
    "sparse": true
  }
}
```

### Pinned Version (Tag)

```json
{
  "id": "tenant-stable",
  "source": {
    "type": "git",
    "url": "https://github.com/acme/docs.git",
    "ref": "v1.2.3"
  }
}
```

### Pinned Commit

```json
{
  "id": "tenant-pinned",
  "source": {
    "type": "git",
    "url": "https://github.com/acme/docs.git",
    "ref": "abc123def456"
  }
}
```

## Consequences

### Positive

- **True Git Integration**: Build directly from git repositories without pre-fetching scripts
- **CI/CD Native**: Fits naturally into git-based deployment pipelines
- **Flexible Refs**: Support branches, tags, and commits for different versioning strategies
- **Efficient Cloning**: Shallow clone + sparse checkout minimize network/disk usage
- **Monorepo Support**: Path specification enables multiple tenants from single repo
- **Cache Optimization**: Avoid re-cloning unchanged content

### Negative

- **Git Dependency**: Requires git binary on build machine
- **Network Dependency**: Build now requires network access for git sources
- **Clone Latency**: Initial clone adds ~5-30 seconds to build time
- **Auth Complexity**: SSH keys and tokens need proper configuration
- **Error Surface**: More failure modes (network, auth, ref not found)

### Migration

1. Existing `local` sources continue to work unchanged
2. Convert local sources to git gradually:
   ```json
   // Before
   { "type": "local", "path": "/fetched/tenant-docs" }

   // After
   { "type": "git", "url": "https://github.com/org/tenant-docs.git" }
   ```
3. Remove pre-fetch scripts once all tenants use git sources

## Implementation Notes

### Git Binary Requirement

```javascript
// Check git is available at startup
import { execSync } from 'child_process';

function checkGitAvailable() {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
```

### Clone Implementation

```javascript
async function cloneGitSource(source, cacheDir) {
  const { url, ref = 'main', path = '.', sparse = false, depth = 1 } = source;

  const cacheKey = createHash('sha256')
    .update(`${url}:${ref}:${path}`)
    .digest('hex')
    .slice(0, 12);

  const cloneDir = join(cacheDir, `git-${cacheKey}`);

  // Clone or update
  if (await pathExists(cloneDir)) {
    // Update existing clone
    await exec(`git -C ${cloneDir} fetch origin ${ref} --depth ${depth}`);
    await exec(`git -C ${cloneDir} checkout FETCH_HEAD`);
  } else {
    // Fresh clone
    const args = ['clone', '--depth', depth, '--branch', ref];
    if (sparse && path !== '.') {
      args.push('--filter=blob:none', '--sparse');
    }
    args.push(url, cloneDir);

    await exec(`git ${args.join(' ')}`);

    if (sparse && path !== '.') {
      await exec(`git -C ${cloneDir} sparse-checkout set ${path}`);
    }
  }

  // Return resolved source path
  return join(cloneDir, path);
}
```

## Relationship to Other ADRs

- **ADR-005** (File-Based Registry): Registry now supports git source type
- **ADR-008** (External Sources): This ADR implements the `git` source type placeholder
- **ADR-004** (Tenant Routing): Unchanged - routing doesn't care about source type

## References

- [Git Shallow Clone](https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---depthltdepthgt)
- [Git Sparse Checkout](https://git-scm.com/docs/git-sparse-checkout)
- [GitHub Authentication](https://docs.github.com/en/authentication)
- UC-006: Update Tenant Content (Git Push to Deploy)
- ADR-008: External Tenant Source Model
