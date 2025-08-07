module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'public/js/**/*.js',
    'server/**/*.js',
    'netlify/functions/**/*.js',
    '!node_modules/**',
    '!tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  setupFiles: [
    '<rootDir>/tests/setup.js'
  ],
  testTimeout: 30000, // 30 seconds for network requests
  verbose: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
