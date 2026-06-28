// pagenary CLI dispatcher.
//
// `pagenary` is the one supported, stable interface for the publisher. Internal
// scripts/*.js are an implementation detail this dispatcher delegates to. Unknown
// commands exit non-zero with near-match suggestions; every command supports
// --help; errors never leak internal script paths.

import { readPackageJson, hasFlag, stripFlags, levenshtein } from './cli-util.js';
import { COMMANDS, GROUPS } from './cli-commands.js';

const HELP_TOKENS = new Set(['--help', '-h', 'help']);
const VERSION_TOKENS = new Set(['--version', '-V']);

function visibleCommands() {
  return Object.entries(COMMANDS).filter(([, def]) => !def.hidden);
}

function renderGlobalHelp() {
  const pkg = readPackageJson();
  const lines = [
    `pagenary — ${pkg.description || 'multi-tenant documentation publisher'}`,
    '',
    'Usage:',
    '  pagenary <command> [options]',
    '  npx @pagenary/publisher <command> [options]',
    ''
  ];
  const all = visibleCommands();
  const width = Math.max(...all.map(([name]) => name.length));
  for (const group of GROUPS) {
    const inGroup = all.filter(([, def]) => def.group === group);
    if (inGroup.length === 0) continue;
    lines.push(`${group}:`);
    for (const [name, def] of inGroup) {
      lines.push(`  ${name.padEnd(width)}  ${def.summary}`);
    }
    lines.push('');
  }
  lines.push('Run `pagenary <command> --help` for command options.');
  lines.push('Global: --help, --version, --json (on read-only commands).');
  lines.push('');
  return lines.join('\n');
}

function renderCommandHelp(name, def) {
  const lines = [
    `pagenary ${name} — ${def.summary}`,
    '',
    'Usage:',
    `  ${def.usage || `pagenary ${name}`}`
  ];
  if (def.flags && def.flags.length) {
    lines.push('', 'Options:');
    const width = Math.max(...def.flags.map(([f]) => f.length));
    for (const [flag, desc] of def.flags) {
      lines.push(`  ${flag.padEnd(width)}  ${desc}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function suggestions(input) {
  return visibleCommands()
    .map(([name]) => [name, levenshtein(input, name)])
    .filter(([, d]) => d <= 3)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([name]) => name);
}

/**
 * Run the CLI. Returns a Promise resolving to the process exit code.
 * @param {string[]} argv arguments after the node binary + script (process.argv.slice(2))
 */
export async function run(argv) {
  const [rawCommand, ...rest] = argv;

  // No command, or a bare help request → global help.
  if (!rawCommand || HELP_TOKENS.has(rawCommand)) {
    process.stdout.write(renderGlobalHelp());
    return 0;
  }
  // Bare version request.
  if (VERSION_TOKENS.has(rawCommand)) {
    const pkg = readPackageJson();
    process.stdout.write(`${pkg.name} ${pkg.version}\n`);
    return 0;
  }

  const def = COMMANDS[rawCommand];
  if (!def) {
    process.stderr.write(`pagenary: unknown command "${rawCommand}"\n`);
    const near = suggestions(rawCommand);
    if (near.length) {
      process.stderr.write(`\nDid you mean:\n${near.map((n) => `  ${n}`).join('\n')}\n`);
    }
    process.stderr.write('\nRun `pagenary --help` to see all commands.\n');
    return 1;
  }

  // Per-command help.
  if (hasFlag(rest, ['--help', '-h'])) {
    process.stdout.write(renderCommandHelp(rawCommand, def));
    return 0;
  }

  // Resolve global --json once; strip it so it never reaches passthrough scripts
  // that don't understand it.
  const json = hasFlag(rest, '--json');
  const cleaned = json ? stripFlags(rest, ['--json']) : rest;

  try {
    const code = await def.run(cleaned, { json });
    return typeof code === 'number' ? code : 0;
  } catch (err) {
    if (json) {
      process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
    } else {
      process.stderr.write(`pagenary: ${rawCommand} failed: ${err.message}\n`);
    }
    return 1;
  }
}
