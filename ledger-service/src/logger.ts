import winston from 'winston'
import env from './env'

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.json(),
  defaultMeta: { service: 'ledger-service' },
  transports: [new winston.transports.Console()]
})

export default logger
