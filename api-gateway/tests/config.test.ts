import config from '../src/config'

describe('config', () => {
  it('loads defaults', () => {
    expect(config.port).toBe(8080)
  })
})
