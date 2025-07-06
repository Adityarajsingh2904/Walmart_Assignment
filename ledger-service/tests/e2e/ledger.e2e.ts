import request from 'supertest'
import app from '../../src/server'

describe('ledger service', () => {
  it('health', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
