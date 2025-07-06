import request from 'supertest'
import { createApp } from '../src/server'

describe('server', () => {
  const app = createApp()

  it('healthcheck', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('docs', async () => {
    const res = await request(app).get('/docs').redirects(1)
    expect(res.status).toBe(200)
  })

  it('metrics', async () => {
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
  })
})
