import { Request, Response, NextFunction } from 'express'
import { collectDefaultMetrics, Registry } from 'prom-client'

export const register = new Registry()
collectDefaultMetrics({ register })

export function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', register.contentType)
  register.metrics().then(m => res.end(m))
}

export function metricsMiddleware(_req: Request, _res: Response, next: NextFunction) {
  next()
}
