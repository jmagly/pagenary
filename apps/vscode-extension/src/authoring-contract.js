'use strict';

try {
  module.exports = require('../../authoring-contract/index.cjs');
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  module.exports = require('./authoring-contract.cjs');
}
