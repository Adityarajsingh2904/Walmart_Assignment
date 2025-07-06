import express from 'express'
import { collectDefaultMetrics, register } from 'prom-client'
import fs from 'fs'
import pino from 'pino'
import env from './config'
import { runPlaybook, type AlertEvent } from './engine'
import { loadPlaybook } from './playbook/mapper'

collectDefaultMetrics()
const logger = pino({ level: env.LOG_LEVEL })

export const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'soar-service' })
})

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

export async function startServer() {

  const server = app.listen(Number(env.PORT), () => {
    logger.info(`soar-service listening on ${env.PORT}`)
  })
  const shutdown = () => {
    logger.info('shutting down')
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return server
}

export async function runPlaybookCli(args: string[]) {
  const alertIdx = args.indexOf('--alert')
  const pbIdx = args.indexOf('--playbook')
  if (alertIdx === -1 || pbIdx === -1 || !args[alertIdx + 1] || !args[pbIdx + 1]) {
    console.error('Usage: run-playbook --alert alert.json --playbook pb.yaml')
    process.exit(1)
  }

  const alert: AlertEvent = JSON.parse(fs.readFileSync(args[alertIdx + 1], 'utf8'))
  const pb = loadPlaybook(fs.readFileSync(args[pbIdx + 1], 'utf8'))
  try {
    const result = await runPlaybook(pb, alert, {
      logger: {
        info: logger.info.bind(logger) as (...args: unknown[]) => void,
        error: logger.error.bind(logger) as (...args: unknown[]) => void
      }
    })
    logger.info({ result }, 'playbook executed')
    process.exit(0)
  } catch (err) {
    logger.error({ err }, 'playbook failed')
    process.exit(1)
  }
}

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2)
  if (cmd === 'run-playbook') {
    runPlaybookCli([cmd, ...rest])
  } else {
    startServer()
  }
}

export default app
