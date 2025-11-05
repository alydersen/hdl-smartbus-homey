module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.js'
  ],
  collectCoverageFrom: [
    'app.js',
    'drivers/**/*.js',
    'hdl/**/*.js',
    '!**/node_modules/**',
    '!**/.homeycompose/**',
    '!**/coverage/**',
    '!**/.homeybuild/**'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // Mock Homey module
  moduleNameMapper: {
    '^homey$': '<rootDir>/test/mocks/homey.js'
  },
  watchPathIgnorePatterns: [
    '<rootDir>/.homeybuild/'
  ]
};

