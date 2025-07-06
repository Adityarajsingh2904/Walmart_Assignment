import express, { RequestHandler } from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import swaggerUi from 'swagger-ui-express'
import fs from 'fs'
import yaml from 'yaml'
import pino from 'pino'
import config from './config'
import { jwtMiddleware } from './middleware/jwt'
import { usageLogger } from './middleware/usageLogger'
import { metricsHandler } from './middleware/metrics'
import alerts from './routes/alerts'
import sessions from './routes/sessions'
import users from './routes/users'
import soar from './routes/soar'
import ledger from './routes/ledger'
import { attachSocket } from './sockets'

export function createApp() {
  const app = express()
  const spec = yaml.parse(fs.readFileSync(__dirname + '/openapi.yaml', 'utf8'))
  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.get('/metrics', metricsHandler)
  app.use('/docs', swaggerUi.serve as unknown as RequestHandler, swaggerUi.setup(spec) as unknown as RequestHandler)
  app.use(jwtMiddleware)
  app.use(usageLogger)
  app.use('/alerts', alerts)
  app.use('/sessions', sessions)
  app.use('/users', users)
  app.use('/soar', soar)
  app.use('/ledger', ledger)
  return app
}

/* istanbul ignore next */
if (require.main === module) {
  const app = createApp()
  const httpServer = createServer(app)
  const io = new Server(httpServer)
  attachSocket(io)
  httpServer.listen(config.port, () => {
    const logger = pino({ level: config.logLevel })
    logger.info(`API Gateway listening on ${config.port}`)
  })
}
