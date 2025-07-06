import logger from '../../src/logger'

describe('logger', () => {
  it('should have service default meta', () => {
    const bindings = (logger as any).bindings()
    expect(bindings.service).toBe('ledger-service')
  })
})
