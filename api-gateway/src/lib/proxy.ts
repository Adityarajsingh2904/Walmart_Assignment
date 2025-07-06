import type { Request, Response, NextFunction } from 'express'
import CircuitBreaker from 'opossum'
import fetch from 'node-fetch'
if (!(global as any).fetch) {
  ;(global as any).fetch = fetch
}
import { z } from 'zod'

const breakerOptions = {
  timeout: 10_000,
  errorThresholdPercentage: 50,
  resetTimeout: 60_000
}

interface Result {
  status: number
  body: any
}

export function createProxyHandler(target: string, schema: z.ZodTypeAny) {
  const fetcher = async (url: string, options: RequestInit): Promise<Result> => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await global.fetch(url, { ...options, signal: controller.signal })
      if (res.status >= 500) throw new Error('upstream error')
      const text = await res.text()
      const body = text ? JSON.parse(text) : undefined
      if (res.ok && body !== undefined) {
        schema.parse(body)
      }
      return { status: res.status, body }
    } finally {
      clearTimeout(id)
    }
  }

  const breaker = new CircuitBreaker(fetcher, breakerOptions)
  breaker.fallback(() => ({ status: 503, body: { error: 'Upstream unavailable' } }))

  return async (req: Request, res: Response, _next: NextFunction) => {
    const url = new URL(req.originalUrl, target).toString()
    const headers: Record<string, string> = {}
    if (req.headers.authorization) headers['Authorization'] = req.headers.authorization
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'] as string
    const opts: RequestInit = {
      method: req.method,
      headers
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      opts.body = JSON.stringify(req.body)
    }
    try {
      const { status, body } = await breaker.fire(url, opts)
      if (body === undefined) return res.status(status).end()
      res.status(status).json(body)
    } catch {
      res.status(503).json({ error: 'Upstream unavailable' })
    }
  }
}
