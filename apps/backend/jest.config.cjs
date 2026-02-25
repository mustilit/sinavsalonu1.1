module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000,
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: './test-reports', outputName: 'junit.xml' }]
  ],
  collectCoverage: false,
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/'],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 30,
      lines: 35,
      statements: 35,
    },
  },
};

