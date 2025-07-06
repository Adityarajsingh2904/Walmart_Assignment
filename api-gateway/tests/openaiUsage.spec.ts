import request from 'supertest'
import express from 'express'
import { newDb } from 'pg-mem'
import openaiUsage from '../src/middleware/openaiUsage'
import { describe, it, expect } from 'vitest'

function setup() {
  const db = newDb()
  db.public.none(`CREATE TABLE openai_usage(
    model text not null,
    prompt_tokens integer not null,
    completion_tokens integer not null,
    cost double precision not null
  )`)
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()
  const app = express()
  app.use(openaiUsage(pool))
  app.get('/test', (_req, res) => res.json({ ok: true }))
  return { app, pool }
}

describe('openai usage middleware', () => {
  it('records header data', async () => {
    const { app, pool } = setup()
    const header = {
      model: 'gpt-4o',
      prompt_tokens: 1,
      completion_tokens: 2,
      cost: 0.1
    }
    await request(app)
      .get('/test')
      .set('x-openai-usage', JSON.stringify(header))
    const rows = await pool.query('SELECT * FROM openai_usage')
    expect(rows.rowCount).toBe(1)
    expect(rows.rows[0].model).toBe('gpt-4o')
  })

  it('ignores missing header', async () => {
    const { app, pool } = setup()
    await request(app).get('/test')
    const rows = await pool.query('SELECT * FROM openai_usage')
    expect(rows.rowCount).toBe(0)
  })
})
