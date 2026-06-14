const rateLimit = require('express-rate-limit')
const logger = require('../utils/logger')

const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded`, { ip: req.ip, url: req.originalUrl })
    res.status(429).json({ success: false, message: 'Too many requests — please slow down.' })
  },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded`, { ip: req.ip })
    res.status(429).json({ success: false, message: 'Too many auth attempts — try again in 15 minutes.' })
  },
})

module.exports = { rateLimiter, authLimiter }
