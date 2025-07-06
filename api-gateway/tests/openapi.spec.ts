import request from 'supertest'
import { createApp } from '../src/index'
import { describe, it, expect } from 'vitest'
import SwaggerParser from '@apidevtools/swagger-parser'

describe('swagger spec', () => {
  it('swagger spec is valid', async () => {
    const app = createApp()
    const spec = (await request(app).get('/docs-json')).body
    await SwaggerParser.validate(spec)
    expect(spec.openapi).toBe('3.1.0')
  })
})
