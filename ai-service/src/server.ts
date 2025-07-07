import express from 'express'
import routes from './routes'
import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

export const app = express()
app.use(express.json())
app.use(routes)

export function startServer(port = Number(process.env.PORT) || 3000) {
  return app.listen(port, () => logger.info(`ai-service listening on ${port}`))
}

if (require.main === module) {
  startServer()
}

export default app
