import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import jwt from 'jsonwebtoken'
let createApp: typeof import('../src/server').createApp

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

async function makeApp() {
  vi.resetModules()
  const mod = await import('../src/server')
  createApp = mod.createApp
  return createApp()
}

describe('proxy alerts', () => {
  it('forwards alert data', async () => {
    process.env.JWT_SECRET = 'secret'
    process.env.ALERTS_URL = 'http://alerts.test'
    const app = await makeApp()
    server.use(
      rest.get('http://alerts.test/alerts', (req, res, ctx) => {
        expect(req.headers.get('authorization')).toMatch(/^Bearer /)
        return res(
          ctx.json({ id: '11111111-1111-1111-1111-111111111111', class: 'foo', severity: 'low' })
        )
      })
    )
    const token = jwt.sign(
      { id: randomUUID(), roles: [], tenant_id: randomUUID() },
      'secret',
      { algorithm: 'HS256', expiresIn: '1h', notBefore: 0 }
    )
    const res = await request(app).get('/alerts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.class).toBe('foo')
  })

  it('handles upstream failure', async () => {
    process.env.JWT_SECRET = 'secret'
    process.env.ALERTS_URL = 'http://alerts.test'
    const app = await makeApp()
    server.use(rest.get('http://alerts.test/alerts', (_req, res, ctx) => res(ctx.status(500))))
    const token = jwt.sign(
      { id: randomUUID(), roles: [], tenant_id: randomUUID() },
      'secret',
      { algorithm: 'HS256', expiresIn: '1h', notBefore: 0 }
    )
    const res = await request(app).get('/alerts').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ error: 'Upstream unavailable' })
  })
})
