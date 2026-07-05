import { MANIFEST, DEFAULT_SECTION, findSection, getAdjacentSections, SITE_CONFIG, EXPORT_CONFIG, layoutForSection } from './manifest.js';
import { updateMetaTags } from './seo.js';
import { escapeRegExp, searchContentPage, flattenManifest, findPreferredIndex, resolveSectionMetadata } from './lib/search.js';
import { resolveTarget as resolveTargetFn, resolveEntry as resolveEntryFn } from './lib/router.js';
import { composeExportDocument, collectExportableSections } from './lib/export.js';
import { buildShareHref, buildShareTargets, resolveSharePayload, shouldUseNativeShare } from './lib/share.js';
import { renderMermaidBlocks } from './mermaid-init.js';
import { initMediaEmbeds } from './media-init.js';
import { highlightCodeBlocks } from './syntax-highlight.js';
import { initPageEffects } from './lib/page-effects.js';
import { initSiteForm } from './lib/form-embeds.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const yearMarker = document.getElementById('year');
const exportBtn = document.getElementById('exportBtn');
const shareBtn = document.getElementById('shareBtn');
const commandToggle = document.getElementById('commandToggle');
const commandPalette = document.getElementById('commandPalette');
const commandInput = document.getElementById('commandInput');
const commandList = document.getElementById('commandList');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.querySelector('.sidebar');
const tenantReadingProgressDefault = document.body.hasAttribute('data-reading-progress');
const tenantReadingProgressMode = document.body.dataset.readingProgressMode || 'bar';

const COMMAND_QUERY_KEY = 'docs-toolkit-command-query';

const rendered = new Map();
const navButtons = new Map();
const navGroups = new Map();
const expandedGroups = new Set();
let commandEntries = [];
let commandIndex = 0;
let paletteOpen = false;
let highlightQuery = (localStorage.getItem(COMMAND_QUERY_KEY) || '').trim();
let pendingHighlightScroll = false;
let currentEntry = null;

function createExternalLink(item, className) {
  const link = document.createElement('a');
  link.href = item.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = `${className} nav-external`;
  link.title = item.summary || item.title;
  link.innerHTML = `
    <span class="nav-title">${item.title}<span class="nav-external-icon" aria-label="(opens in new tab)">↗</span></span>
    ${item.summary ? `<span class="nav-summary">${item.summary}</span>` : ''}
  `;
  return link;
}

function initNav() {
  nav.innerHTML = '';
  nav.classList.remove('nav-static-fallback');
  navButtons.clear();
  navGroups.clear();
  let groupApplied = expandedGroups.size > 0;
  MANIFEST.forEach((section, index) => {
    // Handle external links at top level
    if (section.url) {
      const link = createExternalLink(section, 'nav-leaf');
      nav.appendChild(link);
      return;
    }

    if (section.subsections && section.subsections.length) {
      const group = document.createElement('div');
      group.className = 'nav-group';

      // Check if section has content (module) in addition to subsections
      const hasContent = Boolean(section.module);

      const parentBtn = document.createElement('button');
      parentBtn.type = 'button';
      parentBtn.className = 'nav-parent' + (hasContent ? ' nav-parent-with-content' : '');
      parentBtn.dataset.section = section.id;
      parentBtn.title = section.summary;

      if (hasContent) {
        // Section has content - title navigates, arrow toggles
        parentBtn.innerHTML = `
          <span class="nav-title-link">${section.title}</span>
          <span class="nav-expand-toggle" aria-label="Expand"></span>
          ${section.summary ? `<span class="nav-summary">${section.summary}</span>` : ''}
        `;
        // Title click navigates to content
        parentBtn.querySelector('.nav-title-link').addEventListener('click', (e) => {
          e.stopPropagation();
          navigate(section.id, { scrollToHighlight: Boolean(highlightQuery) });
        });
        // Arrow click toggles expansion
        parentBtn.querySelector('.nav-expand-toggle').addEventListener('click', (e) => {
          e.stopPropagation();
          const next = !expandedGroups.has(section.id);
          setGroupExpanded(section.id, next);
        });
        // Button itself does nothing (handled by children)
        parentBtn.addEventListener('click', (e) => {
          // Only toggle if clicking the button background, not title or arrow
          if (e.target === parentBtn) {
            const next = !expandedGroups.has(section.id);
            setGroupExpanded(section.id, next);
          }
        });
      } else {
        // No content - whole button toggles expansion
        parentBtn.innerHTML = `
          <span class="nav-title">${section.title}</span>
          ${section.summary ? `<span class="nav-summary">${section.summary}</span>` : ''}
        `;
        parentBtn.addEventListener('click', () => {
          const next = !expandedGroups.has(section.id);
          setGroupExpanded(section.id, next);
        });
      }

      const list = document.createElement('div');
      list.className = 'nav-sublist';
      section.subsections.forEach((sub) => {
        // Handle external links in subsections
        if (sub.url) {
          const link = createExternalLink(sub, 'nav-item');
          list.appendChild(link);
          return;
        }

        // Handle nested subsections (3-level nav)
        if (sub.subsections && sub.subsections.length) {
          const nestedGroup = document.createElement('div');
          nestedGroup.className = 'nav-group nav-group-nested';

          const nestedParentBtn = document.createElement('button');
          nestedParentBtn.type = 'button';
          nestedParentBtn.className = 'nav-parent nav-parent-nested';
          nestedParentBtn.dataset.section = sub.id;
          nestedParentBtn.title = sub.summary || sub.title;
          nestedParentBtn.innerHTML = `<span class="nav-title">${sub.title}</span>`;
          nestedParentBtn.addEventListener('click', () => {
            const next = !expandedGroups.has(sub.id);
            setGroupExpanded(sub.id, next);
          });

          const nestedList = document.createElement('div');
          nestedList.className = 'nav-sublist nav-sublist-nested';
          sub.subsections.forEach((nested) => {
            if (nested.url) {
              const link = createExternalLink(nested, 'nav-item');
              nestedList.appendChild(link);
              return;
            }

            // Handle 4th level of nesting (deeply nested subsections)
            if (nested.subsections && nested.subsections.length) {
              const deepGroup = document.createElement('div');
              deepGroup.className = 'nav-group nav-group-deep';

              const deepParentBtn = document.createElement('button');
              deepParentBtn.type = 'button';
              deepParentBtn.className = 'nav-parent nav-parent-deep';
              deepParentBtn.dataset.section = nested.id;
              deepParentBtn.title = nested.summary || nested.title;
              deepParentBtn.innerHTML = `<span class="nav-title">${nested.title}</span>`;
              deepParentBtn.addEventListener('click', () => {
                const next = !expandedGroups.has(nested.id);
                setGroupExpanded(nested.id, next);
              });

              const deepList = document.createElement('div');
              deepList.className = 'nav-sublist nav-sublist-deep';
              nested.subsections.forEach((deep) => {
                if (deep.url) {
                  const link = createExternalLink(deep, 'nav-item');
                  deepList.appendChild(link);
                  return;
                }

                // Handle 5th level of nesting (ultra-deep subsections)
                if (deep.subsections && deep.subsections.length) {
                  const ultraGroup = document.createElement('div');
                  ultraGroup.className = 'nav-group nav-group-ultra';

                  const ultraParentBtn = document.createElement('button');
                  ultraParentBtn.type = 'button';
                  ultraParentBtn.className = 'nav-parent nav-parent-ultra';
                  ultraParentBtn.dataset.section = deep.id;
                  ultraParentBtn.title = deep.summary || deep.title;
                  ultraParentBtn.innerHTML = `<span class="nav-title">${deep.title}</span>`;
                  ultraParentBtn.addEventListener('click', () => {
                    const next = !expandedGroups.has(deep.id);
                    setGroupExpanded(deep.id, next);
                  });

                  const ultraList = document.createElement('div');
                  ultraList.className = 'nav-sublist nav-sublist-ultra';
                  deep.subsections.forEach((ultra) => {
                    if (ultra.url) {
                      const link = createExternalLink(ultra, 'nav-item');
                      ultraList.appendChild(link);
                      return;
                    }
                    const ultraBtn = document.createElement('button');
                    ultraBtn.type = 'button';
                    ultraBtn.className = 'nav-item nav-item-ultra' + (ultra.type ? ` nav-type-${ultra.type}` : '');
                    ultraBtn.dataset.section = ultra.id;
                    ultraBtn.title = ultra.summary || ultra.title;
                    ultraBtn.innerHTML = `
                      <span class="nav-title">${ultra.title}</span>
                      <span class="nav-summary">${ultra.summary || ''}</span>
                    `;
                    ultraBtn.addEventListener('click', () => navigate(ultra.id, { scrollToHighlight: Boolean(highlightQuery) }));
                    ultraList.appendChild(ultraBtn);
                    navButtons.set(ultra.id, ultraBtn);
                  });

                  ultraGroup.append(ultraParentBtn, ultraList);
                  deepList.appendChild(ultraGroup);
                  navButtons.set(deep.id, ultraParentBtn);
                  navGroups.set(deep.id, { group: ultraGroup, button: ultraParentBtn, list: ultraList });
                  const ultraShouldExpand = expandedGroups.has(deep.id) && !deep.collapsed;
                  setGroupExpanded(deep.id, ultraShouldExpand);
                  return;
                }

                const deepBtn = document.createElement('button');
                deepBtn.type = 'button';
                deepBtn.className = 'nav-item nav-item-deep' + (deep.type ? ` nav-type-${deep.type}` : '');
                deepBtn.dataset.section = deep.id;
                deepBtn.title = deep.summary || deep.title;
                deepBtn.innerHTML = `
                  <span class="nav-title">${deep.title}${deep.type === 'press-release' ? '<span class="nav-type-icon" aria-label="Press Release"></span>' : ''}</span>
                  <span class="nav-summary">${deep.summary || ''}</span>
                `;
                deepBtn.addEventListener('click', () => navigate(deep.id, { scrollToHighlight: Boolean(highlightQuery) }));
                deepList.appendChild(deepBtn);
                navButtons.set(deep.id, deepBtn);
              });

              deepGroup.append(deepParentBtn, deepList);
              nestedList.appendChild(deepGroup);
              navButtons.set(nested.id, deepParentBtn);
              navGroups.set(nested.id, { group: deepGroup, button: deepParentBtn, list: deepList });
              const deepShouldExpand = expandedGroups.has(nested.id) && !nested.collapsed;
              setGroupExpanded(nested.id, deepShouldExpand);
              return;
            }

            const nestedBtn = document.createElement('button');
            nestedBtn.type = 'button';
            nestedBtn.className = 'nav-item nav-item-nested' + (nested.type ? ` nav-type-${nested.type}` : '');
            nestedBtn.dataset.section = nested.id;
            nestedBtn.title = nested.summary || nested.title;
            nestedBtn.innerHTML = `
              <span class="nav-title">${nested.title}${nested.type === 'press-release' ? '<span class="nav-type-icon" aria-label="Press Release"></span>' : ''}</span>
              <span class="nav-summary">${nested.summary || ''}</span>
            `;
            nestedBtn.addEventListener('click', () => navigate(nested.id, { scrollToHighlight: Boolean(highlightQuery) }));
            nestedList.appendChild(nestedBtn);
            navButtons.set(nested.id, nestedBtn);
          });

          nestedGroup.append(nestedParentBtn, nestedList);
          list.appendChild(nestedGroup);
          navButtons.set(sub.id, nestedParentBtn);
          navGroups.set(sub.id, { group: nestedGroup, button: nestedParentBtn, list: nestedList });
          // Initialize nested group expansion state (collapsed by default, or if marked collapsed)
          const nestedShouldExpand = expandedGroups.has(sub.id) && !sub.collapsed;
          setGroupExpanded(sub.id, nestedShouldExpand);
          return;
        }

        const childBtn = document.createElement('button');
        childBtn.type = 'button';
        childBtn.className = 'nav-item' + (sub.type ? ` nav-type-${sub.type}` : '');
        childBtn.dataset.section = sub.id;
        childBtn.title = sub.summary;
        childBtn.innerHTML = `
          <span class="nav-title">${sub.title}${sub.type === 'press-release' ? '<span class="nav-type-icon" aria-label="Press Release"></span>' : ''}</span>
          <span class="nav-summary">${sub.summary}</span>
        `;
        childBtn.addEventListener('click', () => navigate(sub.id, { scrollToHighlight: Boolean(highlightQuery) }));
        list.appendChild(childBtn);
        navButtons.set(sub.id, childBtn);
      });

      group.append(parentBtn, list);
      nav.appendChild(group);
      navButtons.set(section.id, parentBtn);
      navGroups.set(section.id, { group, button: parentBtn, list });
      // Respect collapsed property - only expand if not marked collapsed AND (previously expanded OR first group)
      const shouldExpand = !section.collapsed && (expandedGroups.has(section.id) || (!groupApplied && !expandedGroups.size));
      setGroupExpanded(section.id, shouldExpand);
      if (shouldExpand) groupApplied = true;
    } else {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-leaf' + (section.type ? ` nav-type-${section.type}` : '');
      button.dataset.section = section.id;
      button.title = section.summary;
      button.innerHTML = `
        <span class="nav-title">${section.title}${section.type === 'press-release' ? '<span class="nav-type-icon" aria-label="Press Release"></span>' : ''}</span>
        <span class="nav-summary">${section.summary}</span>
      `;
      button.addEventListener('click', () => navigate(section.id, { scrollToHighlight: Boolean(highlightQuery) }));
      nav.appendChild(button);
      navButtons.set(section.id, button);
    }
  });
}

function navigate(id, options = {}) {
  const { scrollToHighlight = false } = options;
  const { targetId, parentId } = resolveTarget(id);
  if (paletteOpen) closeCommandPalette();
  if (parentId) {
    setGroupExpanded(parentId, true);
  }
  pendingHighlightScroll = scrollToHighlight || Boolean(highlightQuery);
  if (location.hash.replace('#', '') === targetId) {
    handleRoute();
  } else {
    location.hash = `#${targetId}`;
  }
}

function currentSectionId() {
  return location.hash.replace('#', '') || DEFAULT_SECTION;
}

async function handleRoute() {
  const currentId = currentSectionId();
  const resolved = resolveEntry(currentId);
  if (!resolved) return;
  const { entry, targetId, parentId } = resolved;
  if (targetId !== currentId) {
    location.replace(`#${targetId}`);
    return;
  }
  if (parentId) {
    setGroupExpanded(parentId, true);
  }
  setActiveNav(entry.id, parentId);
  await loadSection(entry, parentId);
}

function setActiveNav(activeId, parentId = null) {
  navButtons.forEach((btn) => {
    btn.setAttribute('aria-current', 'false');
  });
  const activeBtn = navButtons.get(activeId);
  if (activeBtn) {
    activeBtn.setAttribute('aria-current', 'page');
  }
  if (parentId) {
    const parentBtn = navButtons.get(parentId);
    if (parentBtn) parentBtn.setAttribute('aria-current', 'page');
  }
}

function setGroupExpanded(id, expanded) {
  if (!id) return;
  const info = navGroups.get(id);
  if (expanded) {
    expandedGroups.add(id);
    if (info) info.group.classList.add('expanded');
  } else {
    expandedGroups.delete(id);
    if (info) info.group.classList.remove('expanded');
  }
}

// Wrapper functions that bind findSection to lib functions
function resolveTarget(id) {
  return resolveTargetFn(id, findSection);
}

function resolveEntry(id) {
  return resolveEntryFn(id, findSection);
}

/**
 * Section-scoped shell switching (#90, ADR-016 phase 3). Set body[data-layout]
 * to the route's resolved shell *before* rendering the section, so the scoped
 * CSS (e.g. the blog reading column) applies on first paint with no flash. The
 * shell map is emitted per tenant in manifest.js; docs is the default.
 * @param {string} id - section id being navigated to
 */
function applyShell(id) {
  if (typeof layoutForSection !== 'function') return;
  const shell = layoutForSection(id);
  if (shell && document.body.dataset.layout !== shell) {
    document.body.dataset.layout = shell;
  }
}

async function loadSection(entry) {
  if (!entry) return;
  currentEntry = entry;
  applyShell(entry.id);
  const module = await import(entry.module);
  const loader = module.load || module.default;
  if (typeof loader !== 'function') {
    app.innerHTML = `<article class="section"><p>Section failed to load.</p></article>`;
    return;
  }
  const payload = await loader();
  app.innerHTML = payload.html || '';
  renderEntryMetadata(entry);

  // Render any mermaid diagrams in the content
  await renderMermaidBlocks(app);

  // Wire click-to-load media embeds after the section is in the DOM.
  initMediaEmbeds(app);

  // Apply syntax highlighting to code blocks
  await highlightCodeBlocks(app);

  // Add bottom page navigation
  renderBottomNav(entry.id);

  // Scroll to top of content area
  app.scrollTop = 0;
  window.scrollTo(0, 0);

  if (typeof payload.afterRender === 'function') {
    payload.afterRender(app);
  }

  // Attach opt-in page effects (reveal-on-scroll, hero parallax/sticky, …) to
  // the freshly-rendered section; tears down the previous render's effects.
  initPageEffects(app);
  updateMetaTags({
    title: entry.title,
    description: entry.summary,
    siteTitle: SITE_CONFIG.siteTitle,
    siteUrl: SITE_CONFIG.siteUrl,
    sectionId: entry.id,
    ogImage: entry.ogImage || SITE_CONFIG.ogImage
  });
  rendered.set(entry.id, Date.now());
  const shouldScrollToHighlight = pendingHighlightScroll;
  pendingHighlightScroll = false;
  applyHighlight(shouldScrollToHighlight);
  focusCanvas();
}

function renderEntryMetadata(entry) {
  syncReadingProgressHooks(entry);
  if (!entry) return;
  const content = app.querySelector('.doc-content') || app.querySelector('article, section') || app;
  const heading = content.querySelector('h1');
  if (!heading) return;

  // Hero banner for collection posts (blog layout). Presence-guarded, so docs
  // pages — which never carry `hero` — are unaffected.
  if (entry.hero) {
    const fig = document.createElement('figure');
    fig.className = 'post-hero';
    const img = document.createElement('img');
    img.src = entry.hero;
    img.alt = entry.heroAlt || '';
    img.loading = 'eager';
    fig.appendChild(img);
    heading.before(fig);
  }

  const fragments = [];
  if (entry.showDate && entry.date) {
    fragments.push(formatEntryDate(entry.date));
  }
  if (entry.author) {
    fragments.push(`By ${entry.author}`);
  }
  if (entry.showReadingTime && entry.reading_time) {
    fragments.push(entry.reading_label || `${entry.reading_time} min read`);
  }

  let insertAfter = heading;
  let metaEl = null;
  if (fragments.length > 0) {
    const meta = document.createElement('p');
    meta.className = 'doc-meta';
    // Keep the byline text in its own span so an inline control (the Fortémi
    // info-icon) can sit right after it.
    const text = document.createElement('span');
    text.className = 'doc-meta-text';
    text.textContent = fragments.join(' · ');
    meta.appendChild(text);
    heading.after(meta);
    insertAfter = meta;
    metaEl = meta;
  }

  if (entry.showSummary && entry.summary) {
    const summary = document.createElement('p');
    summary.className = 'doc-summary';
    summary.textContent = entry.summary;
    insertAfter.after(summary);
    insertAfter = summary;
  }

  if (Array.isArray(entry.tags) && entry.tags.length) {
    const tags = document.createElement('ul');
    tags.className = 'post-tags';
    for (const tag of entry.tags) {
      const li = document.createElement('li');
      li.textContent = tag;
      tags.appendChild(li);
    }
    insertAfter.after(tags);
    insertAfter = tags;
  }

  renderFortemiMetadataTools(entry, insertAfter, metaEl);
}

function progressEnabled(entry) {
  if (tenantReadingProgressDefault) return true;
  const progress = entry?.progress;
  if (entry?.reading_progress === true || entry?.readingProgress === true) return true;
  if (progress === true) return true;
  if (progress && typeof progress === 'object') {
    if (progress.enabled === true || progress.bar === true || progress.mode === 'bar') return true;
  }
  return false;
}

function syncReadingProgressHooks(entry) {
  const enabled = progressEnabled(entry);
  document.body.toggleAttribute('data-reading-progress', enabled);
  if (enabled) {
    const mode = entry?.progress && typeof entry.progress === 'object'
      ? (entry.progress.mode || (entry.progress.label ? 'label' : 'bar'))
      : tenantReadingProgressMode;
    document.body.dataset.readingProgressMode = mode;
  } else {
    delete document.body.dataset.readingProgressMode;
  }
}

function hasFortemiMetadata(metadata) {
  if (!metadata) return false;
  return Boolean(
    (metadata.concepts && metadata.concepts.length) ||
    (metadata.skos_concepts && metadata.skos_concepts.length) ||
    (metadata.relationships && metadata.relationships.length) ||
    (metadata.provenance && metadata.provenance.length) ||
    (metadata.provenance_events && metadata.provenance_events.length) ||
    metadata.source ||
    metadata.privacy
  );
}

function humanizeMetadataValue(value) {
  return String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${Math.round(Math.max(0, Math.min(1, numeric)) * 100)}%`;
}

function relationshipTargetId(relationship) {
  return String(relationship?.target_id || relationship?.target || '').replace(/^docs:page:/, '');
}

function conceptLabel(concept) {
  if (typeof concept === 'string') return humanizeMetadataValue(concept);
  return concept.prefLabel || concept.pref_label || concept.label || concept.id || 'concept';
}

function addMetadataRow(parent, key, value) {
  if (value == null || value === '') return;
  const row = document.createElement('div');
  row.className = 'doc-fortemi-row';
  const label = document.createElement('span');
  label.className = 'doc-fortemi-key';
  label.textContent = key;
  const body = document.createElement('span');
  body.textContent = String(value);
  row.append(label, body);
  parent.appendChild(row);
}

function addMetadataChips(parent, values) {
  const list = document.createElement('div');
  list.className = 'doc-fortemi-chips';
  values.forEach((value) => {
    const chip = document.createElement('span');
    chip.className = 'doc-fortemi-chip';
    chip.textContent = conceptLabel(value);
    if (typeof value === 'object' && value) {
      if (value.definition) chip.title = value.definition;
    }
    list.appendChild(chip);
  });
  parent.appendChild(list);
}

function addMetadataSection(panel, title, render) {
  const section = document.createElement('section');
  section.className = 'doc-fortemi-section';
  const heading = document.createElement('h2');
  heading.textContent = title;
  section.appendChild(heading);
  render(section);
  panel.appendChild(section);
}

function renderFortemiPanel(panel, metadata) {
  panel.textContent = '';

  addMetadataSection(panel, 'Concepts', (section) => {
    const concepts = metadata.skos_concepts && metadata.skos_concepts.length
      ? metadata.skos_concepts
      : metadata.concepts || [];
    if (concepts.length) addMetadataChips(section, concepts);
    else addMetadataRow(section, 'concepts', 'none');
    (metadata.skos_relations || []).forEach((relation) => {
      const source = conceptLabel({ id: relation.source_id || relation.source });
      const target = conceptLabel({ id: relation.target_id || relation.target });
      addMetadataRow(section, relation.type || 'related', `${humanizeMetadataValue(source)} -> ${humanizeMetadataValue(target)}`);
    });
  });

  addMetadataSection(panel, 'Source and Provenance', (section) => {
    addMetadataRow(section, 'source', metadata.source?.repo_relative_path || metadata.source?.path);
    addMetadataRow(section, 'locator', metadata.source?.locator);
    addMetadataRow(section, 'updated', metadata.updated_at);
    addMetadataRow(section, 'privacy', metadata.privacy?.classification);
    (metadata.provenance || []).forEach((entry) => {
      addMetadataRow(section, entry.field || 'field', `${entry.source || 'source'} (${entry.confidence || 'unknown'})`);
    });
    (metadata.provenance_events || []).forEach((event) => {
      const details = [
        event.agent || 'unknown agent',
        event.source,
        event.started_at || event.ended_at
      ].filter(Boolean).join(' · ');
      addMetadataRow(section, event.activity || 'activity', details);
    });
  });

  addMetadataSection(panel, 'Related Pages', (section) => {
    const relationships = metadata.relationships || [];
    if (!relationships.length) {
      addMetadataRow(section, 'related', 'none');
      return;
    }
    const list = document.createElement('ul');
    list.className = 'doc-fortemi-links';
    relationships.forEach((relationship) => {
      const item = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'doc-fortemi-link';
      const target = relationshipTargetId(relationship);
      const confidence = formatConfidence(relationship.confidence);
      const label = relationship.label || relationship.type || 'related';
      const shared = Array.isArray(relationship.metadata?.shared_concepts)
        ? relationship.metadata.shared_concepts.map(humanizeMetadataValue).join(', ')
        : null;
      link.textContent = `${label}: ${humanizeMetadataValue(target)}${confidence ? ` (${confidence})` : ''}`;
      if (shared) link.title = `Shared concepts: ${shared}`;
      link.addEventListener('click', () => {
        if (target) navigate(target);
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    section.appendChild(list);
  });
}

async function renderFortemiMetadataTools(entry, insertAfter, inlineHost = null) {
  const sectionId = entry.id;
  const docContent = insertAfter.closest('.doc-content') || insertAfter.parentElement;
  let metadata = null;
  try {
    metadata = await resolveSectionMetadata(MANIFEST, sectionId);
  } catch {
    return;
  }
  if (currentSectionId() !== sectionId || !hasFortemiMetadata(metadata)) return;

  const tools = document.createElement('div');
  tools.className = 'doc-fortemi-tools';
  const panelId = `docFortemiPanel-${sectionId}`;
  const panel = document.createElement('div');
  panel.id = panelId;
  panel.className = 'doc-fortemi-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Page metadata');
  renderFortemiPanel(panel, metadata);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'doc-fortemi-button';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', panelId);
  button.title = 'Show page metadata';
  button.innerHTML = '<span aria-hidden="true">i</span><span class="sr-only">Show page metadata</span>';
  button.addEventListener('click', () => {
    const next = panel.hidden;
    panel.hidden = !next;
    button.setAttribute('aria-expanded', String(next));
  });

  // Inline on the byline (right after "… min read") when a host is given;
  // otherwise fall back to the standalone tools block. Same button + panel.
  if (inlineHost) {
    button.classList.add('doc-fortemi-button-inline');
    inlineHost.appendChild(button);
    docContent.appendChild(panel);
  } else {
    tools.appendChild(button);
    docContent.append(tools, panel);
  }
}

function formatEntryDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

/**
 * Build a prev/next nav item (chevron + titled link). Shared by the docs
 * bottom-nav and the blog post-nav so both render adjacent links identically.
 * @param {{id:string,title:string}} target
 * @param {'prev'|'next'} dir
 */
function buildNavItem(target, dir) {
  const wrapper = document.createElement('div');
  wrapper.className = `bottom-nav-item bottom-nav-${dir}`;
  const chevron = `<span class="bottom-nav-chevron">${dir === 'prev' ? '\u2039' : '\u203a'}</span>`;
  const link = document.createElement('a');
  link.href = `#${target.id}`;
  link.className = 'bottom-nav-link';
  const label = dir === 'prev' ? 'Previous' : 'Next';
  link.title = `${label}: ${target.title}`;
  link.setAttribute('aria-label', `${label}: ${target.title}`);
  link.textContent = target.title;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(target.id);
  });
  if (dir === 'prev') {
    wrapper.innerHTML = chevron;
    wrapper.appendChild(link);
  } else {
    wrapper.appendChild(link);
    wrapper.insertAdjacentHTML('beforeend', chevron);
  }
  return wrapper;
}

function navSpacer() {
  const spacer = document.createElement('div');
  spacer.className = 'bottom-nav-spacer';
  return spacer;
}

function getBottomNavMount() {
  return app.querySelector('section.doc, article.section, section:not(.pe-hero)') || app;
}

/**
 * Resolve post-navigation affordances (#55) from SITE_CONFIG.postNav.
 * `postNav: false` disables it; an object toggles {prev,next,index,label}.
 * Defaults to all affordances on.
 * @returns {{prev:boolean,next:boolean,index:boolean,label:?string}|null}
 */
function resolvePostNav() {
  const pn = SITE_CONFIG.postNav;
  if (pn === false) return null;
  const cfg = (pn && typeof pn === 'object') ? pn : {};
  return {
    prev: cfg.prev !== false,
    next: cfg.next !== false,
    index: cfg.index !== false,
    label: typeof cfg.label === 'string' ? cfg.label : null
  };
}

/**
 * Render blog post navigation (#55): a persistent, accessible control with
 * prev/next post (collection-scoped, with titles) and a back-to-index link.
 * Visible regardless of the docs `bottomNav` mobile/never setting \u2014 a blog post
 * with the sidebar hidden has no other way to move between posts.
 */
function renderPostNav(currentId) {
  const cfg = resolvePostNav();
  if (!cfg) return;

  const { prev, next } = getAdjacentSections(currentId);
  const indexId = SITE_CONFIG.blogIndex
    || (typeof DEFAULT_SECTION === 'string' ? DEFAULT_SECTION : null);
  const showIndex = cfg.index && indexId && indexId !== currentId;
  const showPrev = cfg.prev && Boolean(prev);
  const showNext = cfg.next && Boolean(next);
  if (!showPrev && !showNext && !showIndex) return;

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav bottom-nav--posts';
  nav.setAttribute('aria-label', 'Post navigation');

  const inner = document.createElement('div');
  inner.className = 'bottom-nav__inner';

  inner.appendChild(showPrev ? buildNavItem(prev, 'prev') : navSpacer());

  if (showIndex) {
    const label = cfg.label
      || (SITE_CONFIG.blogIndexTitle ? `All ${SITE_CONFIG.blogIndexTitle}` : 'Back to index');
    const indexLink = document.createElement('a');
    indexLink.href = `#${indexId}`;
    indexLink.className = 'bottom-nav-index';
    indexLink.textContent = label;
    indexLink.setAttribute('aria-label', label);
    indexLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(indexId);
    });
    inner.appendChild(indexLink);
  } else {
    inner.appendChild(navSpacer());
  }

  inner.appendChild(showNext ? buildNavItem(next, 'next') : navSpacer());

  nav.appendChild(inner);
  getBottomNavMount().appendChild(nav);
}

/**
 * Render bottom page navigation (prev/next links).
 * - Blog posts (entries with a `collection`) get a persistent, post-aware
 *   control via renderPostNav (#55): prev/next post + back-to-index.
 * - Docs pages keep the original behavior: visibility controlled by
 *   SITE_CONFIG.bottomNav ('always' | 'mobile' | 'never'), with a per-section
 *   override via SITE_CONFIG.bottomNavSections.
 */
function renderBottomNav(currentId) {
  // Remove existing bottom nav if present
  const existing = app.querySelector('.bottom-nav');
  if (existing) existing.remove();

  // Blog posts: post-aware navigation, independent of the docs bottomNav mode.
  const entry = typeof findSection === 'function' ? findSection(currentId) : null;
  if (entry && entry.collection) {
    renderPostNav(currentId);
    return;
  }

  // Docs: original prev/next-section behavior.
  if (SITE_CONFIG.bottomNav === 'never') return;

  const sectionOverrides = SITE_CONFIG.bottomNavSections || [];
  const isSectionEnabled = sectionOverrides.some(prefix => currentId.startsWith(prefix));
  const isMobileOnly = SITE_CONFIG.bottomNav === 'mobile' && !isSectionEnabled;

  const { prev, next } = getAdjacentSections(currentId);
  if (!prev && !next) return;

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  if (isMobileOnly) {
    nav.classList.add('mobile-only');
  }

  // Buttons live in an inner wrapper so they align with the centered content
  // above while the nav's border-top still spans the full width.
  const inner = document.createElement('div');
  inner.className = 'bottom-nav__inner';
  inner.appendChild(prev ? buildNavItem(prev, 'prev') : navSpacer());
  if (next) {
    inner.appendChild(buildNavItem(next, 'next'));
  }
  nav.appendChild(inner);

  // Append to the section content
  getBottomNavMount().appendChild(nav);
}

function focusCanvas() {
  requestAnimationFrame(() => app.focus());
}

// Runtime theme picker (#35). No-op unless the build injected the control
// (config.themePicker.enabled). Swaps the stylesheet <link> href, persists the
// choice to localStorage, and honors prefers-color-scheme on first visit.
function initThemePicker() {
  const select = document.getElementById('themePicker');
  const link = document.getElementById('themeStylesheet');
  if (!select || !link) return;

  let themes;
  try {
    themes = JSON.parse(select.dataset.themes || '[]');
  } catch {
    return;
  }
  if (!Array.isArray(themes) || themes.length === 0) return;

  const STORAGE_KEY = 'pagenary:theme';
  const fileFor = (name) => {
    const t = themes.find((entry) => entry.name === name);
    return t ? t.file : null;
  };

  function apply(name) {
    const file = fileFor(name);
    if (!file) return;
    link.setAttribute('href', file);
    select.value = name;
  }

  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  const prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = (stored && fileFor(stored)) ? stored
    : (prefersDark && fileFor('dark')) ? 'dark'
    : (select.dataset.default && fileFor(select.dataset.default)) ? select.dataset.default
    : themes[0].name;

  apply(initial);

  select.addEventListener('change', () => {
    apply(select.value);
    try {
      localStorage.setItem(STORAGE_KEY, select.value);
    } catch {
      /* storage unavailable — selection still applies for this session */
    }
  });
}

function boot() {
  initNav();
  initThemePicker();
  if (highlightQuery) {
    pendingHighlightScroll = true;
  }
  window.addEventListener('hashchange', () => {
    if (highlightQuery) {
      pendingHighlightScroll = true;
    }
    handleRoute();
  });
  yearMarker.textContent = new Date().getFullYear();
  // Wire the persistent site-wide form affordance once (#91); per-page embeds are
  // handled by the formEmbeds page-effect on each section render.
  initSiteForm();
  handleRoute();
}

boot();

// Command palette
if (commandToggle && commandPalette && commandInput && commandList) {
  commandToggle.addEventListener('click', () => {
    if (paletteOpen) closeCommandPalette();
    else openCommandPalette();
  });

  commandInput.addEventListener('input', () => {
    const value = commandInput.value;
    setHighlightQuery(value, true);
    updateCommandEntries(value);
  });

  commandInput.addEventListener('keydown', (event) => {
    const max = commandEntries.length - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      commandIndex = Math.min(max, commandIndex + 1);
      reflectCommandSelection();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      commandIndex = Math.max(0, commandIndex - 1);
      reflectCommandSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = commandEntries[commandIndex];
      if (target) {
        setHighlightQuery(commandInput.value, true);
        navigate(target.id, { scrollToHighlight: true });
        closeCommandPalette();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeCommandPalette();
    }
  });

  commandList.addEventListener('click', (event) => {
    const item = event.target.closest('[data-section]');
    if (!item) return;
    const targetId = item.dataset.section;
    if (!targetId) return;
    setHighlightQuery(commandInput.value, true);
    navigate(targetId, { scrollToHighlight: true });
    closeCommandPalette();
  });

  commandPalette.addEventListener('click', (event) => {
    if (event.target === commandPalette) {
      closeCommandPalette();
    }
  });

  // Infinite scroll: fetch the next page as the list nears its bottom.
  commandList.addEventListener('scroll', () => {
    if (searchState.loading || searchState.complete) return;
    const nearBottom = commandList.scrollTop + commandList.clientHeight >= commandList.scrollHeight - 48;
    if (nearBottom) {
      loadSearchPage(false);
    }
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTypingContext = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const isModifier = event.metaKey || event.ctrlKey;
    if ((event.key.toLowerCase() === 'k' && isModifier) || (event.key === '/' && !isTypingContext)) {
      event.preventDefault();
      if (paletteOpen) closeCommandPalette();
      else openCommandPalette();
    } else if (event.key === 'Escape' && paletteOpen) {
      event.preventDefault();
      closeCommandPalette();
    }
  });
}

function openCommandPalette() {
  if (!commandPalette || !commandInput) return;
  paletteOpen = true;
  commandPalette.hidden = false;
  const initial = highlightQuery;
  commandInput.value = initial;
  updateCommandEntries(initial);
  requestAnimationFrame(() => {
    commandInput.focus();
    if (initial) {
      commandInput.select();
    }
  });
}

function closeCommandPalette() {
  if (!commandPalette || !commandInput) return;
  paletteOpen = false;
  commandPalette.hidden = true;
  commandInput.blur();
}

let searchDebounce = null;
let isSearching = false;
const COMMAND_PAGE_LIMIT = 25;
// Paging state for command-palette infinite scroll. `query` is the live query so
// in-flight pages from a superseded query can be discarded.
let searchState = { query: '', offset: 0, total: 0, complete: true, loading: false };

async function updateCommandEntries(query) {
  if (!commandList) return;

  // New query: reset paging and selection.
  searchState = { query, offset: 0, total: 0, complete: false, loading: false };
  commandEntries = [];

  // Show loading state on first search
  if (!isSearching && query.trim()) {
    isSearching = true;
    commandList.innerHTML = '<li class="cmd-item cmd-loading">Indexing content...</li>';
  }

  // Debounce to avoid excessive searches while typing
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    await loadSearchPage(true);
    const currentId = currentSectionId();
    commandIndex = findPreferredIndex(commandEntries, currentId);
    reflectCommandSelection();
    isSearching = false;
  }, query.trim() ? 150 : 0);
}

/**
 * Load one page of results. `reset` replaces the list; otherwise it appends
 * (infinite scroll). In-flight pages whose query no longer matches are dropped.
 */
async function loadSearchPage(reset = false) {
  if (searchState.loading) return;
  if (!reset && searchState.complete) return;
  const query = searchState.query;
  searchState.loading = true;
  let page;
  try {
    page = await searchContentPage(MANIFEST, query, {
      offset: searchState.offset,
      limit: COMMAND_PAGE_LIMIT
    });
  } catch {
    searchState.loading = false;
    return;
  }
  // Discard stale responses from a superseded query.
  if (query !== searchState.query) {
    searchState.loading = false;
    return;
  }
  commandEntries = reset ? page.items : commandEntries.concat(page.items);
  searchState.offset = commandEntries.length;
  searchState.total = page.total;
  searchState.complete = page.complete || page.items.length === 0;
  searchState.loading = false;
  renderCommandList();
}

function renderCommandList() {
  if (!commandList) return;
  commandList.innerHTML = '';
  if (!commandEntries.length) {
    const empty = document.createElement('li');
    empty.className = 'cmd-item';
    empty.setAttribute('aria-selected', 'false');
    empty.textContent = 'No matches.';
    commandList.appendChild(empty);
    return;
  }
  commandEntries.forEach((section) => {
    const item = document.createElement('li');
    item.className = 'cmd-item';
    item.dataset.section = section.id;
    item.setAttribute('role', 'option');
    const title = document.createElement('span');
    title.className = 'cmd-item-title';
    title.textContent = section.title;
    if (section.group) {
      const group = document.createElement('span');
      group.className = 'cmd-item-group';
      group.textContent = section.group;
      title.prepend(group);
    }
    const summary = document.createElement('span');
    summary.className = 'cmd-item-summary';
    summary.textContent = section.summary || '';
    item.append(title, summary);
    if (section.searchSnippet && section.searchSnippet !== section.summary) {
      const snippet = document.createElement('span');
      snippet.className = 'cmd-item-snippet';
      snippet.textContent = section.searchSnippet;
      item.appendChild(snippet);
    }
    if (typeof section.searchRank === 'number' && section.searchRank > 0) {
      const score = document.createElement('span');
      score.className = 'cmd-item-score';
      score.textContent = `Rank ${section.searchRank}`;
      item.appendChild(score);
    }
    commandList.appendChild(item);
  });

  // Infinite-scroll sentinel: shows remaining count while more pages exist.
  if (!searchState.complete && searchState.total > commandEntries.length) {
    const more = document.createElement('li');
    more.className = 'cmd-item cmd-more';
    more.setAttribute('aria-selected', 'false');
    more.setAttribute('role', 'presentation');
    more.textContent = `Showing ${commandEntries.length} of ${searchState.total} — scroll for more`;
    commandList.appendChild(more);
  }
}

function reflectCommandSelection() {
  if (!commandList) return;
  Array.from(commandList.children).forEach((li, index) => {
    const isActive = index === commandIndex && commandEntries.length;
    li.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      li.scrollIntoView({ block: 'nearest' });
    }
  });
}

const SHARE_CONFIG = SITE_CONFIG.share || {};
const SHARE_TARGETS = buildShareTargets(SHARE_CONFIG);
if (shareBtn) {
  if (SHARE_TARGETS.length) {
    shareBtn.addEventListener('click', handleShare);
  } else {
    shareBtn.remove();
  }
}

async function handleShare() {
  const entry = currentEntry || resolveEntry(currentSectionId()) || findSection(DEFAULT_SECTION);
  const payload = resolveSharePayload({
    entry,
    siteConfig: SITE_CONFIG,
    locationHref: window.location.href
  });
  if (shouldUseNativeShare({
    config: SHARE_CONFIG,
    navigatorRef: navigator,
    matchMediaRef: window.matchMedia?.bind(window),
    maxTouchPoints: navigator.maxTouchPoints || 0
  })) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url
      });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  showShareMenu(payload);
}

function showShareMenu(payload) {
  const overlay = document.createElement('div');
  overlay.className = 'share-menu-overlay';
  overlay.innerHTML = `
    <div class="share-menu-modal" role="dialog" aria-modal="true" aria-labelledby="shareMenuTitle">
      <div class="share-menu-header">
        <div id="shareMenuTitle" class="share-menu-title">Share page</div>
        <button type="button" class="share-menu-close" aria-label="Close share menu">×</button>
      </div>
      <div class="share-menu-list"></div>
      <p class="share-menu-url"><a href="${escapeAttribute(payload.url)}">${escapeHtml(payload.url)}</a></p>
    </div>
  `;
  const list = overlay.querySelector('.share-menu-list');
  SHARE_TARGETS.forEach((target) => {
    if (target.kind === 'action') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'share-menu-item';
      appendShareItemContent(button, target);
      button.addEventListener('click', async () => {
        await copyShareUrl(payload.url, button);
      });
      list.appendChild(button);
      return;
    }
    const href = buildShareHref(target, payload);
    if (!href) return;
    const link = document.createElement('a');
    link.className = 'share-menu-item';
    link.href = href;
    if (!/^(mailto:|sms:|sgnl:|fb-messenger:)/i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    appendShareItemContent(link, target);
    list.appendChild(link);
  });

  const close = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    shareBtn?.focus();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
  };
  overlay.querySelector('.share-menu-close').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', onKeydown);
  document.body.appendChild(overlay);
  const firstItem = overlay.querySelector('.share-menu-item, .share-menu-close');
  if (firstItem) firstItem.focus();
}

function appendShareItemContent(element, target) {
  const icon = target.icon?.color || target.icon?.mono || '';
  if (icon) {
    const img = document.createElement('img');
    img.className = 'share-menu-icon';
    img.src = icon;
    img.alt = '';
    img.width = 18;
    img.height = 18;
    img.loading = 'lazy';
    img.decoding = 'async';
    element.appendChild(img);
  }
  const label = document.createElement('span');
  label.className = 'share-menu-label';
  label.textContent = target.label;
  element.appendChild(label);
  element.setAttribute('aria-label', target.label);
}

async function copyShareUrl(url, button) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement('input');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    const label = button.querySelector('.share-menu-label');
    if (label) label.textContent = 'Copied';
    setTimeout(() => { if (label) label.textContent = 'Copy Link'; }, 1400);
  } catch {
    window.prompt('Copy this link', url);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

// Export handler. Publishers can disable export entirely (EXPORT_CONFIG.enabled
// === false) — then the button is removed and nothing is wired.
const EXPORT_ENABLED = !EXPORT_CONFIG || EXPORT_CONFIG.enabled !== false;
const EXPORT_SCOPES = (EXPORT_CONFIG && Array.isArray(EXPORT_CONFIG.scopes) && EXPORT_CONFIG.scopes.length)
  ? EXPORT_CONFIG.scopes
  : ['page', 'site'];
if (exportBtn) {
  if (EXPORT_ENABLED) {
    exportBtn.addEventListener('click', showExportOptions);
  } else {
    exportBtn.remove();
  }
}

const EXPORT_SCOPE_LABELS = {
  page: { title: 'Current Page', desc: 'Export only this section' },
  site: { title: 'Entire Site', desc: 'Export all documentation' }
};

function showExportOptions() {
  const overlay = document.createElement('div');
  overlay.className = 'export-options-overlay';
  const buttons = EXPORT_SCOPES.map((scope) => {
    const label = EXPORT_SCOPE_LABELS[scope];
    if (!label) return '';
    return `<button type="button" class="export-option-btn" data-scope="${scope}">
          <span class="export-option-title">${label.title}</span>
          <span class="export-option-desc">${label.desc}</span>
        </button>`;
  }).join('');
  overlay.innerHTML = `
    <div class="export-options-modal">
      <div class="export-options-header">EXPORT OPTIONS</div>
      <div class="export-options-buttons">
        ${buttons}
      </div>
      <button type="button" class="export-cancel-btn">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('active'), 10);

  const close = () => {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('.export-cancel-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelectorAll('.export-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const scope = btn.dataset.scope;
      close();
      handleExport(scope);
    });
  });
}

/**
 * Render the compiled export document into an off-screen iframe and open the
 * browser's print / Save-as-PDF dialog from it, then discard the iframe. No
 * pop-up window is ever shown — the iframe is purely a processing surface — and
 * nothing is left open after the dialog closes.
 * @param {string} html - Complete export HTML document
 */
function printExportDocument(html) {
  document.getElementById('exportPrintFrame')?.remove();
  const frame = document.createElement('iframe');
  frame.id = 'exportPrintFrame';
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  // Off-screen, zero-footprint: never visible, never part of the layout.
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px;top:0;visibility:hidden;';
  document.body.appendChild(frame);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    setTimeout(() => frame.remove(), 500);
  };

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    const win = frame.contentWindow;
    try {
      win.addEventListener('afterprint', cleanup, { once: true });
      win.focus();
      win.print();
      // Safety net: some browsers never fire afterprint (or the user dismisses
      // without it) — reclaim the frame regardless.
      setTimeout(cleanup, 60000);
    } catch (err) {
      console.error('Export print failed', err);
      frame.remove();
    }
  };

  // Print once the document (and its images/fonts) has settled.
  if (frame.contentWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 60);
  } else {
    frame.addEventListener('load', () => setTimeout(triggerPrint, 60), { once: true });
  }
}

async function handleExport(scope = 'site') {
  if (!exportBtn) return;
  const originalMarkup = exportBtn.innerHTML;

  exportBtn.disabled = true;

  // Create loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'export-loading-overlay';
  loadingOverlay.innerHTML = `
    <div class="export-loading-modal">
      <div class="export-loading-header">
        <div class="export-loading-title">COMPILING DOCUMENTATION</div>
        <div class="export-loading-subtitle">Assembling all sections into unified document</div>
      </div>
      <div class="export-loading-progress">
        <div class="export-loading-bar">
          <div class="export-loading-fill"></div>
        </div>
        <div class="export-loading-status-container">
          <div class="export-loading-status">Initializing...</div>
        </div>
      </div>
      <div class="export-loading-scanner">
        <div class="scanner-line"></div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingOverlay);

  // Force layout and trigger animation
  setTimeout(() => loadingOverlay.classList.add('active'), 10);

  const progressFill = loadingOverlay.querySelector('.export-loading-fill');
  const statusText = loadingOverlay.querySelector('.export-loading-status');

  try {
    // Collect sections based on scope
    let allSections;
    if (scope === 'page') {
      // Export only current page
      const currentId = currentSectionId();
      const allAvailable = collectExportableSections(MANIFEST);
      const current = allAvailable.find(s => s.id === currentId);
      allSections = current ? [current] : [];
    } else {
      // Export entire site
      allSections = collectExportableSections(MANIFEST);
    }

    if (allSections.length === 0) {
      alert('No content available to export.');
      loadingOverlay.remove();
      exportBtn.disabled = false;
      return;
    }

    const bundle = [];
    const totalSections = allSections.length;
    let processedSections = 0;

    for (const section of allSections) {
      // Update progress
      processedSections++;
      const progress = (processedSections / totalSections) * 100;
      progressFill.style.width = `${progress}%`;
      statusText.textContent = scope === 'page'
        ? `Exporting: ${section.title}`
        : `Processing section ${processedSections} of ${totalSections}: ${section.title}`;

      // Small delay to show progress animation
      await new Promise(resolve => setTimeout(resolve, 50));

      try {
        const mod = await import(section.module);
        const loader = mod.load || mod.default;
        if (typeof loader !== 'function') continue;
        const payload = await loader();
        const parsed = sanitizeExportMarkup(payload.html || '');
        bundle.push({ section, html: parsed });
      } catch (err) {
        console.error('Failed to include section in export', section.id, err);
      }
    }

    statusText.textContent = 'Generating document...';
    await new Promise(resolve => setTimeout(resolve, 200));

    const htmlDoc = composeExportDocument(bundle, EXPORT_CONFIG);

    statusText.textContent = 'Opening print dialog...';
    await new Promise(resolve => setTimeout(resolve, 100));

    // Render + print from an off-screen iframe — no pop-up window is shown and
    // nothing is left open afterward (see printExportDocument).
    printExportDocument(htmlDoc);

    // Fade out loading overlay
    loadingOverlay.classList.remove('active');
    setTimeout(() => loadingOverlay.remove(), 300);

  } catch (err) {
    console.error('Export failed', err);
    alert('Export failed. Check console for details.');
    loadingOverlay.remove();
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = originalMarkup;
  }
}

function sanitizeExportMarkup(markup) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = markup;
  wrapper.querySelectorAll('script').forEach((script) => script.remove());
  wrapper.querySelectorAll('button').forEach((button) => button.removeAttribute('onclick'));
  wrapper.querySelectorAll('mark.hl').forEach((mark) => {
    const text = document.createTextNode(mark.textContent || '');
    mark.replaceWith(text);
  });
  const firstSection = wrapper.querySelector('section');
  return firstSection ? firstSection.innerHTML : wrapper.innerHTML;
}

function setHighlightQuery(value, persist = false) {
  highlightQuery = value.trim();
  if (persist) {
    if (highlightQuery) {
      localStorage.setItem(COMMAND_QUERY_KEY, highlightQuery);
    } else {
      localStorage.removeItem(COMMAND_QUERY_KEY);
    }
  }
  applyHighlight();
}

function applyHighlight(scrollToFirst = false) {
  if (!app) return;
  highlightContent(app, highlightQuery, { scrollToFirst });
}

function clearHighlights(root) {
  if (!root) return;
  root.querySelectorAll('mark.hl').forEach((mark) => {
    const text = document.createTextNode(mark.textContent || '');
    mark.replaceWith(text);
  });
}

function highlightContent(root, query, { scrollToFirst = false } = {}) {
  if (!root) return;
  clearHighlights(root);
  if (!query) return;
  const terms = query.split(/\s+/).map((term) => term.trim()).filter(Boolean);
  if (!terms.length) return;

  const lowerTerms = terms.map((term) => term.toLowerCase());
  const skipTags = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE']);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentNode;
        if (parent && skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const matches = [];
  let current;
  while ((current = walker.nextNode())) {
    const value = current.nodeValue.toLowerCase();
    if (lowerTerms.some((term) => value.includes(term))) {
      matches.push(current);
    }
  }

  const termPattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'gi');
  matches.forEach((textNode) => {
    const text = textNode.nodeValue;
    const fragments = [];
    let lastIndex = 0;
    text.replace(termPattern, (match, _group, offset) => {
      if (offset > lastIndex) {
        fragments.push(document.createTextNode(text.slice(lastIndex, offset)));
      }
      const mark = document.createElement('mark');
      mark.className = 'hl';
      mark.textContent = match;
      fragments.push(mark);
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIndex)));
    }
    const replacement = document.createDocumentFragment();
    fragments.forEach((fragment) => replacement.appendChild(fragment));
    textNode.parentNode.replaceChild(replacement, textNode);
  });

  if (scrollToFirst) {
    requestAnimationFrame(() => {
      const first = root.querySelector('mark.hl');
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
}

// Sidebar nav toggle. Behavior depends on data-nav-collapse (default "overlay"):
//   overlay — drawer: slide in/out over the content (the mobile UX, on desktop too)
//   push / instant — collapse the sidebar column (push reflows, instant snaps)
// Mobile (<=960px) always uses the drawer regardless of mode.
if (mobileMenuToggle && sidebar) {
  const navMode = () => document.body.dataset.navCollapse || 'overlay';
  // A drawer is active on mobile (any mode) or on desktop in overlay mode.
  const drawerActive = () => window.innerWidth <= 960 || navMode() === 'overlay';
  const closeDrawer = () => {
    sidebar.classList.remove('mobile-open');
    document.body.classList.remove('menu-open');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
  };

  // Initial desktop state: push/instant show the nav (expanded); overlay starts closed.
  if (window.innerWidth > 960 && navMode() !== 'overlay') {
    mobileMenuToggle.setAttribute('aria-expanded', 'true');
  }

  mobileMenuToggle.addEventListener('click', () => {
    // Desktop push/instant: collapse the sidebar column.
    if (window.innerWidth > 960 && navMode() !== 'overlay') {
      const collapsed = document.body.classList.toggle('nav-collapsed');
      mobileMenuToggle.setAttribute('aria-expanded', String(!collapsed));
      return;
    }
    // Drawer (overlay on desktop, or any mobile): slide in/out.
    const open = sidebar.classList.toggle('mobile-open');
    document.body.classList.toggle('menu-open', open);
    mobileMenuToggle.setAttribute('aria-expanded', String(open));
  });

  // Close the drawer when a nav leaf/item is chosen (not parent section headers).
  nav.addEventListener('click', (e) => {
    if (!drawerActive()) return;
    const clicked = e.target.closest('.nav-item, .nav-leaf, .nav-parent');
    if (clicked && (clicked.classList.contains('nav-item') || clicked.classList.contains('nav-leaf'))) {
      closeDrawer();
    }
  });

  // Close the drawer when clicking outside it.
  document.addEventListener('click', (e) => {
    if (drawerActive() &&
        sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) &&
        !mobileMenuToggle.contains(e.target)) {
      closeDrawer();
    }
  });
}

// The brand/site title is the home link — clicking it routes to the default
// section (the blog index, or the docs home). `navigate` handles the already-home
// case, so it works from anywhere.
const brandHome = document.getElementById('brandHome');
if (brandHome) {
  brandHome.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(DEFAULT_SECTION);
  });
}
