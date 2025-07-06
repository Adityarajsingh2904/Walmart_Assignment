import request from 'supertest'
import { createApp } from '../src/server'
import { describe, it, expect } from 'vitest'

describe('GET /healthz', () => {
  it('responds with status ok', async () => {
    const app = createApp()
    const res = await request(app).get('/healthz')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
