# Security Architect Review: SAD v0.1

**Reviewer:** Security Architect Agent
**Document:** Software Architecture Document v0.1 (Primary Draft)
**Date:** 2025-12-01
**Review Focus:** Security Architecture Completeness

---

## Executive Summary

The SAD demonstrates a sound security-conscious architecture that leverages the principle of "security through simplicity." The read/write segregation pattern is well-articulated and provides an inherently secure foundation for a public documentation platform. However, several gaps exist in documentation and implementation details that should be addressed before production deployment.

**Status: CONDITIONAL**

---

## 1. Strengths

### 1.1 Read/Write Segregation (Excellent)

The core architectural pattern of separating the read path (static content) from the control path (build/deploy) is a strong security design choice:

- **Minimal Attack Surface**: Static file serving eliminates entire categories of vulnerabilities (injection, RCE, SSRF, deserialization)
- **Clear Security Boundary**: Section 7.1 explicitly defines the security posture for each path
- **Defense in Depth**: Even if build systems are compromised, the read path remains deterministic and auditable

**Reference:** SAD Section 7.1, Section 2.1.1

### 1.2 Tenant Isolation Model (Good)

The isolation guarantees documented in Section 7.3 are comprehensive:

- Bundle isolation (separate `dist/` directories)
- Runtime isolation (no shared JavaScript execution)
- Domain isolation (unique domains per tenant)
- Build isolation (independent builds, no shared state)

The architecture diagram (Section 7.3) clearly shows request routing with no connection between tenant paths.

### 1.3 Zero-Dependency Security Benefits (Good)

Section 8 ADR-002 correctly identifies security benefits of the zero-dependency philosophy:

- No supply chain vulnerabilities from frontend frameworks
- No transitive dependency risks (only `terser` as dev dependency)
- Reduced maintenance burden for security patching

**Note:** This significantly simplifies SBOM management and dependency scanning requirements.

### 1.4 Content Classification (Adequate)

Section 7.4 explicitly states:

- Public documentation only
- No PII storage
- No authentication credentials in bundles
- No sensitive business data

This simplifies data protection requirements and is appropriate for the use case.

### 1.5 Security Headers Documented (Good)

Section 7.2 includes recommended Caddy security headers:

```caddyfile
X-Frame-Options "DENY"
X-Content-Type-Options "nosniff"
X-XSS-Protection "1; mode=block"
Referrer-Policy "strict-origin-when-cross-origin"
Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

---

## 2. Gaps

### 2.1 Security Headers Not Implemented (HIGH)

**Finding:** The current Caddyfile (`apps/publisher/Caddyfile`) lacks all security headers documented in Section 7.2.

**Current Implementation:**
```caddyfile
http://tenant-alpha.local {
  root * dist/tenant-alpha
  encode gzip zstd
  try_files {path} {path}/ index.html
  file_server
}
```

**Risk:** Without headers, the application is vulnerable to:
- Clickjacking (missing X-Frame-Options)
- MIME-type confusion attacks (missing X-Content-Type-Options)
- Reflected XSS (missing CSP)

**Impact:** Medium (public content reduces severity, but could enable defacement or phishing)

### 2.2 TLS/HTTPS Requirements Not Enforced (HIGH)

**Finding:** The SAD mentions "HTTPS enforcement" as "Deployment-dependent" (Section 7.2), but the architecture does not mandate TLS for production deployments.

**Concerns:**
- Local development uses `http://` (acceptable)
- Production Caddyfile generation should enforce HTTPS
- No documentation of certificate management approach

**Impact:** High in production environments (data integrity, authentication of content source)

### 2.3 Content Sanitization Status Unclear (MEDIUM)

**Finding:** Section 7.2 lists "Content sanitization" as "Planned" with "Build-time HTML sanitization for user content."

**Questions Not Addressed:**
- What content is considered "user content" vs "trusted content"?
- Which sanitization library will be used?
- What are the sanitization rules (allow-list vs deny-list)?
- How is JavaScript module content (`*.js` files) handled?

**Risk:** XSS vulnerabilities if untrusted content is included in bundles without proper sanitization.

### 2.4 Git Authentication Details Missing (MEDIUM)

**Finding:** Section 7.5 mentions "SSH keys, deploy tokens for content repos" but provides no implementation guidance.

**Missing Details:**
- Key rotation policy
- Minimum key strength requirements (e.g., Ed25519 preferred)
- Where deploy keys are stored (CI/CD secrets, HashiCorp Vault, etc.)
- Access scope limitations per key

### 2.5 Build Job Isolation Details Missing (MEDIUM)

**Finding:** Section 7.5 mentions "Containerized builds, no shared state" but lacks specifics.

**Questions Not Addressed:**
- Are build containers ephemeral (destroyed after each build)?
- Is there network isolation during builds?
- How is the build environment secured against malicious content?
- What happens if a tenant's content contains malicious scripts?

### 2.6 Audit Logging Approach Incomplete (MEDIUM)

**Finding:** Section 7.5 lists "Git history, CI/CD logs, Caddy access logs" but lacks:

- Log retention policy
- Log integrity controls (tamper evidence)
- What events are logged vs what should be logged
- Centralized logging architecture (if any)
- Security event alerting

### 2.7 Secret Management for Tenant Registry (LOW)

**Finding:** The tenant registry (`tenants.json`) is described as git-tracked (Section 8 ADR-005), which is appropriate for the current data model. However:

- If API keys are ever added for integrations, the approach must change
- No mention of access control for who can modify the registry
- Branch protection rules not documented

### 2.8 Subresource Integrity (SRI) Not Implemented (LOW)

**Finding:** Section 7.2 lists SRI as "Optional" but provides no implementation guidance.

**Risk:** If CDN or host is compromised, static assets could be modified without detection.

**Recommendation:** SRI should be mandatory for production deployments, with build pipeline generating hashes.

### 2.9 Security Testing Not Documented (LOW)

**Finding:** Section 10.2 (Technical Debt) mentions "No SAST/DAST or dependency scanning" but the Security Architecture section (7) does not define:

- Required security testing before release
- SAST tool requirements
- DAST/penetration testing approach
- Security regression testing

---

## 3. Recommendations

### 3.1 Immediate (Before Production)

| ID | Recommendation | Priority | SAD Section |
|----|----------------|----------|-------------|
| R-1 | **Implement security headers in production Caddyfile template.** Add all headers from Section 7.2 to the Caddyfile generator. | HIGH | 7.2 |
| R-2 | **Mandate HTTPS for production.** Document that `auto_https` must be enabled for production deployments; add validation to deployment scripts. | HIGH | 7.2 |
| R-3 | **Clarify content sanitization strategy.** Define trusted vs untrusted content boundaries; select and document sanitization approach for Markdown/HTML content. | MEDIUM | 7.4 |
| R-4 | **Document build container security model.** Specify ephemeral containers, network isolation, and handling of malicious content scenarios. | MEDIUM | 7.5 |

### 3.2 Near-Term (Control Path Implementation)

| ID | Recommendation | Priority | SAD Section |
|----|----------------|----------|-------------|
| R-5 | **Define Git authentication standards.** Specify key types (Ed25519), rotation schedule (90 days), and storage location. | MEDIUM | 7.5 |
| R-6 | **Implement audit logging architecture.** Define events to log, retention period (minimum 90 days), and consider centralized logging. | MEDIUM | 7.5 |
| R-7 | **Add branch protection for tenant registry.** Require PR review for `tenants.json` changes to prevent unauthorized tenant additions. | MEDIUM | 7.5, 8 ADR-005 |
| R-8 | **Implement SRI for production builds.** Generate SHA-384 hashes for all JavaScript and CSS assets; include in HTML. | LOW | 7.2 |

### 3.3 Security Testing Requirements

| ID | Recommendation | Priority |
|----|----------------|----------|
| R-9 | **Add `npm audit` to CI/CD pipeline.** Run on every build; fail on high/critical vulnerabilities. | MEDIUM |
| R-10 | **Implement SAST scanning.** Consider ESLint security plugins or dedicated SAST tool for vanilla JavaScript. | LOW |
| R-11 | **Annual penetration test.** Before major releases or annually, conduct focused assessment on tenant isolation and content injection vectors. | LOW |

---

## 4. Threat Model Observations

### 4.1 Threats Adequately Addressed

| Threat | Mitigation in SAD |
|--------|-------------------|
| Server-side code execution | No server-side execution in read path (static files only) |
| SQL injection | No database; file-based storage |
| Session hijacking | No sessions; stateless read path |
| Tenant data leakage (direct) | Separate bundles, domain routing, no shared state |
| Supply chain (frontend) | Zero-dependency philosophy; only `terser` |

### 4.2 Threats Requiring Additional Documentation

| Threat | Current Status | Recommendation |
|--------|----------------|----------------|
| **XSS via content injection** | "Planned" sanitization | Document sanitization approach |
| **Clickjacking** | Headers documented but not implemented | Implement headers |
| **DNS hijacking** | Not addressed | Document DNSSEC recommendations for custom domains |
| **Compromised build pipeline** | Mentioned in 7.5 | Detail container isolation model |
| **Insider threat (registry tampering)** | Git audit trail | Add branch protection, PR requirements |

### 4.3 Acceptable Risks (Documented)

The following are acceptable given the "public documentation only" use case:

- No authentication in read path (public content)
- Hash-based routing SEO limitations
- localStorage for session state (no sensitive data)

---

## 5. Status and Conditions

### Status: CONDITIONAL

The SAD demonstrates strong security fundamentals but requires the following conditions to be addressed:

### Conditions for Approval

1. **MUST: Security headers implementation plan.** Either:
   - Add headers to current Caddyfile for local testing, OR
   - Document that headers will be added when Caddyfile generator is implemented (with ticket reference)

2. **MUST: TLS enforcement documentation.** Add explicit statement that production deployments require HTTPS with automatic certificate management via Caddy.

3. **SHOULD: Content sanitization clarification.** Add subsection to 7.4 explaining what content sources require sanitization and the planned approach.

### Verification

When conditions are met, update SAD version to 0.2 and request re-review from Security Architect.

---

## 6. Positive Security Observations

Beyond the formal review, several architectural choices reflect good security thinking:

1. **Atomic symlink deployment** - Prevents partially-deployed bundles from being served
2. **Read-only volume mounts** in docker-compose (`:ro`) - Prevents container escape writing to host
3. **No environment variables in client bundles** - Secrets cannot leak to browser
4. **File-based registry with git history** - Built-in audit trail without additional tooling
5. **Domain-based tenant routing** - Prevents path traversal between tenants

---

## Appendix: Security Review Checklist

| Category | Item | Status |
|----------|------|--------|
| **Read Path** | No server-side execution | PASS |
| | Content sanitization | PLANNED |
| | Security headers | DOCUMENTED, NOT IMPLEMENTED |
| | HTTPS/TLS | DEPLOYMENT-DEPENDENT |
| | SRI | OPTIONAL |
| **Tenant Isolation** | Bundle separation | PASS |
| | Domain isolation | PASS |
| | Runtime isolation | PASS |
| | Build isolation | DOCUMENTED, NEEDS DETAIL |
| **Control Path** | Git authentication | MENTIONED, NEEDS DETAIL |
| | Build job isolation | MENTIONED, NEEDS DETAIL |
| | Audit logging | MENTIONED, NEEDS DETAIL |
| | Registry access control | NOT DOCUMENTED |
| **Infrastructure** | Caddy configuration | BASIC ONLY |
| | Container security | GOOD (ro mounts) |
| | Secret management | ADEQUATE FOR CURRENT SCOPE |
| **Testing** | SAST | NOT IMPLEMENTED |
| | Dependency scanning | NOT IMPLEMENTED |
| | Security testing process | NOT DOCUMENTED |

---

**Review Completed:** 2025-12-01
**Reviewer:** Security Architect Agent
**Next Action:** Address conditions and request re-review
