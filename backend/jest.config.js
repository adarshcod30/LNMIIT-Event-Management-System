// Two projects share one config:
//   unit         pure functions and middleware, no database, runs in milliseconds
//   integration  the real Express app over HTTP (Supertest) against an in-memory MongoDB
// Coverage is measured across both, and the thresholds below fail the run if it drops.
const shared = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  clearMocks: true,
  restoreMocks: true,
};

module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/matchers.js'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/setup/globalSetup.js',
      globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
      setupFilesAfterEnv: ['<rootDir>/tests/setup/matchers.js', '<rootDir>/tests/setup/database.js'],
    },
  ],
  collectCoverageFrom: [
    'app.js',
    'lib/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'models/**/*.js',
    // wiring that needs a real Google account or SMTP server
    '!lib/passport.js',
    '!lib/email.js',
    // process entry points and one-off scripts
    '!lib/db.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    // Measured at 92.7 / 88.3 / 97.8 / 93.9. The gate sits just below, so a drop fails the build.
    global: { statements: 90, branches: 85, functions: 95, lines: 90 },
  },
};
