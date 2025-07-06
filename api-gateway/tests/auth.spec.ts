import express from 'express'
import request from 'supertest'
import { describe, it, expect, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import auth from '../src/middleware/auth'

declare const process: { env: Record<string, string> }

const secret = 'testsecret'

function buildApp() {
  const app = express()
  app.get('/protected', auth(), (req, res) => {
    res.json(req.user)
  })
  return app
}

beforeEach(() => {
  process.env.JWT_SECRET = secret
})

describe('jwt auth middleware', () => {
  it('allows valid token', async () => {
    const payload = {
      id: randomUUID(),
      roles: ['user'],
      tenant_id: randomUUID()
    }
    const token = jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: '1h',
      notBefore: 0
    })
    const app = buildApp()
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual(payload)
  })

  it('rejects expired token', async () => {
    const payload = {
      id: randomUUID(),
      roles: [],
      tenant_id: randomUUID()
    }
    const now = Math.floor(Date.now() / 1000)
    const token = jwt.sign(
      { ...payload, iat: now - 50, exp: now - 40 },
      secret,
      { algorithm: 'HS256' }
    )
    const app = buildApp()
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('rejects missing token', async () => {
    const app = buildApp()
    const res = await request(app).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })
})
