module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/lib/**/*.ts'],
};
