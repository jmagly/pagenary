#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  prototypeCoreV1KnowledgeShard,
  prototypeFullV1KnowledgeShard,
} from './lib/fortemi-shard-prototype.js';

const args = process.argv.slice(2);
const profileArg = args.find((arg) => arg.startsWith('--profile='));
const profile = profileArg?.slice('--profile='.length) || 'core-v1';
const [input, output] = args.filter((arg) => !arg.startsWith('--profile='));
if (!input || !output) {
  console.error(
    'Usage: node scripts/prototype-fortemi-shard.mjs ' +
    '[--profile=core-v1|full-v1] <index-export.json> <output.shard>'
  );
  process.exitCode = 2;
} else if (profile !== 'core-v1' && profile !== 'full-v1') {
  console.error(`Unknown Knowledge Shard profile: ${profile}`);
  process.exitCode = 2;
} else {
  const source = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
  const result = profile === 'full-v1'
    ? await prototypeFullV1KnowledgeShard(source)
    : await prototypeCoreV1KnowledgeShard(source);
  if (profile === 'full-v1' && (!result.success || !result.archive)) {
    process.stdout.write(`${JSON.stringify({
      profile: result.profile,
      schema_version: result.schema_version,
      success: result.success,
      lossless: result.lossless,
      losses: result.losses,
      receipt: result.receipt,
    }, null, 2)}\n`);
    throw new Error('Input cannot be represented losslessly as Knowledge Shard 2.0.0/full-v1');
  }
  if (profile === 'core-v1' && !result.report.roundTripExact) {
    throw new Error('Knowledge Shard round-trip changed the promoted index');
  }
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(path.resolve(output), profile === 'full-v1' ? result.archive : result.bytes);
  process.stdout.write(`${JSON.stringify(profile === 'full-v1' ? {
    profile: result.profile,
    schema_version: result.schema_version,
    success: result.success,
    lossless: result.lossless,
    losses: result.losses,
    receipt: result.receipt,
  } : result.report, null, 2)}\n`);
}
