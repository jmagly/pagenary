import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import {
  encodePathForFilename,
  extractHtmlFromModule,
  readManifestFromDist,
  resolveDiscoverabilityProfile
} from './seo-generator.js';

const RESTRICTED_PROFILES = new Set(['limited', 'locked']);

function collectMarkdownSections(manifest, parentTitle = null) {
  const sections = [];
  for (const entry of manifest || []) {
    if (entry.module) {
      sections.push({
        id: entry.id,
        title: entry.title,
        summary: entry.summary || '',
        module: entry.module,
        parent: parentTitle,
        author: entry.author || '',
        date: entry.date || '',
        reading_label: entry.reading_label || '',
        tags: Array.isArray(entry.tags) ? entry.tags : []
      });
    }
    if (entry.subsections) sections.push(...collectMarkdownSections(entry.subsections, entry.title));
  }
  return sections;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

export function resolveMarkdownDeliveryConfig(config = {}) {
  const resolved = resolveDiscoverabilityProfile(config);
  const profile = resolved.seo?.discoverabilityProfile || 'standard';
  const authored = resolved.markdownDelivery && typeof resolved.markdownDelivery === 'object'
    ? resolved.markdownDelivery
    : {};
  const enabled = authored.enabled === true && !RESTRICTED_PROFILES.has(profile) && resolved.seo?.noIndex !== true;
  const directArtifacts = enabled && (!hasOwn(authored, 'directArtifacts') || authored.directArtifacts === true);
  return {
    enabled: enabled && directArtifacts,
    contentNegotiation: enabled && directArtifacts && authored.contentNegotiation !== false,
    directArtifacts,
    observability: {
      responseHeader: authored.observability?.responseHeader === true
    },
    disabledReason: RESTRICTED_PROFILES.has(profile)
      ? `discoverability profile ${profile}`
      : (resolved.seo?.noIndex === true ? 'seo.noIndex' : (!directArtifacts ? 'directArtifacts disabled' : null))
  };
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function textOnly(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}

function tableToMarkdown(table) {
  const rows = [...String(table).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => ({
      header: cell[1].toLowerCase() === 'h',
      text: textOnly(cell[2]).replace(/\|/g, '\\|')
    }))
  ).filter((row) => row.length);
  if (!rows.length) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index]?.text || ''));
  const header = normalized[0];
  const body = normalized.slice(1);
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n');
}

export function htmlToMarkdown(html) {
  const protectedBlocks = [];
  const protect = (value) => {
    const token = `\u0000PAGENARY_MD_${protectedBlocks.length}\u0000`;
    protectedBlocks.push(value);
    return token;
  };

  let output = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, attrs, code) => {
      const language = /language-([\w-]+)/i.exec(attrs)?.[1] || '';
      const decoded = decodeEntities(code).replace(/^\n|\n$/g, '');
      const fence = decoded.includes('```') ? '````' : '```';
      return protect(`\n\n${fence}${language}\n${decoded}\n${fence}\n\n`);
    })
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => protect(`\n\n${tableToMarkdown(table)}\n\n`))
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = attribute(tag, 'alt');
      const src = attribute(tag, 'src');
      return src ? `![${alt.replace(/]/g, '\\]')}](${src})` : alt;
    })
    .replace(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi,
      (_, doubleHref, singleHref, label) => `[${textOnly(label)}](${decodeEntities(doubleHref || singleHref || '')})`)
    .replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi,
      (_, heading, content) => `\n\n${'#'.repeat(Number(heading.slice(1)))} ${textOnly(content)}\n\n`)
    .replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, content) => `\n\n_${textOnly(content)}_\n\n`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, content) => `\n\n${textOnly(content).split(/\n/).map((line) => `> ${line}`).join('\n')}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => `\n- ${textOnly(content)}`)
    .replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, content) => `**${textOnly(content)}**`)
    .replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, content) => `*${textOnly(content)}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, content) => `\`${textOnly(content).replace(/`/g, '\\`')}\``)
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<hr\b[^>]*>/gi, '\n\n---\n\n')
    .replace(/<button\b[^>]*>([\s\S]*?)<\/button>/gi, (_, content) => textOnly(content))
    .replace(/<\/(p|div|section|article|aside|header|footer|ul|ol|figure|details|summary|dl|dt|dd)>/gi, '\n\n')
    .replace(/<(p|div|section|article|aside|header|footer|ul|ol|figure|details|summary|dl|dt|dd)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ');

  output = decodeEntities(output);
  protectedBlocks.forEach((block, index) => {
    output = output.replace(`\u0000PAGENARY_MD_${index}\u0000`, block);
  });
  return output
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractAuthoredMarkdownFromModule(moduleContent) {
  const source = String(moduleContent || '');
  const encoded = source.match(/^\/\/ pagenary-authored-markdown-base64: ([A-Za-z\d+/=]+)$/m)?.[1];
  if (encoded) {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  const match = source.match(/authoredMarkdown:\s*("(?:[^"\\]|\\.)*")/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function publicPath(basePath, pathname) {
  const base = String(basePath || '').replace(/\/$/, '');
  return `${base}${pathname}` || '/';
}

function rewriteMarkdownUrls(markdown, { sectionPaths, basePath }) {
  return String(markdown || '').replace(/(!?)\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g,
    (match, image, label, rawHref, suffix) => {
      let href = rawHref;
      if (!image && href.startsWith('#') && sectionPaths.has(href.slice(1))) {
        href = publicPath(basePath, sectionPaths.get(href.slice(1)));
      } else if (!/^(?:[a-z][a-z\d+.-]*:|\/|#|\.\.\/)/i.test(href)) {
        href = publicPath(basePath, `/${href.replace(/^\.\//, '')}`);
      }
      return `${image}[${label}](${href}${suffix})`;
    });
}

function ensurePageHeading(markdown, section) {
  const content = String(markdown || '').trim();
  const details = [];
  if (section.author) details.push(`- **Author:** ${String(section.author).replace(/\s+/g, ' ').trim()}`);
  if (section.date) details.push(`- **Date:** ${String(section.date).replace(/\s+/g, ' ').trim()}`);
  if (section.reading_label) details.push(`- **Reading time:** ${String(section.reading_label).replace(/\s+/g, ' ').trim()}`);
  if (Array.isArray(section.tags) && section.tags.length) details.push(`- **Tags:** ${section.tags.join(', ')}`);

  const context = [];
  if (section.summary) context.push(`> ${section.summary}`);
  if (details.length) context.push(details.join('\n'));
  const heading = content.match(/^#\s+.*$/m);
  if (heading) {
    if (!context.length) return `${content}\n`;
    const insertion = `${heading[0]}\n\n${context.join('\n\n')}`;
    return `${content.replace(heading[0], insertion)}\n`;
  }
  const intro = [`# ${section.title || section.id}`, ...context];
  if (content) intro.push(content);
  return `${intro.join('\n\n')}\n`;
}

async function readRenderedRouteFallback(distDir, encoded) {
  try {
    const rendered = await fsp.readFile(path.join(distDir, 'pages', `${encoded}.html`), 'utf8');
    const content = rendered.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
      || rendered.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
    return content || '';
  } catch {
    return '';
  }
}

export async function generateMarkdownArtifacts(distDir, config = {}) {
  const delivery = resolveMarkdownDeliveryConfig(config);
  const markdownDir = path.join(distDir, 'markdown');
  const routeManifestPath = path.join(distDir, 'markdown-routes.json');
  if (!delivery.enabled) {
    await Promise.all([
      fsp.rm(markdownDir, { recursive: true, force: true }),
      fsp.rm(routeManifestPath, { force: true })
    ]);
    return { generated: 0, delivery };
  }
  await Promise.all([
    fsp.rm(markdownDir, { recursive: true, force: true }),
    fsp.rm(routeManifestPath, { force: true })
  ]);
  const manifest = await readManifestFromDist(distDir);
  if (!manifest) return { generated: 0, delivery };

  const sections = collectMarkdownSections(manifest);
  await fsp.mkdir(markdownDir, { recursive: true });
  const sectionPaths = new Map(sections.map((section) => [section.id, `/pages/${encodePathForFilename(section.id)}.html`]));
  const routes = {};
  let generated = 0;

  for (const section of sections) {
    try {
      const encoded = encodePathForFilename(section.id);
      const moduleContent = await fsp.readFile(path.join(distDir, section.module), 'utf8');
      const authored = extractAuthoredMarkdownFromModule(moduleContent);
      const html = extractHtmlFromModule(moduleContent);
      const renderedFallback = authored || html
        ? ''
        : await readRenderedRouteFallback(distDir, encoded);
      const source = authored || htmlToMarkdown(html || renderedFallback);
      if (!source.trim()) continue;
      const markdown = ensurePageHeading(rewriteMarkdownUrls(source, {
        sectionPaths,
        basePath: config.basePath || ''
      }), section);
      const artifact = `/markdown/${encoded}.md`;
      const canonical = `/pages/${encoded}.html`;
      await fsp.writeFile(path.join(markdownDir, `${encoded}.md`), markdown, 'utf8');
      const record = { id: section.id, canonical, artifact };
      routes[canonical] = record;
      routes[`/pages/${encoded}`] = record;
      generated += 1;
    } catch (error) {
      console.warn(`  ⚠ Failed to generate Markdown representation for ${section.id}: ${error.message}`);
    }
  }

  const first = sections.find((section) => routes[`/pages/${encodePathForFilename(section.id)}.html`]);
  if (first) routes['/'] = routes[`/pages/${encodePathForFilename(first.id)}.html`];
  const routeManifest = {
    version: 1,
    contentNegotiation: delivery.contentNegotiation,
    directArtifacts: delivery.directArtifacts,
    basePath: config.basePath || '',
    observability: delivery.observability,
    routes
  };
  await fsp.writeFile(routeManifestPath, `${JSON.stringify(routeManifest, null, 2)}\n`, 'utf8');
  console.log(`  ↳ generated ${generated} Markdown representation(s) in /markdown/`);
  return { generated, delivery, routes: routeManifest };
}
