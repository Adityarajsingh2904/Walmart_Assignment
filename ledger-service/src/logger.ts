import pino from 'pino'
import env from './env'

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'ledger-service' },
  timestamp: pino.stdTimeFunctions.isoTime
})

export default logger
