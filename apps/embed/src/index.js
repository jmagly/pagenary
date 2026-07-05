import { aggregateBlogIndexes } from '@pagenary/blog-client';

const HTMLElementBase = globalThis.HTMLElement || class {};
const templateHtml = `
  <style>
    :host {
      --pagenary-blog-color: inherit;
      --pagenary-blog-muted: #5f6673;
      --pagenary-blog-border: #d9dee8;
      --pagenary-blog-gap: 1rem;
      --pagenary-blog-link: currentColor;
      display: block;
      color: var(--pagenary-blog-color);
      font: inherit;
    }
    [part="list"] {
      display: grid;
      gap: var(--pagenary-blog-gap);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    [part="item"] {
      border-block-end: 1px solid var(--pagenary-blog-border);
      padding-block-end: var(--pagenary-blog-gap);
    }
    [part="title"] {
      color: var(--pagenary-blog-link);
      font-weight: 700;
      text-decoration: none;
    }
    [part="title"]:hover {
      text-decoration: underline;
    }
    [part="meta"],
    [part="summary"],
    [part="notice"] {
      color: var(--pagenary-blog-muted);
      font-size: 0.92em;
      line-height: 1.5;
    }
    [part="meta"] {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      margin-block: 0.2rem 0;
    }
    [part="summary"] {
      margin-block: 0.45rem 0;
    }
  </style>
  <div part="root" role="status" aria-live="polite"></div>
`;

function createTemplate() {
  const template = document.createElement('template');
  template.innerHTML = templateHtml;
  return template;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function booleanAttr(element, name) {
  const value = element.getAttribute(name);
  return value !== null && value !== 'false';
}

export class PagenaryBlogElement extends HTMLElementBase {
  static observedAttributes = ['sources', 'limit', 'show-source'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = createTemplate();
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.root = this.shadowRoot.querySelector('[part="root"]');
    this.abortController = null;
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this.abortController) this.abortController.abort();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  async render() {
    const sources = this.getAttribute('sources') || '';
    const limitRaw = Number.parseInt(this.getAttribute('limit') || '', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    const showSource = booleanAttr(this, 'show-source');

    if (!sources.trim()) {
      this.root.innerHTML = '<p part="notice">No blog sources configured.</p>';
      return;
    }

    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    this.root.innerHTML = '<p part="notice">Loading updates...</p>';

    try {
      const result = await aggregateBlogIndexes(sources, {
        limit,
        signal: this.abortController.signal,
        fetch: window.fetch.bind(window)
      });
      const notice = result.errors.length
        ? `<p part="notice">${result.errors.length} source${result.errors.length === 1 ? '' : 's'} unavailable.</p>`
        : '';
      const items = result.posts.map((post) => this.renderPost(post, showSource)).join('');
      this.root.setAttribute('role', 'region');
      this.root.innerHTML = items
        ? `${notice}<ul part="list">${items}</ul>`
        : `${notice}<p part="notice">No posts yet.</p>`;
    } catch {
      if (this.abortController?.signal.aborted) return;
      this.root.innerHTML = '<p part="notice">Updates are unavailable right now.</p>';
    }
  }

  renderPost(post, showSource) {
    const url = post.url || post.canonical || post.path || '#';
    const date = formatDate(post.date);
    const source = post.source?.title || post.docbase?.title || '';
    const meta = [
      date ? `<time datetime="${esc(post.date)}">${esc(date)}</time>` : '',
      showSource && source ? `<span part="source">${esc(source)}</span>` : ''
    ].filter(Boolean).join('<span aria-hidden="true">·</span>');

    return `<li part="item">
      <article>
        <a part="title" href="${esc(url)}">${esc(post.title || post.slug || 'Untitled')}</a>
        ${meta ? `<div part="meta">${meta}</div>` : ''}
        ${post.summary ? `<p part="summary">${esc(post.summary)}</p>` : ''}
      </article>
    </li>`;
  }
}

export function definePagenaryBlogElement(name = 'pagenary-blog') {
  if (!customElements.get(name)) customElements.define(name, PagenaryBlogElement);
  return customElements.get(name);
}

if (typeof window !== 'undefined' && window.customElements) {
  definePagenaryBlogElement();
}
