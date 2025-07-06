import logger from '../../src/logger'

describe('logger', () => {
  it('should have service default meta', () => {
    // @ts-ignore access private property
    const meta = (logger as any).defaultMeta
    expect(meta.service).toBe('ledger-service')
  })
})
