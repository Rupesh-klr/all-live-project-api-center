const logger = require('../utils/logger')

const whitelistIps = (process.env.WHITELIST_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
const whitelistHosts = (process.env.WHITELIST_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean)
const mainDomain = process.env.CORS_MAIN_DOMAIN || ''

function accessControl(req, res, next) {
  // If no whitelist configured — allow all
  if (whitelistIps.length === 0 && whitelistHosts.length === 0) return next()

  const clientIp = req.ip || req.connection.remoteAddress || ''
  const origin = req.headers.origin || req.headers.referer || ''

  // IP check
  if (whitelistIps.length > 0 && whitelistIps.includes(clientIp)) return next()

  // Host check
  if (whitelistHosts.length > 0) {
    try {
      const host = origin ? new URL(origin).host : ''
      if (whitelistHosts.includes(host)) return next()
      // Subdomain of mainDomain
      if (mainDomain && (host === mainDomain || host.endsWith('.' + mainDomain))) return next()
    } catch { /* invalid URL */ }
  }

  logger.warn(`Access denied`, { ip: clientIp, origin, url: req.originalUrl })
  return res.status(403).json({ success: false, message: 'Access denied' })
}

module.exports = { accessControl }
