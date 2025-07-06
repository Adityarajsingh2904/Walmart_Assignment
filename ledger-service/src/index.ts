import express from 'express'
import { stringify } from 'csv-stringify'
import env from './env'
import logger from './logger'
import client from './client'
import { SoarActionEvent } from './models/event'

export const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ledger-service' })
})

app.post('/log-event', async (req, res) => {
  const event = req.body as SoarActionEvent
  await client.logEvent(event)
  res.status(201).json({ status: 'logged' })
})

app.get('/verify/:runId', async (req, res) => {
  const verified = await client.verify(req.params.runId)
  res.json({ runId: req.params.runId, verified })
})

app.get('/export/csv', async (_req, res) => {
  const events = await client.getEvents()
  res.setHeader('Content-Type', 'text/csv')
  const stringifier = stringify({ header: true })
  stringifier.pipe(res)
  events.forEach(e => stringifier.write(e))
  stringifier.end()
})

/* istanbul ignore next */
export async function startServer() {
  const server = app.listen(env.PORT, () => {
    logger.info(`ledger-service listening on ${env.PORT}`)
  })
  const shutdown = () => server.close(() => process.exit(0))
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return server
}

/* istanbul ignore next */
if (require.main === module) {
  startServer()
}

export default app
