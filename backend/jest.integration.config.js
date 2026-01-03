/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/tests/integration'],

  // Only match test files in the integration directory
  testMatch: ['**/tests/integration/**/*.test.ts'],

  // File extensions to consider
  moduleFileExtensions: ['ts', 'js', 'json'],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/integration/setup.ts',
  globalTeardown: '<rootDir>/tests/integration/teardown.ts',

  // Longer timeout for API calls (30 seconds)
  testTimeout: 30000,

  // Transform TypeScript files
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Verbose output for CI debugging
  verbose: true,

  // Fail fast on first error in CI
  bail: process.env.CI ? 1 : 0,

  // Force exit after tests complete (helps with hanging connections)
  forceExit: true,

  // Detect open handles (async operations not properly cleaned up)
  detectOpenHandles: true,

  // Run tests serially (avoid race conditions with shared test data)
  maxWorkers: 1,
};
