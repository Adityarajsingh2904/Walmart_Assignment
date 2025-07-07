import pino from 'pino'

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'ai-service' } })

export default logger
