const cors = require('cors')

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean)

const mainDomain = process.env.CORS_MAIN_DOMAIN || ''

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.includes(origin)) return true
  if (mainDomain) {
    try {
      const host = new URL(origin).hostname
      if (host === mainDomain || host.endsWith('.' + mainDomain)) return true
    } catch { /* invalid URL */ }
  }
  return false
}

const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) callback(null, true)
    else callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Module-Key'],
})

module.exports = { corsMiddleware }
