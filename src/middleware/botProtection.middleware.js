const logger = require('../utils/logger')

const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i, /curl/i, /wget/i,
  /python-requests/i, /go-http-client/i, /java\//i, /postmanruntime/i,
  /libwww/i, /lwp-trivial/i, /heritrix/i, /nutch/i,
]

// Honeypot — any request to this path is a bot
const HONEYPOT_PATH = '/api/verify-human-token-hidden'

function botProtection(req, res, next) {
  if (req.path === HONEYPOT_PATH) {
    logger.warn(`Honeypot triggered`, { ip: req.ip, ua: req.headers['user-agent'] })
    return res.status(403).json({ success: false, message: 'Access denied' })
  }

  const ua = req.headers['user-agent'] || ''
  if (!ua) {
    logger.warn(`Request with no User-Agent blocked`, { ip: req.ip, url: req.originalUrl })
    return res.status(403).json({ success: false, message: 'Access denied' })
  }

  if (BOT_UA_PATTERNS.some(p => p.test(ua))) {
    logger.warn(`Bot UA blocked`, { ip: req.ip, ua, url: req.originalUrl })
    return res.status(403).json({ success: false, message: 'Access denied' })
  }

  next()
}

module.exports = { botProtection }
