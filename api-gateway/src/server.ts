import env from './config/env'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import openapiSpec from './lib/openapi'
import pino from 'pino'
import http from 'http'
import pool from './lib/db'
import { initSocket, io } from './lib/socket'
import { metricsRouter, trackRoute } from './middleware/metrics'
import auth from './middleware/auth'
import openaiUsage from './middleware/openaiUsage'
import alertsRoutes from './routes/alerts'
import sessionsRoutes from './routes/sessions'
import usersRoutes from './routes/users'
import soarRoutes from './routes/soar'
import ledgerRoutes from './routes/ledger'

const logger = pino({ level: env.LOG_LEVEL, base: { service: 'api-gateway' } })

export function createApp() {
  const app = express()
  app.use(helmet())
  const origins = env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  app.use(cors(origins.length ? { origin: origins } : {}))
  app.use(morgan('combined'))
  app.use(express.json())

  // public routes
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }))
  app.use(metricsRouter)
  app.get('/docs-json', (_req, res) => res.json(openapiSpec))
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))

  // auth & middlewares
  app.use(auth())
  app.use(openaiUsage(pool))

  // authenticated routes with metrics
  app.use(trackRoute('alerts'), alertsRoutes)
  app.use(trackRoute('sessions'), sessionsRoutes)
  app.use(trackRoute('users'), usersRoutes)
  app.use(trackRoute('soar'), soarRoutes)
  app.use(trackRoute('ledger'), ledgerRoutes)

  return app
}

export function startServer() {
  const app = createApp()
  const server = http.createServer(app)
  const socket = initSocket(server)

  server.listen(env.PORT, () => {
    logger.info(`API Gateway listening on ${env.PORT}`)
  })

  const shutdown = async () => {
    await socket.close()
    server.close(() => {})
    if (typeof (logger as any).flush === 'function') {
      ;(logger as any).flush()
    }
    setTimeout(() => process.exit(), 100).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return server
}

if (require.main === module) {
  startServer()
}
