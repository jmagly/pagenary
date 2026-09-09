#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export async function mirrorRelease({ tag, server, repository, token, fetchImpl = fetch, attempts = 45, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^v\d{4}\.(?:[1-9]|1[0-2])\.(?:0|[1-9]\d*)$/.test(tag)) throw Error('Expected stable CalVer tag');
  if (!token) throw Error('Gitea release token is required');
  if (server !== 'https://git.integrolabs.net' || repository !== 'roctinam/pagenary') throw Error('Unexpected canonical Gitea destination');
  const version = tag.slice(1);
  const names = [`pagenary-publisher-${version}.tgz`, `pagenary-site-${version}.tgz`, 'checksums.txt'];
  async function request(url, options = {}) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(60000) });
    return response;
  }
  // GitHub release assets are public. Never send the Gitea token to GitHub.
  let release;
  for (let i = 0; i < attempts; i++) {
    const response = await request(`https://api.github.com/repos/jmagly/pagenary/releases/tags/${tag}`);
    if (response.ok) {
      const candidate = await response.json();
      if (candidate.tag_name === tag && !candidate.draft && names.every(name => candidate.assets?.some(a => a.name === name))) {
        release = candidate;
        break;
      }
    } else if (response.status !== 404) {
      throw Error(`GitHub release lookup failed: HTTP ${response.status}`);
    }
    if (i + 1 < attempts) await wait(20000);
  }
  if (!release) throw Error('Timed out waiting for the GitHub npm workflow to publish complete release assets');
  const files = new Map();
  for (const name of names) {
    const asset = release.assets.find(a => a.name === name);
    const url = new URL(asset.browser_download_url);
    if (url.origin !== 'https://github.com' || !url.pathname.startsWith(`/jmagly/pagenary/releases/download/${tag}/`)) throw Error(`Unexpected asset URL: ${name}`);
    const response = await request(url.href);
    if (!response.ok) throw Error(`GitHub asset download failed: ${name}, HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.size) throw Error(`Asset size mismatch: ${name}`);
    files.set(name, bytes);
  }
  const rows = files.get('checksums.txt').toString('utf8').trim().split(/\r?\n/);
  for (const name of names.filter(n => n.endsWith('.tgz'))) {
    const expected = rows.map(row => row.trim().split(/\s+/)).filter(row => row[1]?.replace(/^\*/, '') === name);
    const actual = createHash('sha256').update(files.get(name)).digest('hex');
    if (expected.length !== 1 || expected[0][0] !== actual) throw Error(`Checksum mismatch: ${name}`);
  }
  // No destination writes occur until every source asset has been verified.
  const api = `${server}/api/v1/repos/${repository}/releases`;
  async function gitea(url, options = {}) {
    const response = await request(url, { ...options, headers: { Authorization: `token ${token}`, ...options.headers } });
    if (!response.ok) throw Error(`Gitea ${options.method || 'GET'} failed: HTTP ${response.status}`);
    return response;
  }
  const existing = await request(`${api}/tags/${tag}`, { headers: { Authorization: `token ${token}` } });
  let destination;
  const payload = JSON.stringify({ tag_name: tag, name: release.name || tag, body: release.body || '', draft: false, prerelease: false });
  if (existing.ok) {
    destination = await existing.json();
    await gitea(`${api}/${destination.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload });
  } else if (existing.status === 404) {
    destination = await (await gitea(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })).json();
  } else throw Error(`Gitea release lookup failed: HTTP ${existing.status}`);
  if (!Number.isInteger(destination.id) || destination.id <= 0) throw Error('Invalid Gitea release ID');
  const assetApi = `${api}/${destination.id}/assets`;
  const existingAssets = await (await gitea(assetApi)).json();
  for (const [name, bytes] of files) {
    for (const asset of existingAssets.filter(a => a.name === name)) await gitea(`${assetApi}/${asset.id}`, { method: 'DELETE' });
    const form = new FormData();
    form.append('attachment', new Blob([bytes]), name);
    await gitea(`${assetApi}?name=${encodeURIComponent(name)}`, { method: 'POST', body: form });
    console.log(`Mirrored verified asset: ${name}`);
  }
  return { tag, assets: names, verified: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(await mirrorRelease({ tag: process.env.RELEASE_TAG, server: process.env.GITHUB_SERVER_URL, repository: process.env.GITHUB_REPOSITORY, token: process.env.GITEA_TOKEN })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
