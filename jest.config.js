module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['**/*.ts', '!main.ts', '!**/*.module.ts'],
  coverageDirectory: '../coverage',
};
