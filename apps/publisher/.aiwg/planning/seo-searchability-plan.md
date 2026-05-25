# SEO Searchability Implementation Plan for Pagenary Publisher

## Executive Summary

This plan addresses the search engine indexability challenges inherent in hash-based SPA architectures. The solution generates build-time SEO artifacts (sitemaps, static HTML snapshots, robots.txt, and JSON-LD structured data) that work alongside the existing hash-based routing without breaking the current architecture.

## Current Architecture Analysis

### Key Components

1. **`scripts/build-tenants.js`** - Multi-tenant build orchestrator
   - Processes content from `tenants/<id>/content/` or nested structures
   - Generates `manifest.js` with section metadata, navigation structure
   - Materializes content files (`.md`, `.html`, `.js`) into ES modules in `sections/`

2. **`src/seo.js`** - Client-side meta tag updates (title, description only)

3. **Generated Output Structure**:
   ```
   dist/<tenant-id>/
   ├── index.html          # Single entry point
   ├── manifest.js         # Navigation data
   ├── app.js              # Router (hash-based)
   ├── sections/           # Content modules
   │   └── <section-id>.js
   └── styles.css
   ```

4. **Routing Pattern**: `https://domain/#<section-id>` (e.g., `#alpha-launch-checklist`)

### Current SEO Limitations

- Single `index.html` with generic meta tags
- No `robots.txt` or `sitemap.xml`
- Content loaded via JavaScript `import()` - invisible to basic crawlers
- No structured data (JSON-LD) for documentation discovery
- Hash fragments (`#`) not reliably followed by all search engines

---

## Implementation Strategy

### Phase 1: Sitemap Generation

**Goal**: Generate `sitemap.xml` listing all content URLs for each tenant.

**URL Strategy**:
Since hash-based URLs (`example.com/#section-id`) are poorly indexed, use dual-URL strategy:
1. Primary: Hash-based URLs for JavaScript clients
2. Sitemap: Path-based URLs pointing to static HTML snapshots

**XML Sitemap Template**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-12-08</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/pages/getting-started.html</loc>
    <lastmod>2025-12-08</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

**New Function** (`build-tenants.js`):
```javascript
async function generateSitemap(distDir, manifest, config) {
  const baseUrl = config.seo?.siteUrl || '';
  const urls = [];

  // Add root URL
  urls.push({ loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly' });

  // Recursively collect all section URLs
  function collectUrls(sections, depth = 0) {
    for (const section of sections) {
      if (section.module) {
        urls.push({
          loc: `${baseUrl}/pages/${encodePathForFilename(section.id)}.html`,
          priority: depth === 0 ? '0.8' : '0.6',
          changefreq: 'monthly'
        });
      }
      if (section.subsections) {
        collectUrls(section.subsections, depth + 1);
      }
    }
  }
  collectUrls(manifest);

  const xml = buildSitemapXml(urls);
  await fsp.writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
}
```

---

### Phase 2: Static HTML Snapshot Generation (Pre-rendering)

**Goal**: Generate static HTML pages for each section that search engines can crawl.

**Strategy**: During build, create `dist/<tenant>/pages/<section-id>.html` for each content section.

**Output Structure**:
```
dist/<tenant-id>/
├── index.html
├── sitemap.xml
├── robots.txt
├── pages/
│   ├── welcome-overview.html
│   ├── getting-started--introduction.html
│   └── ... (one per section)
└── ...
```

**Static Page Template**:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{SECTION_TITLE}} | {{SITE_TITLE}}</title>
  <meta name="description" content="{{SECTION_SUMMARY}}" />
  <link rel="canonical" href="{{BASE_URL}}/#{{SECTION_ID}}" />

  <!-- Open Graph -->
  <meta property="og:title" content="{{SECTION_TITLE}}" />
  <meta property="og:description" content="{{SECTION_SUMMARY}}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{{BASE_URL}}/#{{SECTION_ID}}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
  {{JSON_LD}}
  </script>

  <!-- Redirect to SPA for JavaScript-enabled browsers -->
  <script>
    if (typeof window !== 'undefined') {
      window.location.replace('{{BASE_URL}}/#{{SECTION_ID}}');
    }
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0; url={{BASE_URL}}/#{{SECTION_ID}}" />
  </noscript>

  <link rel="stylesheet" href="../styles.css" />
</head>
<body>
  <main class="static-content">
    {{CONTENT_HTML}}
  </main>
  <footer>
    <p>View interactive version: <a href="{{BASE_URL}}/#{{SECTION_ID}}">{{SECTION_TITLE}}</a></p>
  </footer>
</body>
</html>
```

**Key Features**:
1. Full HTML content (not JavaScript-loaded) for crawlers
2. Proper `<title>`, `<meta>` tags, and canonical URL
3. JavaScript redirect to hash-based URL for modern browsers
4. `<noscript>` fallback for non-JS crawlers
5. Serves as crawler fallback while preserving SPA experience

---

### Phase 3: robots.txt Generation

**Goal**: Generate tenant-specific `robots.txt` with sitemap reference.

**Template**:
```
# Pagenary Publisher - {{SITE_TITLE}}
# Generated: {{BUILD_DATE}}

User-agent: *
Allow: /
Allow: /pages/
Disallow: /sections/
Disallow: /lib/

Sitemap: {{BASE_URL}}/sitemap.xml
```

---

### Phase 4: JSON-LD Structured Data

**Goal**: Add structured data to improve search result presentation.

**Schema Types**:
1. **TechArticle** - For technical documentation pages
2. **WebSite** - For the root/home page
3. **BreadcrumbList** - For navigation hierarchy

**JSON-LD for Documentation Pages**:
```json
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "{{SECTION_TITLE}}",
  "description": "{{SECTION_SUMMARY}}",
  "url": "{{CANONICAL_URL}}",
  "dateModified": "{{BUILD_DATE}}",
  "publisher": {
    "@type": "Organization",
    "name": "{{BRAND_NAME}}"
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "{{CANONICAL_URL}}"
  },
  "isPartOf": {
    "@type": "WebSite",
    "name": "{{SITE_TITLE}}",
    "url": "{{BASE_URL}}"
  }
}
```

**JSON-LD for Home Page** (index.html):
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "{{SITE_TITLE}}",
  "description": "{{SITE_DESCRIPTION}}",
  "url": "{{BASE_URL}}",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "{{BASE_URL}}/#?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

**JSON-LD Breadcrumbs** (in static pages):
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "{{BASE_URL}}/" },
    { "@type": "ListItem", "position": 2, "name": "{{GROUP_TITLE}}", "item": "{{BASE_URL}}/#{{GROUP_ID}}" },
    { "@type": "ListItem", "position": 3, "name": "{{SECTION_TITLE}}", "item": "{{BASE_URL}}/#{{SECTION_ID}}" }
  ]
}
```

---

## File Organization in dist/

**Final Output Structure**:
```
dist/<tenant-id>/
├── index.html              # Main SPA entry (enhanced with JSON-LD)
├── sitemap.xml             # XML sitemap for crawlers
├── robots.txt              # Crawler directives
├── favicon.png             # (existing)
├── app.js                  # (existing)
├── manifest.js             # (existing)
├── styles.css              # (existing)
├── seo.js                  # (existing)
├── lib/                    # (existing)
├── sections/               # (existing - JS modules)
│   └── *.js
├── pages/                  # NEW: Static HTML snapshots
│   ├── welcome-overview.html
│   ├── getting-started--introduction.html
│   └── *.html
└── assets/                 # (existing)
```

---

## Implementation Phases

### Phase 1: Sitemap Generation (Low Risk)
**Files to Modify**:
- `scripts/build-tenants.js` - Add `generateSitemap()` function

**Estimated Effort**: 2-3 hours

### Phase 2: robots.txt Generation (Low Risk)
**Files to Modify**:
- `scripts/build-tenants.js` - Add `generateRobotsTxt()` function

**Estimated Effort**: 1 hour

### Phase 3: Static HTML Snapshots (Medium Risk)
**Files to Create**:
- `scripts/lib/seo-generator.js` - HTML template and rendering logic

**Files to Modify**:
- `scripts/build-tenants.js` - Add `generateStaticSnapshots()` function
- `Caddyfile` - Add route handling for `/pages/` directory

**Estimated Effort**: 4-6 hours

### Phase 4: JSON-LD Structured Data (Low Risk)
**Files to Create**:
- `scripts/lib/structured-data.js` - JSON-LD generation utilities

**Files to Modify**:
- `scripts/build-tenants.js` - Integrate JSON-LD into static page generation
- `src/index.html` - Add WebSite schema to template

**Estimated Effort**: 2-3 hours

### Phase 5: Testing & Validation
- Test with Google's Rich Results Test
- Validate sitemap with online validators
- Test crawler behavior with `curl`

**Estimated Effort**: 2-3 hours

---

## Configuration Schema Update

**Enhanced `config.json` for Tenants**:
```json
{
  "title": "ROKO Network Documentation",
  "brandMark": "ROKO",
  "brandSub": "Network",
  "seo": {
    "enabled": true,
    "siteUrl": "https://docs.roko.network",
    "generateSitemap": true,
    "generateStaticPages": true,
    "generateRobotsTxt": true,
    "defaultChangeFreq": "weekly",
    "structuredData": {
      "organizationName": "ROKO Network",
      "logoUrl": "https://docs.roko.network/favicon.png"
    }
  }
}
```

---

## Server Configuration Updates

**Caddyfile Enhancement** (for static page serving):
```caddyfile
http://tenant-roko.local:5175 {
  root * dist/roko-kb
  encode gzip zstd

  # Serve static pages for crawlers
  @static_pages path /pages/*
  handle @static_pages {
    try_files {path} {path}.html
    file_server
  }

  # Serve sitemap and robots
  @seo_files path /sitemap.xml /robots.txt
  handle @seo_files {
    file_server
  }

  # Default SPA handling
  handle {
    try_files {path} {path}/ index.html
    file_server
  }
}
```

---

## Testing Strategy

1. **Sitemap Validation**:
   - Use W3C Sitemap Validator
   - Verify all URLs are accessible
   - Check lastmod dates are accurate

2. **Static Page Testing**:
   - Test JavaScript redirect works
   - Test noscript meta refresh works
   - Verify content matches SPA version
   - Check canonical URLs are correct

3. **Structured Data Testing**:
   - Google Rich Results Test
   - Schema.org validator
   - Verify breadcrumbs display correctly

4. **Crawler Simulation**:
   - Test with `curl` (no JavaScript)
   - Test with Googlebot user-agent
   - Verify robots.txt is respected

---

## Critical Files for Implementation

### Primary Files to Modify

| File | Purpose |
|------|---------|
| `scripts/build-tenants.js` | Main build orchestrator - add sitemap, robots.txt, and static page generation |
| `src/index.html` | Add JSON-LD WebSite schema to base template |
| `Caddyfile` | Add route handling for /pages/ directory |

### New Files to Create

| File | Purpose |
|------|---------|
| `scripts/lib/seo-generator.js` | Sitemap, robots.txt, and static page generation utilities |
| `scripts/lib/structured-data.js` | JSON-LD schema generation |

### Configuration Files to Update

| File | Purpose |
|------|---------|
| `tenants/<id>/config.json` | Add SEO configuration block |

---

## Success Criteria

- [ ] sitemap.xml generated for each tenant with all pages listed
- [ ] robots.txt generated with proper directives and sitemap reference
- [ ] Static HTML pages generated in /pages/ directory
- [ ] Static pages include proper meta tags and JSON-LD
- [ ] JavaScript redirect works for modern browsers
- [ ] noscript fallback works for basic crawlers
- [ ] Canonical URLs point to hash-based SPA URLs
- [ ] Google Rich Results Test passes
- [ ] Sitemap validates with W3C validator
