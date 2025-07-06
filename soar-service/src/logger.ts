import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.simple(),
  transports: [new transports.Console({ silent: process.env.NODE_ENV === 'test' })],
});

export default logger;
