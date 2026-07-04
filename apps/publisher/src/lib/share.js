const DEFAULT_SERVICES = ['copy', 'email'];
const NATIVE_MODES = new Set(['auto', 'always', 'never']);

export const SHARE_SERVICE_CATALOG = {
  copy: {
    id: 'copy',
    label: 'Copy Link',
    kind: 'action'
  },
  email: {
    id: 'email',
    label: 'Email',
    urlTemplate: 'mailto:?subject={title}&body={title}%0A%0A{url}'
  },
  x: {
    id: 'x',
    label: 'X',
    urlTemplate: 'https://twitter.com/intent/tweet?url={url}&text={title}'
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    urlTemplate: 'https://www.linkedin.com/sharing/share-offsite/?url={url}'
  },
  facebook: {
    id: 'facebook',
    label: 'Facebook',
    urlTemplate: 'https://www.facebook.com/sharer/sharer.php?u={url}'
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    urlTemplate: 'https://www.threads.net/intent/post?text={title}%20{url}'
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    urlTemplate: 'https://bsky.app/intent/compose?text={title}%20{url}'
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    urlTemplate: 'https://www.reddit.com/submit?url={url}&title={title}'
  },
  hackernews: {
    id: 'hackernews',
    label: 'Hacker News',
    urlTemplate: 'https://news.ycombinator.com/submitlink?u={url}&t={title}'
  },
  lobsters: {
    id: 'lobsters',
    label: 'Lobsters',
    urlTemplate: 'https://lobste.rs/stories/new?url={url}&title={title}'
  },
  producthunt: {
    id: 'producthunt',
    label: 'Product Hunt',
    urlTemplate: 'https://www.producthunt.com/posts/new?url={url}'
  },
  slashdot: {
    id: 'slashdot',
    label: 'Slashdot',
    urlTemplate: 'https://slashdot.org/submission?url={url}&title={title}'
  },
  sms: {
    id: 'sms',
    label: 'SMS',
    urlTemplate: 'sms:?&body={title}%20{url}'
  },
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp',
    urlTemplate: 'https://wa.me/?text={title}%20{url}'
  },
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    urlTemplate: 'https://t.me/share/url?url={url}&text={title}'
  },
  signal: {
    id: 'signal',
    label: 'Signal',
    urlTemplate: 'sgnl://send?text={title}%20{url}'
  },
  messenger: {
    id: 'messenger',
    label: 'Messenger',
    urlTemplate: 'fb-messenger://share?link={url}'
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    urlTemplate: 'https://mastodon.social/share?text={title}%20{url}',
    configKey: 'mastodon',
    configurableInstance: true
  },
  misskey: {
    id: 'misskey',
    label: 'Misskey',
    urlTemplate: 'https://misskey.io/share?text={title}%20{url}',
    configKey: 'misskey',
    configurableInstance: true
  },
  lemmy: {
    id: 'lemmy',
    label: 'Lemmy',
    urlTemplate: 'https://lemmy.world/create_post?url={url}&title={title}',
    configKey: 'lemmy',
    configurableInstance: true
  },
  pocket: {
    id: 'pocket',
    label: 'Pocket',
    urlTemplate: 'https://getpocket.com/save?url={url}&title={title}'
  },
  instapaper: {
    id: 'instapaper',
    label: 'Instapaper',
    urlTemplate: 'https://www.instapaper.com/edit?url={url}&title={title}&description={description}'
  },
  pinboard: {
    id: 'pinboard',
    label: 'Pinboard',
    urlTemplate: 'https://pinboard.in/add?url={url}&title={title}&description={description}'
  },
  raindrop: {
    id: 'raindrop',
    label: 'Raindrop.io',
    urlTemplate: 'https://app.raindrop.io/add?link={url}&title={title}'
  },
  teams: {
    id: 'teams',
    label: 'Microsoft Teams',
    urlTemplate: 'https://teams.microsoft.com/share?href={url}&msgText={title}'
  },
  notion: {
    id: 'notion',
    label: 'Notion',
    urlTemplate: 'https://www.notion.so/web-clipper?url={url}'
  },
  trello: {
    id: 'trello',
    label: 'Trello',
    urlTemplate: 'https://trello.com/add-card?url={url}&name={title}&desc={description}'
  },
  pinterest: {
    id: 'pinterest',
    label: 'Pinterest',
    urlTemplate: 'https://www.pinterest.com/pin/create/button/?url={url}&description={title}'
  },
  tumblr: {
    id: 'tumblr',
    label: 'Tumblr',
    urlTemplate: 'https://www.tumblr.com/widgets/share/tool?canonicalUrl={url}&title={title}&caption={description}'
  }
};

export function normalizeShareConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const rawServices = Array.isArray(source.services) ? source.services : DEFAULT_SERVICES;
  return {
    enabled: source.enabled === true,
    native: NATIVE_MODES.has(source.native) ? source.native : 'auto',
    services: rawServices,
    mastodon: normalizeInstanceConfig(source.mastodon),
    misskey: normalizeInstanceConfig(source.misskey),
    lemmy: normalizeInstanceConfig(source.lemmy)
  };
}

export function buildShareTargets(config = {}) {
  const normalized = normalizeShareConfig(config);
  if (!normalized.enabled) return [];
  const targets = [];
  for (const item of normalized.services) {
    const target = normalizeService(item, normalized);
    if (!target) continue;
    if (!targets.some((existing) => existing.id === target.id)) targets.push(target);
  }
  if (!targets.some((target) => target.id === 'copy')) targets.unshift(SHARE_SERVICE_CATALOG.copy);
  if (!targets.some((target) => target.id === 'email')) targets.push(SHARE_SERVICE_CATALOG.email);
  return targets;
}

export function resolveSharePayload({ entry = {}, siteConfig = {}, locationHref = '' } = {}) {
  const siteTitle = siteConfig.siteTitle || siteConfig.title || '';
  const title = entry.title && siteTitle ? `${entry.title} · ${siteTitle}` : (entry.title || siteTitle || 'Share this page');
  const description = entry.summary || siteConfig.description || '';
  const url = resolveShareUrl({ entry, siteConfig, locationHref });
  return { title, text: description, description, url };
}

export function buildShareHref(target, payload) {
  if (!target || target.kind === 'action' || !target.urlTemplate) return '';
  return target.urlTemplate.replace(/\{(url|title|text|description)\}/g, (_, key) => {
    const value = key === 'text' ? payload.text : payload[key];
    return encodeURIComponent(value || '');
  });
}

export function shouldUseNativeShare({ config = {}, navigatorRef, matchMediaRef, maxTouchPoints = 0 } = {}) {
  const normalized = normalizeShareConfig(config);
  if (!normalized.enabled || normalized.native === 'never') return false;
  if (!navigatorRef || typeof navigatorRef.share !== 'function') return false;
  if (normalized.native === 'always') return true;
  if (Number(maxTouchPoints) > 0) return true;
  if (typeof matchMediaRef === 'function') {
    try {
      return Boolean(matchMediaRef('(pointer: coarse)').matches);
    } catch {
      return false;
    }
  }
  return false;
}

function normalizeService(item, config) {
  if (typeof item === 'string') {
    const builtIn = SHARE_SERVICE_CATALOG[item.toLowerCase()];
    return builtIn ? applyServiceConfig(builtIn, config) : null;
  }
  if (!item || typeof item !== 'object') return null;
  const id = sanitizeId(item.id);
  const label = typeof item.label === 'string' ? item.label.trim() : '';
  const urlTemplate = typeof item.urlTemplate === 'string' ? item.urlTemplate.trim() : '';
  if (!id || !label || !isSafeTemplate(urlTemplate)) return null;
  return { id, label, urlTemplate };
}

function applyServiceConfig(service, config) {
  if (!service.configurableInstance) return service;
  const instanceConfig = config[service.configKey] || {};
  const instance = normalizeInstanceUrl(instanceConfig.instance);
  if (!instance) return service;
  if (service.id === 'mastodon') {
    return { ...service, urlTemplate: `${instance}/share?text={title}%20{url}` };
  }
  if (service.id === 'misskey') {
    return { ...service, urlTemplate: `${instance}/share?text={title}%20{url}` };
  }
  if (service.id === 'lemmy') {
    return { ...service, urlTemplate: `${instance}/create_post?url={url}&title={title}` };
  }
  return service;
}

function resolveShareUrl({ entry = {}, siteConfig = {}, locationHref = '' }) {
  if (entry.staticUrl) return entry.staticUrl;
  const baseUrl = String(siteConfig.siteUrl || '').replace(/\/+$/, '');
  if (baseUrl && entry.id) {
    return `${baseUrl}/pages/${String(entry.id).replace(/\//g, '--')}.html`;
  }
  if (locationHref) return stripHashless(locationHref);
  if (entry.id) return `#${entry.id}`;
  return '';
}

function stripHashless(value) {
  try {
    const url = new URL(value);
    return url.href;
  } catch {
    return value;
  }
}

function normalizeInstanceConfig(value) {
  if (!value || typeof value !== 'object') return {};
  return {
    instance: normalizeInstanceUrl(value.instance),
    mode: value.mode === 'configured-instance' ? 'configured-instance' : 'default'
  };
}

function normalizeInstanceUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function sanitizeId(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(raw) ? raw : '';
}

function isSafeTemplate(value) {
  if (!value) return false;
  if (/^(mailto:|sms:|https?:\/\/|sgnl:\/\/|fb-messenger:\/\/)/i.test(value)) return true;
  return false;
}
