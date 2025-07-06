import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { collectDefaultMetrics, register, Counter } from 'prom-client'
import env from './env'
import ledgerRoutes from './routes/ledger'
import logger from './logger'

collectDefaultMetrics()
export const ledgerLogTotal = new Counter({
  name: 'ledger_log_total',
  help: 'Total ledger log operations',
  labelNames: ['status'] as const,
})

export const app = express()
app.use(helmet())
app.use(cors())
app.use(morgan('combined'))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/ledger', ledgerRoutes)

const metricsApp = express()
metricsApp.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

export async function startServer() {
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'ledger-service listening')
  })
  const metricsServer = metricsApp.listen(env.METRICS_PORT)
  const shutdown = () => {
    server.close(() => {})
    metricsServer.close(() => {})
    setTimeout(() => process.exit(0), 100).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return { server, metricsServer }
}

if (require.main === module) void startServer()

export default app
