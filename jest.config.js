module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'scripts/utils/**/*.js',
    '!src/**/*.d.ts',
    '!src/index.js',
    '!src/serviceWorker.js',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!scripts/utils/**/*.test.js',
    '!scripts/utils/**/__*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'html', 'text-summary'],
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['__coverage.test.js']
};
