import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildReleaseAssets, main, publishRelease, verifyLocalTag } from '../../tools/release/publish-github-release.mjs';

const commit = 'a'.repeat(40);
const tag = 'v2026.9.1';
const assets = ['pagenary-publisher-2026.9.1.tgz', 'pagenary-site-2026.9.1.tgz', 'checksums.txt'].map(name => ({ name, bytes: Buffer.from(name), contentType: 'application/octet-stream' }));
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

for (const env of [ {}, { NPMJS_PUBLISH_ENABLED: 'false', NPM_PUBLISH_SUCCEEDED: 'true' }, { NPMJS_PUBLISH_ENABLED: 'true', RELEASE_DRY_RUN: 'true', NPM_PUBLISH_SUCCEEDED: 'true' }, { NPMJS_PUBLISH_ENABLED: 'true', NPM_PUBLISH_SUCCEEDED: 'false' } ]) {
  test(`publication gate prevents all effects: ${JSON.stringify(env)}`, async () => {
    const forbidden = () => assert.fail('Gated publication must not execute commands or HTTP requests');
    assert.ok((await main({ env, cwd: '/nonexistent-release-workspace', run: forbidden, fetchImpl: forbidden })).skipped);
  });
}

test('local tag validation rejects version and checked-out commit mismatches', () => {
  assert.throws(() => verifyLocalTag({ ref: 'refs/heads/main', version: '2026.9.1', run: () => assert.fail('invalid ref must fail before git') }), /existing version tag/);
  assert.throws(() => verifyLocalTag({ ref: `refs/tags/${tag}`, version: '2026.9.1', run: (_cmd, args) => args.at(-1) === 'HEAD' ? 'b'.repeat(40) : commit }), /checked-out commit/);
});

test('asset builder packages prepack output with exact archive names and checksum bytes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'pagenary-release-test-'));
  try {
    const outputDir = join(cwd, 'release-assets');
    const publisher = join(cwd, 'apps/publisher');
    mkdirSync(join(publisher, 'site'), { recursive: true });
    const calls = [];
    const built = buildReleaseAssets({ cwd, version: '2026.9.1', outputDir, run(command, args, options) {
      calls.push({ command, args, options });
      if (command === 'npm') {
        assert.deepEqual(args, ['pack', '--json', '--pack-destination', outputDir]);
        assert.equal(options.cwd, publisher);
        writeFileSync(join(outputDir, assets[0].name), 'packed publisher bytes');
        writeFileSync(join(publisher, 'site/index.html'), '<h1>prepack built site</h1>');
        return JSON.stringify([{ filename: assets[0].name, version: '2026.9.1' }]);
      }
      assert.equal(command, 'tar');
      assert.deepEqual(args, ['-czf', join(outputDir, assets[1].name), '-C', join(publisher, 'site'), '.']);
      writeFileSync(args[1], readFileSync(join(publisher, 'site/index.html')));
      return '';
    } });
    assert.deepEqual(calls.map(c => c.command), ['npm', 'tar']);
    assert.deepEqual(built.map(a => a.name), assets.map(a => a.name));
    assert.equal(built[0].bytes.toString(), 'packed publisher bytes');
    assert.equal(built[1].bytes.toString(), '<h1>prepack built site</h1>');
    const expected = built.slice(0, 2).map(a => `${createHash('sha256').update(a.bytes).digest('hex')}  ${a.name}\n`).join('');
    assert.equal(built[2].bytes.toString(), expected);
    assert.equal(readFileSync(join(outputDir, 'checksums.txt'), 'utf8'), expected);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('remote tag mismatch prevents every release mutation', async () => {
  const calls = [];
  await assert.rejects(publishRelease({ tag, commit, repository: 'jmagly/pagenary', token: 'test', assets, fetchImpl: async (url, options) => {
    calls.push([url, options.method || 'GET']);
    return json({ object: { type: 'commit', sha: 'b'.repeat(40) } });
  } }), /Remote release tag/);
  assert.deepEqual(calls, [[`https://api.github.com/repos/jmagly/pagenary/git/ref/tags/${tag}`, 'GET']]);
});

for (const exists of [false, true]) {
  test(`${exists ? 'reuse' : 'create'} release preserves annotated tag and uploads exact bytes`, async () => {
    const uploads = [];
    const writes = [];
    const release = { id: 7, tag_name: tag, draft: false, prerelease: false };
    await publishRelease({ tag, commit, repository: 'jmagly/pagenary', token: 'test', assets, fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test');
      if (options.method) writes.push([url, options.method]);
      if (url.includes('/git/ref/')) return json({ object: { type: 'tag', sha: 'c'.repeat(40) } });
      if (url.includes('/git/tags/')) return json({ object: { type: 'commit', sha: commit } });
      if (url.includes('/releases/tags/')) return json(release, exists ? 200 : 404);
      if (url.endsWith('/releases')) { assert.equal(JSON.parse(options.body).tag_name, tag); return json(release, 201); }
      if (url.includes('?per_page=')) return json(exists ? [{ id: 10, name: assets[0].name }] : []);
      if (options.method === 'DELETE') return new Response(null, { status: 204 });
      if (url.startsWith('https://uploads.github.com/')) { uploads.push({ name: new URL(url).searchParams.get('name'), bytes: options.body }); return json({}, 201); }
      assert.fail(`Unexpected request ${url}`);
    } });
    assert.deepEqual(uploads, assets.map(({ name, bytes }) => ({ name, bytes })));
    assert.equal(writes.filter(([, method]) => method === 'DELETE').length, exists ? 1 : 0);
    assert.ok(writes.every(([url]) => !url.includes('/git/')));
  });
}

test('upload failure is fatal and does not continue uploading', async () => {
  let uploads = 0;
  await assert.rejects(publishRelease({ tag, commit, repository: 'jmagly/pagenary', token: 'test', assets, fetchImpl: async (url) => {
    if (url.includes('/git/ref/')) return json({ object: { type: 'commit', sha: commit } });
    if (url.includes('/releases/tags/')) return json({ id: 7, tag_name: tag, draft: false });
    if (url.includes('?per_page=')) return json([]);
    uploads++;
    return json({ message: 'upload unavailable' }, 503);
  } }), /HTTP 503/);
  assert.equal(uploads, 1);
});
