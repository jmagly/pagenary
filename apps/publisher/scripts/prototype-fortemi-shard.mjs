#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { prototypeKnowledgeShard } from './lib/fortemi-shard-prototype.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/prototype-fortemi-shard.mjs <index-export.json> <output.shard>');
  process.exitCode = 2;
} else {
  const source = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
  const result = await prototypeKnowledgeShard(source);
  if (!result.report.roundTripExact) throw new Error('Knowledge Shard round-trip changed the promoted index');
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(path.resolve(output), result.bytes);
  process.stdout.write(`${JSON.stringify(result.report, null, 2)}\n`);
}
