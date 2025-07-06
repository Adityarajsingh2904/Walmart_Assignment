module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  coverageThreshold: {
    global: { statements: 80 }
  }
};
