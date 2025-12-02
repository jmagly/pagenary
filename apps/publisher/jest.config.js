/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: [
    'scripts/**/*.js',
    '!scripts/serve.js', // Server has side effects
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Note: Coverage thresholds disabled for now because tests run scripts
  // as subprocesses (integration tests). Unit tests with direct requires
  // would need to be added for meaningful coverage metrics.
  // coverageThreshold: {
  //   global: {
  //     lines: 40,
  //     branches: 30,
  //     functions: 40,
  //     statements: 40
  //   }
  // },
  verbose: true,
  testTimeout: 30000 // Increased for build processes
};
