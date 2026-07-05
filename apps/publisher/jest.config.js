/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: [
    'scripts/**/*.js',
    'src/lib/**/*.js',
    '!scripts/serve.js', // Server has side effects
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 60000,
  // ESM support
  transform: {},
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js'
  }
};
