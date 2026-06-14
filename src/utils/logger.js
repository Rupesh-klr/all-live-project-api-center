const { createLogger, format, transports } = require('winston')
require('winston-daily-rotate-file')
const path = require('path')

const logDir = path.join(__dirname, '../../logs')

const fileRotateTransport = new transports.DailyRotateFile({
  dirname: logDir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '30d',
  zippedArchive: true,
  format: format.combine(format.timestamp(), format.json()),
})

const errorRotateTransport = new transports.DailyRotateFile({
  dirname: logDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '30d',
  format: format.combine(format.timestamp(), format.json()),
})

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    fileRotateTransport,
    errorRotateTransport,
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
          return `[${timestamp}] ${level}: ${message}${extra}`
        })
      ),
    }),
  ],
})

module.exports = logger
