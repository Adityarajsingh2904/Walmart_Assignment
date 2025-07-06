import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  coveragePathIgnorePatterns: ['<rootDir>/src/client'],
  coverageThreshold: {
    global: {
      statements: 80
    }
  }
}

export default config
