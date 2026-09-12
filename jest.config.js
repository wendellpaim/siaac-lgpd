/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/siaac.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.js'],
  reporters: ['default', '<rootDir>/test/avaliacao-reporter.js'],
  verbose: true,
  forceExit: true,
};
