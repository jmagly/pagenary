import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let contractPath;
try {
  // Development and source controls must observe the canonical shared module.
  contractPath = require.resolve('../../../authoring-contract/index.cjs');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  contractPath = require.resolve('./authoring-contract.cjs');
}
// Load outside the resolution catch: a broken canonical module must not silently
// fall back to a previously bundled copy.
export default require(contractPath);
