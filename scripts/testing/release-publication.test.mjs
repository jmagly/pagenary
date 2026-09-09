import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mirrorRelease } from '../../tools/release/mirror-gitea-release.mjs';

function fixture({ corrupt = false, failUpload = false, delay = false } = {}) {
  const tag = 'v2026.9.1';
  const files = new Map([
    ['pagenary-publisher-2026.9.1.tgz', Buffer.from('packed publisher')],
    ['pagenary-site-2026.9.1.tgz', Buffer.from('compiled site')]
  ]);
  files.set('checksums.txt', Buffer.from([...files].map(([name, bytes]) => `${createHash('sha256').update(bytes).digest('hex')}  ${name}`).join('\n') + '\n'));
  const mutations = [], uploads = []; let lookups = 0;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET';
    if (url.hostname !== 'git.integrolabs.net') assert.equal(options.headers?.Authorization, undefined, 'Gitea token must never reach GitHub');
    if (url.hostname === 'api.github.com') {
      if (delay && ++lookups === 1) return json({}, 404);
      return json({ tag_name: tag, name: tag, body: 'Published by npm', draft: false, assets: [...files].map(([name, bytes]) => ({ name, size: bytes.length, browser_download_url: `https://github.com/jmagly/pagenary/releases/download/${tag}/${name}` })) });
    }
    if (url.hostname === 'github.com') {
      const name = url.pathname.split('/').pop();
      const bytes = Buffer.from(files.get(name));
      if (corrupt && name.endsWith('publisher-2026.9.1.tgz')) bytes[0] ^= 1;
      return new Response(bytes);
    }
    assert.equal(options.headers.Authorization, 'token test-only-placeholder');
    if (method !== 'GET') mutations.push({ method, pathname: url.pathname });
    if (url.pathname.endsWith(`/tags/${tag}`)) return json({ id: 10 });
    if (method === 'PATCH') return json({ id: 10 });
    if (method === 'GET' && url.pathname.endsWith('/assets')) return json([{ id: 20, name: 'checksums.txt' }]);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (method === 'POST') {
      if (failUpload) return json({}, 500);
      const blob = options.body.get('attachment');
      uploads.push({ name: url.searchParams.get('name'), bytes: Buffer.from(await blob.arrayBuffer()) });
      return json({ id: 21 }, 201);
    }
    throw Error(`Unexpected request: ${method} ${url}`);
  };
  return { files, mutations, uploads, options: { tag, server: 'https://git.integrolabs.net', repository: 'roctinam/pagenary', token: 'test-only-placeholder', fetchImpl, attempts: 2, wait: async () => {} } };
}

test('mirrors exact npm-owned release assets with token confined to Gitea', async () => {
  const f = fixture({ delay: true });
  const result = await mirrorRelease(f.options);
  assert.equal(result.verified, true);
  assert.equal(f.uploads.length, 3);
  for (const { name, bytes } of f.uploads) assert.deepEqual(bytes, f.files.get(name));
  assert.ok(f.mutations.some(x => x.method === 'DELETE'));
});

test('corrupted source artifact fails before any Gitea write', async () => {
  const f = fixture({ corrupt: true });
  await assert.rejects(mirrorRelease(f.options), /Checksum mismatch/);
  assert.deepEqual(f.mutations, []);
});

test('Gitea upload rejection fails the release job', async () => {
  const f = fixture({ failUpload: true });
  await assert.rejects(mirrorRelease(f.options), /Gitea POST failed: HTTP 500/);
});

test('missing release never becomes a successful no-op', async () => {
  const f = fixture();
  f.options.fetchImpl = async () => new Response('{}', { status: 404 });
  await assert.rejects(mirrorRelease(f.options), /Timed out/);
});
