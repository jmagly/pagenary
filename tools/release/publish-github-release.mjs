#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function runCommand(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error(`${command} failed: ${result.error?.message || result.stderr || result.status}`);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.stdout.trim();
}

export function verifyLocalTag({ cwd, ref, version, run = runCommand }) {
  if (ref !== `refs/tags/v${version}` || !/^\d{4}\.(?:[1-9]|1[0-2])\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw Error('Release requires an existing version tag matching the publisher package');
  }
  const commit = run('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd });
  const head = run('git', ['rev-parse', '--verify', 'HEAD'], { cwd });
  if (!/^[a-f0-9]{40}$/.test(commit) || commit !== head) throw Error('Release tag does not identify the checked-out commit');
  return { tag: `v${version}`, commit };
}

export function buildReleaseAssets({ cwd, version, outputDir = join(cwd, 'release-assets'), run = runCommand }) {
  mkdirSync(outputDir, { recursive: true });
  const publisher = join(cwd, 'apps/publisher');
  // Run the real prepack lifecycle; its site output and bundled contract ship together.
  const packed = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', outputDir], { cwd: publisher }));
  const tarball = `pagenary-publisher-${version}.tgz`;
  if (packed.length !== 1 || packed[0].filename !== tarball || packed[0].version !== version) throw Error('Unexpected publisher npm pack result');
  if (!statSync(join(publisher, 'site/index.html')).size) throw Error('Prepack did not produce a site index');
  const site = `pagenary-site-${version}.tgz`;
  run('tar', ['-czf', join(outputDir, site), '-C', join(publisher, 'site'), '.'], { cwd });
  const assets = [tarball, site].map(name => ({ name, bytes: readFileSync(join(outputDir, name)), contentType: 'application/gzip' }));
  if (assets.some(asset => !asset.bytes.length)) throw Error('Empty release archive');
  const checksums = assets.map(({ name, bytes }) => `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`).join('');
  writeFileSync(join(outputDir, 'checksums.txt'), checksums);
  return [...assets, { name: 'checksums.txt', bytes: Buffer.from(checksums), contentType: 'text/plain' }];
}

export async function publishRelease({ tag, commit, repository, token, assets, fetchImpl = fetch }) {
  if (repository !== 'jmagly/pagenary' || !token) throw Error('Canonical GitHub repository and workflow token are required');
  if (!/^v\d{4}\.(?:[1-9]|1[0-2])\.(?:0|[1-9]\d*)$/.test(tag) || !/^[a-f0-9]{40}$/.test(commit)) throw Error('Stable release tag and commit are required');
  const names = [`pagenary-publisher-${tag.slice(1)}.tgz`, `pagenary-site-${tag.slice(1)}.tgz`, 'checksums.txt'];
  if (assets.length !== names.length || names.some(name => assets.filter(a => a.name === name && a.bytes?.length).length !== 1)) throw Error('Expected exactly the three release assets');
  const api = `https://api.github.com/repos/${repository}`;
  async function request(url, options = {}, allowMissing = false) {
    const response = await fetchImpl(url, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...options.headers },
    });
    if (!response.ok && !(allowMissing && response.status === 404)) throw Error(`GitHub ${options.method || 'GET'} failed: HTTP ${response.status}`);
    return response;
  }
  // Resolve the existing remote tag without ever creating or rewriting a tag.
  const ref = await (await request(`${api}/git/ref/tags/${tag}`)).json();
  let object = ref.object;
  for (let depth = 0; object?.type === 'tag' && depth < 8; depth++) {
    if (!/^[a-f0-9]{40}$/.test(object.sha)) throw Error('Invalid remote tag object');
    object = (await (await request(`${api}/git/tags/${object.sha}`)).json()).object;
  }
  if (object?.type !== 'commit' || object.sha !== commit) throw Error('Remote release tag does not match the checked-out commit');
  const existing = await request(`${api}/releases/tags/${tag}`, {}, true);
  let release;
  if (existing.status === 404) {
    release = await (await request(`${api}/releases`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_name: tag, name: `Pagenary ${tag}`, draft: false, prerelease: false,
        body: `Install with \`npm install -g @pagenary/publisher@${tag.slice(1)}\`.\n\nAssets include the publisher npm package, compiled site ready to host, and SHA-256 checksums.`,
      }),
    })).json();
  } else release = await existing.json();
  if (!Number.isInteger(release.id) || release.id <= 0 || release.tag_name !== tag || release.draft || release.prerelease) throw Error('Unexpected GitHub release identity or visibility');
  // Enumerate all pages so reruns replace existing assets even on larger releases.
  const oldAssets = [];
  for (let page = 1; ; page++) {
    const batch = await (await request(`${api}/releases/${release.id}/assets?per_page=100&page=${page}`)).json();
    if (!Array.isArray(batch)) throw Error('Invalid GitHub assets response');
    oldAssets.push(...batch);
    if (batch.length < 100) break;
  }
  for (const asset of assets) {
    for (const old of oldAssets.filter(a => a.name === asset.name)) {
      if (!Number.isInteger(old.id) || old.id <= 0) throw Error('Invalid GitHub asset ID');
      await request(`${api}/releases/assets/${old.id}`, { method: 'DELETE' });
    }
    await request(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`, {
      method: 'POST', headers: { 'Content-Type': asset.contentType }, body: asset.bytes,
    });
  }
  return { tag, releaseId: release.id, assets: names };
}

export async function main({ env = process.env, cwd = process.cwd(), run = runCommand, fetchImpl = fetch } = {}) {
  if (env.NPMJS_PUBLISH_ENABLED !== 'true' || env.RELEASE_DRY_RUN === 'true' || env.NPM_PUBLISH_SUCCEEDED !== 'true') return { skipped: 'npm publishing was not enabled and successful, or this is a dry run' };
  const version = JSON.parse(readFileSync(join(cwd, 'apps/publisher/package.json'), 'utf8')).version;
  const context = verifyLocalTag({ cwd, ref: env.GITHUB_REF, version, run });
  if (version.includes('-')) return { skipped: 'prerelease tag' };
  const assets = buildReleaseAssets({ cwd, version, run });
  return publishRelease({ ...context, repository: env.GITHUB_REPOSITORY, token: env.GH_TOKEN, assets, fetchImpl });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
