#!/usr/bin/env node
/**
 * pagenary — CLI entry point for @pagenary/publisher.
 *
 * A thin wrapper over the existing scripts/*.js ESM entry points so the
 * package works as `npx @pagenary/publisher <command>` and as an installed
 * devDependency CLI (`pagenary <command>`). Scripts are resolved relative to
 * this file (the installed package), never the caller's CWD, so the right
 * generator code runs regardless of where the command is invoked.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(__dirname, '..', 'scripts');

// command -> { script, baseArgs, summary }
const COMMANDS = {
  build: {
    script: 'build.js',
    baseArgs: [],
    summary: 'Build the default bundle to dist/.'
  },
  'build:tenants': {
    script: 'build-tenants.js',
    baseArgs: [],
    summary: 'Build tenant bundles to dist/<id>/. Pass a tenant id to build one.'
  },
  'tenants:list': {
    script: 'build-tenants.js',
    baseArgs: ['--list'],
    summary: 'List configured tenants from the registry.'
  },
  serve: {
    script: 'serve.js',
    baseArgs: [],
    summary: 'Serve the built output over HTTP.'
  }
};

// Convenience aliases.
const ALIASES = {
  'build:tenant': 'build:tenants'
};

function printHelp() {
  const lines = [
    'pagenary — multi-tenant documentation publisher',
    '',
    'Usage:',
    '  pagenary <command> [options]',
    '  npx @pagenary/publisher <command> [options]',
    '',
    'Commands:'
  ];
  const width = Math.max(...Object.keys(COMMANDS).map((c) => c.length));
  for (const [name, def] of Object.entries(COMMANDS)) {
    lines.push(`  ${name.padEnd(width)}  ${def.summary}`);
  }
  lines.push(
    '',
    'Examples:',
    '  pagenary build',
    '  pagenary build:tenants            # build all enabled tenants',
    '  pagenary build:tenants pagenary   # build one tenant',
    '  pagenary tenants:list',
    '  pagenary serve',
    '',
    'Any extra options are passed through to the underlying script, e.g.',
    '  pagenary build:tenants --incremental',
    ''
  );
  console.log(lines.join('\n'));
}

function main() {
  const [, , rawCommand, ...rest] = process.argv;

  if (!rawCommand || rawCommand === '--help' || rawCommand === '-h' || rawCommand === 'help') {
    printHelp();
    process.exit(0);
  }

  const command = ALIASES[rawCommand] || rawCommand;
  const def = COMMANDS[command];

  if (!def) {
    console.error(`pagenary: unknown command "${rawCommand}"\n`);
    printHelp();
    process.exit(1);
  }

  const scriptPath = path.join(scriptsDir, def.script);
  const args = [scriptPath, ...def.baseArgs, ...rest];

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (err) => {
    console.error(`pagenary: failed to run ${command}: ${err.message}`);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}

main();
