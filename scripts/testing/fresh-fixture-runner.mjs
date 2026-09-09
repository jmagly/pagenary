import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runManagedProcess } from '../../apps/publisher/scripts/lib/process-lifecycle.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const publisher = path.join(root, 'apps/publisher');
const args = process.argv.slice(2);
if (args[0] !== '--fixture' || !['syntax-gallery', 'seo'].includes(args[1])) throw new Error('Explicit supported fixture required');
async function run(command, argv, cwd) {
  const result = await runManagedProcess(command, argv, { cwd }, 1_140_000);
  process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  if (result.code !== 0 || result.signal) throw new Error(`Fixture action failed (${result.code ?? result.signal})`);
}
if (args[1] === 'syntax-gallery') {
  await run(process.execPath, ['scripts/build-tenants.js', '--registry', 'examples/recipes.tenants.json', 'syntax-gallery'], publisher);
} else {
  await run(process.execPath, ['scripts/build.js'], publisher);
}
if (args.length > 2) {
  if (args[2] !== '--' || !args[3]) throw new Error('Fixture command requires explicit argv after --');
  await run(args[3], args.slice(4), publisher);
}
